import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret, hasServerSecret } from "../../../../lib/server-secrets";

export const runtime="nodejs";
const CONTROL_SECRET="luma_maintenance_control_password";

function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)throw new Error("Supabase server environment is incomplete.");
  return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
function same(a:string,b:string){
  const aa=Buffer.from(a);const bb=Buffer.from(b);
  return aa.length===bb.length&&timingSafeEqual(aa,bb);
}

export async function GET(req:NextRequest){
  try{
    const admin=adminClient();
    const {data}=await admin.from("luma_system_controls").select("*").eq("id",1).single();
    let can_manage=false,password_configured=false;
    const workspaceId=new URL(req.url).searchParams.get("workspace_id")||"";
    if(workspaceId){
      try{
        const ctx=await getServerContext(workspaceId);
        can_manage=Boolean(ctx.platformAdmin);
        if(can_manage)password_configured=await hasServerSecret(ctx.admin,CONTROL_SECRET);
      }catch{}
    }
    return NextResponse.json({ok:true,state:data||{id:1,mode:"normal",status_code:200,title:"Lumaway berjalan normal",message:"Semua layanan utama tersedia.",block_user_access:false},can_manage,password_configured},{headers:{"Cache-Control":"no-store"}});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Unable to read system status."},{status:503})}
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();const workspaceId=String(body.workspace_id||"");
    const ctx=await getServerContext(workspaceId);
    if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Owner access required."},{status:403});
    const action=String(body.action||"update_state");
    if(action==="set_password"){
      const next=String(body.new_password||"");
      if(next.length<8)return NextResponse.json({ok:false,error:"Password control minimal 8 karakter."},{status:400});
      const existing=await getServerSecret(ctx.admin,CONTROL_SECRET);
      if(existing&&!same(existing,String(body.current_password||"")))return NextResponse.json({ok:false,error:"Password control saat ini tidak sesuai."},{status:403});
      const {error}=await ctx.admin.rpc("luma_set_server_secret",{p_name:CONTROL_SECRET,p_secret:next,p_description:"Lumaway maintenance/system control password"});
      if(error)throw error;
      return NextResponse.json({ok:true,password_configured:true});
    }
    const expected=await getServerSecret(ctx.admin,CONTROL_SECRET);
    if(!expected)return NextResponse.json({ok:false,error:"Password control belum dibuat. Buat password terlebih dahulu."},{status:409});
    if(!same(expected,String(body.password||"")))return NextResponse.json({ok:false,error:"Password control tidak sesuai."},{status:403});
    const mode=String(body.mode||"normal");
    if(!["normal","maintenance","degraded","outage"].includes(mode))return NextResponse.json({ok:false,error:"Mode system tidak valid."},{status:400});
    const code=Number(body.status_code||(mode==="normal"?200:mode==="maintenance"||mode==="outage"?503:200));
    const title=String(body.title||"Lumaway system status").slice(0,140);
    const message=String(body.message||"").slice(0,1500);
    const block=Boolean(body.block_user_access)&&mode!=="normal";
    const now=new Date().toISOString();
    const {data,error}=await ctx.admin.from("luma_system_controls").update({mode,status_code:code,title,message,block_user_access:block,starts_at:mode==="normal"?null:now,ends_at:mode==="normal"?now:null,updated_by:ctx.user.id,updated_at:now}).eq("id",1).select("*").single();
    if(error)throw error;
    await ctx.admin.from("luma_system_events").insert({mode,status_code:code,title,message,action:mode==="normal"?"restore":"update",created_by:ctx.user.id});
    if(body.notify_users!==false){
      await ctx.admin.from("luma_notifications").insert({workspace_id:null,title,body:message||title,category:mode==="maintenance"||mode==="outage"?"maintenance":"system_update",action_url:"#dashboard",action_label:"Lihat Status",image_url:null,audience:"all",status:"published",created_by:ctx.user.id,published_at:now});
    }
    return NextResponse.json({ok:true,state:data});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Unable to update system status."},{status:400})}
}
