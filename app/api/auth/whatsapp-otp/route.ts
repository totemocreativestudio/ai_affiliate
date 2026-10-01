import {createHash,randomBytes,randomInt} from "crypto";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {sendWhatsAppOtpWithFailover} from "../../../../lib/whatsapp-router";
import {getServerSecret} from "../../../../lib/server-secrets";

export const runtime="nodejs";

const SERVICE="auth_whatsapp_otp";
const normalizePhone=(input:string)=>{
  let value=String(input||"").replace(/[^0-9+]/g,"");
  if(value.startsWith("08"))value="+62"+value.slice(1);
  else if(value.startsWith("62"))value="+"+value;
  else if(value&&!value.startsWith("+"))value="+"+value;
  return value;
};
const phoneVariants=(phone:string)=>{
  const normalized=normalizePhone(phone);
  const digits=normalized.replace(/\D/g,"");
  const local=digits.startsWith("62")?"0"+digits.slice(2):digits;
  return [...new Set([normalized,digits,local])];
};
const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
const codeHash=(code:string,salt:string)=>sha(`${code}:${salt}`);

async function rateLimited(admin:any,phoneHash:string,ipHash:string){
  const since=new Date(Date.now()-10*60*1000).toISOString();
  const {count}=await admin.from("luma_api_usage_events").select("id",{count:"exact",head:true}).eq("service",SERVICE).gte("created_at",since).contains("metadata",{phone_hash:phoneHash});
  if((count||0)>=5)return true;
  const {count:ipCount}=await admin.from("luma_api_usage_events").select("id",{count:"exact",head:true}).eq("service",SERVICE).gte("created_at",since).contains("metadata",{ip_hash:ipHash});
  return (ipCount||0)>=12;
}

async function audit(admin:any,status:string,requestType:string,phoneHash:string,ipHash:string,reference?:string,error?:string){
  await admin.from("luma_api_usage_events").insert({
    provider:"whatsapp",service:SERVICE,request_type:requestType,status,reference:reference||null,
    metadata:{phone_hash:phoneHash,ip_hash:ipHash,...(error?{error:error.slice(0,180)}:{})}
  });
}

async function profileForPhone(admin:any,phone:string){
  const variants=phoneVariants(phone);
  const {data:byPhone}=await admin.from("profiles").select("id,email,active,phone,whatsapp").in("phone",variants).eq("active",true).limit(1).maybeSingle();
  if(byPhone)return byPhone;
  const {data:byWhatsapp}=await admin.from("profiles").select("id,email,active,phone,whatsapp").in("whatsapp",variants).eq("active",true).limit(1).maybeSingle();
  return byWhatsapp||null;
}

function tokenHashFromLink(data:any){
  const props=data?.properties||{};
  let tokenHash=String(props.hashed_token||props.hashedToken||"").trim();
  if(tokenHash)return tokenHash;
  try{
    const action=new URL(String(props.action_link||props.actionLink||""));
    return String(action.searchParams.get("token")||action.searchParams.get("token_hash")||"").trim();
  }catch{return ""}
}

async function sendEmailFallback(admin:any,email:string,code:string){
  const key=await getServerSecret(admin,"luma_resend_api_key");
  if(!key)return false;
  const {data}=await admin.from("luma_platform_settings").select("setting_value").eq("setting_key","email_from").maybeSingle();
  const from=String(process.env.LUMA_EMAIL_FROM||data?.setting_value||"Lumaway <marketing@lumaway.online>").trim();
  const html=`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px"><div style="font-size:12px;font-weight:800;color:#5266d8">LUMAWAY.</div><h2>Kode login Lumaway</h2><p>Provider WhatsApp sedang tidak tersedia. Gunakan kode berikut untuk melanjutkan login. Kode berlaku 5 menit.</p><div style="font-size:30px;letter-spacing:.22em;font-weight:800;padding:18px;background:#f4f3ff;border-radius:12px;text-align:center">${code}</div><p style="font-size:12px;color:#667085">Jangan bagikan kode ini kepada siapa pun.</p></div>`;
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[email],subject:"Kode login Lumaway",html})});
  return r.ok;
}

