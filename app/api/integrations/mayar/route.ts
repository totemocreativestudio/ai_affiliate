import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecretSource, hasServerSecret } from "../../../../lib/server-secrets";

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
    const apiKey=String(body.api_key||"").trim();
    const webhookToken=String(body.webhook_token||"").trim();
    const ctx=await getServerContext(workspaceId);
    if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Hanya platform admin yang dapat mengubah Mayar.id credential."},{status:403});
    if(!apiKey||apiKey.length<10)return NextResponse.json({ok:false,error:"Token API Mayar.id tidak valid."},{status:400});
    const saves=[
      ctx.admin.rpc("luma_set_server_secret",{p_name:API_KEY,p_secret:apiKey,p_description:"Lumaway Mayar.id API token"}),
    ];
    if(webhookToken)saves.push(ctx.admin.rpc("luma_set_server_secret",{p_name:WEBHOOK_TOKEN,p_secret:webhookToken,p_description:"Lumaway Mayar.id webhook verification token"}));
    const results=await Promise.all(saves);
    const err=results.find(x=>x.error)?.error;if(err)throw err;
    return NextResponse.json({ok:true,configured:true,webhook_configured:Boolean(webhookToken)});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Unable to save Mayar.id credential."},{status:400});
  }
}
