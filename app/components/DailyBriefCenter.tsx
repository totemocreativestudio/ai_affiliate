"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {navigateToSection} from "../../lib/luma-navigation";

type Row=Record<string,any>;
const money=(v:any)=>"Rp "+Number(v||0).toLocaleString("id-ID",{maximumFractionDigits:0});
const num=(v:any)=>Number(v||0).toLocaleString("id-ID",{maximumFractionDigits:0});
const pct=(v:any)=>v==null?"—":(Number(v)>=0?"+":"")+Number(v).toLocaleString("id-ID",{maximumFractionDigits:2})+"%";

export default function DailyBriefCenter({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [brief,setBrief]=useState<Row|null>(null);
  const [saved,setSaved]=useState<Row[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function load(){
    setLoading(true);setError("");
    const [b,a]=await Promise.all([
      supabase.rpc("luma_daily_brief_v1",{p_workspace_id:workspaceId}),
      supabase.from("luma_action_items").select("*").eq("workspace_id",workspaceId).in("status",["open","in_progress"]).order("due_date",{ascending:true,nullsFirst:false}).order("updated_at",{ascending:false}).limit(40)
    ]);
    if(b.error)setError(b.error.message);else setBrief((b.data||{}) as Row);
    if(!a.error)setSaved((a.data||[]) as Row[]);
    setLoading(false);
  }
  useEffect(()=>{void load()},[workspaceId]);

  async function saveAction(action:Row){
    const duplicate=saved.find(x=>x.source_type===action.source_type&&String(x.source_id)===String(action.source_id)&&x.status!=="done"&&x.status!=="dismissed");
    if(duplicate){setMessage("Action ini sudah ada di Action Center.");return}
    const {error:e}=await supabase.from("luma_action_items").insert({
      workspace_id:workspaceId,source_type:action.source_type,source_id:String(action.source_id||""),
      title:action.title,description:action.description||null,severity:action.severity||"normal",
      due_date:action.due_date||null,action_route:action.action_route||null,metadata:{source:"daily_brief"}
    });
    if(e){setError(e.message);return}
    setMessage("Action disimpan ke Action Center.");await load();
  }
  async function updateAction(id:number,status:"in_progress"|"done"|"dismissed"){
    const {error:e}=await supabase.from("luma_action_items").update({status,updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",id);
    if(e){setError(e.message);return}
    await load();
  }

  const perf=brief?.performance||{},attention=brief?.attention||{},actions=(brief?.actions||[]) as Row[];
  const totalAttention=Number(attention.campaign_due||0)+Number(attention.samples_followup||0)+Number(attention.shipping_attention||0)+Number(attention.products_missing_hpp||0)+Number(attention.stale_listings||0);

  if(loading)return <section id="daily-brief" className="legacy-page-anchor daily-brief-page"><div className="daily-brief-loading"><i/><i/><i/></div></section>;
  return <section id="daily-brief" className="legacy-page-anchor daily-brief-page">
    <header className="daily-brief-head">
      <div><span>GROWTH & WORKFLOW</span><h1>Lumaway Daily Brief</h1><p>Ringkasan operasional otomatis dari data workspace agar tim langsung tahu apa yang berubah dan apa yang perlu dikerjakan hari ini.</p></div>
      <div className="daily-brief-head-actions"><span className={"daily-brief-health "+(totalAttention?"attention":"clear")}><i/>{totalAttention?num(totalAttention)+" perlu perhatian":"Tidak ada issue utama"}</span><button className="secondary" onClick={()=>void load()}>Refresh</button></div>
    </header>
    {error&&<div className="owner-inline-note error">{error}</div>}{message&&<div className="owner-inline-note">{message}</div>}

    <div className="daily-brief-performance">
      <article><span>Data Terakhir</span><b>{brief?.latest_data_date?new Date(brief.latest_data_date+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"—"}</b><small>Periode pembanding: {brief?.previous_data_date||"belum tersedia"}</small></article>
      <article><span>GMV</span><b>{money(perf.gmv)}</b><small className={Number(perf.gmv_change_pct||0)>=0?"positive":"negative"}>{pct(perf.gmv_change_pct)} vs data sebelumnya</small></article>
      <article><span>Orders</span><b>{num(perf.orders)}</b><small className={Number(perf.orders_change_pct||0)>=0?"positive":"negative"}>{pct(perf.orders_change_pct)} vs data sebelumnya</small></article>
      <article><span>Campaign Aktif</span><b>{num(attention.active_campaigns)}</b><small>{num(attention.campaign_due)} deliverable mendekati deadline</small></article>
    </div>

    <div className="daily-brief-attention">
      {[["Campaign Due",attention.campaign_due,"campaign-tracker"],["Sample Follow Up",attention.samples_followup,"creator-samples"],["Shipping Attention",attention.shipping_attention,"shipping"],["HPP Belum Lengkap",attention.products_missing_hpp,"product-master"],["Listing Stale",attention.stale_listings,"listings"]].map(([label,value,route])=><button key={String(label)} onClick={()=>navigateToSection(String(route))}><span>{label}</span><b>{num(value)}</b><small>Buka modul →</small></button>)}
    </div>

    <div className="daily-brief-grid">
      <section className="daily-brief-panel">
        <div className="daily-brief-section-head"><div><span>PRIORITAS HARI INI</span><h2>Action yang disarankan</h2><p>Diurutkan berdasarkan urgensi dan kondisi aktual workspace.</p></div><b>{actions.length}</b></div>
        <div className="daily-action-list">
          {actions.map((a,index)=><article key={a.source_type+"-"+a.source_id} className={"severity-"+(a.severity||"normal")}><div className="daily-action-rank">{String(index+1).padStart(2,"0")}</div><div className="daily-action-copy"><div><strong>{a.title}</strong><span>{a.severity||"normal"}</span></div><p>{a.description||"Perlu ditinjau."}</p>{a.due_date&&<small>Target / referensi tanggal: {new Date(a.due_date+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"})}</small>}</div><div className="daily-action-buttons"><button onClick={()=>navigateToSection(a.action_route||"dashboard")}>Buka</button><button className="primary" onClick={()=>void saveAction(a)}>Simpan Action</button></div></article>)}
          {!actions.length&&<div className="daily-brief-empty"><b>Operasional terlihat rapi.</b><span>Belum ada action otomatis yang perlu diprioritaskan dari rule Daily Brief saat ini.</span></div>}
        </div>
      </section>

      <section className="daily-brief-panel">
        <div className="daily-brief-section-head"><div><span>ACTION CENTER</span><h2>Action tersimpan</h2><p>Tindak lanjut yang dipilih user dari Daily Brief.</p></div><b>{saved.length}</b></div>
        <div className="daily-saved-list">
          {saved.map(row=><article key={row.id}><div><span className={"action-status "+row.status}>{String(row.status).replace("_"," ")}</span><strong>{row.title}</strong><p>{row.description||"—"}</p>{row.due_date&&<small>{new Date(row.due_date+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"})}</small>}</div><div><button onClick={()=>row.action_route&&navigateToSection(row.action_route)}>Buka</button>{row.status==="open"&&<button onClick={()=>void updateAction(Number(row.id),"in_progress")}>Mulai</button>}<button className="primary" onClick={()=>void updateAction(Number(row.id),"done")}>Selesai</button></div></article>)}
          {!saved.length&&<div className="daily-brief-empty compact"><b>Action Center masih kosong.</b><span>Simpan salah satu rekomendasi Daily Brief untuk mulai membuat daftar tindakan.</span></div>}
        </div>
      </section>
    </div>
  </section>;
}
