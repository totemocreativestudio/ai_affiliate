import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSecret } from "../../../../lib/server-secrets";

export const runtime="nodejs";

function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)throw new Error("Supabase server environment is incomplete.");
  return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function POST(req:NextRequest){
  try{
    const admin=adminClient();
    const expected=await getServerSecret(admin,"luma_xendit_webhook_token");
    if(!expected)return NextResponse.json({ok:false,error:"Xendit webhook token belum dikonfigurasi."},{status:503});
    const received=req.headers.get("x-callback-token")||"";
    if(received!==expected)return NextResponse.json({ok:false,error:"Invalid webhook token."},{status:401});

    const body=await req.json();
    const event=String(body?.event||"");
    const data=body?.data||{};
    const reference=String(data?.reference_id||data?.payment_request?.reference_id||"");
    if(!reference)return NextResponse.json({ok:true,ignored:true,reason:"No reference_id"});

    const successEvents=new Set(["payment_session.completed","payment.capture","payment.succeeded"]);
    if(successEvents.has(event)){
      const paymentRef=String(data?.payment_id||data?.payment_request_id||data?.payment_session_id||"");
      const {data:result,error}=await admin.rpc("luma_complete_topup",{p_order_code:reference,p_payment_reference:paymentRef||null,p_provider_payload:body});
      if(error)throw error;
      return NextResponse.json({ok:true,event,result});
    }

    if(event.includes("expired")||event.includes("failed")||event.includes("cancel")){
      await admin.from("luma_topup_orders").update({status:event.includes("expired")?"expired":"failed",provider_payload:body}).eq("order_code",reference).neq("status","paid");
    }
    return NextResponse.json({ok:true,event,ignored:!successEvents.has(event)});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Webhook processing failed."},{status:400});
  }
}
