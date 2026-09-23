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
    let query=admin.from("creators")
      .select("id,creator_code,name,username,platform,affiliate_id,phone,payment_type,ratecard,status",{count:"exact"})
      .eq("workspace_id",workspaceId)
      .order("name",{ascending:true,nullsFirst:false})
      .range((page-1)*pageSize,page*pageSize-1);
    if(q){
      const safe=q.replace(/[,%()]/g," ").trim();
      query=query.or(`name.ilike.%${safe}%,username.ilike.%${safe}%,creator_code.ilike.%${safe}%,affiliate_id.ilike.%${safe}%,platform.ilike.%${safe}%`);
    }
    const {data,count,error}=await query;
    if(error)throw error;
    return NextResponse.json({ok:true,results:data||[],total:Number(count||0),page,page_size:pageSize});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Gagal memuat Master Creator."},{status:400});
  }
}
