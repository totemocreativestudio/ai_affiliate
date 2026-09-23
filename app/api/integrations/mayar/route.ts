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
    const [apiConfigured,webhookConfigured,{data:providerState}]=await Promise.all([
      hasServerSecret(ctx.admin,API_KEY),
      hasServerSecret(ctx.admin,WEBHOOK_TOKEN),
      ctx.admin.from("luma_payment_provider_settings").select("enabled,priority,health_status,last_success_at,last_error_at,last_error,webhook_registered_at").eq("provider","mayar").maybeSingle(),
    ]);
    return NextResponse.json({
      ok:true,
      configured:apiConfigured,
      webhook_configured:webhookConfigured,
      webhook_registered:Boolean(providerState?.webhook_registered_at),
      webhook_registered_at:providerState?.webhook_registered_at||null,
      health_status:providerState?.health_status||"unknown",
      last_success_at:providerState?.last_success_at||null,
      last_error_at:providerState?.last_error_at||null,
      last_error:providerState?.last_error||null,
      enabled:providerState?.enabled!==false,
      priority:Number(providerState?.priority||10),
      source:apiConfigured?getServerSecretSource(API_KEY):"none",
      webhook_source:webhookConfigured?getServerSecretSource(WEBHOOK_TOKEN):"none",
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
    if(action==="production_check"){
      const [savedKey,savedToken]=await Promise.all([
        getServerSecret(ctx.admin,API_KEY),
        getServerSecret(ctx.admin,WEBHOOK_TOKEN)
      ]);
      if(!savedKey||!savedToken)return NextResponse.json({ok:false,error:"Token API dan Webhook Mayar.id belum lengkap."},{status:400});

      const checkResponse=await fetch("https://api.mayar.id/hl/v2/invoices?limit=1",{method:"GET",headers:{Authorization:`Bearer ${savedKey}`,Accept:"application/json"},cache:"no-store"});
      const checkBody=await checkResponse.json().catch(()=>({}));
      if(!checkResponse.ok||Number(checkBody?.statusCode||checkResponse.status)>=400){
        const msg=String(checkBody?.messages||checkBody?.message||"Token API Mayar.id ditolak.");
        await ctx.admin.rpc("luma_payment_provider_health",{p_provider:"mayar",p_ok:false,p_error:msg});
        return NextResponse.json({ok:false,error:msg,stage:"api"},{status:502});
      }

      const origin=String(process.env.NEXT_PUBLIC_APP_URL||new URL(req.url).origin).replace(/\/$/,"");
      if(!origin.startsWith("https://"))return NextResponse.json({ok:false,error:"NEXT_PUBLIC_APP_URL production harus HTTPS.",stage:"app_url"},{status:500});
      const hookUrl=`${origin}/api/payments/webhook/mayar?token=${encodeURIComponent(savedToken)}`;
      const hookResponse=await fetch("https://api.mayar.id/hl/v2/webhooks/update",{method:"POST",headers:{Authorization:`Bearer ${savedKey}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({urlHook:hookUrl})});
      const hookBody=await hookResponse.json().catch(()=>({}));
      if(!hookResponse.ok||Number(hookBody?.statusCode||hookResponse.status)>=400){
        const msg=String(hookBody?.messages||hookBody?.message||"Registrasi webhook Mayar.id gagal.");
        await ctx.admin.rpc("luma_payment_provider_health",{p_provider:"mayar",p_ok:false,p_error:msg});
        return NextResponse.json({ok:false,error:msg,stage:"webhook"},{status:502});
      }

      const now=new Date().toISOString();
      await Promise.all([
        ctx.admin.from("luma_payment_provider_settings").update({webhook_registered_at:now,health_status:"healthy",last_success_at:now,last_error:null,updated_at:now}).eq("provider","mayar"),
        ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:ctx.user.id,provider:"mayar",service:"production_check",request_type:"payment_gateway_health",status:"success",reference:"PR36-MAYAR",metadata:{api:true,webhook:true}})
      ]);
      return NextResponse.json({
        ok:true,
        ready:true,
        api_connected:true,
        webhook_registered:true,
        health_status:"healthy",
        checked_at:now,
        source:getServerSecretSource(API_KEY),
        webhook_source:getServerSecretSource(WEBHOOK_TOKEN)
      });
    }
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
      await ctx.admin.from("luma_payment_provider_settings").update({webhook_registered_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("provider","mayar");
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
        if(webhookRegistered)await ctx.admin.from("luma_payment_provider_settings").update({webhook_registered_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("provider","mayar");
      }catch{}
    }
    return NextResponse.json({ok:true,configured:true,webhook_configured:Boolean(webhookToken),webhook_registered:webhookRegistered});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Unable to save Mayar.id credential."},{status:400});
  }
}
