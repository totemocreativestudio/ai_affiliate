"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

type Metric="gmv"|"orders"|"qty"|"contribution_margin";
const rupiah=(n:number)=>"Rp "+Math.round(Number(n||0)).toLocaleString("id-ID");
const number=(n:number)=>Math.round(Number(n||0)).toLocaleString("id-ID");
const monthRange=()=>{
  const d=new Date(),y=d.getFullYear(),m=d.getMonth();
  const start=new Date(y,m,1),end=new Date(y,m+1,0);
  const f=(x:Date)=>x.toISOString().slice(0,10);
  return {start:f(start),end:f(end)};
};
function pct(actual:number,target:number){return target>0?Math.max(0,Math.round(actual/target*1000)/10):0}
function forecastLabel(f:number,t:number){
  if(!t)return "Target belum ditentukan";
  const p=f/t*100;
  if(p>=105)return "Forecast di atas target";
  if(p>=95)return "Forecast dekat target";
  return "Forecast perlu perhatian";
}

export default function GoalForecastCenter({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const initial=monthRange();
  const [start,setStart]=useState(initial.start);
  const [end,setEnd]=useState(initial.end);
  const [data,setData]=useState<any>(null);
  const [metric,setMetric]=useState<Metric>("gmv");
  const [editing,setEditing]=useState(false);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({gmv:"",orders:"",qty:"",margin:""});

  async function load(){
    setLoading(true);setMessage("");
    const result=await supabase.rpc("luma_goal_forecast_v1",{p_workspace_id:workspaceId,p_period_start:start,p_period_end:end});
    if(result.error){setMessage(result.error.message);setData(null)}else{
      const value:any=result.data||{};setData(value);
      setForm({gmv:String(value.target?.gmv||""),orders:String(value.target?.orders||""),qty:String(value.target?.qty||""),margin:String(value.target?.contribution_margin||"")});
    }
    setLoading(false);
  }
  useEffect(()=>{void load()},[workspaceId,start,end]);

  async function save(){
    const payload={workspace_id:workspaceId,period_start:start,period_end:end,target_gmv:Number(form.gmv||0),target_orders:Number(form.orders||0),target_qty:Number(form.qty||0),target_contribution_margin:Number(form.margin||0),updated_at:new Date().toISOString()};
    const result=await supabase.from("luma_workspace_goals").upsert(payload,{onConflict:"workspace_id,period_start,period_end"});
    if(result.error){setMessage(result.error.message);return}
    setEditing(false);setMessage("Target berhasil disimpan.");await load();
  }

  const cards=[
    ["GMV","gmv",rupiah] as const,
    ["Orders","orders",number] as const,
    ["Qty","qty",number] as const,
    ["Contribution Margin","contribution_margin",rupiah] as const,
  ];
  const points=(data?.daily||[]).map((x:any)=>Number(x[metric]||0));
  const max=Math.max(...points,1);
  const path=points.length>1?points.map((v:number,i:number)=>(i===0?"M":"L")+" "+(i/(points.length-1)*100)+" "+(92-(v/max)*78)).join(" "):"";
  const actual=Number(data?.actual?.[metric]||0),forecast=Number(data?.forecast?.[metric]||0),target=Number(data?.target?.[metric]||0);

  return <section id="goal-forecast" className="legacy-page-anchor goal-forecast-page">
    <div className="goal-head">
      <div><div className="eyebrow">GROWTH & WORKFLOW</div><h1>Goal & Forecast Center</h1><p>Bandingkan target, actual, dan forecast dari data workspace yang sudah masuk.</p></div>
      <div className="goal-period"><label>Mulai<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Sampai<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><button onClick={()=>setEditing(true)}>Atur Target</button></div>
    </div>
    {message&&<div className="goal-message">{message}</div>}
    {loading?<div className="goal-loading">Menghitung actual dan forecast...</div>:<>
      <div className="goal-scorecards">{cards.map(([label,key,format])=>{
        const a=Number(data?.actual?.[key]||0),t=Number(data?.target?.[key]||0),f=Number(data?.forecast?.[key]||0),p=pct(a,t);
        return <button key={key} className={metric===key?"active":""} onClick={()=>setMetric(key as Metric)}>
          <span>{label}</span><strong>{format(a)}</strong><div className="goal-progress"><i style={{width:String(Math.min(100,p))+"%"}}/></div><small>{p}% target · Forecast {format(f)}</small>
        </button>
      })}</div>

      <div className="goal-main-grid">
        <article className="goal-chart-card">
          <header><div><span>PERFORMANCE CURVE</span><h2>{cards.find(x=>x[1]===metric)?.[0]}</h2></div><div className="goal-legend"><i className="actual"/>Actual <i className="forecast"/>Forecast</div></header>
          <div className="goal-chart">
            {points.length>1?<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d={path} fill="none" vectorEffect="non-scaling-stroke"/><line x1="0" y1="94" x2="100" y2="94"/></svg>:<div className="goal-empty-chart">Data harian belum cukup untuk membentuk trend.</div>}
          </div>
          <footer><div><span>Actual</span><b>{metric==="gmv"||metric==="contribution_margin"?rupiah(actual):number(actual)}</b></div><div><span>Target</span><b>{metric==="gmv"||metric==="contribution_margin"?rupiah(target):number(target)}</b></div><div><span>Forecast</span><b>{metric==="gmv"||metric==="contribution_margin"?rupiah(forecast):number(forecast)}</b></div></footer>
        </article>

        <article className="goal-forecast-card">
          <span>FORECAST STATUS</span><h2>{forecastLabel(forecast,target)}</h2>
          <div className="forecast-ring" style={{"--progress":String(Math.min(100,pct(forecast,target)))+"%"} as any}><strong>{pct(forecast,target)}%</strong><small>forecast vs target</small></div>
          <p>{target>0?(forecast>=target?"Dengan pace saat ini, target berpotensi tercapai.":"Dengan pace saat ini, forecast masih di bawah target. Gunakan Daily Brief dan Automation Rules untuk menindaklanjuti gap."):"Masukkan target periode agar Lumaway dapat membaca gap dan pacing."}</p>
        </article>
      </div>

      <div className="goal-detail-grid">
        <article><span>Hari terdata</span><strong>{data?.period?.days_elapsed||0}/{data?.period?.days_total||0}</strong><small>Forecast memakai pace dari hari data yang tersedia.</small></article>
        <article><span>Refund</span><strong>{rupiah(data?.costs?.refund||0)}</strong><small>Dikurangi dari contribution margin.</small></article>
        <article><span>Commission + Ads</span><strong>{rupiah(Number(data?.costs?.commission||0)+Number(data?.costs?.ads_spend||0))}</strong><small>Biaya acquisition / affiliate.</small></article>
        <article><span>HPP + Shipping + Fee</span><strong>{rupiah(Number(data?.costs?.hpp||0)+Number(data?.costs?.shipping||0)+Number(data?.costs?.flat_fee||0))}</strong><small>Biaya operasional yang terbaca dari sales.</small></article>
      </div>
    </>}

    {editing&&<div className="goal-modal-backdrop" onClick={()=>setEditing(false)}><div className="goal-modal" onClick={e=>e.stopPropagation()}><header><div><span>TARGET PERIODE</span><h2>Atur Goal</h2></div><button onClick={()=>setEditing(false)}>×</button></header>
      <div className="goal-form"><label>Target GMV<input value={form.gmv} onChange={e=>setForm({...form,gmv:e.target.value})} inputMode="numeric"/></label><label>Target Orders<input value={form.orders} onChange={e=>setForm({...form,orders:e.target.value})} inputMode="numeric"/></label><label>Target Qty<input value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})} inputMode="numeric"/></label><label>Target Contribution Margin<input value={form.margin} onChange={e=>setForm({...form,margin:e.target.value})} inputMode="numeric"/></label></div>
      <footer><button onClick={()=>setEditing(false)}>Batal</button><button onClick={()=>void save()}>Simpan Target</button></footer>
    </div></div>}
  </section>
}
