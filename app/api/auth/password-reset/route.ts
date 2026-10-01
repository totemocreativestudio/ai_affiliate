import {createHash,randomBytes,randomInt} from "crypto";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getServerSecret} from "../../../../lib/server-secrets";

export const runtime="nodejs";

const APP_ORIGIN="https://app.lumaway.online";
const SERVICE="auth_password_reset";
const CHANNEL="email_password_reset";

const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
const codeHash=(code:string,salt:string)=>sha(`${code}:${salt}`);
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function sender(admin:any){
  const {data}=await admin.from("luma_platform_settings").select("setting_value").eq("setting_key","email_from").maybeSingle();
  return String(process.env.LUMA_EMAIL_FROM||data?.setting_value||"Lumaway <marketing@lumaway.online>").trim();
}

async function rateLimited(admin:any,emailHash:string,ipHash:string){
  const since=new Date(Date.now()-10*60*1000).toISOString();
  const {count}=await admin.from("luma_api_usage_events").select("id",{count:"exact",head:true}).eq("provider","resend").eq("service",SERVICE).gte("created_at",since).contains("metadata",{email_hash:emailHash});
  if((count||0)>=5)return true;
  const {count:ipCount}=await admin.from("luma_api_usage_events").select("id",{count:"exact",head:true}).eq("provider","resend").eq("service",SERVICE).gte("created_at",since).contains("metadata",{ip_hash:ipHash});
  return (ipCount||0)>=12;
}

