"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
const rp=(v:any)=>"Rp "+Math.round(Number(v||0)).toLocaleString("id-ID");
const no=(v:any)=>Math.round(Number(v||0)).toLocaleString("id-ID");
const range=()=>{const d=new Date(),y=d.getFullYear(),m=d.getMonth();return{start:new Date(y,m,1).toISOString().slice(0,10),end:new Date(y,m+1,0).toISOString().slice(0,10)}};

export default function LiveCampaignPanel({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]),r=range();
 const [start,setStart]=useState(r.start),[end,setEnd]=useState(r.end),[data,setData]=useState<any>({campaigns:[],gimmicks:[]}),[open,setOpen]=useState(false),[msg,setMsg]=useState("");
 const [form,setForm]=useState({name:"",start_date:r.start,end_date:r.end,target_gmv:"",target_orders:"",budget:"",status:"active"});
 async function load(){const x=await supabase.rpc("luma_live_campaign_overview_v1",{p_workspace_id:workspaceId,p_start:start,p_end:end});if(x.error)setMsg(x.error.message);else setData(x.data||{campaigns:[],gimmicks:[]})}
 useEffect(()=>{void load()},[workspaceId,start,end]);
 async function save(){const x=await supabase.from("live_campaigns").insert({workspace_id:workspaceId,name:form.name.trim(),start_date:form.start_date,end_date:form.end_date,target_gmv:Number(form.target_gmv||0),target_orders:Number(form.target_orders||0),budget:Number(form.budget||0),status:form.status});if(x.error){setMsg(x.error.message);return}setOpen(false);setForm({...form,name:"",target_gmv:"",target_orders:"",budget:""});await load()}
 const campaigns=data.campaigns||[],gimmicks=data.gimmicks||[];
 return <div className="live-campaign-panel">
  <div className="lc-toolbar"><div><input type="date" value={start} onChange={e=>setStart(e.target.value)}/><span>→</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></div><button onClick={()=>setOpen(true)}>+ Buat Campaign</button></div>
  {msg&&<div className="live-upload-msg">{msg}</div>}
  <div className="lc-grid">
   <section className="lc-campaigns"><header><div><span>CAMPAIGN TRACKER</span><h2>Target vs Achievement</h2></div><small>{campaigns.length} campaign</small></header>
    {campaigns.length?campaigns.map((c:any)=>{const p=Number(c.target_gmv||0)>0?Math.round(Number(c.gmv||0)/Number(c.target_gmv)*1000)/10:0;return <article key={c.id}><div className="lc-title"><div><strong>{c.name}</strong><small>{c.start_date||"-"} → {c.end_date||"-"} · {c.sessions} session</small></div><span>{c.status}</span></div><div className="lc-metrics"><div><small>GMV</small><b>{rp(c.gmv)}</b></div><div><small>Target</small><b>{rp(c.target_gmv)}</b></div><div><small>Orders</small><b>{no(c.orders)} / {no(c.target_orders)}</b></div><div><small>Cost</small><b>{rp(c.actual_cost)}</b></div></div><div className="lc-progress"><i style={{width:String(Math.min(100,p))+"%"}}/></div><footer><span>{p}% target GMV</span><span>Budget {rp(c.budget)}</span></footer></article>}):<div className="live-empty">Belum ada campaign live.</div>}
   </section>
   <section className="lc-gimmicks"><header><span>GIMMICK INTELLIGENCE</span><h2>Apa yang paling menghasilkan?</h2></header>
    {gimmicks.length?gimmicks.map((g:any,i:number)=><article key={g.gimmick}><b>#{i+1}</b><div><strong>{g.gimmick}</strong><small>{g.sessions} sesi · {no(g.orders)} orders · Avg viewer {no(g.avg_viewers)}</small></div><div><strong>{rp(g.gmv)}</strong><small>{rp(g.revenue_per_hour)}/jam</small></div></article>):<div className="live-empty">Belum ada gimmick yang bisa dibandingkan.</div>}
   </section>
  </div>
  {open&&<div className="host-modal-bg" onClick={()=>setOpen(false)}><div className="host-modal" onClick={e=>e.stopPropagation()}><header><div><span>LIVE CAMPAIGN</span><h2>Buat Campaign</h2></div><button onClick={()=>setOpen(false)}>×</button></header><div className="host-form">
   <label className="wide">Nama Campaign<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Mulai<input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label><label>Selesai<input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></label><label>Target GMV<input inputMode="numeric" value={form.target_gmv} onChange={e=>setForm({...form,target_gmv:e.target.value})}/></label><label>Target Orders<input inputMode="numeric" value={form.target_orders} onChange={e=>setForm({...form,target_orders:e.target.value})}/></label><label>Budget<input inputMode="numeric" value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})}/></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>draft</option><option>active</option><option>completed</option></select></label>
  </div><footer><button onClick={()=>setOpen(false)}>Batal</button><button onClick={()=>void save()}>Simpan Campaign</button></footer></div></div>}
 </div>
}
