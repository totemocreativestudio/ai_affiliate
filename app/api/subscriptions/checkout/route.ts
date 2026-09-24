import {randomUUID} from "crypto";
import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";
import {sendExternalCustomerNotice} from "../../../../lib/customer-notifications";
import {resolvePromo} from "../../../../lib/promo";
import {createPaymentCheckout} from "../../../../lib/payment-gateway";
import {acquireCheckoutIntent,markCheckoutIntentFailed,markCheckoutIntentReady,waitForCheckoutIntent} from "../../../../lib/payment-idempotency";

export const runtime="nodejs";
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));

function calculateUpgrade(current:any,target:any){
  const cp=current?.luma_subscription_plans;
  if(!current||!cp||cp.is_trial||String(current.status).toLowerCase()!=="active"||!current.ends_at||new Date(current.ends_at).getTime()<=Date.now())return null;
  if(Number(target.sort_order||0)<=Number(cp.sort_order||0)||Number(target.price||0)<=Number(cp.price||0))return null;
  const remainingDays=Math.max(0,(new Date(current.ends_at).getTime()-Date.now())/86400000);
  const credit=Math.min(Number(target.price||0),Math.max(0,Math.round((Number(cp.price||0)/Math.max(1,Number(cp.duration_days||1)))*remainingDays)));
  return {subscription_id:Number(current.id),from_plan_id:Number(current.plan_id),from_plan_code:String(cp.code||""),from_plan_name:String(cp.name||""),remaining_days:Math.round(remainingDays*100)/100,credit_amount:credit};
}