async function audit(admin:any,status:string,emailHash:string,ipHash:string,requestType:string,reference?:string,error?:string){
  await admin.from("luma_api_usage_events").insert({
    provider:"resend",service:SERVICE,request_type:requestType,status,reference:reference||null,
    metadata:{email_hash:emailHash,ip_hash:ipHash,...(error?{error:error.slice(0,180)}:{})}
  });
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

function htmlEmail(confirmUrl:string,code:string){
  return `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#101828">
  <div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e4e7ec;border-radius:18px;padding:32px">
    <div style="font-size:13px;font-weight:800;letter-spacing:.14em;color:#5266d8">LUMAWAY.</div>
    <h1 style="font-size:26px;margin:18px 0 8px">Reset password Lumaway</h1>
    <p style="line-height:1.65;color:#475467">Masukkan kode berikut pada halaman Lumaway. Kode berlaku 10 menit.</p>
    <div style="margin:24px 0;padding:18px;text-align:center;border-radius:14px;background:#f4f3ff;font-size:32px;letter-spacing:.22em;font-weight:800;color:#4338ca">${code}</div>
    <p style="line-height:1.65;color:#475467">Atau gunakan link aman berikut sebagai alternatif:</p>
    <p style="margin:22px 0"><a href="${confirmUrl}" style="display:inline-block;background:#111318;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:999px">Buat password baru</a></p>
    <p style="font-size:12px;line-height:1.6;color:#667085">Jika Anda tidak meminta reset password, abaikan email ini. Jangan bagikan kode kepada siapa pun.</p>
    <hr style="border:0;border-top:1px solid #eaecf0;margin:28px 0"/>
    <p style="font-size:11px;color:#98a2b3">Lumaway · Light Up Your Potential.</p>
  </div></body></html>`;
}

export async function POST(req:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)return NextResponse.json({ok:false,error:"Konfigurasi server Auth belum lengkap."},{status:503});

  let body:any={};try{body=await req.json()}catch{}
  const action=String(body.action||"request").toLowerCase();
  const email=String(body.email||"").trim().toLowerCase();
  if(!validEmail(email))return NextResponse.json({ok:false,error:"Email tidak valid."},{status:400});

  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const ip=String(req.headers.get("x-forwarded-for")||req.headers.get("x-real-ip")||"unknown").split(",")[0].trim();
  const emailHash=sha(email),ipHash=sha(ip||"unknown");

  if(action==="verify"){
    const otp=String(body.otp||"").trim();
    if(!/^\d{6}$/.test(otp))return NextResponse.json({ok:false,error:"Kode reset harus 6 digit."},{status:400});

    const {data:challenge}=await admin.from("luma_otp_challenges").select("*").eq("channel",CHANNEL).eq("target",email).is("used_at",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(!challenge||new Date(challenge.expires_at).getTime()<Date.now()||Number(challenge.attempts||0)>=5){
      await audit(admin,"denied",emailHash,ipHash,"verify");
      return NextResponse.json({ok:false,error:"Kode reset tidak valid atau sudah kedaluwarsa."},{status:400});
    }

    const valid=codeHash(otp,String(challenge.salt||""))===challenge.code_hash;
    await admin.from("luma_otp_challenges").update({attempts:Number(challenge.attempts||0)+1,used_at:valid?new Date().toISOString():null}).eq("id",challenge.id);
    if(!valid){
      await audit(admin,"denied",emailHash,ipHash,"verify");
      return NextResponse.json({ok:false,error:"Kode reset tidak valid atau sudah kedaluwarsa."},{status:400});
    }

    const {data,error}=await admin.auth.admin.generateLink({type:"recovery",email,options:{redirectTo:`${APP_ORIGIN}/auth/reset-password`}});
    const tokenHash=error?"":tokenHashFromLink(data);
    if(error||!tokenHash){
      await audit(admin,"error",emailHash,ipHash,"verify",undefined,String(error?.message||"missing recovery token"));
      return NextResponse.json({ok:false,error:"Sesi reset password belum dapat dibuat. Minta kode baru lalu coba lagi."},{status:500});
    }

    await audit(admin,"success",emailHash,ipHash,"verify");
    return NextResponse.json({ok:true,token_hash:tokenHash});
  }

  if(await rateLimited(admin,emailHash,ipHash))return NextResponse.json({ok:false,error:"Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi."},{status:429});

  const {data:profile}=await admin.from("profiles").select("id,email,active").ilike("email",email).eq("active",true).limit(1).maybeSingle();
  if(!profile?.id){
    await audit(admin,"ignored",emailHash,ipHash,"request");
    return NextResponse.json({ok:true,requested:true,expires_in:600});
  }

  const resendKey=await getServerSecret(admin,"luma_resend_api_key");
  if(!resendKey)return NextResponse.json({ok:false,error:"Layanan email Lumaway belum terhubung."},{status:503});

  const code=String(randomInt(100000,1000000));
  const salt=randomBytes(16).toString("hex");

  await admin.from("luma_otp_challenges").delete().eq("user_id",profile.id).eq("channel",CHANNEL).is("used_at",null);
  const {error:challengeError}=await admin.from("luma_otp_challenges").insert({
    user_id:profile.id,channel:CHANNEL,target:email,code_hash:codeHash(code,salt),salt,
    expires_at:new Date(Date.now()+10*60*1000).toISOString()
  });
  if(challengeError){
    await audit(admin,"error",emailHash,ipHash,"request",undefined,challengeError.message);
    return NextResponse.json({ok:false,error:"Kode reset belum dapat disiapkan."},{status:500});
  }

  const {data,error}=await admin.auth.admin.generateLink({type:"recovery",email,options:{redirectTo:`${APP_ORIGIN}/auth/reset-password`}});
  const tokenHash=error?"":tokenHashFromLink(data);
  if(error||!tokenHash){
    await audit(admin,"error",emailHash,ipHash,"request",undefined,String(error?.message||"missing recovery token"));
    return NextResponse.json({ok:false,error:"Link reset password belum dapat dibuat."},{status:400});
  }

  const confirmUrl=`${APP_ORIGIN}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json"},
    body:JSON.stringify({from:await sender(admin),to:[email],subject:"Kode reset password Lumaway",html:htmlEmail(confirmUrl,code)})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok){
    const msg=String(result?.message||result?.name||`Resend HTTP ${response.status}`);
    await audit(admin,"error",emailHash,ipHash,"request",undefined,msg);
    return NextResponse.json({ok:false,error:"Email reset password belum dapat dikirim."},{status:502});
  }

  await audit(admin,"success",emailHash,ipHash,"request",String(result?.id||""));
  return NextResponse.json({ok:true,requested:true,expires_in:600,mode:"code_link"});
}
