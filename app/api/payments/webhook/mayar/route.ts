import {createHash} from "crypto";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getServerSecret} from "../../../../../lib/server-secrets";
import {sendExternalCustomerNotice} from "../../../../../lib/customer-notifications";

export const runtime="nodejs";
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
function adminClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!secret)throw new Error("Supabase server environment incomplete.");return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})}
function eqAmount(a:any,b:any){return Math.abs(Number(a||0)-Number(b||0))<1}
async function findOrders(admin:any,orderCode:string,invoiceId:string,transactionId:string){
  let token:any=null,sub:any=null;
  if(orderCode){
    const [a,b]=await Promise.all([
      admin.from("luma_topup_orders").select("*").eq("order_code",orderCode).maybeSingle(),
      admin.from("luma_subscription_orders").select("*,luma_subscription_plans(name,bonus_tokens)").eq("order_code",orderCode).maybeSingle()
    ]);token=a.data;sub=b.data;
  }
  if(!token&&!sub&&invoiceId){
    const [a,b]=await Promise.all([
      admin.from("luma_topup_orders").select("*").eq("payment_session_id",invoiceId).maybeSingle(),
      admin.from("luma_subscription_orders").select("*,luma_subscription_plans(name,bonus_tokens)").eq("payment_session_id",invoiceId).maybeSingle()
    ]);token=a.data;sub=b.data;
  }
  if(!token&&!sub&&transactionId){
    const [a,b]=await Promise.all([
      admin.from("luma_topup_orders").select("*").eq("payment_reference",transactionId).maybeSingle(),
      admin.from("luma_subscription_orders").select("*,luma_subscription_plans(name,bonus_tokens)").eq("payment_reference",transactionId).maybeSingle()
    ]);token=a.data;sub=b.data;
  }
  return {token,sub};
}

