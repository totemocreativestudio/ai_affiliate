import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../lib/server-auth";

export const runtime="nodejs";

export async function POST(req:NextRequest){
  try{
    const b=await req.json();const workspaceId=String(b.workspace_id||"");
    if(!workspaceId)return NextResponse.json({ok:false,error:"workspace_id required"},{status:400});
    const ctx=await getServerContext(workspaceId);
    const title=String(b.title||"Client error").slice(0,180);const details=String(b.details||"").slice(0,5000);const page=String(b.page_path||"").slice(0,500);const category=String(b.category||"bug").slice(0,40);const severity=["low","medium","high","critical"].includes(String(b.severity))?String(b.severity):"medium";
    const {error}=await ctx.admin.from("luma_issue_logs").insert({workspace_id:workspaceId,user_id:ctx.user.id,category,severity,title,details,page_path:page,status:"open"});if(error)throw error;
    return NextResponse.json({ok:true});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Unable to log issue"},{status:400});}
}
