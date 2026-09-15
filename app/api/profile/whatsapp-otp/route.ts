import { createHash, randomBytes, randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";

export const runtime="nodejs";
function normalizePhone(input:string){let s=input.replace(/[^0-9+]/g,"");if(s.startsWith("08"))s="+62"+s.slice(1);else if(s.startsWith("62"))s="+"+s;else if(!s.startsWith("+"))s="+"+s;return s;}
const hash=(code:string,salt:string)=>createHash("sha256").update(`${code}:${salt}`).digest("hex");
async function settings(admin:any){const {data}=await admin.from("luma_platform_settings").select("setting_key,setting_value").in("setting_key",["whatsapp_phone_number_id","whatsapp_otp_template","whatsapp_template_language","whatsapp_graph_version"]);return Object.fromEntries((data||[]).map((x:any)=>[x.setting_key,x.setting_value||""]));}

export async function POST(req:NextRequest){
  let ctx:any=null;let workspaceId="";let action="request";
  try{
    const b=await req.json();workspaceId=String(b.workspace_id||"");action=String(b.action||"request");const phone=normalizePhone(String(b.phone||""));ctx=await getServerContext(workspaceId);
    if(!/^\+[1-9][0-9]{8,14}$/.test(phone))return NextResponse.json({ok:false,error:"Nomor WhatsApp tidak valid. Gunakan format +62812..."},{status:400});
    if(action==="request"){
      const cfg=await settings(ctx.admin);const accessToken=await getServerSecret(ctx.admin,"luma_whatsapp_access_token");if(!accessToken||!cfg.whatsapp_phone_number_id)return NextResponse.json({ok:false,error:"WhatsApp OTP belum dikonfigurasi oleh owner."},{status:503});
      const code=String(randomInt(100000,1000000));const salt=randomBytes(16).toString("hex");await ctx.admin.from("luma_otp_challenges").delete().eq("user_id",ctx.user.id).eq("channel","whatsapp").is("used_at",null);const {error:dbError}=await ctx.admin.from("luma_otp_challenges").insert({user_id:ctx.user.id,channel:"whatsapp",target:phone,code_hash:hash(code,salt),salt,expires_at:new Date(Date.now()+5*60*1000).toISOString()});if(dbError)throw dbError;
      const version=cfg.whatsapp_graph_version||"v24.0";const template=cfg.whatsapp_otp_template||"luma_otp";const language=cfg.whatsapp_template_language||"id";const payload={messaging_product:"whatsapp",to:phone.replace(/^\+/,""),type:"template",template:{name:template,language:{code:language},components:[{type:"body",parameters:[{type:"text",text:code}]}]}};
      const r=await fetch(`https://graph.facebook.com/${version}/${cfg.whatsapp_phone_number_id}/messages`,{method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});const raw=await r.json();if(!r.ok)throw new Error(raw?.error?.message||"WhatsApp gagal mengirim OTP.");
      await ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:ctx.user.id,provider:"meta",service:"whatsapp",request_type:"otp_send",status:"success",reference:raw?.messages?.[0]?.id||null,metadata:{template,graph_version:version}});
      return NextResponse.json({ok:true,expires_in:300});
    }
    if(action==="verify"){
      const code=String(b.otp||"").trim();if(!/^\d{6}$/.test(code))return NextResponse.json({ok:false,error:"OTP harus 6 digit."},{status:400});const {data:challenge,error}=await ctx.admin.from("luma_otp_challenges").select("*").eq("user_id",ctx.user.id).eq("channel","whatsapp").eq("target",phone).is("used_at",null).order("created_at",{ascending:false}).limit(1).maybeSingle();if(error)throw error;if(!challenge)return NextResponse.json({ok:false,error:"OTP tidak ditemukan. Minta kode baru."},{status:400});if(new Date(challenge.expires_at).getTime()<Date.now())return NextResponse.json({ok:false,error:"OTP kedaluwarsa. Minta kode baru."},{status:400});if(Number(challenge.attempts)>=5)return NextResponse.json({ok:false,error:"Terlalu banyak percobaan. Minta OTP baru."},{status:429});const valid=hash(code,String(challenge.salt||""))===challenge.code_hash;await ctx.admin.from("luma_otp_challenges").update({attempts:Number(challenge.attempts||0)+1,used_at:valid?new Date().toISOString():null}).eq("id",challenge.id);if(!valid)return NextResponse.json({ok:false,error:"OTP salah."},{status:400});const {error:authError}=await ctx.admin.auth.admin.updateUserById(ctx.user.id,{phone});if(authError)throw authError;const now=new Date().toISOString();const {error:pError}=await ctx.admin.from("profiles").update({phone,whatsapp:phone,phone_verified_at:now,whatsapp_opt_in:true,whatsapp_opt_in_at:now,updated_at:now}).eq("id",ctx.user.id);if(pError)throw pError;return NextResponse.json({ok:true,phone});
    }
    return NextResponse.json({ok:false,error:"Unknown action"},{status:400});
  }catch(error:any){if(ctx){try{await ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId||null,user_id:ctx.user.id,provider:"meta",service:"whatsapp",request_type:action,status:"error",metadata:{error:error?.message||"unknown"}})}catch{}}return NextResponse.json({ok:false,error:error?.message||"WhatsApp OTP failed."},{status:400})}
}
