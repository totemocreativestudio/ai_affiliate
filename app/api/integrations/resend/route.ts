import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";
import {getServerSecret,getServerSecretSource,hasServerSecret} from "../../../../lib/server-secrets";

export const runtime="nodejs";
const SECRET_NAME="luma_resend_api_key";
const SMTP={host:"smtp.resend.com",port:465,user:"resend",security:"SSL/TLS"};

function validFrom(value:string){
  const match=value.match(/<([^>]+)>/)?.[1]||value;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(match.trim());
}

async function currentFrom(admin:any){
  const {data}=await admin.from("luma_platform_settings").select("setting_value").eq("setting_key","email_from").maybeSingle();
  return String(process.env.LUMA_EMAIL_FROM||data?.setting_value||"Lumaway <marketing@lumaway.online>").trim();
}

async function currentKeyLast4(admin:any){
  const {data}=await admin.from("luma_platform_settings").select("setting_value").eq("setting_key","email_resend_key_last4").maybeSingle();
  return String(data?.setting_value||"").trim().slice(-4);
}

export async function GET(req:NextRequest){
  try{
    const workspaceId=new URL(req.url).searchParams.get("workspace_id")||"";
    const ctx=await getServerContext(workspaceId);
    if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Owner access required."},{status:403});
    const configured=await hasServerSecret(ctx.admin,SECRET_NAME);
    const from=await currentFrom(ctx.admin);
    const keyLast4=configured?await currentKeyLast4(ctx.admin):"";
    return NextResponse.json({
      ok:true,
      configured,
      source:configured?getServerSecretSource(SECRET_NAME):"none",
      key_last4:keyLast4,
      masked_key:configured?`re_••••••••••${keyLast4||"••••"}`:"",
      from_address:from,
      smtp_host:SMTP.host,
      smtp_port:SMTP.port,
      smtp_user:SMTP.user,
      smtp_security:SMTP.security,
      can_configure:true
    });
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Unable to read Resend integration."},{status:400});
  }
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const workspaceId=String(body.workspace_id||"");
    const action=String(body.action||"save");
    const ctx=await getServerContext(workspaceId);
    if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Hanya platform admin yang dapat mengubah Resend API key."},{status:403});

    if(action==="test"){
      const key=await getServerSecret(ctx.admin,SECRET_NAME);
      const from=await currentFrom(ctx.admin);
      const to=String(ctx.user?.email||"").trim();
      if(!key)return NextResponse.json({ok:false,error:"Resend API key belum tersedia."},{status:400});
      if(!validFrom(from))return NextResponse.json({ok:false,error:"Sender email belum valid."},{status:400});
      if(!to||!validFrom(to))return NextResponse.json({ok:false,error:"Email owner tidak tersedia untuk test."},{status:400});

      const response=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
        body:JSON.stringify({
          from,
          to:[to],
          subject:"Lumaway · Resend Connection Test",
          html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#101828"><h2>Resend berhasil terhubung</h2><p>Email ini dikirim dari Lumaway untuk memverifikasi API key, sender domain, dan koneksi transactional email.</p><p style="font-size:12px;color:#667085">SMTP secure transport: smtp.resend.com:465 · SSL/TLS.</p></div>`
        })
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        const msg=String(data?.message||data?.name||`Resend HTTP ${response.status}`);
        await ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:ctx.user.id,provider:"resend",service:"transactional_notice",request_type:"integration_test",status:"error",metadata:{error:msg.slice(0,180)}});
        return NextResponse.json({ok:false,error:msg},{status:502});
      }
      await ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:ctx.user.id,provider:"resend",service:"transactional_notice",request_type:"integration_test",status:"success",reference:String(data?.id||""),metadata:{smtp_ssl:true}});
      return NextResponse.json({ok:true,test_to:to,provider_message_id:data?.id||null});
    }

    const apiKey=String(body.api_key||"").trim();
    const from=String(body.from_address||"").trim()||"Lumaway <marketing@lumaway.online>";
    if(!apiKey||apiKey.length<20||!apiKey.startsWith("re_"))return NextResponse.json({ok:false,error:"Resend API key tidak valid. Gunakan key yang diawali re_."},{status:400});
    if(!validFrom(from))return NextResponse.json({ok:false,error:"Sender email tidak valid."},{status:400});

    const {error}=await ctx.admin.rpc("luma_set_server_secret",{p_name:SECRET_NAME,p_secret:apiKey,p_description:"Lumaway Resend API key"});
    if(error)throw error;

    const settings=[
      ["email_provider","resend"],
      ["email_from",from],
      ["email_resend_key_last4",apiKey.slice(-4)],
      ["email_smtp_host",SMTP.host],
      ["email_smtp_port",String(SMTP.port)],
      ["email_smtp_user",SMTP.user],
      ["email_smtp_security","ssl"]
    ].map(([setting_key,setting_value])=>({setting_key,setting_value,updated_at:new Date().toISOString(),updated_by:ctx.user.id}));
    const {error:settingsError}=await ctx.admin.from("luma_platform_settings").upsert(settings,{onConflict:"setting_key"});
    if(settingsError)throw settingsError;

    return NextResponse.json({
      ok:true,
      configured:true,
      source:"secure-vault",
      key_last4:apiKey.slice(-4),
      masked_key:`re_••••••••••${apiKey.slice(-4)}`,
      from_address:from,
      smtp_host:SMTP.host,
      smtp_port:SMTP.port,
      smtp_user:SMTP.user,
      smtp_security:SMTP.security,
      can_configure:true
    });
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Unable to save Resend integration."},{status:400});
  }
}
