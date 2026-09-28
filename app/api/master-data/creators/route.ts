import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

function normalizeCreator(value:string){
  return String(value||"").trim().replace(/^@+/,"").trim().toLowerCase();
}
function makeCreatorCode(value:string){
  const base=String(value||"").trim().toUpperCase().replace(/[^A-Z0-9]+/g,"").slice(0,10)||"CREATOR";
  return "CR-"+base+"-"+randomUUID().replace(/-/g,"").slice(0,8).toUpperCase();
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const workspaceId=String(body.workspace_id||"").trim();
    const raw=String(body.creator||body.username||body.name||"").trim();
    const platform=String(body.platform||"").trim();
    if(!workspaceId)return NextResponse.json({ok:false,error:"workspace_id required"},{status:400});
    if(!raw)return NextResponse.json({ok:false,error:"Username / nama creator wajib diisi."},{status:400});
    if(!platform)return NextResponse.json({ok:false,error:"Pilih platform terlebih dahulu untuk creator baru."},{status:400});
    if(raw.length>160)return NextResponse.json({ok:false,error:"Nama creator terlalu panjang."},{status:400});

    const {admin}=await getServerContext(workspaceId);
    const normalized=normalizeCreator(raw);
    const {data:matches,error:searchError}=await admin.rpc("luma_get_master_creators_unique",{
      p_workspace_id:workspaceId,
      p_search:raw,
      p_page:1,
      p_page_size:30
    });
    if(searchError)throw searchError;

    const exact=(matches||[]).find((row:any)=>
      [row.name,row.username,row.creator_code].some((v:any)=>normalizeCreator(String(v||""))===normalized)
      && (!row.platform||String(row.platform).toLowerCase()===platform.toLowerCase())
    );
    if(exact){
      const {total_count,...creator}=exact as any;
      return NextResponse.json({ok:true,created:false,creator});
    }

    const cleanUsername=raw.replace(/^@+/,"").trim();
    const {data,error}=await admin.from("creators").insert({
      workspace_id:workspaceId,
      creator_code:makeCreatorCode(cleanUsername),
      name:cleanUsername,
      username:cleanUsername,
      platform,
      status:"Active"
    }).select("id,creator_code,name,username,platform,affiliate_id,phone,payment_type,ratecard,status").single();
    if(error)throw error;
    return NextResponse.json({ok:true,created:true,creator:data});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Gagal membuat creator baru."},{status:400});
  }
}
