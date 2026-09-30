const target=process.env.LOAD_URL||"https://app.lumaway.online/dashboard";
const total=Math.max(1,Number(process.env.LOAD_REQUESTS||100));
const concurrency=Math.max(1,Math.min(100,Number(process.env.LOAD_CONCURRENCY||10)));
const timeoutMs=Math.max(1000,Number(process.env.LOAD_TIMEOUT_MS||15000));
const method=String(process.env.LOAD_METHOD||"GET").toUpperCase();
const bearer=String(process.env.LOAD_AUTH_BEARER||"").trim();
const cookie=String(process.env.LOAD_COOKIE||"").trim();
const body=process.env.LOAD_BODY||"";

const results=[];
let cursor=0;
async function one(index){
  const started=performance.now();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const headers={"user-agent":"Lumaway-Load-Readiness/1.0"};
    if(bearer)headers.authorization="Bearer "+bearer;
    if(cookie)headers.cookie=cookie;
    if(body)headers["content-type"]="application/json";
    const res=await fetch(target,{method,headers,body:method==="GET"||method==="HEAD"?undefined:body||undefined,signal:controller.signal,redirect:"manual"});
    const elapsed=performance.now()-started;
    await res.arrayBuffer();
    results.push({index,status:res.status,ms:elapsed,ok:res.status>=200&&res.status<400});
  }catch(error){
    results.push({index,status:0,ms:performance.now()-started,ok:false,error:String(error?.name||error)});
  }finally{clearTimeout(timer)}
}
async function worker(){
  while(true){
    const index=cursor++;
    if(index>=total)return;
    await one(index);
  }
}
await Promise.all(Array.from({length:Math.min(concurrency,total)},()=>worker()));
const times=results.map(x=>x.ms).sort((a,b)=>a-b);
const percentile=p=>times.length?times[Math.min(times.length-1,Math.max(0,Math.ceil(times.length*p)-1))]:0;
const ok=results.filter(x=>x.ok).length;
const statusCounts=Object.fromEntries([...new Set(results.map(x=>x.status))].sort((a,b)=>a-b).map(status=>[status,results.filter(x=>x.status===status).length]));
const summary={
  target,method,total,concurrency,
  success:ok,failed:total-ok,error_rate_pct:Number((((total-ok)/total)*100).toFixed(2)),
  latency_ms:{min:Number((times[0]||0).toFixed(1)),p50:Number(percentile(.50).toFixed(1)),p95:Number(percentile(.95).toFixed(1)),p99:Number(percentile(.99).toFixed(1)),max:Number((times.at(-1)||0).toFixed(1))},
  status_counts:statusCounts
};
console.log(JSON.stringify(summary,null,2));
if(summary.error_rate_pct>5)process.exitCode=1;
