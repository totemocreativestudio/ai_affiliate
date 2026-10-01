"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {navigateToSection} from "../../lib/luma-navigation";

type ActionItem={
  id:number;source_type:string;source_id:string|null;title:string;description:string|null;
  severity:string;status:string;due_date:string|null;action_route:string|null;metadata:Record<string,any>;
  priority_score:number;action_level:"critical"|"action"|"scheduled"|"info";
};
type SourceCount={source_type:string;count:number};

const SOURCE_LABEL:Record<string,string>={
  listing_followup:"Listing Follow Up",
  listing_stale:"Listing",
  campaign_due:"Campaign",
  sample_followup:"Sample",
  shipping_attention:"Shipping",
  missing_hpp:"Product HPP",
  live_data_health:"Live Data Health",
  automation:"Automation",
};

function dueLabel(date:string|null){
  if(!date)return"Tanpa deadline";
  const today=new Date();today.setHours(0,0,0,0);
  const due=new Date(date+"T00:00:00");
  const days=Math.round((due.getTime()-today.getTime())/86400000);
  if(days<0)return"Terlambat "+Math.abs(days)+" hari";
  if(days===0)return"Hari ini";
  if(days===1)return"Besok";
  if(days<=7)return days+" hari lagi";
  return due.toLocaleDateString("id-ID",{day:"2-digit",month:"short"});
}
function levelLabel(level:string){
  if(level==="critical")return"Kritis";
  if(level==="action")return"Perlu Ditindaklanjuti";
  if(level==="scheduled")return"Dijadwalkan";
  return"Informasi";
}

export default function DashboardActionCenter({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [items,setItems]=useState<ActionItem[]>([]);
  const [summary,setSummary]=useState<Record<string,number>>({});
  const [sources,setSources]=useState<SourceCount[]>([]);
  const [filter,setFilter]=useState("all");
  const [loading,setLoading]=useState(true);
  const [busyId,setBusyId]=useState<number|null>(null);

  async function load(){
    setLoading(true);
    const {data,error}=await supabase.rpc("luma_action_center_v2",{p_workspace_id:workspaceId,p_limit:60});
    if(!error){
      setItems((data?.items||[]) as ActionItem[]);
      setSummary((data?.summary||{}) as Record<string,number>);
      setSources((data?.sources||[]) as SourceCount[]);
    }
    setLoading(false);
  }

  useEffect(()=>{
    void load();
    const refresh=()=>void load();
    window.addEventListener("focus",refresh);
    window.addEventListener("lumaway-database-updated",refresh as EventListener);
    window.addEventListener("lumaway-live-updated",refresh as EventListener);
    return()=>{
      window.removeEventListener("focus",refresh);
      window.removeEventListener("lumaway-database-updated",refresh as EventListener);
      window.removeEventListener("lumaway-live-updated",refresh as EventListener);
    };
  },[workspaceId]);

  const visible=useMemo(()=>filter==="all"?items:items.filter(x=>x.source_type===filter),[items,filter]);

  async function updateStatus(item:ActionItem,status:"done"|"dismissed"){
    setBusyId(item.id);
    const previous=items;
    setItems(old=>old.filter(x=>x.id!==item.id));
    const {error}=await supabase.from("luma_action_items")
      .update({status,updated_at:new Date().toISOString()})
      .eq("workspace_id",workspaceId).eq("id",item.id);
    if(error)setItems(previous);
    else window.dispatchEvent(new Event("lumaway-database-updated"));
    setBusyId(null);
  }

  function open(item:ActionItem){
    navigateToSection(item.action_route||"dashboard");
    window.setTimeout(()=>window.dispatchEvent(new CustomEvent("lumaway-global-select",{detail:{
      type:item.source_type,id:item.source_id,section:item.action_route,title:item.title
    }})),80);
  }

  return <section className="lw-action-center v2">
    <div className="lw-action-head">
      <div><span className="eyebrow">ACTION CENTER 2.0</span><h2>{summary.open?summary.open+" tindakan menunggu":"Tidak ada tindakan tertunda"}</h2><p>Prioritas otomatis dari deadline, severity, dan sumber operasional workspace.</p></div>
      <button type="button" className="secondary" onClick={()=>void load()}>Refresh</button>
    </div>

    <div className="lw-action-summary">
      {[["Kritis",summary.critical||0,"critical"],["Hari Ini",summary.today||0,"today"],["7 Hari",summary.this_week||0,"week"],["Open",summary.open||0,"open"]].map(([label,value,key])=>
        <article key={String(key)} className={"tone-"+key}><span>{label}</span><strong>{Number(value).toLocaleString("id-ID")}</strong></article>
      )}
    </div>

    {!!sources.length&&<div className="lw-action-filters">
      <button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Semua <b>{summary.open||0}</b></button>
      {sources.map(s=><button key={s.source_type} className={filter===s.source_type?"active":""} onClick={()=>setFilter(s.source_type)}>
        {SOURCE_LABEL[s.source_type]||s.source_type.replaceAll("_"," ")} <b>{s.count}</b>
      </button>)}
    </div>}

    {loading?<div className="lw-action-loading"><span className="lw-skeleton"/><span className="lw-skeleton"/><span className="lw-skeleton"/></div>
    :visible.length?<div className="lw-action-list v2-list">
      {visible.slice(0,12).map(item=><article key={item.id} className={"lw-action-row-v2 level-"+item.action_level}>
        <button className="lw-action-main" type="button" onClick={()=>open(item)}>
          <span className="lw-action-source">{SOURCE_LABEL[item.source_type]||item.source_type.replaceAll("_"," ")}</span>
          <span className="lw-action-copy"><strong>{item.title}</strong><small>{item.description||"Buka detail untuk melihat tindakan berikutnya."}</small></span>
          <span className="lw-action-due">{dueLabel(item.due_date)}</span>
          <span className={"lw-action-level "+item.action_level}>{levelLabel(item.action_level)}</span>
        </button>
        <div className="lw-action-row-actions">
          <button type="button" onClick={()=>open(item)}>Buka</button>
          <button type="button" disabled={busyId===item.id} onClick={()=>void updateStatus(item,"done")}>Selesai</button>
          <button type="button" disabled={busyId===item.id} onClick={()=>void updateStatus(item,"dismissed")}>Abaikan</button>
        </div>
      </article>)}
    </div>
    :<div className="lw-action-empty smart">
      <div className="smart-empty-icon">✓</div>
      <strong>{filter==="all"?"Semua tindakan sudah tertangani.":"Tidak ada tindakan pada kategori ini."}</strong>
      <span>Gunakan waktu berikutnya untuk memperbarui data agar insight dan automation tetap akurat.</span>
      <div><button type="button" onClick={()=>navigateToSection("upload-center")}>Upload Data</button><button type="button" onClick={()=>navigateToSection("dashboard")}>Review Dashboard</button></div>
    </div>}

    {!!items.length&&<div className="lw-action-foot"><span>{summary.overdue?summary.overdue+" tindakan sudah melewati deadline":"Tidak ada tindakan overdue"}</span><button type="button" onClick={()=>navigateToSection("kanban")}>Buka Kanban →</button></div>}
  </section>;
}
