import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";
import { DEFAULT_CONVIA_BASE_URL } from "../../../../lib/convia";
import { sendWhatsAppTextWithFailover } from "../../../../lib/whatsapp-router";
import { openAIResponsesWithFailover } from "../../../../lib/openai-router";
import { extractOpenAIText, firstName, LUMA_SUPPORT_KNOWLEDGE, LUMA_SUPPORT_SCHEMA, supportTicketCode } from "../../../../lib/luma-support";

export const runtime = "nodejs";

async function getConviaSettings(admin:any){
  const {data}=await admin.from("luma_platform_settings").select("setting_key,setting_value").in("setting_key",["convia_base_url","convia_phone_number_id"]);
  const s=Object.fromEntries((data||[]).map((x:any)=>[x.setting_key,x.setting_value||""]));
  return {baseUrl:process.env.CONVIA_BASE_URL||s.convia_base_url||DEFAULT_CONVIA_BASE_URL,phoneNumberId:process.env.CONVIA_WHATSAPP_PHONE_NUMBER_ID||s.convia_phone_number_id||""};
}

async function ensureTicket(ctx:any,workspaceId:string,ticketId:string|undefined,userName:string){
  if(ticketId){
    const {data}=await ctx.admin.from("luma_support_tickets").select("*").eq("id",ticketId).eq("workspace_id",workspaceId).eq("user_id",ctx.user.id).maybeSingle();
    if(data)return data;
  }
  const {data:active}=await ctx.admin.from("luma_support_tickets").select("*").eq("workspace_id",workspaceId).eq("user_id",ctx.user.id).in("status",["ai_assist","escalated","open","awaiting_user"]).order("updated_at",{ascending:false}).limit(1).maybeSingle();
  if(active)return active;
  const {data,error}=await ctx.admin.from("luma_support_tickets").insert({workspace_id:workspaceId,user_id:ctx.user.id,ticket_code:supportTicketCode(),subject:`Help Desk - ${userName}`,status:"ai_assist",category:"general",priority:"normal"}).select("*").single();
  if(error)throw error;
  return data;
}

async function escalate(ctx:any,workspaceId:string,ticket:any,userName:string,profile:any,reason:string){
  const phone=String(profile?.whatsapp||profile?.phone||"").trim();
  await ctx.admin.from("luma_support_tickets").update({status:"escalated",channel:phone?"in_app+whatsapp":"in_app",whatsapp_phone:phone||null,whatsapp_handoff_at:phone?new Date().toISOString():null,summary:reason.slice(0,1200),updated_at:new Date().toISOString()}).eq("id",ticket.id).eq("user_id",ctx.user.id);
  await ctx.admin.from("luma_support_messages").insert({ticket_id:ticket.id,workspace_id:workspaceId,user_id:ctx.user.id,sender_type:"system",body:phone?`Ticket ${ticket.ticket_code} diteruskan ke Support Lumaway. Notifikasi WhatsApp sedang dikirim ke nomor terverifikasi.`:`Ticket ${ticket.ticket_code} diteruskan ke Support Lumaway. Tambahkan/verifikasi nomor WhatsApp di My Profile agar follow-up bisa dilanjutkan lewat WhatsApp.`,metadata:{event:"escalated"}});
  let whatsappSent=false;
  if(phone){
    try{
      const apiKey=await getServerSecret(ctx.admin,"luma_convia_api_key");
      if(apiKey){
        const cfg=await getConviaSettings(ctx.admin);
        const text=`Halo ${userName}, tiket bantuan Lumaway ${ticket.ticket_code} sudah dibuat. Luma sudah meneruskan konteks kendala Anda ke tim support. Balas percakapan WhatsApp support yang aktif jika ada informasi tambahan. Tim Lumaway/owner dapat ikut membantu sampai kendala selesai.`;
        const sent=await sendWhatsAppTextWithFailover(ctx.admin,phone,text);
        whatsappSent=true;
        await ctx.admin.from("luma_support_messages").insert({ticket_id:ticket.id,workspace_id:workspaceId,user_id:ctx.user.id,sender_type:"system",body:`Notifikasi handoff WhatsApp terkirim melalui ${sent.provider}.`,provider:sent.provider,provider_message_id:sent.reference||null,metadata:{event:"whatsapp_handoff",failover_used:sent.failover_used,attempted:sent.attempted}});
        await ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:ctx.user.id,provider:sent.provider,service:"support_handoff",request_type:"ticket_escalation",status:"success",reference:ticket.ticket_code,metadata:{recipient_last4:phone.slice(-4),failover_used:sent.failover_used,attempted:sent.attempted}});
      }
    }catch(error:any){
      await ctx.admin.from("luma_support_messages").insert({ticket_id:ticket.id,workspace_id:workspaceId,user_id:ctx.user.id,sender_type:"system",body:"Ticket sudah masuk ke Support Lumaway. Pengiriman WhatsApp belum berhasil; owner tetap dapat melihat tiket dari Support Desk.",metadata:{event:"whatsapp_handoff_failed",error:String(error?.message||"unknown").slice(0,300)}});
    }
  }
  return {ticket_code:ticket.ticket_code,whatsapp_sent:whatsappSent,phone_available:Boolean(phone)};
}

