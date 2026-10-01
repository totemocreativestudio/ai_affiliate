"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {navigateToSection,sectionFromPath} from "../../lib/luma-navigation";
import LumaIcon,{type IconName} from "./LumaIcon";

type Row=Record<string,any>;
type DashboardFilter={start:string;end:string;platform:string;store:string;preset:string};

const MODULES:Array<{section:string;title:string;icon:IconName}>=[
 {section:"dashboard",title:"Dashboard",icon:"dashboard"},
 {section:"upload",title:"Upload Center",icon:"data"},
 {section:"listings",title:"Listings",icon:"listing"},
 {section:"campaign-tracker",title:"Campaign Tracker",icon:"performance"},
 {section:"live-streaming",title:"Live Streaming",icon:"performance"},
 {section:"affiliate-360",title:"Affiliate 360",icon:"creator"},
 {section:"product-master",title:"Product Master",icon:"product"},
 {section:"shipping",title:"Shipping",icon:"shipping"},
 {section:"spending",title:"Spending",icon:"billing"},
 {section:"goal-forecast",title:"Goal & Forecast",icon:"performance"},
 {section:"automation-rules",title:"Automation",icon:"settings"},
 {section:"scheduled-reports",title:"Scheduled Report",icon:"content"},
];

const sectionTitle=(section:string)=>MODULES.find(x=>x.section===section)?.title||section.replaceAll("-"," ").replace(/\b\w/g,m=>m.toUpperCase());

