import {createHash} from "crypto";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getServerSecret} from "../../../../../lib/server-secrets";
import {sendExternalCustomerNotice} from "../../../../../lib/customer-notifications";
export const runtime="nodejs";
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
function adminClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!secret)throw new Error("Supabase server environment incomplete.");return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})}
export async function POST(req:NextRequest){
 try{
  const admin=adminClient();const key=await getServerSecret(admin,"luma_midtrans_server_key");if(!key)return NextResponse.json({ok:false,error:"Midtrans belum dikonfigurasi."},{status:503});
  const body=await req.json();const orderCode=String(body?.order_id||"");const statusCode=String(body?.status_code||"");const grossAmount=String(body?.gross_amount||"");const signature=String(body?.signature_key||"");
  const expected=createHash("sha512").update(orderCode+statusCode+grossAmount+key).digest("hex");
  if(!signature||signature!==expected)return NextResponse.json({ok:false,error:"Invalid Midtrans signature."},{status:401});
  if(!orderCode)return NextResponse.json({ok:true,ignored:true});
  const eventKey=`${String(body?.transaction_id||orderCode)}|${String(body?.transaction_status||"")}`;
  await admin.from("luma_payment_webhook_events").upsert({provider:"midtrans",event_key:eventKey,order_code:orderCode,status:String(body?.transaction_status||""),payload:body},{onConflict:"provider,event_key",ignoreDuplicates:true});
  const [{data:tokenOrder},{data:subOrder}]=await Promise.all([
    admin.from("luma_topup_orders").select("*").eq("order_code",orderCode).maybeSingle(),
    admin.from("luma_subscription_orders").select("*,luma_subscription_plans(name,bonus_tokens)").eq("order_code",orderCode).maybeSingle()
  ]);
  const order=subOrder||tokenOrder;if(!order)return NextResponse.json({ok:true,ignored:true});
  if(Math.abs(Number(grossAmount||0)-Number(order.amount||0))>=1)return NextResponse.json({ok:false,error:"Nominal Midtrans tidak sesuai order."},{status:409});
  const tx=String(body?.transaction_status||"").toLowerCase(),fraud=String(body?.fraud_status||"").toLowerCase();
  const success=tx==="settlement"||(tx==="capture"&&(!fraud||fraud==="accept"));
  const app=`${String(process.env.NEXT_PUBLIC_APP_URL||"").replace(/\/$/,"")}/#billing`;
  if(success){
    const paymentRef=String(body?.transaction_id||"");
    if(subOrder){const {data:result,error}=await admin.rpc("luma_complete_subscription",{p_order_code:orderCode,p_payment_reference:paymentRef||null,p_provider_payload:body});if(error)throw error;if(!result?.already_paid)await sendExternalCustomerNotice(admin,{userId:subOrder.user_id,workspaceId:subOrder.workspace_id,kind:"subscription_paid",title:"Langganan Lumaway aktif",message:`Pembayaran ${orderCode} via Midtrans berhasil. Paket ${subOrder.luma_subscription_plans?.name||"Lumaway"} senilai ${money(subOrder.amount)} telah aktif.`,actionUrl:app});return NextResponse.json({ok:true,type:"subscription",result})}
    const {data:result,error}=await admin.rpc("luma_complete_topup",{p_order_code:orderCode,p_payment_reference:paymentRef||null,p_provider_payload:body});if(error)throw error;if(!result?.already_paid)await sendExternalCustomerNotice(admin,{userId:tokenOrder.user_id,workspaceId:tokenOrder.workspace_id,kind:"token_paid",title:"Top up token berhasil",message:`Pembayaran ${orderCode} via Midtrans berhasil. ${Number(tokenOrder.package_tokens||0)} token telah ditambahkan.`,actionUrl:app});return NextResponse.json({ok:true,type:"token",result});
  }
  if(["expire","cancel","deny","failure"].includes(tx)){const table=subOrder?"luma_subscription_orders":"luma_topup_orders";const mapped=tx==="expire"?"expired":tx==="cancel"?"canceled":"failed";await admin.from(table).update({status:mapped,provider_payload:body}).eq("order_code",orderCode).neq("status","paid")}
  return NextResponse.json({ok:true,status:tx});
 }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Midtrans webhook gagal diproses."},{status:400})}
}
