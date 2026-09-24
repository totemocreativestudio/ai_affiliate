import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";

export const runtime="nodejs";

export async function GET(req:NextRequest){
  try{
    const {searchParams}=new URL(req.url);
    const workspaceId=String(searchParams.get("workspace_id")||"");
    const q=String(searchParams.get("q")||"").trim();
    const page=Math.max(1,Number(searchParams.get("page")||1));
    const pageSize=Math.min(200,Math.max(25,Number(searchParams.get("page_size")||100)));
    if(!workspaceId)return NextResponse.json({ok:false,error:"workspace_id required"},{status:400});
    const {admin}=await getServerContext(workspaceId);
    const {data,error}=await admin.rpc("luma_get_master_creators_unique",{
      p_workspace_id:workspaceId,
      p_search:q||null,
      p_page:page,
      p_page_size:pageSize
    });
    if(error)throw error;
    const rows=(data||[]) as any[];
    const total=rows.length?Number(rows[0].total_count||0):0;
    const results=rows.map(({total_count,...row}:any)=>row);
    return NextResponse.json({ok:true,results,total,page,page_size:pageSize});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Gagal memuat Master Creator."},{status:400});
  }
}
