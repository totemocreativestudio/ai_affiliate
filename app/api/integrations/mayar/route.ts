import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret, getServerSecretSource, hasServerSecret } from "../../../../lib/server-secrets";

export const runtime = "nodejs";
const API_KEY = "luma_mayar_api_key";
const WEBHOOK_TOKEN = "luma_mayar_webhook_token";

export async function GET(req:NextRequest){
  try{
    const workspaceId=new URL(req.url).searchParams.get("workspace_id")||"";
    const ctx=await getServerContext(workspaceId);
    const [apiConfigured,webhookConfigured]=await Promise.all([
      hasServerSecret(ctx.admin,API_KEY),
      hasServerSecret(ctx.admin,WEBHOOK_TOKEN),
    ]);
    return NextResponse.json({
      ok:true,
      configured:apiConfigured,
      webhook_configured:webhookConfigured,
      source:apiConfigured?getServerSecretSource(API_KEY):"none",
      can_configure:ctx.platformAdmin,
      env_names:{api_key:"API_Key_Mayar_ID",webhook_token:"Webhook_Token_Mayar_ID"},
    });
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Unable to read Mayar integration status."},{status:400});
  }
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const workspaceId=String(body.workspace_id||"");
    const action=String(body.action||"save");
    const apiKey=String(body.api_key||"").trim();
    const webhookToken=String(body.webhook_token||"").trim();
    const ctx=await getServerContext(workspaceId);
    if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Hanya platform admin yang dapat mengubah Mayar.id credential."},{status:403});
    if(action==="register_webhook"){
      const [savedKey,savedToken]=await Promise.all([
        getServerSecret(ctx.admin,API_KEY),
        getServerSecret(ctx.admin,WEBHOOK_TOKEN)
      ]);
      if(!savedKey||!savedToken)return NextResponse.json({ok:false,error:"Token API dan Webhook Mayar.id harus tersedia sebelum registrasi webhook."},{status:400});
      const origin=String(process.env.NEXT_PUBLIC_APP_URL||new URL(req.url).origin).replace(/\/$/,"");
      const hookUrl=`${origin}/api/payments/webhook/mayar?token=${encodeURIComponent(savedToken)}`;
      const response=await fetch("https://api.mayar.id/hl/v2/webhooks/update",{method:"POST",headers:{Authorization:`Bearer ${savedKey}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({urlHook:hookUrl})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||Number(result?.statusCode||response.status)>=400)throw new Error(result?.messages||"Registrasi webhook Mayar.id gagal.");
      return NextResponse.json({ok:true,registered:true,webhook_url:hookUrl});
    }
    if(!apiKey||apiKey.length<10)return NextResponse.json({ok:false,error:"Token API Mayar.id tidak valid."},{status:400});
    const saves=[
      ctx.admin.rpc("luma_set_server_secret",{p_name:API_KEY,p_secret:apiKey,p_description:"Lumaway Mayar.id API token"}),
    ];
    if(webhookToken)saves.push(ctx.admin.rpc("luma_set_server_secret",{p_name:WEBHOOK_TOKEN,p_secret:webhookToken,p_description:"Lumaway Mayar.id webhook verification token"}));
    const results=await Promise.all(saves);
    const err=results.find(x=>x.error)?.error;if(err)throw err;
    let webhookRegistered=false;
    if(webhookToken){
      try{
        const origin=String(process.env.NEXT_PUBLIC_APP_URL||new URL(req.url).origin).replace(/\/$/,"");
        const hookUrl=`${origin}/api/payments/webhook/mayar?token=${encodeURIComponent(webhookToken)}`;
        const response=await fetch("https://api.mayar.id/hl/v2/webhooks/update",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({urlHook:hookUrl})});
        webhookRegistered=response.ok;
      }catch{}
    }
    return NextResponse.json({ok:true,configured:true,webhook_configured:Boolean(webhookToken),webhook_registered:webhookRegistered});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Unable to save Mayar.id credential."},{status:400});
  }
}