export async function POST(req:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)return NextResponse.json({ok:false,error:"Konfigurasi server Auth belum lengkap."},{status:503});

  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  let body:any={};try{body=await req.json()}catch{}
  const action=String(body.action||"request").toLowerCase();
  const phone=normalizePhone(String(body.phone||""));
  if(!/^\+[1-9][0-9]{8,14}$/.test(phone))return NextResponse.json({ok:false,error:"Nomor WhatsApp tidak valid."},{status:400});

  const ip=String(req.headers.get("x-forwarded-for")||req.headers.get("x-real-ip")||"unknown").split(",")[0].trim();
  const phoneHash=sha(phone),ipHash=sha(ip||"unknown");
  if(await rateLimited(admin,phoneHash,ipHash))return NextResponse.json({ok:false,error:"Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi."},{status:429});

  if(action==="request"){
    const profile=await profileForPhone(admin,phone);
    if(!profile?.id||!profile?.email){
      await audit(admin,"ignored","request",phoneHash,ipHash);
      return NextResponse.json({ok:true,requested:true});
    }

    const code=String(randomInt(100000,1000000));
    const salt=randomBytes(16).toString("hex");
    await admin.from("luma_otp_challenges").delete().eq("user_id",profile.id).eq("channel","whatsapp_login").is("used_at",null);
    const {error:dbError}=await admin.from("luma_otp_challenges").insert({
      user_id:profile.id,channel:"whatsapp_login",target:phone,code_hash:codeHash(code,salt),salt,
      expires_at:new Date(Date.now()+5*60*1000).toISOString()
    });
    if(dbError)return NextResponse.json({ok:false,error:"OTP belum dapat disiapkan."},{status:500});

    try{
      const sent=await sendWhatsAppOtpWithFailover(admin,phone,code);
      await audit(admin,"success","request",phoneHash,ipHash,String(sent.reference||""));
      return NextResponse.json({ok:true,requested:true,expires_in:300,channel:"whatsapp",provider:sent.provider});
    }catch(error:any){
      const fallback=await sendEmailFallback(admin,String(profile.email),code).catch(()=>false);
      if(fallback){
        await audit(admin,"fallback_email","request",phoneHash,ipHash,undefined,String(error?.message||"whatsapp provider unavailable"));
        return NextResponse.json({ok:true,requested:true,expires_in:300,channel:"email_fallback"});
      }
      await audit(admin,"error","request",phoneHash,ipHash,undefined,String(error?.message||"unknown"));
      return NextResponse.json({ok:false,error:"Kode login belum dapat dikirim melalui WhatsApp maupun email akun. Coba lagi beberapa saat."},{status:502});
    }
  }

  if(action==="verify"){
    const otp=String(body.otp||"").trim();
    if(!/^\d{6}$/.test(otp))return NextResponse.json({ok:false,error:"OTP harus 6 digit."},{status:400});

    const {data:challenge}=await admin.from("luma_otp_challenges").select("*").eq("channel","whatsapp_login").eq("target",phone).is("used_at",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(!challenge||new Date(challenge.expires_at).getTime()<Date.now()||Number(challenge.attempts||0)>=5){
      await audit(admin,"denied","verify",phoneHash,ipHash);
      return NextResponse.json({ok:false,error:"Kode OTP tidak valid atau sudah kedaluwarsa."},{status:400});
    }

    const valid=codeHash(otp,String(challenge.salt||""))===challenge.code_hash;
    await admin.from("luma_otp_challenges").update({attempts:Number(challenge.attempts||0)+1,used_at:valid?new Date().toISOString():null}).eq("id",challenge.id);
    if(!valid){
      await audit(admin,"denied","verify",phoneHash,ipHash);
      return NextResponse.json({ok:false,error:"Kode OTP tidak valid atau sudah kedaluwarsa."},{status:400});
    }

    const {data:profile}=await admin.from("profiles").select("email,active").eq("id",challenge.user_id).eq("active",true).maybeSingle();
    if(!profile?.email){
      await audit(admin,"denied","verify",phoneHash,ipHash);
      return NextResponse.json({ok:false,error:"Akun Lumaway tidak dapat digunakan."},{status:400});
    }

    const {data,error}=await admin.auth.admin.generateLink({type:"magiclink",email:String(profile.email)});
    const tokenHash=error?"":tokenHashFromLink(data);
    if(error||!tokenHash){
      await audit(admin,"error","verify",phoneHash,ipHash,undefined,String(error?.message||"missing token"));
      return NextResponse.json({ok:false,error:"Sesi login belum dapat dibuat. Coba lagi."},{status:500});
    }

    await audit(admin,"success","verify",phoneHash,ipHash);
    return NextResponse.json({ok:true,token_hash:tokenHash});
  }

  return NextResponse.json({ok:false,error:"Permintaan tidak valid."},{status:400});
}
