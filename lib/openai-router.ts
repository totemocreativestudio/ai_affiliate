type Usage={input_tokens?:number;output_tokens?:number;total_tokens?:number};

const PRICE:Record<string,{input:number;output:number}>={
  "gpt-5.6-sol":{input:4,output:20},
  "gpt-5.6":{input:4,output:20},
  "gpt-5.6-luna":{input:0.2,output:1.2},
};

export async function getOpenAIRouting(admin:any,preferred?:string){
  const {data}=await admin.from("luma_platform_settings").select("setting_key,setting_value").in("setting_key",["openai_primary_model","openai_fallback_model","usd_idr_rate"]);
  const settings=Object.fromEntries((data||[]).map((x:any)=>[x.setting_key,x.setting_value||""]));
  const primary=String(preferred||settings.openai_primary_model||process.env.OPENAI_MODEL||"gpt-5.6-sol");
  const fallback=String(settings.openai_fallback_model||"gpt-5.6-luna");
  const models=[primary,fallback].filter((x,i,a)=>x&&a.indexOf(x)===i);
  const fx=Math.max(1,Number(settings.usd_idr_rate||17745));
  return {models,fx};
}

export function openAICost(model:string,usage:Usage,fx=17745){
  const rate=PRICE[model]||PRICE["gpt-5.6-sol"];
  const input=Number(usage?.input_tokens||0);
  const output=Number(usage?.output_tokens||0);
  const usd=(input*rate.input+output*rate.output)/1_000_000;
  return {cost_usd:Math.round(usd*1e8)/1e8,cost_idr:Math.round(usd*fx*100)/100,input_per_million_usd:rate.input,output_per_million_usd:rate.output,fx};
}

async function markHealth(admin:any,ok:boolean,error?:string){
  const update:any={status:ok?"active":"error",last_status:ok?"ok":String(error||"error").slice(0,300),last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  if(ok) update.consecutive_failures=0;
  const {data}=await admin.from("luma_provider_accounts").select("consecutive_failures").eq("provider","openai").eq("service","responses").maybeSingle();
  if(!ok) update.consecutive_failures=Number(data?.consecutive_failures||0)+1;
  await admin.from("luma_provider_accounts").update(update).eq("provider","openai").eq("service","responses");
}

export async function openAIResponsesWithFailover(admin:any,apiKey:string,payload:any,preferred?:string){
  const routing=await getOpenAIRouting(admin,preferred);
  const errors:string[]=[];
  for(const model of routing.models){
    try{
      const response=await fetch("https://api.openai.com/v1/responses",{
        method:"POST",
        headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
        body:JSON.stringify({...payload,model})
      });
      const raw=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(raw?.error?.message||`OpenAI request failed (${response.status})`);
      await markHealth(admin,true).catch(()=>undefined);
      return {raw,model,fx:routing.fx,cost:openAICost(model,raw?.usage||{},routing.fx),fallback_used:model!==routing.models[0]};
    }catch(error:any){
      const message=String(error?.message||"unknown");
      errors.push(`${model}: ${message}`);
      await markHealth(admin,false,message).catch(()=>undefined);
    }
  }
  throw new Error(`Semua model OpenAI gagal. ${errors.join(" | ")}`);
}