export default function PersonalWorkspace({
 workspaceId,
 dashboardFilter,
 onApplyDashboardView,
}:{
 workspaceId:string;
 dashboardFilter:DashboardFilter;
 onApplyDashboardView:(filter:DashboardFilter)=>void;
}){
 const supabase=useMemo(()=>createClient(),[]);
 const [data,setData]=useState<Row>({saved_views:[],pins:[],recent:[]});
 const [open,setOpen]=useState(false);
 const [saveOpen,setSaveOpen]=useState(false);
 const [pinOpen,setPinOpen]=useState(false);
 const [name,setName]=useState("");
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState("");

 async function load(){
  const x=await supabase.rpc("luma_personal_workspace_v1",{p_workspace_id:workspaceId});
  if(!x.error)setData(x.data||{saved_views:[],pins:[],recent:[]});
 }

 useEffect(()=>{
  void load();
  const record=async()=>{
   const section=sectionFromPath(window.location.pathname)||"dashboard";
   await supabase.rpc("luma_record_recent_section_v1",{p_workspace_id:workspaceId,p_section:section,p_title:sectionTitle(section)});
   await load();
  };
  void record();
  const onRoute=()=>void record();
  window.addEventListener("lumaway-routechange",onRoute as EventListener);
  return()=>window.removeEventListener("lumaway-routechange",onRoute as EventListener);
 },[workspaceId]);

 async function saveCurrent(){
  const n=name.trim();if(!n)return setMsg("Nama Saved View wajib diisi.");
  setBusy(true);setMsg("");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setBusy(false);return}
  const section=sectionFromPath(window.location.pathname)||"dashboard";
  const filter=section==="dashboard"?dashboardFilter:{};
  const x=await supabase.from("luma_saved_views").insert({
   workspace_id:workspaceId,user_id:user.id,name:n,section,filter_json:filter,sort_json:{},ui_state_json:{},is_pinned:false
  });
  if(x.error)setMsg(x.error.message);
  else{setName("");setSaveOpen(false);setMsg("Saved View tersimpan.");await load()}
  setBusy(false);
 }

 async function applyView(view:Row){
  await supabase.from("luma_saved_views").update({last_used_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",view.id);
  if(view.section==="dashboard")onApplyDashboardView(view.filter_json as DashboardFilter);
  else{
   navigateToSection(view.section);
   window.setTimeout(()=>window.dispatchEvent(new CustomEvent("lumaway-apply-saved-view",{detail:{section:view.section,filter_json:view.filter_json||{},sort_json:view.sort_json||{},ui_state_json:view.ui_state_json||{}}})),80);
  }
  setOpen(false);await load();
 }

 async function toggleViewPin(view:Row){
  await supabase.from("luma_saved_views").update({is_pinned:!view.is_pinned,updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",view.id);await load();
 }
 async function removeView(view:Row){
  await supabase.from("luma_saved_views").delete().eq("workspace_id",workspaceId).eq("id",view.id);await load();
 }

 async function toggleModule(module:{section:string;title:string}){
  const pinned=(data.pins||[]).some((x:Row)=>x.section===module.section);
  if(pinned)await supabase.from("luma_user_workspace_pins").delete().eq("workspace_id",workspaceId).eq("section",module.section);
  else{
   const {data:{user}}=await supabase.auth.getUser();if(!user)return;
   await supabase.from("luma_user_workspace_pins").upsert({workspace_id:workspaceId,user_id:user.id,section:module.section,title:module.title,display_order:(data.pins||[]).length+1},{onConflict:"workspace_id,user_id,section"});
  }
  await load();
 }

 const pinnedViews=(data.saved_views||[]).filter((x:Row)=>x.is_pinned).slice(0,5);
 return <section className="personal-workspace-card">
  <header>
   <div><span>MY WORKSPACE</span><h2>Ruang kerja pribadi</h2><p>Shortcut, Saved View, dan riwayat ini hanya untuk akun Anda.</p></div>
   <div className="pw-head-actions"><button onClick={()=>setSaveOpen(true)}>+ Save Current View</button><button className="secondary" onClick={()=>setOpen(true)}>Kelola</button></div>
  </header>

  {msg&&<div className="pw-message">{msg}</div>}

  <div className="pw-grid">
   <div className="pw-block"><div className="pw-block-head"><b>Pinned Modules</b><button onClick={()=>setPinOpen(true)}>Edit</button></div><div className="pw-chips">{(data.pins||[]).slice(0,6).map((x:Row)=><button key={x.section} onClick={()=>navigateToSection(x.section)}><LumaIcon name={MODULES.find(m=>m.section===x.section)?.icon||"dashboard"}/><span>{x.title}</span></button>)}</div></div>
   <div className="pw-block"><div className="pw-block-head"><b>Pinned Views</b><button onClick={()=>setOpen(true)}>Semua</button></div>{pinnedViews.length?<div className="pw-view-list">{pinnedViews.map((x:Row)=><button key={x.id} onClick={()=>void applyView(x)}><strong>{x.name}</strong><small>{sectionTitle(x.section)}</small></button>)}</div>:<div className="pw-mini-empty">Belum ada view yang dipin.</div>}</div>
   <div className="pw-block"><div className="pw-block-head"><b>Recently Opened</b></div><div className="pw-recent">{(data.recent||[]).slice(0,4).map((x:Row)=><button key={x.section} onClick={()=>navigateToSection(x.section)}><span>{x.title}</span><small>{new Date(x.last_opened_at).toLocaleString("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</small></button>)}</div></div>
  </div>

  {saveOpen&&<div className="pw-modal-backdrop" onMouseDown={()=>setSaveOpen(false)}><div className="pw-modal" onMouseDown={e=>e.stopPropagation()}><header><div><span>SAVE CURRENT VIEW</span><h3>Simpan tampilan ini</h3></div><button onClick={()=>setSaveOpen(false)}>×</button></header><label>Nama View<input autoFocus value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void saveCurrent()} placeholder="Contoh: Shopee 30 Hari"/></label><div className="pw-save-preview"><span>Section</span><b>{sectionTitle(sectionFromPath(window.location.pathname)||"dashboard")}</b>{(sectionFromPath(window.location.pathname)||"dashboard")==="dashboard"&&<small>{[dashboardFilter.preset||"custom",dashboardFilter.platform||"Semua platform",dashboardFilter.store||"Semua toko"].join(" · ")}</small>}</div><footer><button onClick={()=>setSaveOpen(false)}>Batal</button><button className="primary" disabled={busy} onClick={()=>void saveCurrent()}>{busy?"Menyimpan...":"Simpan View"}</button></footer></div></div>}

  {open&&<div className="pw-modal-backdrop" onMouseDown={()=>setOpen(false)}><div className="pw-modal large" onMouseDown={e=>e.stopPropagation()}><header><div><span>SAVED VIEWS</span><h3>Kelola Saved Views</h3></div><button onClick={()=>setOpen(false)}>×</button></header><div className="pw-manage-list">{(data.saved_views||[]).length?(data.saved_views||[]).map((x:Row)=><article key={x.id}><button className="pw-view-main" onClick={()=>void applyView(x)}><strong>{x.name}</strong><small>{sectionTitle(x.section)}{x.last_used_at?" · terakhir "+new Date(x.last_used_at).toLocaleDateString("id-ID"):""}</small></button><div><button onClick={()=>void toggleViewPin(x)}>{x.is_pinned?"Unpin":"Pin"}</button><button onClick={()=>void removeView(x)}>Hapus</button></div></article>):<div className="pw-mini-empty">Belum ada Saved View.</div>}</div></div></div>}

  {pinOpen&&<div className="pw-modal-backdrop" onMouseDown={()=>setPinOpen(false)}><div className="pw-modal" onMouseDown={e=>e.stopPropagation()}><header><div><span>PIN MODULE</span><h3>Pilih shortcut Anda</h3></div><button onClick={()=>setPinOpen(false)}>×</button></header><div className="pw-module-picker">{MODULES.map(m=>{const active=(data.pins||[]).some((x:Row)=>x.section===m.section);return <button key={m.section} className={active?"active":""} onClick={()=>void toggleModule(m)}><LumaIcon name={m.icon}/><span>{m.title}</span><b>{active?"✓":"+"}</b></button>})}</div></div></div>}
 </section>;
}