export async function POST(req:NextRequest){
  const started=Date.now();let ctx:any=null;let workspaceId="";
  try{
    const contentType=req.headers.get("content-type")||"";
    let body:any={};let image:File|null=null;
    if(contentType.includes("multipart/form-data")){
      const fd=await req.formData();
      body=Object.fromEntries(fd.entries());
      const maybeImage=fd.get("image");
      image=maybeImage instanceof File&&maybeImage.size>0?maybeImage:null;
    }else{
      body=await req.json();
    }
    workspaceId=String(body.workspace_id||"");
    const message=String(body.message||"").trim().slice(0,4000);
    const action=String(body.action||"chat");
    if(!workspaceId)return NextResponse.json({ok:false,error:"workspace_id required"},{status:400});
    ctx=await getServerContext(workspaceId);
    if(ctx.platformAdmin)return NextResponse.json({ok:false,error:"Luma Help Desk ditujukan untuk dashboard user. Gunakan Support Desk pada Owner Control."},{status:403});
    const {data:profile}=await ctx.admin.from("profiles").select("full_name,phone,whatsapp,phone_verified_at").eq("id",ctx.user.id).maybeSingle();
    const {data:workspace}=await ctx.admin.from("workspaces").select("name").eq("id",workspaceId).maybeSingle();
    const userName=firstName(profile?.full_name||ctx.user.user_metadata?.full_name||ctx.user.email?.split("@")[0]);
    const ticket=await ensureTicket(ctx,workspaceId,body.ticket_id?String(body.ticket_id):undefined,userName);
    let attachment:any=null;let imageDataUrl:string|null=null;
    if(image){
      if(image.size>2*1024*1024)return NextResponse.json({ok:false,error:"Ukuran foto melebihi 2 MB. Silakan unggah file yang lebih kecil."},{status:400});
      if(!["image/jpeg","image/png","image/webp"].includes(image.type))return NextResponse.json({ok:false,error:"Format foto hanya JPG, PNG, atau WEBP."},{status:400});
      const bytes=Buffer.from(await image.arrayBuffer());
      const ext=image.type==="image/png"?"png":image.type==="image/webp"?"webp":"jpg";
      const storagePath=`${workspaceId}/${ctx.user.id}/${ticket.id}/${Date.now()}.${ext}`;
      let upload=await ctx.admin.storage.from("luma-support").upload(storagePath,bytes,{contentType:image.type,upsert:false});
      if(upload.error&&/bucket/i.test(String(upload.error.message||""))){
        await ctx.admin.storage.createBucket("luma-support",{public:false,fileSizeLimit:2*1024*1024,allowedMimeTypes:["image/jpeg","image/png","image/webp"]}).catch(()=>undefined);
        upload=await ctx.admin.storage.from("luma-support").upload(storagePath,bytes,{contentType:image.type,upsert:false});
      }
      if(upload.error)throw upload.error;
      attachment={bucket:"luma-support",path:storagePath,name:image.name||`screenshot.${ext}`,mime:image.type,size:image.size};
      imageDataUrl=`data:${image.type};base64,${bytes.toString("base64")}`;
    }

    if(action==="escalate"){
      const result=await escalate(ctx,workspaceId,ticket,userName,profile,message||"User meminta bantuan lanjutan dari Support Lumaway.");
      return NextResponse.json({ok:true,escalated:true,ticket_id:ticket.id,...result});
    }
    if(!message&&!image)return NextResponse.json({ok:false,error:"Pesan atau foto kendala wajib diisi."},{status:400});

    await ctx.admin.from("luma_support_messages").insert({ticket_id:ticket.id,workspace_id:workspaceId,user_id:ctx.user.id,sender_type:"user",sender_user_id:ctx.user.id,body:message|| (attachment?"Lampiran screenshot kendala.":""),metadata:{page:String(body.page||"").slice(0,120),attachment}});
    const {data:history}=await ctx.admin.from("luma_support_messages").select("sender_type,body,created_at").eq("ticket_id",ticket.id).eq("user_id",ctx.user.id).order("created_at",{ascending:false}).limit(16);
    const ordered=(history||[]).reverse().map((x:any)=>({role:x.sender_type==="user"?"user":x.sender_type==="owner"?"support_owner":"luma_agent",content:x.body}));

    const {data:knowledgeRows}=await ctx.admin.from("luma_knowledge_documents").select("title,content_markdown,tags,updated_at").eq("status","active").order("updated_at",{ascending:false}).limit(40);
    let knowledgeBudget=26000;
    const dynamicKnowledge=(knowledgeRows||[]).map((doc:any)=>{
      if(knowledgeBudget<=0)return "";
      const source=String(doc.content_markdown||"").slice(0,Math.min(7000,knowledgeBudget));
      knowledgeBudget-=source.length;
      return source?`\n### ${String(doc.title||"Lumaway Knowledge")}\nTags: ${(doc.tags||[]).join(", ")}\n${source}`:"";
    }).filter(Boolean).join("\n");
    const apiKey=await getServerSecret(ctx.admin,"luma_openai_api_key");
    if(!apiKey)return NextResponse.json({ok:false,error:"Luma Agent belum aktif karena OpenAI integration belum dikonfigurasi owner.",ticket_id:ticket.id},{status:503});
    const model=process.env.LUMA_SUPPORT_MODEL||process.env.OPENAI_MODEL||"gpt-5.6-sol";
    const instructions=`Anda adalah Luma, AI Help Desk resmi Lumaway. Nama user aktif: ${userName}. Workspace user: ${String(workspace?.name||"Lumaway").slice(0,120)}.\n\nBASE KNOWLEDGE:\n${LUMA_SUPPORT_KNOWLEDGE}\n\nOWNER PRODUCT KNOWLEDGE (Obsidian-compatible vault):\n${dynamicKnowledge||"Belum ada knowledge tambahan."}\n\nBATASAN WAJIB: Jawab HANYA tentang produk, fitur, tutorial, error, billing, data, dan penggunaan Lumaway yang didukung oleh knowledge di atas atau halaman aktif user. Jangan menjawab topik umum di luar Lumaway. Jika pertanyaan di luar cakupan, jelaskan singkat bahwa Luma hanya menangani Lumaway. Jangan mengarang fitur, SOP, harga, credential, data admin/owner, user lain, atau workspace lain. Jika knowledge tidak cukup, katakan informasi belum tersedia lalu arahkan eskalasi. Bila belum solve, tandai escalation_recommended=true.`;
    const currentContext=JSON.stringify({current_page:String(body.page||""),conversation:ordered,current_message:message||"Analisis screenshot kendala yang dikirim user."});
    const input:any[]=imageDataUrl
      ? [{role:"user",content:[{type:"input_text",text:currentContext},{type:"input_image",image_url:imageDataUrl}]}]
      : [{role:"user",content:[{type:"input_text",text:currentContext}]}];
    const routed=await openAIResponsesWithFailover(ctx.admin,apiKey,{instructions,input,text:{format:{type:"json_schema",name:"luma_support_reply",schema:LUMA_SUPPORT_SCHEMA,strict:true}},store:false},model);
    const raw=routed.raw;const actualModel=routed.model;
    const output=extractOpenAIText(raw);if(!output)throw new Error("Luma Agent tidak menerima respons AI.");
    const result=JSON.parse(output);
    if(!String(result.reply||"").toLowerCase().includes(userName.toLowerCase()))result.reply=`${userName}, ${String(result.reply||"").trim()}`;
    await ctx.admin.from("luma_support_messages").insert({ticket_id:ticket.id,workspace_id:workspaceId,user_id:ctx.user.id,sender_type:"agent",body:String(result.reply||"").slice(0,8000),provider:"openai",provider_message_id:raw?.id||null,metadata:{category:result.category,priority:result.priority,solved:result.solved,escalation_recommended:result.escalation_recommended,suggested_actions:result.suggested_actions||[]}});
    await ctx.admin.from("luma_support_tickets").update({category:result.category||"general",priority:result.priority||"normal",ai_attempts:Number(ticket.ai_attempts||0)+1,status:result.solved?"resolved":"ai_assist",resolved_at:result.solved?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",ticket.id).eq("user_id",ctx.user.id);
    const usage=raw?.usage||{};
    await ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:ctx.user.id,provider:"openai",service:"luma_helpdesk",request_type:"support_chat",model:actualModel,input_tokens:Number(usage.input_tokens||0),output_tokens:Number(usage.output_tokens||0),total_tokens:Number(usage.total_tokens||0),cost_usd:routed.cost.cost_usd,cost_idr:routed.cost.cost_idr,status:"success",reference:ticket.ticket_code,metadata:{duration_ms:Date.now()-started,category:result.category,requested_model:model,fallback_used:routed.fallback_used,fx:routed.fx}});
    return NextResponse.json({ok:true,ticket_id:ticket.id,ticket_code:ticket.ticket_code,user_name:userName,reply:result.reply,solved:Boolean(result.solved),escalation_recommended:Boolean(result.escalation_recommended),category:result.category,priority:result.priority,suggested_actions:result.suggested_actions||[]});
  }catch(error:any){
    if(ctx){try{await ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId||null,user_id:ctx.user.id,provider:"openai",service:"luma_helpdesk",request_type:"support_chat",status:"error",metadata:{error:String(error?.message||"unknown").slice(0,500)}})}catch{}}
    return NextResponse.json({ok:false,error:error?.message||"Luma Help Desk gagal memproses pesan."},{status:400});
  }
}
