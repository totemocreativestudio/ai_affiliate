import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";

export const runtime="nodejs";

export async function GET(req:NextRequest){
  try{
    const url=new URL(req.url);const workspaceId=url.searchParams.get("workspace_id")||"";const ticketId=url.searchParams.get("ticket_id")||"";
    const ctx=await getServerContext(workspaceId);
    if(ctx.platformAdmin)return NextResponse.json({ok:false,error:"Gunakan Owner Support Desk."},{status:403});
    let q=ctx.admin.from("luma_support_tickets").select("id,ticket_code,subject,category,status,priority,channel,ai_attempts,last_message_at,created_at,updated_at,resolved_at").eq("workspace_id",workspaceId).eq("user_id",ctx.user.id).order("updated_at",{ascending:false}).limit(20);
    if(ticketId)q=q.eq("id",ticketId);
    const {data:tickets,error}=await q;if(error)throw error;
    const selected=ticketId?(tickets||[])[0]:(tickets||[]).find((x:any)=>["ai_assist","escalated","open","awaiting_user"].includes(x.status))||(tickets||[])[0];
    let messages:any[]=[];
    if(selected?.id){const {data,error:msgError}=await ctx.admin.from("luma_support_messages").select("id,sender_type,body,metadata,created_at").eq("ticket_id",selected.id).eq("user_id",ctx.user.id).order("created_at",{ascending:true}).limit(200);if(msgError)throw msgError;messages=data||[];}
    return NextResponse.json({ok:true,tickets:tickets||[],active_ticket:selected||null,messages});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Unable to load support tickets."},{status:400});}
}
