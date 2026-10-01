const targets=(process.env.LOAD_TARGETS||process.env.LOAD_URL||"https://app.lumaway.online/dashboard").split(",").map(x=>x.trim()).filter(Boolean);
const total=Math.max(1,Number(process.env.LOAD_REQUESTS||100));
const concurrency=Math.max(1,Math.min(100,Number(process.env.LOAD_CONCURRENCY||10)));
const timeoutMs=Math.max(1000,Number(process.env.LOAD_TIMEOUT_MS||15000));
const method=String(process.env.LOAD_METHOD||"GET").toUpperCase();
const bearer=String(process.env.LOAD_AUTH_BEARER||"").trim();
const cookie=String(process.env.LOAD_COOKIE||"").trim();
const body=process.env.LOAD_BODY||"";
const budgetP95=Math.max(1,Number(process.env.LOAD_BUDGET_P95_MS||1500));
const budgetError=Math.max(0,Number(process.env.LOAD_BUDGET_ERROR_PCT||1));

async function runTarget(target){
  const results=[];let cursor=0;
  async function one(index){
    const started=performance.now();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const headers={"user-agent":"Lumaway-Load-Readiness/2.0","x-lumaway-load-test":"1"};
      if(bearer)headers.authorization="Bearer "+bearer;if(cookie)headers.cookie=cookie;if(body)headers["content-type"]="application/json";
      const res=await fetch(target,{method,headers,body:method==="GET"||method==="HEAD"?undefined:body||undefined,signal:controller.signal,redirect:"manual"});
      const elapsed=performance.now()-started;await res.arrayBuffer();
      results.push({index,status:res.status,ms:elapsed,ok:res.status>=200&&res.status<400});
    }catch(error){results.push({index,status:0,ms:performance.now()-started,ok:false,error:String(error?.name||error)})}
    finally{clearTimeout(timer)}
  }
  async function worker(){while(true){const index=cursor++;if(index>=total)return;await one(index)}}
  await Promise.all(Array.from({length:Math.min(concurrency,total)},()=>worker()));
  const times=results.map(x=>x.ms).sort((a,b)=>a-b);
  const pct=p=>times.length?times[Math.min(times.length-1,Math.max(0,Math.ceil(times.length*p)-1))]:0;
  const ok=results.filter(x=>x.ok).length;const errorRate=((total-ok)/total)*100;
  const summary={target,method,total,concurrency,success:ok,failed:total-ok,error_rate_pct:+errorRate.toFixed(2),
    latency_ms:{min:+(times[0]||0).toFixed(1),p50:+pct(.5).toFixed(1),p95:+pct(.95).toFixed(1),p99:+pct(.99).toFixed(1),max:+(times.at(-1)||0).toFixed(1)},
    status_counts:Object.fromEntries([...new Set(results.map(x=>x.status))].sort((a,b)=>a-b).map(s=>[s,results.filter(x=>x.status===s).length]))};
  summary.budget={p95_ms:budgetP95,error_rate_pct:budgetError,latency_pass:summary.latency_ms.p95<=budgetP95,error_pass:summary.error_rate_pct<=budgetError};
  summary.pass=summary.budget.latency_pass&&summary.budget.error_pass;
  return summary;
}
const summaries=[];
for(const target of targets)summaries.push(await runTarget(target));
const output={generated_at:new Date().toISOString(),config:{total,concurrency,timeoutMs,budgetP95,budgetError},results:summaries,pass:summaries.every(x=>x.pass)};
console.log(JSON.stringify(output,null,2));
if(!output.pass)process.exitCode=1;
