import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { hasServerSecret } from "../../../../lib/server-secrets";

export const runtime="nodejs";
const SECRET_NAME="luma_whatsapp_access_token";
const KEYS=["whatsapp_phone_number_id","whatsapp_otp_template","whatsapp_template_language","whatsapp_graph_version","whatsapp_channel_url"];

async function getSettings(admin:any){const {data}=await admin.from("luma_platform_settings").select("setting_key,setting_value").in("setting_key",KEYS);return Object.fromEntries((data||[]).map((x:any)=>[x.setting_key,x.setting_value||""]));}

export async function GET(req:NextRequest){try{const workspaceId=new URL(req.url).searchParams.get("workspace_id")||"";const ctx=await getServerContext(workspaceId);const settings=await getSettings(ctx.admin);const configured=await hasServerSecret(ctx.admin,SECRET_NAME);return NextResponse.json({ok:true,configured,settings,can_configure:ctx.platformAdmin});}catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Unable to read WhatsApp integration."},{status:400})}}

export async function POST(req:NextRequest){try{const b=await req.json();const workspaceId=String(b.workspace_id||"");const ctx=await getServerContext(workspaceId);if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Hanya owner yang dapat mengubah WhatsApp integration."},{status:403});
  const accessToken=String(b.access_token||"").trim();if(accessToken){const {error}=await ctx.admin.rpc("luma_set_server_secret",{p_name:SECRET_NAME,p_secret:accessToken,p_description:"Lumaway WhatsApp Cloud API access token"});if(error)throw error;}
  const values:Record<string,string>={whatsapp_phone_number_id:String(b.phone_number_id||""),whatsapp_otp_template:String(b.otp_template||"luma_otp"),whatsapp_template_language:String(b.template_language||"id"),whatsapp_graph_version:String(b.graph_version||"v24.0"),whatsapp_channel_url:String(b.channel_url||"")};
  for(const [setting_key,setting_value] of Object.entries(values)){const {error}=await ctx.admin.from("luma_platform_settings").upsert({setting_key,setting_value,updated_at:new Date().toISOString(),updated_by:ctx.user.id},{onConflict:"setting_key"});if(error)throw error;}
  return NextResponse.json({ok:true,configured:Boolean(accessToken)||await hasServerSecret(ctx.admin,SECRET_NAME)});
}catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Unable to save WhatsApp integration."},{status:400})}}
