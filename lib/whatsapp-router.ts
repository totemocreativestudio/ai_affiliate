import { getServerSecret } from "./server-secrets";
import { conviaSendTemplate, conviaSendText, DEFAULT_CONVIA_BASE_URL } from "./convia";

type Provider = "flowkirim" | "convia" | "meta";

type WhatsAppSettings = {
  provider: Provider;
  order: Provider[];
  failover: boolean;
  baseUrl: string;
  deviceId: string;
  phoneNumberId: string;
  template: string;
  language: string;
  graphVersion: string;
  conviaBaseUrl: string;
  conviaTemplate: string;
  conviaPhoneNumberId: string;
};

const normalizePhone = (input:string) => {
  let value=String(input||"").replace(/[^0-9+]/g,"");
  if(value.startsWith("08")) value="+62"+value.slice(1);
  else if(value.startsWith("62")) value="+"+value;
  else if(!value.startsWith("+")) value="+"+value;
  return value;
};

async function settings(admin:any):Promise<WhatsAppSettings>{
  const keys=[
    "whatsapp_provider","whatsapp_base_url","whatsapp_device_id","whatsapp_phone_number_id",
    "whatsapp_otp_template","whatsapp_template_language","whatsapp_graph_version",
    "convia_base_url","convia_otp_template","convia_phone_number_id",
    "whatsapp_failover_enabled","whatsapp_provider_order"
  ];
  const {data}=await admin.from("luma_platform_settings").select("setting_key,setting_value").in("setting_key",keys);
  const saved=Object.fromEntries((data||[]).map((x:any)=>[x.setting_key,x.setting_value||""]));
  const preferred=(process.env.WHATSAPP_PROVIDER||saved.whatsapp_provider||"flowkirim") as Provider;
  const requested=String(saved.whatsapp_provider_order||"flowkirim,convia,meta").split(",").map((x)=>x.trim()).filter((x):x is Provider=>["flowkirim","convia","meta"].includes(x));
  const order=[preferred,...requested].filter((x,i,a)=>a.indexOf(x)===i);
  return {
    provider:preferred,
    order,
    failover:String(saved.whatsapp_failover_enabled||"true").toLowerCase()!=="false",
    baseUrl:process.env.WHATSAPP_BASE_URL||process.env.FLOWKIRIM_BASE_URL||saved.whatsapp_base_url||"https://scan.flowkirim.com",
    deviceId:process.env.WHATSAPP_DEVICE_ID||process.env.FLOWKIRIM_DEVICE_ID||saved.whatsapp_device_id||"",
    phoneNumberId:process.env.WHATSAPP_PHONE_NUMBER_ID||saved.whatsapp_phone_number_id||"",
    template:process.env.WHATSAPP_OTP_TEMPLATE||saved.whatsapp_otp_template||"luma_otp",
    language:process.env.WHATSAPP_TEMPLATE_LANGUAGE||saved.whatsapp_template_language||"id",
    graphVersion:process.env.WHATSAPP_GRAPH_VERSION||saved.whatsapp_graph_version||"v24.0",
    conviaBaseUrl:process.env.CONVIA_BASE_URL||saved.convia_base_url||DEFAULT_CONVIA_BASE_URL,
    conviaTemplate:process.env.CONVIA_OTP_TEMPLATE||saved.convia_otp_template||"luma_otp",
    conviaPhoneNumberId:process.env.CONVIA_WHATSAPP_PHONE_NUMBER_ID||saved.convia_phone_number_id||"",
  };
}

async function markHealth(admin:any,provider:string,ok:boolean,error?:string){
  const now=new Date().toISOString();
  if(ok){
    await admin.from("luma_provider_accounts").update({status:"active",last_status:"ok",last_checked_at:now,consecutive_failures:0,updated_at:now}).eq("provider",provider).eq("service","whatsapp");
    return;
  }
  const {data}=await admin.from("luma_provider_accounts").select("consecutive_failures").eq("provider",provider).eq("service","whatsapp").maybeSingle();
  await admin.from("luma_provider_accounts").update({status:"error",last_status:String(error||"error").slice(0,300),last_checked_at:now,consecutive_failures:Number(data?.consecutive_failures||0)+1,updated_at:now}).eq("provider",provider).eq("service","whatsapp");
}

