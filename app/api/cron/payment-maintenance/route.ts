import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const maxDuration=30;

function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)throw new Error("Supabase server environment incomplete.");
  return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function GET(req:NextRequest){
  const expected=String(process.env.CRON_SECRET||"");
  if(!expected||req.headers.get("authorization")!==`Bearer ${expected}`)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
  try{
    const admin=adminClient();
    const {data,error}=await admin.rpc("luma_payment_maintenance_v1");
    if(error)throw error;
    try{
      await admin.from("luma_api_usage_events").insert({
        workspace_id:null,user_id:null,provider:"lumaway",service:"payment_maintenance",
        request_type:"cron",status:"success",metadata:data||{}
      });
    }catch{}
    return NextResponse.json(data||{ok:true});
  }catch(error:any){
    return NextResponse.json({ok:false,error:String(error?.message||"Payment maintenance failed.")},{status:500});
  }
}