export async function POST(req:NextRequest){
  let ctx:any=null;let orderCode="",intentId:number|null=null;
  try{
    const body=await req.json();const workspaceId=String(body.workspace_id||"");const planId=Number(body.plan_id||0);
    if(!workspaceId||!planId)throw new Error("invalid request");
    ctx=await getServerContext(workspaceId);

    const {data:plan,error:planError}=await ctx.admin.from("luma_subscription_plans").select("*").eq("id",planId).eq("status","active").single();
    if(planError||!plan||plan.is_trial)throw new Error("Paket langganan tidak tersedia.");

    const {data:current}=await ctx.admin.from("luma_user_subscriptions")
      .select("id,user_id,workspace_id,plan_id,status,starts_at,ends_at,luma_subscription_plans(id,code,name,price,duration_days,sort_order,is_trial)")
      .eq("user_id",ctx.user.id).in("status",["trialing","active"]).order("ends_at",{ascending:false}).limit(1).maybeSingle();

    const cp=current?.luma_subscription_plans;
    const currentPaid=Boolean(current&&cp&&!cp.is_trial&&String(current.status).toLowerCase()==="active"&&current.ends_at&&new Date(current.ends_at).getTime()>Date.now());
    if(currentPaid&&Number(plan.sort_order||0)<Number(cp.sort_order||0)){
      return NextResponse.json({ok:false,error:"Paket aktif tidak dapat diturunkan sebelum masa aktif berakhir. Anda tetap dapat memperpanjang paket yang sama atau upgrade."},{status:409});
    }

    const upgrade=calculateUpgrade(current,plan);
    const baseAmount=Number(plan.price||0),upgradeCredit=Number(upgrade?.credit_amount||0),subtotal=Math.max(0,baseAmount-upgradeCredit);
    let promo:any=null,promoDiscount=0;
    if(body.promo_code){const r=await resolvePromo(ctx.admin,ctx.user.id,String(body.promo_code),"subscription",plan.code,subtotal);promo=r.promo;promoDiscount=Number(r.effect.discount_amount||0)}
    const amount=Math.max(0,subtotal-promoDiscount);
    const origin=(process.env.NEXT_PUBLIC_APP_URL||new URL(req.url).origin).replace(/\/$/,"");
    const expiresAt=new Date(Date.now()+3*86400000).toISOString();

    if(amount<=0){
      orderCode=`SUB-${randomUUID().replace(/-/g,"").slice(0,12).toUpperCase()}`;
      const orderRow={user_id:ctx.user.id,workspace_id:workspaceId,plan_id:plan.id,order_code:orderCode,base_amount:baseAmount,discount_amount:promoDiscount,amount,status:"pending",promo_id:promo?.id||null,expires_at:expiresAt,upgrade_from_subscription_id:upgrade?.subscription_id||null,upgrade_credit_days:Number(upgrade?.remaining_days||0),upgrade_credit_amount:upgradeCredit};
      const {error:insertError}=await ctx.admin.from("luma_subscription_orders").insert({...orderRow,payment_provider:"Promo/Credit",payment_method:"Covered by promo or upgrade credit",provider_payload:{promo_code:promo?.code||null,upgrade}});
      if(insertError)throw insertError;
      const {data:result,error}=await ctx.admin.rpc("luma_complete_subscription",{p_order_code:orderCode,p_payment_reference:`CREDIT-${promo?.code||"UPGRADE"}`,p_provider_payload:{promo_code:promo?.code||null,upgrade}});
      if(error)throw error;
      return NextResponse.json({ok:true,free:true,result,pricing:{base_amount:baseAmount,upgrade_credit_amount:upgradeCredit,promo_discount_amount:promoDiscount,amount:0,upgrade}});
    }

    const targetKey=`plan:${plan.id}:upgrade:${upgrade?.subscription_id||0}`;
    const acquired=await acquireCheckoutIntent({
      admin:ctx.admin,workspaceId,userId:ctx.user.id,kind:"subscription",targetKey,
      promoCode:promo?.code||"",amount
    });
    intentId=Number(acquired.intent.id);orderCode=String(acquired.intent.order_code);

    if(!acquired.owner){
      const existing=await waitForCheckoutIntent(ctx.admin,intentId,12,250);
      if(existing?.status==="ready"&&existing?.payment_url){
        const providerName=existing.provider==="mayar"?"Mayar.id":existing.provider==="xendit"?"Xendit":existing.provider==="midtrans"?"Midtrans":"Payment";
        return NextResponse.json({ok:true,reused:true,order_code:orderCode,payment_url:existing.payment_url,expires_at:existing.expires_at,payment_provider:providerName,pricing:{base_amount:baseAmount,upgrade_credit_amount:upgradeCredit,promo_discount_amount:promoDiscount,amount,upgrade}});
      }
      return NextResponse.json({ok:false,error:"Pembayaran sedang diproses. Mohon tunggu beberapa detik lalu coba kembali.",code:"PAYMENT_PENDING"},{status:409});
    }

    let checkout:any;
    try{
      checkout=await createPaymentCheckout({
        admin:ctx.admin,user:ctx.user,workspaceId,orderCode,amount,expiresAt,origin,kind:"subscription",
        description:upgrade?`Lumaway upgrade ke ${plan.name}`:`Lumaway ${plan.name}`,
        itemName:upgrade?`Upgrade Lumaway ${plan.name}`:`Lumaway ${plan.name}`,
        itemId:`subscription-${plan.code}`,
        metadata:{plan_code:plan.code,upgrade_from_subscription_id:upgrade?.subscription_id?String(upgrade.subscription_id):"",upgrade_credit_amount:String(upgradeCredit),promo_code:promo?.code||""}
      });
      await markCheckoutIntentReady(ctx.admin,intentId,checkout);
    }catch(error:any){
      await markCheckoutIntentFailed(ctx.admin,intentId,String(error?.message||"PAYMENT_GATEWAY_UNAVAILABLE"));
      throw error;
    }

    const providerName=checkout.provider==="mayar"?"Mayar.id":checkout.provider==="xendit"?"Xendit":"Midtrans";
    const orderRow={user_id:ctx.user.id,workspace_id:workspaceId,plan_id:plan.id,order_code:orderCode,base_amount:baseAmount,discount_amount:promoDiscount,amount,status:"pending",promo_id:promo?.id||null,expires_at:checkout.expiresAt,upgrade_from_subscription_id:upgrade?.subscription_id||null,upgrade_credit_days:Number(upgrade?.remaining_days||0),upgrade_credit_amount:upgradeCredit};
    const {error:orderError}=await ctx.admin.from("luma_subscription_orders").upsert({
      ...orderRow,payment_provider:providerName,payment_method:"Secure Checkout",
      payment_session_id:checkout.paymentSessionId,payment_reference:checkout.paymentReference,payment_url:checkout.paymentUrl,
      checkout_intent_id:intentId,
      provider_payload:{...checkout.providerPayload,promo_code:promo?.code||null,upgrade,attempted:checkout.attempted}
    },{onConflict:"order_code"});
    if(orderError)throw orderError;

    const expiryText=new Date(checkout.expiresAt).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",dateStyle:"medium",timeStyle:"short"});
    const priceMessage=upgrade?`Harga ${money(baseAmount)}, kredit sisa paket ${money(upgradeCredit)}, total pembayaran ${money(amount)}.`:`Total pembayaran ${money(amount)}.`;
    await sendExternalCustomerNotice(ctx.admin,{userId:ctx.user.id,workspaceId,kind:"subscription_checkout",title:"Checkout langganan dibuat",message:`Order ${orderCode} melalui ${providerName}. ${priceMessage} Selesaikan pembayaran paling lambat ${expiryText} WIB.`,actionUrl:checkout.paymentUrl});
    await ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:ctx.user.id,provider:checkout.provider,service:"payment_session",request_type:"subscription_checkout",status:"success",reference:orderCode,metadata:{amount,plan_code:plan.code,attempted:checkout.attempted,idempotent:true}});

    return NextResponse.json({ok:true,order_code:orderCode,payment_url:checkout.paymentUrl,expires_at:checkout.expiresAt,payment_provider:providerName,attempted:checkout.attempted,pricing:{base_amount:baseAmount,upgrade_credit_amount:upgradeCredit,promo_discount_amount:promoDiscount,amount,upgrade}});
  }catch(error:any){
    if(ctx){try{await ctx.admin.from("luma_api_usage_events").insert({workspace_id:null,user_id:ctx.user.id,provider:"payment-router",service:"payment_session",request_type:"subscription_checkout",status:"error",reference:orderCode||null,metadata:{error:error?.message||"unknown",intent_id:intentId}})}catch{}}
    return NextResponse.json({ok:false,error:"Sistem error, mohon tunggu beberapa saat. Sedang dalam perbaikan.",code:"PAYMENT_SYSTEM_ERROR"},{status:503});
  }
}
