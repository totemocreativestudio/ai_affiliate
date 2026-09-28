import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {createHash} from "crypto";
import {getServerSecret} from "../../../../lib/server-secrets";

export const runtime="nodejs";

const APP_ORIGIN="https://app.lumaway.online";
const SERVICE="auth_verification";

function sha(value:string){
  return createHash("sha256").update(value).digest("hex");
}

function validEmail(value:string){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sender(admin:any){
  const {data}=await admin.from("luma_platform_settings")
    .select("setting_value")
    .eq("setting_key","email_from")
    .maybeSingle();
  return String(process.env.LUMA_EMAIL_FROM||data?.setting_value||"Lumaway <marketing@lumaway.online>").trim();
}

function verificationFromGenerateLink(data:any){
  const props=data?.properties||{};
  const action=String(props.action_link||props.actionLink||"").trim();
  let tokenHash=String(props.hashed_token||props.hashedToken||"").trim();
  let type=String(props.verification_type||props.verificationType||"").trim();
  if(action){
    try{
      const u=new URL(action);
      if(!tokenHash)tokenHash=String(u.searchParams.get("token")||u.searchParams.get("token_hash")||"").trim();
      if(!type)type=String(u.searchParams.get("type")||"").trim();
    }catch{}
  }
  return {tokenHash,type:type||"email"};
}

async function rateLimited(admin:any,emailHash:string,ipHash:string){
  const since=new Date(Date.now()-10*60*1000).toISOString();
  const {count}=await admin.from("luma_api_usage_events")
    .select("id",{count:"exact",head:true})
    .eq("provider","resend")
    .eq("service",SERVICE)
    .gte("created_at",since)
    .contains("metadata",{email_hash:emailHash});
  if((count||0)>=3)return true;
  const {count:ipCount}=await admin.from("luma_api_usage_events")
    .select("id",{count:"exact",head:true})
    .eq("provider","resend")
    .eq("service",SERVICE)
    .gte("created_at",since)
    .contains("metadata",{ip_hash:ipHash});
  return (ipCount||0)>=8;
}

async function audit(admin:any,status:string,action:string,emailHash:string,ipHash:string,reference?:string,error?:string){
  await admin.from("luma_api_usage_events").insert({
    provider:"resend",
    service:SERVICE,
    request_type:action,
    status,
    reference:reference||null,
    metadata:{email_hash:emailHash,ip_hash:ipHash,...(error?{error:error.slice(0,180)}:{})}
  });
}

function htmlEmail(confirmUrl:string){
  return `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#101828">
  <div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e4e7ec;border-radius:18px;padding:32px">
    <div style="font-size:13px;font-weight:800;letter-spacing:.14em;color:#635bff">LUMAWAY.</div>
    <h1 style="font-size:26px;margin:18px 0 8px">Konfirmasi email Lumaway</h1>
    <p style="line-height:1.65;color:#475467">Selesaikan verifikasi email untuk mengaktifkan akses Lumaway. Tombol ini membuka halaman konfirmasi Lumaway terlebih dahulu agar link satu kali tidak otomatis terpakai oleh email security scanner.</p>
    <p style="margin:28px 0"><a href="${confirmUrl}" style="display:inline-block;background:#635bff;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px">Konfirmasi email saya</a></p>
    <p style="font-size:12px;line-height:1.6;color:#667085">Jika Anda tidak membuat akun Lumaway, abaikan email ini.</p>
    <hr style="border:0;border-top:1px solid #eaecf0;margin:28px 0"/>
    <p style="font-size:11px;color:#98a2b3">Lumaway · Light Up Your Potential.</p>
  </div></body></html>`;
}

export async function POST(req:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)return NextResponse.json({ok:false,error:"Konfigurasi server Auth belum lengkap."},{status:503});

  let body:any={};
  try{body=await req.json()}catch{}
  const action=String(body.action||"resend").toLowerCase();
  const email=String(body.email||"").trim().toLowerCase();
  const password=String(body.password||"");
  if(!validEmail(email))return NextResponse.json({ok:false,error:"Email tidak valid."},{status:400});
  if(action==="signup"&&password.length<8)return NextResponse.json({ok:false,error:"Password minimal 8 karakter."},{status:400});
  if(!["signup","resend"].includes(action))return NextResponse.json({ok:false,error:"Permintaan tidak valid."},{status:400});

  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const ip=String(req.headers.get("x-forwarded-for")||req.headers.get("x-real-ip")||"unknown").split(",")[0].trim();
  const emailHash=sha(email);
  const ipHash=sha(ip||"unknown");

  if(await rateLimited(admin,emailHash,ipHash)){
    return NextResponse.json({ok:false,error:"Terlalu banyak permintaan verifikasi. Tunggu beberapa menit lalu coba lagi."},{status:429});
  }

  const resendKey=await getServerSecret(admin,"luma_resend_api_key");
  if(!resendKey)return NextResponse.json({ok:false,error:"Layanan email Lumaway belum terhubung."},{status:503});

  let linkData:any=null;
  let linkError:any=null;
  if(action==="signup"){
    const result=await admin.auth.admin.generateLink({type:"signup",email,password});
    linkData=result.data;linkError=result.error;
  }else{
    const result=await admin.auth.admin.generateLink({type:"magiclink",email});
    linkData=result.data;linkError=result.error;
  }

  if(linkError){
    const msg=String(linkError.message||"");
    const known=/(already|registered|not found|does not exist)/i.test(msg);
    await audit(admin,known?"ignored":"error",action,emailHash,ipHash,undefined,msg);
    if(known)return NextResponse.json({ok:true,requested:true});
    return NextResponse.json({ok:false,error:"Email verifikasi belum dapat dibuat. Coba beberapa saat lagi."},{status:400});
  }

  const {tokenHash,type}=verificationFromGenerateLink(linkData);
  if(!tokenHash){
    await audit(admin,"error",action,emailHash,ipHash,undefined,"missing token hash");
    return NextResponse.json({ok:false,error:"Token verifikasi belum dapat dibuat."},{status:500});
  }

  const confirmUrl=`${APP_ORIGIN}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`;
  const from=await sender(admin);
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      from,
      to:[email],
      subject:"Konfirmasi email Lumaway",
      html:htmlEmail(confirmUrl)
    })
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok){
    const msg=String(result?.message||result?.name||`Resend HTTP ${response.status}`);
    await audit(admin,"error",action,emailHash,ipHash,undefined,msg);
    return NextResponse.json({ok:false,error:"Email verifikasi belum dapat dikirim. Coba beberapa saat lagi."},{status:502});
  }

  await audit(admin,"success",action,emailHash,ipHash,String(result?.id||""));
  return NextResponse.json({ok:true,requested:true});
}
