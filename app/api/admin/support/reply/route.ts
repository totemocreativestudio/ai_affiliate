import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../../lib/server-auth";
import { getServerSecret } from "../../../../../lib/server-secrets";
import { conviaSendText, DEFAULT_CONVIA_BASE_URL } from "../../../../../lib/convia";

export const runtime="nodejs";

async function conviaSettings(admin:any){
  const {data}=await admin.from("luma_platform_settings").select("setting_key,setting_value").in("setting_key",["convia_base_url","convia_phone_number_id"]);
  const s=Object.fromEntries((data||[]).map((x:any)=>[x.setting_key,x.setting_value||""]));
  return {baseUrl:process.env.CONVIA_BASE_URL||s.convia_base_url||DEFAULT_CONVIA_BASE_URL,phoneNumberId:process.env.CONVIA_WHATSAPP_PHONE_NUMBER_ID||s.convia_phone_number_id||""};
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();const workspaceId=String(body.workspace_id||"");const ticketId=String(body.ticket_id||"");const message=String(body.message||"").trim();const sendWhatsapp=body.send_whatsapp!==false;
    if(!workspaceId||!ticketId||!message)return NextResponse.json({ok:false,error:"workspace_id, ticket_id, dan message wajib diisi."},{status:400});
    const ctx=await getServerContext(workspaceId);if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Owner access required."},{status:403});
    const {data:ticket,error}=await ctx.admin.from("luma_support_tickets").select("*").eq("id",ticketId).maybeSingle();if(error||!ticket)throw error||new Error("Ticket tidak ditemukan.");
    const {data:profile}=await ctx.admin.from("profiles").select("full_name,phone,whatsapp").eq("id",ticket.user_id).maybeSingle();
    await ctx.admin.from("luma_support_messages").insert({ticket_id:ticket.id,workspace_id:ticket.workspace_id,user_id:ticket.user_id,sender_type:"owner",sender_user_id:ctx.user.id,body:message,metadata:{source:"owner_support_desk"}});
    let whatsappSent=false;
    const phone=String(ticket.whatsapp_phone||profile?.whatsapp||profile?.phone||"").trim();
    if(sendWhatsapp&&phone){
      const key=await getServerSecret(ctx.admin,"luma_convia_api_key");
      if(key){
        const cfg=await conviaSettings(ctx.admin);
        const raw=await conviaSendText(key,phone,message,{baseUrl:cfg.baseUrl,whatsappPhoneNumberId:cfg.phoneNumberId,customerName:String(profile?.full_name||"Lumaway User")});
        whatsappSent=true;
        await ctx.admin.from("luma_api_usage_events").insert({workspace_id:ticket.workspace_id,user_id:ctx.user.id,provider:"convia",service:"support_owner_reply",request_type:"support_reply",status:"success",reference:ticket.ticket_code,metadata:{message_id:raw?.data?.message_id||null,recipient_last4:phone.slice(-4)}});
      }
    }
    await ctx.admin.from("luma_support_tickets").update({status:String(body.status||"awaiting_user"),assigned_to:ctx.user.id,updated_at:new Date().toISOString()}).eq("id",ticket.id);
    return NextResponse.json({ok:true,whatsapp_sent:whatsappSent});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Support reply failed."},{status:400})}
}
