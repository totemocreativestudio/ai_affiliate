"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

type Row=Record<string,any>;
const fmt=(value:any)=>new Intl.NumberFormat("id-ID").format(Number(value||0));
const money=(value:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(value||0));
const months=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function newPlan(year:number,month:number){return {id:null as number|null,target_year:year,target_month:month,target_revenue:"",forecast_revenue:"",notes:""}}

export default function OwnerCommandCenterSummary({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const today=new Date();
 const [summary,setSummary]=useState<Row>({});
 const [system,setSystem]=useState<Row>({});
 const [providers,setProviders]=useState<Row[]>([]);
 const [issues,setIssues]=useState<Row[]>([]);
 const [targets,setTargets]=useState<Row[]>([]);
 const [realized,setRealized]=useState<Record<number,number>>({});
 const [year,setYear]=useState(today.getFullYear());
 const [plan,setPlan]=useState<any>(newPlan(today.getFullYear(),today.getMonth()+1));
 const [planMsg,setPlanMsg]=useState("");
 const [busy,setBusy]=useState(false);
 const [planBusy,setPlanBusy]=useState(false);

 async function load(){
  setBusy(true);
  const yearStart=`${year}-01-01T00:00:00Z`,nextYear=`${year+1}-01-01T00:00:00Z`;
  const [summaryRes,systemRes,providerRes,issueRes,targetRes,subscriptionRes,topupRes]=await Promise.all([
   supabase.rpc("get_owner_monitoring_summary"),
   supabase.from("luma_system_controls").select("*").eq("id",1).maybeSingle(),
   supabase.from("luma_provider_accounts").select("*").order("provider"),
   supabase.from("luma_issue_logs").select("id,severity,title,status,created_at").neq("status","resolved").order("created_at",{ascending:false}).limit(8),
   supabase.from("luma_business_monthly_targets").select("*").gte("target_year",year-1).lte("target_year",year).order("target_year").order("target_month"),
   supabase.from("luma_subscription_orders").select("amount,paid_at,status").eq("status","paid").gte("paid_at",yearStart).lt("paid_at",nextYear),
   supabase.from("luma_topup_orders").select("amount,paid_at,status").eq("status","paid").gte("paid_at",yearStart).lt("paid_at",nextYear)
  ]);
  setSummary(summaryRes.data||{});
  setSystem(systemRes.data||{});
  setProviders((providerRes.data||[]) as Row[]);
  setIssues((issueRes.data||[]) as Row[]);
  setTargets((targetRes.data||[]) as Row[]);
  const nextRealized:Record<number,number>={};
  for(const row of [...(subscriptionRes.data||[]),...(topupRes.data||[])] as Row[]){
   if(!row.paid_at)continue;
   const date=new Date(row.paid_at);if(date.getUTCFullYear()!==year)continue;
   const month=date.getUTCMonth()+1;nextRealized[month]=(nextRealized[month]||0)+Number(row.amount||0);
  }
  setRealized(nextRealized);
  setBusy(false);
 }

 useEffect(()=>{void load()},[workspaceId,year]);

 const currentTargets=targets.filter(row=>Number(row.target_year)===year);
 const targetFor=(month:number)=>currentTargets.find(row=>Number(row.target_month)===month);
 const previousTargetFor=(month:number)=>{
  if(month>1)return Number(targetFor(month-1)?.target_revenue||0);
  return Number(targets.find(row=>Number(row.target_year)===year-1&&Number(row.target_month)===12)?.target_revenue||0);
 };
 const currentMonth=today.getFullYear()===year?today.getMonth()+1:1;
 const current=targetFor(currentMonth);
 const currentTarget=Number(current?.target_revenue||0);
 const currentForecast=Number(current?.forecast_revenue||0);
 const currentActual=Number(realized[currentMonth]||0);
 const achievement=currentTarget>0?currentActual/currentTarget*100:0;
 const previousTarget=previousTargetFor(currentMonth);
 const targetGrowth=previousTarget>0?(currentTarget-previousTarget)/previousTarget*100:null;

 const now=Date.now();
 const providerAlerts=providers.filter(row=>row.status!=="active"||(row.renewal_at&&new Date(row.renewal_at).getTime()-now<7*86400000)||(Number(row.alert_threshold_idr||0)>0&&Number(row.balance_idr||0)<=Number(row.alert_threshold_idr)));
 const open=(tab:string,section?:string)=>window.dispatchEvent(new CustomEvent("luma-owner-nav",{detail:{tab,section}}));

 async function savePlan(){
  const target=Number(plan.target_revenue||0),forecast=Number(plan.forecast_revenue||0);
  if(target<0||forecast<0)return setPlanMsg("Target dan forecast tidak boleh negatif.");
  setPlanBusy(true);setPlanMsg("");
  const {data:{user}}=await supabase.auth.getUser();
  const payload={target_year:Number(plan.target_year),target_month:Number(plan.target_month),target_revenue:target,forecast_revenue:forecast,notes:String(plan.notes||"").trim()||null,updated_by:user?.id||null,updated_at:new Date().toISOString(),...(plan.id?{}:{created_by:user?.id||null})};
  const {error}=await supabase.from("luma_business_monthly_targets").upsert(payload,{onConflict:"target_year,target_month"});
  if(error)setPlanMsg(error.message);
  else{setPlanMsg("Target & forecast tersimpan.");setPlan(newPlan(year,currentMonth));await load()}
  setPlanBusy(false);
 }

 function editPlan(row:Row){
  setPlan({id:Number(row.id),target_year:Number(row.target_year),target_month:Number(row.target_month),target_revenue:String(row.target_revenue??""),forecast_revenue:String(row.forecast_revenue??""),notes:String(row.notes||"")});
  setPlanMsg(`Edit target ${months[Number(row.target_month)-1]} ${row.target_year}.`);
 }

 async function deletePlan(row:Row){
  if(!window.confirm(`Hapus target ${months[Number(row.target_month)-1]} ${row.target_year}?`))return;
  setPlanBusy(true);
  const {error}=await supabase.from("luma_business_monthly_targets").delete().eq("id",row.id);
  setPlanMsg(error?error.message:"Target & forecast dihapus.");
  if(!error){if(Number(plan.id)===Number(row.id))setPlan(newPlan(year,currentMonth));await load()}
  setPlanBusy(false);
 }

 return <div className="owner-command-summary">
  <div className="section-head"><div><h2>Command Center</h2><p className="muted">Ringkasan kondisi bisnis dan operasional Lumaway, target bulanan, forecast, serta pencapaian revenue terverifikasi.</p></div><button className="secondary" disabled={busy} onClick={()=>void load()}>{busy?"Refreshing...":"Refresh Summary"}</button></div>

  <div className="owner-kpi-grid"><Metric label="Users" value={fmt(summary.users)} sub={fmt(summary.active_users)+" active"}/><Metric label="Workspaces" value={fmt(summary.workspaces)} sub="customer databases"/><Metric label="Creators" value={fmt(summary.creators)} sub={fmt(summary.stores)+" stores"}/><Metric label="GMV Monitored" value={money(summary.gmv)} sub={fmt(summary.orders)+" customer orders"}/><Metric label="API Tokens" value={fmt(summary.api_total_tokens)} sub={fmt(summary.api_requests)+" calls"}/><Metric label="Open Issues" value={fmt(summary.open_issues)} sub="production"/></div>

  <section className="owner-panel target-control-panel">
   <div className="owner-panel-head"><div><h3>Monthly Target & Forecast</h3><p>Target bisnis Lumaway per bulan. Actual hanya menghitung pembayaran subscription + top-up token berstatus <b>paid</b>.</p></div><label className="target-year-select">Year<select value={year} onChange={event=>{const next=Number(event.target.value);setYear(next);setPlan(newPlan(next,1))}}>{Array.from({length:5},(_,index)=>today.getFullYear()-1+index).map(item=><option key={item} value={item}>{item}</option>)}</select></label></div>

   <div className="target-current-grid">
    <Metric label={`Target ${months[currentMonth-1]} ${year}`} value={money(currentTarget)} sub={targetGrowth==null?"Belum ada pembanding bulan lalu":`${targetGrowth>=0?"+":""}${targetGrowth.toFixed(1)}% dari target bulan sebelumnya`}/>
    <Metric label="Forecast" value={money(currentForecast)} sub={currentTarget>0?`${(currentForecast/currentTarget*100).toFixed(1)}% dari target`:"Set forecast bulanan"}/>
    <Metric label="Actual Verified Revenue" value={money(currentActual)} sub="subscription + token paid"/>
    <Metric label="Achievement" value={currentTarget>0?`${achievement.toFixed(1)}%`:"—"} sub={currentTarget>0?money(Math.max(0,currentTarget-currentActual))+" remaining":"Target belum diset"}/>
   </div>

   <div className="target-month-grid">
    {months.map((label,index)=>{
     const month=index+1,row=targetFor(month),target=Number(row?.target_revenue||0),forecast=Number(row?.forecast_revenue||0),actual=Number(realized[month]||0);
     const pct=target>0?actual/target*100:0,forecastPct=target>0?forecast/target*100:0,prev=previousTargetFor(month),growth=prev>0?(target-prev)/prev*100:null;
     return <article className={`target-month-card ${month===currentMonth?"current":""}`} key={month}>
      <header><strong>{label}</strong><span>{target>0?`${pct.toFixed(0)}%`:"No target"}</span></header>
      <div className="target-tall-bar" aria-label={`${label} achievement ${pct.toFixed(1)}%`}><i style={{height:`${Math.min(100,pct)}%`}}/><em style={{bottom:`${Math.min(100,forecastPct)}%`}} title="Forecast"/></div>
      <div className="target-month-values"><span>Target <b>{money(target)}</b></span><span>Actual <b>{money(actual)}</b></span><span>Forecast <b>{money(forecast)}</b></span><span>MoM Target <b>{growth==null?"—":`${growth>=0?"+":""}${growth.toFixed(1)}%`}</b></span></div>
      {row&&<button className="secondary target-edit-button" onClick={()=>editPlan(row)}>Edit</button>}
     </article>
    })}
   </div>

   <div className="target-plan-form">
    <div className="owner-panel-head"><div><h4>{plan.id?"Edit Monthly Plan":"Set Monthly Target & Forecast"}</h4><p>Simpan target sebagai acuan Command Center. Data dapat diedit atau dihapus kapan saja.</p></div>{plan.id&&<button className="secondary" onClick={()=>setPlan(newPlan(year,currentMonth))}>Cancel Edit</button>}</div>
    <div className="target-form-grid">
     <label>Year<input type="number" min="2020" max="2100" value={plan.target_year} onChange={event=>setPlan({...plan,target_year:event.target.value})}/></label>
     <label>Month<select value={plan.target_month} onChange={event=>setPlan({...plan,target_month:Number(event.target.value)})}>{months.map((label,index)=><option key={label} value={index+1}>{label}</option>)}</select></label>
     <label>Target Revenue<input type="number" min="0" value={plan.target_revenue} onChange={event=>setPlan({...plan,target_revenue:event.target.value})} placeholder="0"/></label>
     <label>Forecast Revenue<input type="number" min="0" value={plan.forecast_revenue} onChange={event=>setPlan({...plan,forecast_revenue:event.target.value})} placeholder="0"/></label>
     <label className="target-notes">Notes<input value={plan.notes} onChange={event=>setPlan({...plan,notes:event.target.value})} placeholder="Asumsi, campaign, pricing, atau catatan bulan ini"/></label>
    </div>
    <div className="button-row"><button className="primary" disabled={planBusy} onClick={()=>void savePlan()}>{planBusy?"Saving...":plan.id?"Update Target & Forecast":"Save Target & Forecast"}</button></div>
    {planMsg&&<div className="owner-inline-note">{planMsg}</div>}
   </div>

   <div className="owner-table-wrap target-plan-table"><table><thead><tr><th>Period</th><th>Target</th><th>Forecast</th><th>Actual</th><th>Achievement</th><th>Notes</th><th></th></tr></thead><tbody>{currentTargets.length?currentTargets.map(row=>{const month=Number(row.target_month),target=Number(row.target_revenue||0),actual=Number(realized[month]||0),pct=target>0?actual/target*100:0;return <tr key={row.id}><td>{months[month-1]} {row.target_year}</td><td>{money(target)}</td><td>{money(row.forecast_revenue)}</td><td>{money(actual)}</td><td>{target>0?`${pct.toFixed(1)}%`:"—"}</td><td>{row.notes||"-"}</td><td><div className="button-row"><button onClick={()=>editPlan(row)}>Edit</button><button onClick={()=>void deletePlan(row)}>Delete</button></div></td></tr>}):<tr><td colSpan={7}><div className="empty-state"><strong>Belum ada target untuk {year}.</strong></div></td></tr>}</tbody></table></div>
  </section>

  <div className="owner-command-grid">
   <section className="owner-panel"><div className="owner-panel-head"><div><h3>Platform Status</h3><p>Status global yang dilihat seluruh user.</p></div><span className={`integration-badge ${system.mode==="normal"?"connected":"disconnected"}`}>{String(system.mode||"normal").toUpperCase()}</span></div><strong>{system.title||"Lumaway berjalan normal"}</strong><p className="muted">{system.message||"Semua layanan utama tersedia."}</p><button className="secondary" onClick={()=>open("system","owner-system-control")}>Buka System & Issues</button></section>
   <section className="owner-panel"><div className="owner-panel-head"><div><h3>Needs Attention</h3><p>Provider, renewal, saldo, dan issue yang perlu ditinjau.</p></div><span className="priority-badge p-high">{providerAlerts.length+issues.length}</span></div>{providerAlerts.slice(0,4).map(row=><div className="owner-attention-row" key={row.id}><b>{row.display_name}</b><span>{row.status} · {row.renewal_at?"renew "+new Date(row.renewal_at).toLocaleDateString("id-ID"):"no renewal date"}</span></div>)}{issues.slice(0,4).map(row=><div className="owner-attention-row" key={"i-"+row.id}><b>{row.title}</b><span>{row.severity} · system issue</span></div>)}{!providerAlerts.length&&!issues.length&&<div className="empty-state"><strong>Tidak ada alert kritis.</strong></div>}<div className="button-row"><button className="secondary" onClick={()=>open("providers")}>Provider Accounts</button><button className="secondary" onClick={()=>open("system")}>Issues</button></div></section>
   <section className="owner-panel"><h3>Quick Access</h3><div className="owner-quick-grid"><button onClick={()=>open("monitoring")}>Monitoring 360<span>User, creator, store, token</span></button><button onClick={()=>open("finance")}>Payments & Subscription<span>Pricing, payment, promo</span></button><button onClick={()=>open("ai")}>AI & API Usage<span>Model, token, cost, provider</span></button><button onClick={()=>open("financial")}>Financial Reports<span>Lumaway revenue, API, cashflow, P&L</span></button><button onClick={()=>open("hpp")}>Lumaway Pricing Guardrail<span>Subscription unit economics</span></button><button onClick={()=>open("knowledge")}>Knowledge Vault<span>Product knowledge & tutorial</span></button></div></section>
  </div>
 </div>;
}

function Metric({label,value,sub}:{label:string;value:any;sub?:string}){return <div className="owner-metric"><span>{label}</span><b>{value}</b>{sub&&<small>{sub}</small>}</div>}
