import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const maxDuration=60;

function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)throw new Error("Supabase server environment incomplete.");
  return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function GET(req:NextRequest){
  const expected=String(process.env.CRON_SECRET||"");
  if(!expected||req.headers.get("authorization")!=="Bearer "+expected)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
  try{
    const admin=adminClient();
    const [sync,escalate]=await Promise.all([
      admin.rpc("luma_sync_alert_incidents_v1"),
      admin.rpc("luma_escalate_incidents_v1")
    ]);
    if(sync.error)throw sync.error;
    if(escalate.error)throw escalate.error;
    return NextResponse.json({ok:true,sync:sync.data,escalation:escalate.data});
  }catch(error:any){
    return NextResponse.json({ok:false,error:String(error?.message||"Incident cron failed.")},{status:500});
  }
}