async function flowKirimText(admin:any,cfg:WhatsAppSettings,phone:string,message:string){
  const token=await getServerSecret(admin,"luma_whatsapp_access_token");
  if(!token) throw new Error("FlowKirim access token belum tersedia.");
  if(!cfg.deviceId) throw new Error("FlowKirim Device ID belum tersedia.");
  const base=cfg.baseUrl.replace(/\/$/,"");
  const sr=await fetch(`${base}/api/whatsapp/sessions/${encodeURIComponent(cfg.deviceId)}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
  const s=await sr.json().catch(()=>({}));
  const sessionId=s?.data?.session_id;
  if(!sr.ok||!s?.success||!sessionId) throw new Error(s?.message||`FlowKirim session tidak aktif (${sr.status}).`);
  const r=await fetch(`${base}/api/whatsapp/messages/text`,{
    method:"POST",
    headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",Accept:"application/json"},
    body:JSON.stringify({session_id:sessionId,to:normalizePhone(phone).replace(/\D/g,""),message}),
    cache:"no-store"
  });
  const raw=await r.json().catch(()=>({}));
  if(!r.ok||!raw?.success) throw new Error(raw?.message||`FlowKirim gagal mengirim pesan (${r.status}).`);
  return {provider:"flowkirim" as const,reference:raw?.data?.message_id||raw?.data?.id||null,sessionId};
}

async function conviaText(admin:any,cfg:WhatsAppSettings,phone:string,message:string){
  const key=await getServerSecret(admin,"luma_convia_api_key");
  if(!key) throw new Error("Convia API key belum tersedia.");
  const raw=await conviaSendText(key,normalizePhone(phone),message,{baseUrl:cfg.conviaBaseUrl,whatsappPhoneNumberId:cfg.conviaPhoneNumberId||undefined});
  return {provider:"convia" as const,reference:raw?.data?.message_id||null,sessionId:null};
}

async function metaOtp(admin:any,cfg:WhatsAppSettings,phone:string,code:string){
  const token=await getServerSecret(admin,"luma_whatsapp_access_token");
  if(!token) throw new Error("Meta WhatsApp access token belum tersedia.");
  if(!cfg.phoneNumberId) throw new Error("Meta WhatsApp Phone Number ID belum tersedia.");
  const r=await fetch(`https://graph.facebook.com/${cfg.graphVersion}/${encodeURIComponent(cfg.phoneNumberId)}/messages`,{
    method:"POST",
    headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify({messaging_product:"whatsapp",to:normalizePhone(phone).replace(/^\+/,""),type:"template",template:{name:cfg.template,language:{code:cfg.language},components:[{type:"body",parameters:[{type:"text",text:code}]}]}})
  });
  const raw=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(raw?.error?.message||"Meta WhatsApp gagal mengirim OTP.");
  return {provider:"meta" as const,reference:raw?.messages?.[0]?.id||null,sessionId:null};
}

async function conviaOtp(admin:any,cfg:WhatsAppSettings,phone:string,code:string){
  const key=await getServerSecret(admin,"luma_convia_api_key");
  if(!key) throw new Error("Convia API key belum tersedia.");
  const raw=await conviaSendTemplate(key,normalizePhone(phone),{
    name:cfg.conviaTemplate,
    language:cfg.language,
    components:[{type:"body",parameters:[{type:"text",text:code}]}]
  },{baseUrl:cfg.conviaBaseUrl,whatsappPhoneNumberId:cfg.conviaPhoneNumberId||undefined,autoCreateCustomer:true});
  return {provider:"convia" as const,reference:raw?.data?.message_id||null,sessionId:null,customerId:raw?.data?.customer_id||null};
}

export async function sendWhatsAppTextWithFailover(admin:any,phone:string,message:string){
  const cfg=await settings(admin);
  const providers=(cfg.failover?cfg.order:[cfg.provider]).filter((p)=>p!=="meta");
  const errors:string[]=[];
  for(const provider of providers){
    try{
      const result=provider==="flowkirim"?await flowKirimText(admin,cfg,phone,message):await conviaText(admin,cfg,phone,message);
      await markHealth(admin,provider,true);
      return {...result,failover_used:provider!==cfg.provider,attempted:providers.slice(0,providers.indexOf(provider)+1)};
    }catch(error:any){
      const message=String(error?.message||"unknown");
      errors.push(`${provider}: ${message}`);
      await markHealth(admin,provider,false,message).catch(()=>undefined);
    }
  }
  throw new Error(`Semua provider WhatsApp gagal. ${errors.join(" | ")}`);
}

export async function sendWhatsAppOtpWithFailover(admin:any,phone:string,code:string){
  const cfg=await settings(admin);
  const providers=cfg.failover?cfg.order:[cfg.provider];
  const errors:string[]=[];
  for(const provider of providers){
    try{
      const message=`Kode OTP Lumaway Anda: ${code}. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.`;
      const result=provider==="flowkirim"
        ? await flowKirimText(admin,cfg,phone,message)
        : provider==="convia"
          ? await conviaOtp(admin,cfg,phone,code)
          : await metaOtp(admin,cfg,phone,code);
      await markHealth(admin,provider,true);
      return {...result,failover_used:provider!==cfg.provider,attempted:providers.slice(0,providers.indexOf(provider)+1)};
    }catch(error:any){
      const message=String(error?.message||"unknown");
      errors.push(`${provider}: ${message}`);
      await markHealth(admin,provider,false,message).catch(()=>undefined);
    }
  }
  throw new Error(`Semua provider OTP WhatsApp gagal. ${errors.join(" | ")}`);
}

export async function getWhatsAppRoutingStatus(admin:any){
  const cfg=await settings(admin);
  return {primary:cfg.provider,order:cfg.order,failover:cfg.failover};
}
