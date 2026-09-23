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
  try{
    const admin=adminClient();
    const expected=await getServerSecret(admin,"luma_mayar_webhook_token");
    if(!expected)return NextResponse.json({ok:false,error:"Mayar webhook token belum dikonfigurasi."},{status:503});
    const received=new URL(req.url).searchParams.get("token")||req.headers.get("x-mayar-token")||"";
    if(received!==expected)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});

    const raw=await req.text();const body=JSON.parse(raw||"{}");const data=body?.data||body||{};
    const extra=data?.extraData||data?.extra_data||body?.extraData||{};
    const orderCode=String(extra?.orderCode||extra?.order_code||data?.orderCode||data?.order_code||"");
    const invoiceId=String(data?.paymentLinkId||data?.invoiceId||data?.invoice?.id||extra?.invoiceId||"");
    const transactionId=String(data?.transactionId||data?.transaction_id||data?.id||"");
    const eventKey=String(body?.eventId||body?.id||body?.event||"mayar")+"|"+String(transactionId||invoiceId||createHash("sha256").update(raw).digest("hex").slice(0,24));

    await admin.from("luma_payment_webhook_events").upsert({provider:"mayar",event_key:eventKey,order_code:orderCode||null,status:String(data?.status||body?.event||""),payload:body},{onConflict:"provider,event_key",ignoreDuplicates:true});

    const orders=await findOrders(admin,orderCode,invoiceId,transactionId);
    const order=orders.sub||orders.token;
    if(!order)return NextResponse.json({ok:true,ignored:true,reason:"order_not_found"});

    const key=await getServerSecret(admin,"luma_mayar_api_key");
    if(!key)return NextResponse.json({ok:false,error:"Mayar API key belum tersedia."},{status:503});
    const verifyId=String(order.payment_session_id||invoiceId||"");
    if(!verifyId)return NextResponse.json({ok:false,error:"Mayar invoice id tidak tersedia."},{status:422});

    const verifyRes=await fetch(`https://api.mayar.id/hl/v2/invoices/${encodeURIComponent(verifyId)}`,{headers:{Authorization:`Bearer ${key}`,Accept:"application/json"},cache:"no-store"});
    const verify=await verifyRes.json().catch(()=>({}));
    if(!verifyRes.ok||!verify?.data)return NextResponse.json({ok:false,error:"Gagal memverifikasi invoice Mayar."},{status:502});
    const invoice=verify.data;
    if(!eqAmount(invoice.amount,order.amount))return NextResponse.json({ok:false,error:"Nominal invoice Mayar tidak sesuai order."},{status:409});

    const status=String(invoice.status||"").toLowerCase();
    if(status!=="paid"){
      if(["closed","expired","cancelled","canceled"].includes(status)){
        const table=orders.sub?"luma_subscription_orders":"luma_topup_orders";
        await admin.from(table).update({status:status==="closed"?"expired":status,provider_payload:{webhook:body,verified_invoice:invoice}}).eq("id",order.id).neq("status","paid");
      }
      return NextResponse.json({ok:true,ignored:true,verified_status:status||"unknown"});
    }

    const paymentRef=String(invoice.transactionId||transactionId||order.payment_reference||"");
    const app=`${String(process.env.NEXT_PUBLIC_APP_URL||"").replace(/\/$/,"")}/#billing`;
    if(orders.sub){
      const {data:result,error}=await admin.rpc("luma_complete_subscription",{p_order_code:order.order_code,p_payment_reference:paymentRef||null,p_provider_payload:{webhook:body,verified_invoice:invoice}});
      if(error)throw error;
      if(!result?.already_paid)await sendExternalCustomerNotice(admin,{userId:order.user_id,workspaceId:order.workspace_id,kind:"subscription_paid",title:"Langganan Lumaway aktif",message:`Pembayaran ${order.order_code} via Mayar.id berhasil. Paket ${order.luma_subscription_plans?.name||"Lumaway"} senilai ${money(order.amount)} telah aktif.`,actionUrl:app});
      return NextResponse.json({ok:true,type:"subscription",result,verified:true});
    }
    const {data:result,error}=await admin.rpc("luma_complete_topup",{p_order_code:order.order_code,p_payment_reference:paymentRef||null,p_provider_payload:{webhook:body,verified_invoice:invoice}});
    if(error)throw error;
    if(!result?.already_paid)await sendExternalCustomerNotice(admin,{userId:order.user_id,workspaceId:order.workspace_id,kind:"token_paid",title:"Top up token berhasil",message:`Pembayaran ${order.order_code} via Mayar.id berhasil. ${Number(order.package_tokens||0)} token senilai ${money(order.amount)} telah ditambahkan.`,actionUrl:app});
    return NextResponse.json({ok:true,type:"token",result,verified:true});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Mayar webhook gagal diproses."},{status:400})}
}
