"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

const rp=(v:any)=>"Rp "+Math.round(Number(v||0)).toLocaleString("id-ID");
const no=(v:any)=>Math.round(Number(v||0)).toLocaleString("id-ID");

export default function LiveCampaignPanel({workspaceId,start,end}:{workspaceId:string;start:string;end:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [data,setData]=useState<any>({campaigns:[],gimmicks:[]}),[open,setOpen]=useState(false),[msg,setMsg]=useState("");
 const [form,setForm]=useState({name:"",start_date:start,end_date:end,target_gmv:"",target_orders:"",budget:"",status:"active"});
 async function load(){const x=await supabase.rpc("luma_live_campaign_overview_v1",{p_workspace_id:workspaceId,p_start:start,p_end:end});if(x.error)setMsg(x.error.message);else{setData(x.data||{campaigns:[],gimmicks:[]});setMsg("")}}
 useEffect(()=>{setForm(f=>({...f,start_date:start,end_date:end}));void load()},[workspaceId,start,end]);
 async function save(){
  if(!form.name.trim()){setMsg("Nama campaign wajib diisi.");return}
  const x=await supabase.from("live_campaigns").insert({workspace_id:workspaceId,name:form.name.trim(),start_date:form.start_date,end_date:form.end_date,target_gmv:Number(form.target_gmv||0),target_orders:Number(form.target_orders||0),budget:Number(form.budget||0),status:form.status});
  if(x.error){setMsg(x.error.message);return}
  setOpen(false);setForm({...form,name:"",target_gmv:"",target_orders:"",budget:""});await load()
 }
 const campaigns=data.campaigns||[],gimmicks=data.gimmicks||[];
 const totals=campaigns.reduce((a:any,c:any)=>({target:a.target+Number(c.target_gmv||0),gmv:a.gmv+Number(c.gmv||0),orders:a.orders+Number(c.orders||0),targetOrders:a.targetOrders+Number(c.target_orders||0),budget:a.budget+Number(c.budget||0),cost:a.cost+Number(c.actual_cost||0),sessions:a.sessions+Number(c.sessions||0)}),{target:0,gmv:0,orders:0,targetOrders:0,budget:0,cost:0,sessions:0});
 const achievement=totals.target>0?totals.gmv/totals.target*100:0;
 const budgetUse=totals.budget>0?totals.cost/totals.budget*100:0;

 return <div className="live-campaign-panel lc-v2">
  <div className="lc-hero">
   <div><span>LIVE CAMPAIGN TRACKER</span><h2>Campaign Performance</h2><p>Target, achievement, biaya dan gimmick Live dalam periode yang sama dengan dashboard utama.</p></div>
   <div className="lc-hero-actions"><div className="live-shared-period"><span>Periode Live</span><b>{start} → {end}</b></div><button onClick={()=>setOpen(true)}>+ Buat Campaign</button></div>
  </div>
  {msg&&<div className="live-upload-msg">{msg}</div>}

  <div className="lc-summary">
   <article><span>Campaign</span><strong>{no(campaigns.length)}</strong><small>{no(totals.sessions)} session terhubung</small></article>
   <article><span>Target GMV</span><strong>{rp(totals.target)}</strong><small>Akumulasi target aktif</small></article>
   <article className="accent"><span>Achievement GMV</span><strong>{rp(totals.gmv)}</strong><small>{achievement.toFixed(1)}% dari target</small></article>
   <article><span>Orders</span><strong>{no(totals.orders)}</strong><small>Target {no(totals.targetOrders)}</small></article>
   <article><span>Budget</span><strong>{rp(totals.budget)}</strong><small>Actual {rp(totals.cost)}</small></article>
   <article><span>Budget Usage</span><strong>{budgetUse.toFixed(1)}%</strong><small>{totals.budget>0?(totals.cost<=totals.budget?"Dalam budget":"Melebihi budget"):"Belum ada budget"}</small></article>
  </div>

  <div className="lc-v2-grid">
   <section className="lc-campaigns-v2">
    <header><div><span>CAMPAIGN TRACKER</span><h3>Target vs Achievement</h3><p>Progress tiap campaign berdasarkan session yang sudah terhubung.</p></div><b>{campaigns.length} campaign</b></header>
    {campaigns.length?<div className="lc-campaign-list">{campaigns.map((c:any)=>{
      const gmv=Number(c.gmv||0),target=Number(c.target_gmv||0),progress=target>0?gmv/target*100:0;
      const orderProgress=Number(c.target_orders||0)>0?Number(c.orders||0)/Number(c.target_orders)*100:0;
      return <article className="lc-campaign-card" key={c.id}>
       <div className="lc-card-top"><div><span className={"lc-status "+String(c.status||"draft").toLowerCase()}>{c.status||"draft"}</span><h4>{c.name}</h4><small>{c.start_date||"-"} → {c.end_date||"-"} · {no(c.sessions)} session</small></div><div className="lc-card-ach"><strong>{progress.toFixed(1)}%</strong><span>GMV achievement</span></div></div>
       <div className="lc-card-metrics"><div><span>GMV</span><b>{rp(gmv)}</b><small>Target {rp(target)}</small></div><div><span>Orders</span><b>{no(c.orders)}</b><small>{orderProgress.toFixed(1)}% target</small></div><div><span>Actual Cost</span><b>{rp(c.actual_cost)}</b><small>Budget {rp(c.budget)}</small></div><div><span>Efficiency</span><b>{Number(c.actual_cost||0)>0?(gmv/Number(c.actual_cost)).toFixed(2)+"x":"-"}</b><small>GMV / cost</small></div></div>
       <div className="lc-progress-v2"><i style={{width:String(Math.min(100,Math.max(0,progress)))+"%"}}/></div>
       <footer><span>{target>0?rp(Math.max(0,target-gmv))+" gap ke target":"Target GMV belum diatur"}</span><b>{Number(c.budget||0)>0?budgetUse.toFixed(1)+"% budget used":"No budget"}</b></footer>
      </article>
    })}</div>:<div className="lc-empty-v2"><div>◎</div><h4>Belum ada campaign Live</h4><p>Buat campaign untuk mengelompokkan session, target GMV, target order dan budget.</p><button onClick={()=>setOpen(true)}>+ Buat Campaign Pertama</button></div>}
   </section>

   <section className="lc-gimmicks-v2">
    <header><div><span>GIMMICK INTELLIGENCE</span><h3>Apa yang paling menghasilkan?</h3><p>Perbandingan gimmick berdasarkan GMV dan revenue per hour.</p></div></header>
    {gimmicks.length?<div className="lc-gimmick-list">{gimmicks.slice(0,8).map((g:any,i:number)=>{
      const top=Number(gimmicks[0]?.gmv||1);
      return <article key={g.gimmick}><div className="lc-g-rank">#{i+1}</div><div className="lc-g-main"><strong>{g.gimmick}</strong><small>{no(g.sessions)} sesi · {no(g.orders)} orders · Avg viewer {no(g.avg_viewers)}</small><div className="lc-g-bar"><i style={{width:String(Math.max(5,Number(g.gmv||0)/top*100))+"%"}}/></div></div><div className="lc-g-value"><b>{rp(g.gmv)}</b><small>{rp(g.revenue_per_hour)}/jam</small></div></article>
    })}</div>:<div className="lc-empty-v2 compact"><h4>Belum ada gimmick</h4><p>Tambahkan gimmick pada Session Planner agar performanya bisa dibandingkan.</p></div>}
   </section>
  </div>

  {open&&<div className="host-modal-bg" onClick={()=>setOpen(false)}><div className="host-modal" onClick={e=>e.stopPropagation()}><header><div><span>LIVE CAMPAIGN</span><h2>Buat Campaign</h2></div><button onClick={()=>setOpen(false)}>×</button></header><div className="host-form">
   <label className="wide">Nama Campaign<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Contoh: Payday Live Oktober"/></label>
   <label>Mulai<input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label>
   <label>Selesai<input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></label>
   <label>Target GMV<input inputMode="numeric" value={form.target_gmv} onChange={e=>setForm({...form,target_gmv:e.target.value})}/></label>
   <label>Target Orders<input inputMode="numeric" value={form.target_orders} onChange={e=>setForm({...form,target_orders:e.target.value})}/></label>
   <label>Budget<input inputMode="numeric" value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})}/></label>
   <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>draft</option><option>active</option><option>completed</option></select></label>
  </div><footer><button onClick={()=>setOpen(false)}>Batal</button><button onClick={()=>void save()}>Simpan Campaign</button></footer></div></div>}
 </div>
}
