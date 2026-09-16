import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../../lib/server-auth";
import { getServerSecret } from "../../../../../lib/server-secrets";
import { conviaSendText, DEFAULT_CONVIA_BASE_URL } from "../../../../../lib/convia";

export const runtime="nodejs";

async function conviaConfig(admin:any){
  const {data}=await admin.from("luma_platform_settings").select("setting_key,setting_value").in("setting_key",["convia_base_url","convia_phone_number_id"]);
  const s=Object.fromEntries((data||[]).map((x:any)=>[x.setting_key,x.setting_value||""]));
  return {baseUrl:process.env.CONVIA_BASE_URL||s.convia_base_url||DEFAULT_CONVIA_BASE_URL,phoneNumberId:process.env.CONVIA_WHATSAPP_PHONE_NUMBER_ID||s.convia_phone_number_id||""};
}

export async function GET(req:NextRequest){
  try{
    const url=new URL(req.url);const workspaceId=url.searchParams.get("workspace_id")||"";const ticketId=url.searchParams.get("ticket_id")||"";const status=url.searchParams.get("status")||"";
    const ctx=await getServerContext(workspaceId);if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Owner access required."},{status:403});
    let q=ctx.admin.from("luma_support_tickets").select("*").order("updated_at",{ascending:false}).limit(250);if(status)q=q.eq("status",status);if(ticketId)q=q.eq("id",ticketId);
    const {data:tickets,error}=await q;if(error)throw error;
    const userIds=[...new Set((tickets||[]).map((x:any)=>x.user_id))];const workspaceIds=[...new Set((tickets||[]).map((x:any)=>x.workspace_id))];
    const [profilesRes,workspacesRes]=await Promise.all([
      userIds.length?ctx.admin.from("profiles").select("id,full_name,email,phone,whatsapp").in("id",userIds):Promise.resolve({data:[]}),
      workspaceIds.length?ctx.admin.from("workspaces").select("id,name").in("id",workspaceIds):Promise.resolve({data:[]}),
    ] as any);
    const profiles=Object.fromEntries((profilesRes.data||[]).map((x:any)=>[x.id,x]));const workspaces=Object.fromEntries((workspacesRes.data||[]).map((x:any)=>[x.id,x]));
    const enriched=(tickets||[]).map((t:any)=>({...t,user:profiles[t.user_id]||null,workspace:workspaces[t.workspace_id]||null}));
    let messages:any[]=[];if(ticketId){const {data,error:me}=await ctx.admin.from("luma_support_messages").select("*").eq("ticket_id",ticketId).order("created_at",{ascending:true}).limit(500);if(me)throw me;messages=data||[];}
    return NextResponse.json({ok:true,tickets:enriched,messages});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Unable to load support queue."},{status:400});}
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();const workspaceId=String(body.workspace_id||"");const ticketId=String(body.ticket_id||"");const action=String(body.action||"reply");const ctx=await getServerContext(workspaceId);if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Owner access required."},{status:403});
    const {data:ticket,error:tErr}=await ctx.admin.from("luma_support_tickets").select("*").eq("id",ticketId).maybeSingle();if(tErr)throw tErr;if(!ticket)return NextResponse.json({ok:false,error:"Ticket tidak ditemukan."},{status:404});
    if(action==="status"){
      const next=String(body.status||"");if(!["escalated","open","awaiting_user","resolved","closed"].includes(next))return NextResponse.json({ok:false,error:"Status tidak valid."},{status:400});
      await ctx.admin.from("luma_support_tickets").update({status:next,resolved_at:next==="resolved"||next==="closed"?new Date().toISOString():null,updated_at:new Date().toISOString(),assigned_to:ctx.user.id}).eq("id",ticketId);
      return NextResponse.json({ok:true,status:next});
    }
    const message=String(body.message||"").trim().slice(0,5000);if(!message)return NextResponse.json({ok:false,error:"Balasan tidak boleh kosong."},{status:400});
    let providerMessageId:string|null=null;let whatsappSent=false;const viaWhatsapp=Boolean(body.via_whatsapp);const phone=String(ticket.whatsapp_phone||"").trim();
    if(viaWhatsapp&&phone){
      try{
        const apiKey=await getServerSecret(ctx.admin,"luma_convia_api_key");if(!apiKey)throw new Error("Convia belum dikonfigurasi.");const cfg=await conviaConfig(ctx.admin);
        const raw=await conviaSendText(apiKey,phone,message,{baseUrl:cfg.baseUrl,whatsappPhoneNumberId:cfg.phoneNumberId});providerMessageId=raw?.data?.message_id||null;whatsappSent=true;
        await ctx.admin.from("luma_api_usage_events").insert({workspace_id:ticket.workspace_id,user_id:ctx.user.id,provider:"convia",service:"support_reply",request_type:"owner_reply",status:"success",reference:ticket.ticket_code,metadata:{recipient_last4:phone.slice(-4)}});
      }catch(error:any){return NextResponse.json({ok:false,error:`Balasan in-app belum dikirim karena WhatsApp gagal: ${error?.message||"unknown"}`},{status:400});}
    }
    await ctx.admin.from("luma_support_messages").insert({ticket_id:ticketId,workspace_id:ticket.workspace_id,user_id:ticket.user_id,sender_type:"owner",sender_user_id:ctx.user.id,body:message,provider:whatsappSent?"convia":null,provider_message_id:providerMessageId,metadata:{via_whatsapp:whatsappSent}});
    await ctx.admin.from("luma_support_tickets").update({status:"awaiting_user",assigned_to:ctx.user.id,updated_at:new Date().toISOString(),channel:whatsappSent?"in_app+whatsapp":ticket.channel}).eq("id",ticketId);
    await ctx.admin.from("user_notifications").insert({user_id:ticket.user_id,title:`Support Lumaway · ${ticket.ticket_code}`,message,kind:"support",is_read:false,action_url:"#dashboard",created_at:new Date().toISOString()});
    return NextResponse.json({ok:true,whatsapp_sent:whatsappSent,provider_message_id:providerMessageId});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Unable to update support ticket."},{status:400});}
}
