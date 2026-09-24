import { createHash } from "crypto";
import { getServerSecret, hasServerSecret } from "./server-secrets";

export type PaymentProvider = "mayar"|"xendit"|"midtrans";
export type CheckoutInput = {
  admin:any;
  user:any;
  workspaceId:string;
  orderCode:string;
  amount:number;
  expiresAt:string;
  description:string;
  itemName:string;
  itemId:string;
  origin:string;
  kind:"subscription"|"token";
  metadata?:Record<string,any>;
};

export type CheckoutResult = {
  provider:PaymentProvider;
  paymentUrl:string;
  paymentSessionId:string|null;
  paymentReference:string|null;
  expiresAt:string;
  providerPayload:any;
  attempted:PaymentProvider[];
};

function normalizeMobile(raw:any){
  let v=String(raw||"").trim().replace(/[^0-9+]/g,"");
  if(!v)return "";
  if(v.startsWith("+62"))v="0"+v.slice(3);
  else if(v.startsWith("62"))v="0"+v.slice(2);
  return v;
}
function hashInt(value:string){
  return parseInt(createHash("sha256").update(value).digest("hex").slice(0,8),16)>>>0;
}
async function providerConfigured(admin:any,provider:PaymentProvider){
  if(provider==="mayar"){
    const [key,hook]=await Promise.all([hasServerSecret(admin,"luma_mayar_api_key"),hasServerSecret(admin,"luma_mayar_webhook_token")]);
    return key&&hook;
  }
  if(provider==="xendit"){
    const [key,hook]=await Promise.all([hasServerSecret(admin,"luma_xendit_secret_key"),hasServerSecret(admin,"luma_xendit_webhook_token")]);
    return key&&hook;
  }
  return hasServerSecret(admin,"luma_midtrans_server_key");
}
async function markHealth(admin:any,provider:PaymentProvider,ok:boolean,error?:string){
  try{await admin.rpc("luma_payment_provider_health",{p_provider:provider,p_ok:ok,p_error:error||null})}catch{}
}
async function routingOrder(admin:any,orderCode:string){
  const [{data:settings},{data:routing}]=await Promise.all([
    admin.from("luma_payment_provider_settings").select("provider,enabled,priority,weight,health_status,last_error_at").eq("enabled",true),
    admin.from("luma_payment_routing").select("mode").eq("id",1).maybeSingle()
  ]);
  const rows=((settings||[]) as any[]).filter(x=>["mayar","xendit","midtrans"].includes(String(x.provider)));
  const ready:any[]=[];
  for(const row of rows){
    const provider=String(row.provider) as PaymentProvider;
    if(await providerConfigured(admin,provider))ready.push({...row,provider});
  }
  ready.sort((a,b)=>Number(a.priority||999)-Number(b.priority||999));

  // Circuit breaker: a provider that failed in the last 5 minutes is not used as
  // the primary route while another configured provider is available. It remains
  // at the very end as a last-resort fallback and automatically rejoins after cooldown.
  const cooldownMs=5*60*1000;
  const recentError=(row:any)=>String(row.health_status||"")==="error"&&row.last_error_at&&(Date.now()-new Date(row.last_error_at).getTime())<cooldownMs;
  const primary=ready.filter(row=>!recentError(row));
  const cooling=ready.filter(row=>recentError(row));
  const pool=primary.length?primary:ready;

  let ordered:PaymentProvider[]=[];
  if(String(routing?.mode||"priority_fallback")==="weighted"&&pool.length>=2){
    const total=pool.reduce((s,x)=>s+Math.max(1,Number(x.weight||1)),0);
    let pick=hashInt(orderCode)%Math.max(1,total),first=0;
    for(let i=0;i<pool.length;i++){pick-=Math.max(1,Number(pool[i].weight||1));if(pick<0){first=i;break}}
    ordered=[...pool.slice(first),...pool.slice(0,first)].map(x=>x.provider) as PaymentProvider[];
  }else{
    ordered=pool.map(x=>x.provider) as PaymentProvider[];
  }
  if(primary.length){
    for(const row of cooling){if(!ordered.includes(row.provider))ordered.push(row.provider)}
  }
  return ordered;
}

async function customerInfo(admin:any,user:any){
  const {data:profile}=await admin.from("profiles").select("full_name,email,phone,whatsapp").eq("id",user.id).maybeSingle();
  const email=String(user.email||profile?.email||"").trim();
  const name=String(profile?.full_name||user.user_metadata?.full_name||user.user_metadata?.name||email.split("@")[0]||"Lumaway User").trim();
  const mobile=normalizeMobile(profile?.phone||profile?.whatsapp);
  return {name,email,mobile};
}

