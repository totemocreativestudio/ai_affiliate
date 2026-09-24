import {createHash} from "crypto";

type Kind="token"|"subscription";
type AcquireInput={admin:any;workspaceId:string;userId:string;kind:Kind;targetKey:string;promoCode?:string|null;amount:number};

export function intentOrderCode(kind:Kind,key:string){
  const prefix=kind==="token"?"TOPUP":"SUB";
  return `${prefix}-${key.slice(0,12).toUpperCase()}`;
}

export async function acquireCheckoutIntent(input:AcquireInput){
  const now=Date.now();
  const since=new Date(now-120000).toISOString();
  const promoCode=String(input.promoCode||"").trim().toUpperCase();
  const amount=Number(input.amount||0);

  const {data:existing,error:existingError}=await input.admin
    .from("luma_payment_checkout_intents")
    .select("*")
    .eq("workspace_id",input.workspaceId)
    .eq("user_id",input.userId)
    .eq("kind",input.kind)
    .eq("target_key",input.targetKey)
    .eq("promo_code",promoCode)
    .eq("amount",amount)
    .in("status",["processing","ready"])
    .gte("created_at",since)
    .order("created_at",{ascending:false})
    .limit(1)
    .maybeSingle();
  if(existingError)throw existingError;
  if(existing)return {intent:existing,owner:false,reused:true};

  const bucket=Math.floor(now/120000);
  const raw=[input.workspaceId,input.userId,input.kind,input.targetKey,promoCode,String(amount),String(bucket)].join("|");
  const key=createHash("sha256").update(raw).digest("hex");
  const orderCode=intentOrderCode(input.kind,key);
  const row={
    workspace_id:input.workspaceId,user_id:input.userId,kind:input.kind,target_key:input.targetKey,
    promo_code:promoCode,amount,idempotency_key:key,order_code:orderCode,status:"processing",
    updated_at:new Date().toISOString()
  };
  const {data:inserted,error}=await input.admin.from("luma_payment_checkout_intents").insert(row).select("*").single();
  if(!error&&inserted)return {intent:inserted,owner:true,reused:false};

  const {data:conflict,error:conflictError}=await input.admin
    .from("luma_payment_checkout_intents").select("*").eq("idempotency_key",key).single();
  if(conflictError)throw error||conflictError;
  return {intent:conflict,owner:false,reused:true};
}

export async function waitForCheckoutIntent(admin:any,intentId:number,attempts=10,delayMs=250){
  for(let i=0;i<attempts;i++){
    const {data,error}=await admin.from("luma_payment_checkout_intents").select("*").eq("id",intentId).single();
    if(error)throw error;
    if(data?.status==="ready"&&data?.payment_url)return data;
    if(data?.status==="failed"||data?.status==="expired")return data;
    await new Promise(resolve=>setTimeout(resolve,delayMs));
  }
  const {data,error}=await admin.from("luma_payment_checkout_intents").select("*").eq("id",intentId).single();
  if(error)throw error;
  return data;
}

export async function markCheckoutIntentReady(admin:any,intentId:number,checkout:any){
  const {error}=await admin.from("luma_payment_checkout_intents").update({
    status:"ready",provider:checkout.provider,payment_url:checkout.paymentUrl,
    payment_session_id:checkout.paymentSessionId,payment_reference:checkout.paymentReference,
    expires_at:checkout.expiresAt,last_error_code:null,updated_at:new Date().toISOString()
  }).eq("id",intentId);
  if(error)throw error;
}

export async function markCheckoutIntentFailed(admin:any,intentId:number,code:string){
  await admin.from("luma_payment_checkout_intents").update({
    status:"failed",last_error_code:String(code||"PAYMENT_GATEWAY_UNAVAILABLE").slice(0,80),
    updated_at:new Date().toISOString()
  }).eq("id",intentId);
}
