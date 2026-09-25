import {randomUUID} from "crypto";
import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";
import {sendExternalCustomerNotice} from "../../../../lib/customer-notifications";
import {resolvePromo} from "../../../../lib/promo";
import {createPaymentCheckout} from "../../../../lib/payment-gateway";
import {acquireCheckoutIntent,markCheckoutIntentFailed,markCheckoutIntentReady,waitForCheckoutIntent} from "../../../../lib/payment-idempotency";

export const runtime="nodejs";
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));

export async function POST(req:NextRequest){
  let ctx:any=null;let workspaceId="",orderCode="",intentId:number|null=null;
  try{
    const body=await req.json();workspaceId=String(body.workspace_id||"");const packageId=Number(body.package_id||0);
    if(!workspaceId||!packageId)throw new Error("invalid request");
    ctx=await getServerContext(workspaceId);
    const {data:pkg,error:pkgError}=await ctx.admin.from("luma_token_packages").select("id,label,tokens,price,status").eq("id",packageId).single();
    if(pkgError||!pkg||pkg.status!=="active"||Number(pkg.price||0)<=0)throw new Error("Paket token belum tersedia.");

    const baseAmount=Number(pkg.price);let promo:any=null,discount=0;
    if(body.promo_code){const p=await resolvePromo(ctx.admin,ctx.user.id,String(body.promo_code),"token",pkg.id,baseAmount);promo=p.promo;discount=p.effect.discount_amount}
    const amount=Math.max(0,baseAmount-discount);
    const origin=(process.env.NEXT_PUBLIC_APP_URL||new URL(req.url).origin).replace(/\/$/,"");
    const expiresAt=new Date(Date.now()+3*86400000).toISOString();

    if(amount<=0){
      orderCode=`TOPUP-${randomUUID().replace(/-/g,"").slice(0,12).toUpperCase()}`;
      await ctx.admin.from("luma_topup_orders").insert({workspace_id:workspaceId,user_id:ctx.user.id,order_code:orderCode,package_tokens:pkg.tokens,base_amount:baseAmount,discount_amount:discount,amount:0,status:"pending",payment_provider:"Promo",payment_method:"Promo 100%",promo_id:promo?.id||null,expires_at:expiresAt});
      const {data:result,error}=await ctx.admin.rpc("luma_complete_topup",{p_order_code:orderCode,p_payment_reference:`PROMO-${promo?.code||"FREE"}`,p_provider_payload:{promo_code:promo?.code||null}});
      if(error)throw error;return NextResponse.json({ok:true,free:true,result});
    }

    const acquired=await acquireCheckoutIntent({
      admin:ctx.admin,workspaceId,userId:ctx.user.id,kind:"token",targetKey:`package:${pkg.id}`,
      promoCode:promo?.code||"",amount
    });
    intentId=Number(acquired.intent.id);orderCode=String(acquired.intent.order_code);

    if(!acquired.owner){
      const existing=await waitForCheckoutIntent(ctx.admin,intentId,12,250);
      if(existing?.status==="ready"&&existing?.payment_url){
        const providerName=existing.provider==="mayar"?"Mayar.id":existing.provider==="xendit"?"Xendit":existing.provider==="midtrans"?"Midtrans":"Payment";
        return NextResponse.json({ok:true,reused:true,order_code:orderCode,payment_url:existing.payment_url,expires_at:existing.expires_at,amount,discount_amount:discount,payment_provider:providerName});
      }
      return NextResponse.json({ok:false,error:"Pembayaran sedang diproses. Mohon tunggu beberapa detik lalu coba kembali.",code:"PAYMENT_PENDING"},{status:409});
    }

    let checkout:any;
    try{
      checkout=await createPaymentCheckout({
        admin:ctx.admin,user:ctx.user,workspaceId,orderCode,amount,expiresAt,origin,kind:"token",
        description:`Lumaway ${pkg.label} - ${pkg.tokens} token`,
        itemName:`Lumaway ${pkg.tokens} Token`,itemId:`token-${pkg.tokens}`,
        metadata:{package_tokens:String(pkg.tokens),promo_code:promo?.code||""}
      });
      await markCheckoutIntentReady(ctx.admin,intentId,checkout);
    }catch(error:any){
      await markCheckoutIntentFailed(ctx.admin,intentId,String(error?.message||"PAYMENT_GATEWAY_UNAVAILABLE"));
      throw error;
    }

    const providerName=checkout.provider==="mayar"?"Mayar.id":checkout.provider==="xendit"?"Xendit":"Midtrans";
    const {error:orderError}=await ctx.admin.from("luma_topup_orders").upsert({
      workspace_id:workspaceId,user_id:ctx.user.id,order_code:orderCode,package_tokens:pkg.tokens,
      base_amount:baseAmount,discount_amount:discount,amount,status:"pending",
      payment_provider:providerName,payment_method:"Secure Checkout",
      payment_session_id:checkout.paymentSessionId,payment_reference:checkout.paymentReference,
      payment_url:checkout.paymentUrl,promo_id:promo?.id||null,expires_at:checkout.expiresAt,
      checkout_intent_id:intentId,
      provider_payload:{...checkout.providerPayload,promo_code:promo?.code||null,attempted:checkout.attempted}
    },{onConflict:"order_code"});
    if(orderError)throw orderError;

    await ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:ctx.user.id,provider:checkout.provider,service:"payment_session",request_type:"token_checkout",status:"success",reference:orderCode,metadata:{amount,tokens:Number(pkg.tokens),promo_code:promo?.code||null,attempted:checkout.attempted,idempotent:true}});
    const expiryText=new Date(checkout.expiresAt).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",dateStyle:"medium",timeStyle:"short"});
    void sendExternalCustomerNotice(ctx.admin,{userId:ctx.user.id,workspaceId,kind:"token_checkout",title:"Checkout token dibuat",message:`Order ${orderCode} untuk ${pkg.tokens} token senilai ${money(amount)} dibuat melalui ${providerName}. Selesaikan pembayaran paling lambat ${expiryText} WIB.`,actionUrl:checkout.paymentUrl}).catch(()=>undefined);
    return NextResponse.json({ok:true,order_code:orderCode,payment_url:checkout.paymentUrl,expires_at:checkout.expiresAt,amount,discount_amount:discount,payment_provider:providerName,attempted:checkout.attempted});
  }catch(error:any){
    if(ctx){try{await ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId||null,user_id:ctx.user.id,provider:"payment-router",service:"payment_session",request_type:"token_checkout",status:"error",reference:orderCode||null,metadata:{error:error?.message||"unknown",intent_id:intentId}})}catch{}}
    return NextResponse.json({ok:false,error:"Sistem error, mohon tunggu beberapa saat. Sedang dalam perbaikan.",code:"PAYMENT_SYSTEM_ERROR"},{status:503});
  }
}
