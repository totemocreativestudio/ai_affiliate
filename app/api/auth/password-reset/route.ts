import {createHash} from "crypto";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getServerSecret} from "../../../../lib/server-secrets";

export const runtime="nodejs";

const APP_ORIGIN="https://app.lumaway.online";
const SERVICE="auth_password_reset";

const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function sender(admin:any){
  const {data}=await admin.from("luma_platform_settings").select("setting_value").eq("setting_key","email_from").maybeSingle();
  return String(process.env.LUMA_EMAIL_FROM||data?.setting_value||"Lumaway <marketing@lumaway.online>").trim();
}

async function rateLimited(admin:any,emailHash:string,ipHash:string){
  const since=new Date(Date.now()-10*60*1000).toISOString();
  const {count}=await admin.from("luma_api_usage_events").select("id",{count:"exact",head:true}).eq("provider","resend").eq("service",SERVICE).gte("created_at",since).contains("metadata",{email_hash:emailHash});
  if((count||0)>=3)return true;
  const {count:ipCount}=await admin.from("luma_api_usage_events").select("id",{count:"exact",head:true}).eq("provider","resend").eq("service",SERVICE).gte("created_at",since).contains("metadata",{ip_hash:ipHash});
  return (ipCount||0)>=8;
}

async function audit(admin:any,status:string,emailHash:string,ipHash:string,reference?:string,error?:string){
  await admin.from("luma_api_usage_events").insert({
    provider:"resend",service:SERVICE,request_type:"recovery",status,reference:reference||null,
    metadata:{email_hash:emailHash,ip_hash:ipHash,...(error?{error:error.slice(0,180)}:{})}
  });
}

function htmlEmail(confirmUrl:string){
  return `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#101828">
  <div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e4e7ec;border-radius:18px;padding:32px">
    <div style="font-size:13px;font-weight:800;letter-spacing:.14em;color:#5266d8">LUMAWAY.</div>
    <h1 style="font-size:26px;margin:18px 0 8px">Reset password Lumaway</h1>
    <p style="line-height:1.65;color:#475467">Kami menerima permintaan untuk membuat password baru. Tekan tombol di bawah untuk melanjutkan. Link ini bersifat satu kali dan akan kedaluwarsa.</p>
    <p style="margin:28px 0"><a href="${confirmUrl}" style="display:inline-block;background:#111318;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:999px">Buat password baru</a></p>
    <p style="font-size:12px;line-height:1.6;color:#667085">Jika Anda tidak meminta reset password, abaikan email ini. Password lama tetap berlaku.</p>
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
  const email=String(body.email||"").trim().toLowerCase();
  if(!validEmail(email))return NextResponse.json({ok:false,error:"Email tidak valid."},{status:400});

  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const ip=String(req.headers.get("x-forwarded-for")||req.headers.get("x-real-ip")||"unknown").split(",")[0].trim();
  const emailHash=sha(email),ipHash=sha(ip||"unknown");
  if(await rateLimited(admin,emailHash,ipHash))return NextResponse.json({ok:false,error:"Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi."},{status:429});

  const resendKey=await getServerSecret(admin,"luma_resend_api_key");
  if(!resendKey)return NextResponse.json({ok:false,error:"Layanan email Lumaway belum terhubung."},{status:503});

  const {data,error}=await admin.auth.admin.generateLink({type:"recovery",email,options:{redirectTo:`${APP_ORIGIN}/auth/reset-password`}});
  if(error){
    const msg=String(error.message||"");
    await audit(admin,/not found|does not exist/i.test(msg)?"ignored":"error",emailHash,ipHash,undefined,msg);
    if(/not found|does not exist/i.test(msg))return NextResponse.json({ok:true,requested:true});
    return NextResponse.json({ok:false,error:"Link reset password belum dapat dibuat."},{status:400});
  }

  const props=(data as any)?.properties||{};
  let tokenHash=String(props.hashed_token||props.hashedToken||"").trim();
  if(!tokenHash){
    try{
      const action=new URL(String(props.action_link||props.actionLink||""));
      tokenHash=String(action.searchParams.get("token")||action.searchParams.get("token_hash")||"").trim();
    }catch{}
  }
  if(!tokenHash){
    await audit(admin,"error",emailHash,ipHash,undefined,"missing recovery token hash");
    return NextResponse.json({ok:false,error:"Token reset password belum dapat dibuat."},{status:500});
  }

  const confirmUrl=`${APP_ORIGIN}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json"},
    body:JSON.stringify({from:await sender(admin),to:[email],subject:"Reset password Lumaway",html:htmlEmail(confirmUrl)})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok){
    const msg=String(result?.message||result?.name||`Resend HTTP ${response.status}`);
    await audit(admin,"error",emailHash,ipHash,undefined,msg);
    return NextResponse.json({ok:false,error:"Email reset password belum dapat dikirim."},{status:502});
  }

  await audit(admin,"success",emailHash,ipHash,String(result?.id||""));
  return NextResponse.json({ok:true,requested:true});
}