async function recoverMayarDuplicate(key:string,input:CheckoutInput,customer:{name:string;email:string;mobile:string}){
  try{
    const params=new URLSearchParams({email:customer.email,limit:"12"});
    const listRes=await fetch(`https://api.mayar.id/hl/v2/invoices/filter?${params.toString()}`,{headers:{Authorization:`Bearer ${key}`,Accept:"application/json"},cache:"no-store"});
    const listBody=await listRes.json().catch(()=>({}));
    if(!listRes.ok||!Array.isArray(listBody?.data))return null;
    const cutoff=Date.now()-5*60*1000;
    const candidates=listBody.data.filter((row:any)=>{
      const created=typeof row?.createdAt==="number"?Number(row.createdAt):new Date(row?.createdAt||0).getTime();
      return Math.abs(Number(row?.amount||0)-Number(input.amount||0))<1 && created>=cutoff;
    }).slice(0,8);
    for(const row of candidates){
      if(!row?.id)continue;
      const detailRes=await fetch(`https://api.mayar.id/hl/v2/invoices/${encodeURIComponent(String(row.id))}`,{headers:{Authorization:`Bearer ${key}`,Accept:"application/json"},cache:"no-store"});
      const detailBody=await detailRes.json().catch(()=>({}));
      const d=detailBody?.data;
      if(!detailRes.ok||!d)continue;
      const description=String(d?.description||"");
      if(!description.includes(input.orderCode))continue;
      const link=String(d?.link||d?.url||"");
      if(!link)continue;
      return {
        provider:"mayar" as PaymentProvider,
        paymentUrl:link,
        paymentSessionId:String(d.id||row.id)||null,
        paymentReference:String(d.transactionId||"")||null,
        expiresAt:d.expiredAt?new Date(Number(d.expiredAt)).toISOString():input.expiresAt,
        providerPayload:{invoice_id:d.id||row.id,transaction_id:d.transactionId||null,recovered_duplicate:true,order_code:input.orderCode}
      };
    }
  }catch{}
  return null;
}

async function createMayar(input:CheckoutInput){
  const [key,webhookToken]=await Promise.all([
    getServerSecret(input.admin,"luma_mayar_api_key"),
    getServerSecret(input.admin,"luma_mayar_webhook_token")
  ]);
  if(!key)throw new Error("Mayar API key belum tersedia.");
  if(!webhookToken)throw new Error("Mayar webhook token belum tersedia.");
  if(input.origin.startsWith("https://")){
    const {data:providerState}=await input.admin.from("luma_payment_provider_settings").select("webhook_registered_at").eq("provider","mayar").maybeSingle();
    const registeredAt=providerState?.webhook_registered_at?new Date(providerState.webhook_registered_at).getTime():0;
    const stale=!registeredAt||(Date.now()-registeredAt)>7*86400000;
    if(stale){
      const hookUrl=`${input.origin}/api/payments/webhook/mayar?token=${encodeURIComponent(webhookToken)}`;
      const hookRes=await fetch("https://api.mayar.id/hl/v2/webhooks/update",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({urlHook:hookUrl})});
      const hookBody=await hookRes.json().catch(()=>({}));
      if(!hookRes.ok||Number(hookBody?.statusCode||hookRes.status)>=400)throw new Error(String(hookBody?.messages||"Webhook Mayar gagal diregistrasikan."));
      await input.admin.from("luma_payment_provider_settings").update({webhook_registered_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("provider","mayar");
    }
  }
  const customer=await customerInfo(input.admin,input.user);
  if(!customer.email)throw new Error("Email user belum tersedia untuk checkout Mayar.");
  if(!customer.mobile)throw new Error("Nomor HP/WhatsApp user belum tersedia untuk checkout Mayar.");
  const payload={
    name:customer.name,
    email:customer.email,
    mobile:customer.mobile,
    redirectUrl:input.origin.startsWith("https://")?`${input.origin}/#billing`:undefined,
    description:`${input.description} · Order ${input.orderCode}`,
    expiredAt:input.expiresAt,
    items:[{quantity:1,rate:Math.round(input.amount),description:input.itemName}]
  };
  const r=await fetch("https://api.mayar.id/hl/v2/invoices/create",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(payload)});
  const body=await r.json().catch(()=>({}));
  const mayarMessage=String(body?.messages||body?.message||"Mayar checkout gagal.");
  if(!r.ok||Number(body?.statusCode||r.status)>=400||!body?.data?.link){
    if(/duplicate request/i.test(mayarMessage)){
      const recovered=await recoverMayarDuplicate(key,input,customer);
      if(recovered)return recovered;
      throw new Error("MAYAR_DUPLICATE_REQUEST");
    }
    throw new Error(mayarMessage);
  }
  const d=body.data;
  return {provider:"mayar" as PaymentProvider,paymentUrl:String(d.link),paymentSessionId:String(d.id||"")||null,paymentReference:String(d.transactionId||"")||null,expiresAt:d.expiredAt?new Date(Number(d.expiredAt)).toISOString():input.expiresAt,providerPayload:{invoice_id:d.id,transaction_id:d.transactionId,status_code:body.statusCode,order_code:input.orderCode}};
}

