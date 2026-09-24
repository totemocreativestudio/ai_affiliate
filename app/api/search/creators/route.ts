import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";

export const runtime="nodejs";

export async function GET(req:NextRequest){
  try{
    const {searchParams}=new URL(req.url);
    const workspaceId=String(searchParams.get("workspace_id")||"");
    const q=String(searchParams.get("q")||"").trim();
    const limit=Math.min(30,Math.max(5,Number(searchParams.get("limit")||15)));
    if(!workspaceId)return NextResponse.json({ok:false,error:"workspace_id required"},{status:400});
    const {admin}=await getServerContext(workspaceId);
    const {data,error}=await admin.rpc("luma_get_master_creators_unique",{
      p_workspace_id:workspaceId,
      p_search:q||null,
      p_page:1,
      p_page_size:limit
    });
    if(error)throw error;
    const results=(data||[]).map(({total_count,...row}:any)=>row);
    return NextResponse.json({ok:true,results});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Creator search failed."},{status:400});
  }
}