export async function POST(req:NextRequest){
  let admin:any=null;
  let eventId:number|null=null;
  let claimedOrderCode="";
  let claimedStatus="";
  try{
    admin=adminClient();
    const expected=await getServerSecret(admin,"luma_mayar_webhook_token");
    if(!expected)return NextResponse.json({ok:false,error:"Mayar webhook token belum dikonfigurasi."},{status:503});
    const received=new URL(req.url).searchParams.get("token")||req.headers.get("x-mayar-token")||"";
    if(received!==expected)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});

    const raw=await req.text();const body=JSON.parse(raw||"{}");const data=body?.data||body||{};
    const extra=data?.extraData||data?.extra_data||body?.extraData||{};
    const description=String(data?.productDescription||data?.description||body?.description||"");
    const descriptionOrder=description.match(/\\b(?:SUB|TOPUP)-[A-Z0-9]+\\b/i)?.[0]?.toUpperCase()||"";
    const orderCode=String(extra?.orderCode||extra?.order_code||data?.orderCode||data?.order_code||descriptionOrder||"").trim().toUpperCase();
    const invoiceId=String(data?.paymentLinkId||data?.productId||data?.product_id||data?.invoiceId||data?.invoice?.id||extra?.invoiceId||"");
    const transactionId=String(data?.transactionId||data?.transaction_id||data?.id||"");
    const eventKey=String(body?.eventId||body?.id||body?.event||"mayar")+"|"+String(transactionId||invoiceId||createHash("sha256").update(raw).digest("hex").slice(0,24));
    claimedOrderCode=orderCode;
    claimedStatus=String(data?.status||body?.event||"");

    const {data:claim,error:claimError}=await admin.rpc("luma_claim_payment_webhook_event_v1",{
      p_provider:"mayar",p_event_key:eventKey,p_order_code:orderCode||null,
      p_status:claimedStatus||null,p_payload:body
    });
    if(claimError)throw claimError;
    eventId=Number(claim?.event_id||0)||null;
    if(!claim?.claimed)return NextResponse.json({ok:true,duplicate:true,processed:true});

    const finish=async(ok:boolean,status?:string,error?:string)=>{
      if(!eventId)return;
      await admin.rpc("luma_finish_payment_webhook_event_v1",{
        p_event_id:eventId,p_ok:ok,p_order_code:claimedOrderCode||null,
        p_status:status||claimedStatus||null,p_error:error||null
      });
    };

    const orders=await findOrders(admin,orderCode,invoiceId,transactionId);
    const order=orders.sub||orders.token;
    if(!order){await finish(true,"ignored_order_not_found");return NextResponse.json({ok:true,ignored:true,reason:"order_not_found"})}
    claimedOrderCode=String(order.order_code||orderCode||"");

    const key=await getServerSecret(admin,"luma_mayar_api_key");
    if(!key){await finish(false,"config_error","Mayar API key belum tersedia.");return NextResponse.json({ok:false,error:"Mayar API key belum tersedia."},{status:503})}
    const verifyId=String(order.payment_session_id||invoiceId||"");
    if(!verifyId){await finish(false,"invalid_invoice","Mayar invoice id tidak tersedia.");return NextResponse.json({ok:false,error:"Mayar invoice id tidak tersedia."},{status:422})}

    const verifyRes=await fetch(`https://api.mayar.id/hl/v2/invoices/${encodeURIComponent(verifyId)}`,{headers:{Authorization:`Bearer ${key}`,Accept:"application/json"},cache:"no-store"});
    const verify=await verifyRes.json().catch(()=>({}));
    if(!verifyRes.ok||!verify?.data){await finish(false,"verification_failed","Gagal memverifikasi invoice Mayar.");return NextResponse.json({ok:false,error:"Gagal memverifikasi invoice Mayar."},{status:502})}
    const invoice=verify.data;
    if(!eqAmount(invoice.amount,order.amount)){await finish(false,"amount_mismatch","Nominal invoice Mayar tidak sesuai order.");return NextResponse.json({ok:false,error:"Nominal invoice Mayar tidak sesuai order."},{status:409})}

    const status=String(invoice.status||"").toLowerCase();
    if(status!=="paid"){
      if(["closed","expired","cancelled","canceled"].includes(status)){
        const table=orders.sub?"luma_subscription_orders":"luma_topup_orders";
        const nextStatus=status==="closed"?"expired":status;await admin.from(table).update({status:nextStatus,provider_payload:{webhook:body,verified_invoice:invoice}}).eq("id",order.id).neq("status","paid");if(order.checkout_intent_id)await admin.from("luma_payment_checkout_intents").update({status:"expired",updated_at:new Date().toISOString()}).eq("id",order.checkout_intent_id);
      }
      await finish(true,status||"ignored");
      return NextResponse.json({ok:true,ignored:true,verified_status:status||"unknown"});
    }

    const paymentRef=String(invoice.transactionId||transactionId||order.payment_reference||"");
    const app=`${String(process.env.NEXT_PUBLIC_APP_URL||"").replace(/\/$/,"")}/#billing`;
    if(orders.sub){
      const {data:result,error}=await admin.rpc("luma_complete_subscription",{p_order_code:order.order_code,p_payment_reference:paymentRef||null,p_provider_payload:{webhook:body,verified_invoice:invoice}});
      if(error)throw error;
      if(order.checkout_intent_id)await admin.from("luma_payment_checkout_intents").update({status:"paid",payment_reference:paymentRef||null,updated_at:new Date().toISOString()}).eq("id",order.checkout_intent_id);if(!result?.already_paid)await sendExternalCustomerNotice(admin,{userId:order.user_id,workspaceId:order.workspace_id,kind:"subscription_paid",title:"Langganan Lumaway aktif",message:`Pembayaran ${order.order_code} via Mayar.id berhasil. Paket ${order.luma_subscription_plans?.name||"Lumaway"} senilai ${money(order.amount)} telah aktif.`,actionUrl:app});
      await finish(true,"paid");
      return NextResponse.json({ok:true,type:"subscription",result,verified:true});
    }
    const {data:result,error}=await admin.rpc("luma_complete_topup",{p_order_code:order.order_code,p_payment_reference:paymentRef||null,p_provider_payload:{webhook:body,verified_invoice:invoice}});
    if(error)throw error;
    if(order.checkout_intent_id)await admin.from("luma_payment_checkout_intents").update({status:"paid",payment_reference:paymentRef||null,updated_at:new Date().toISOString()}).eq("id",order.checkout_intent_id);if(!result?.already_paid)await sendExternalCustomerNotice(admin,{userId:order.user_id,workspaceId:order.workspace_id,kind:"token_paid",title:"Top up token berhasil",message:`Pembayaran ${order.order_code} via Mayar.id berhasil. ${Number(order.package_tokens||0)} token senilai ${money(order.amount)} telah ditambahkan.`,actionUrl:app});
    await finish(true,"paid");
    return NextResponse.json({ok:true,type:"token",result,verified:true});
  }catch(error:any){
    if(admin&&eventId){
      try{await admin.rpc("luma_finish_payment_webhook_event_v1",{p_event_id:eventId,p_ok:false,p_order_code:claimedOrderCode||null,p_status:claimedStatus||null,p_error:String(error?.message||"Mayar webhook gagal diproses.")})}catch{}
    }
    return NextResponse.json({ok:false,error:error?.message||"Mayar webhook gagal diproses."},{status:400})
  }
}