async function createXendit(input:CheckoutInput){
  const key=await getServerSecret(input.admin,"luma_xendit_secret_key");
  if(!key)throw new Error("Xendit secret key belum tersedia.");
  const customer=await customerInfo(input.admin,input.user);
  const payload:any={reference_id:input.orderCode,session_type:"PAY",mode:"PAYMENT_LINK",amount:input.amount,currency:"IDR",country:"ID",locale:"id",expires_at:input.expiresAt,description:input.description,customer:{reference_id:`luma-${input.user.id}-${Date.now()}`,type:"INDIVIDUAL",email:customer.email||undefined},items:[{reference_id:input.itemId,name:input.itemName,description:input.description,type:"DIGITAL_SERVICE",category:"SOFTWARE",net_unit_amount:input.amount,quantity:1,currency:"IDR"}],metadata:{workspace_id:input.workspaceId,user_id:input.user.id,kind:input.kind,...(input.metadata||{})}};
  if(input.origin.startsWith("https://")){payload.success_return_url=`${input.origin}/#billing`;payload.cancel_return_url=`${input.origin}/#billing`}
  const r=await fetch("https://api.xendit.co/sessions",{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${key}:`).toString("base64")}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const x=await r.json().catch(()=>({}));
  if(!r.ok||!x?.payment_link_url)throw new Error(String(x?.message||"Xendit checkout gagal."));
  return {provider:"xendit" as PaymentProvider,paymentUrl:String(x.payment_link_url),paymentSessionId:String(x.payment_session_id||"")||null,paymentReference:null,expiresAt:String(x.expires_at||input.expiresAt),providerPayload:{status:x.status}};
}

async function createMidtrans(input:CheckoutInput){
  const key=await getServerSecret(input.admin,"luma_midtrans_server_key");
  if(!key)throw new Error("Midtrans server key belum tersedia.");
  const customer=await customerInfo(input.admin,input.user);
  const payload:any={
    transaction_details:{order_id:input.orderCode,gross_amount:Math.round(input.amount)},
    item_details:[{id:input.itemId,price:Math.round(input.amount),quantity:1,name:input.itemName.slice(0,50)}],
    customer_details:{first_name:customer.name,email:customer.email||undefined,phone:customer.mobile||undefined},
    custom_field1:input.workspaceId,custom_field2:input.kind,
    page_expiry:{duration:3,unit:"days"}
  };
  if(input.origin.startsWith("https://"))payload.callbacks={finish:`${input.origin}/#billing`};
  const midHeaders:Record<string,string>={Authorization:`Basic ${Buffer.from(`${key}:`).toString("base64")}`,"Content-Type":"application/json",Accept:"application/json"};
  if(input.origin.startsWith("https://"))midHeaders["X-Override-Notification"]=`${input.origin}/api/payments/webhook/midtrans`;
  const r=await fetch("https://app.midtrans.com/snap/v1/transactions",{method:"POST",headers:midHeaders,body:JSON.stringify(payload)});
  const m=await r.json().catch(()=>({}));
  if(!r.ok||!m?.redirect_url)throw new Error(String(m?.error_messages?.[0]||m?.status_message||"Midtrans checkout gagal."));
  return {provider:"midtrans" as PaymentProvider,paymentUrl:String(m.redirect_url),paymentSessionId:String(m.token||"")||null,paymentReference:null,expiresAt:input.expiresAt,providerPayload:{token:m.token}};
}

export async function createPaymentCheckout(input:CheckoutInput):Promise<CheckoutResult>{
  const providers=await routingOrder(input.admin,input.orderCode);
  if(!providers.length)throw new Error("Belum ada payment gateway yang terkonfigurasi.");
  const attempted:PaymentProvider[]=[];
  for(const provider of providers){
    attempted.push(provider);
    try{
      const result=provider==="mayar"?await createMayar(input):provider==="xendit"?await createXendit(input):await createMidtrans(input);
      await markHealth(input.admin,provider,true);
      return {...result,attempted};
    }catch(e:any){
      const msg=String(e?.message||"payment provider error");
      const lower=msg.toLowerCase();
      const duplicate=provider==="mayar"&&(msg==="MAYAR_DUPLICATE_REQUEST"||lower.includes("duplicate request"));
      // Duplicate protection, missing profile data, and validation responses are not gateway outages.
      if(duplicate){
        await markHealth(input.admin,provider,true);
      }else if(!lower.includes("nomor hp")&&!lower.includes("email user")){
        await markHealth(input.admin,provider,false,msg);
      }
    }
  }
  throw new Error("PAYMENT_GATEWAY_UNAVAILABLE");
}

export async function getPaymentProviderStatus(admin:any){
  const [{data:settings},{data:routing}]=await Promise.all([
    admin.from("luma_payment_provider_settings").select("*").order("priority"),
    admin.from("luma_payment_routing").select("*").eq("id",1).maybeSingle()
  ]);
  const result=[] as any[];
  for(const row of settings||[]){
    const provider=String(row.provider) as PaymentProvider;
    result.push({...row,configured:await providerConfigured(admin,provider)});
  }
  return {mode:routing?.mode||"priority_fallback",providers:result,available:result.some(x=>x.enabled&&x.configured)};
}
