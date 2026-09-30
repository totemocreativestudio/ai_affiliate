"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {navigateToSection} from "../../lib/luma-navigation";
import LumaIcon from "./LumaIcon";

type SearchRow={
  entity_type:"creator"|"product"|"campaign"|"shipping"|"task"|"listing"|string;
  entity_id:number;
  title:string;
  subtitle:string|null;
  meta:string|null;
  section:string;
  score:number;
};

type QuickCreateKey="product"|"listing"|"shipping"|"campaign"|"task";

const QUICK_CREATE:Array<{key:QuickCreateKey;label:string;desc:string;section:string;icon:"product"|"listing"|"shipping"|"performance"|"kanban"}>=[
  {key:"campaign",label:"Campaign",desc:"Buat campaign affiliate / influencer",section:"campaign-tracker",icon:"performance"},
  {key:"listing",label:"Listing",desc:"Tambah creator listing / follow up",section:"listings",icon:"listing"},
  {key:"shipping",label:"Shipping",desc:"Tambah pengiriman sample / produk",section:"shipping",icon:"shipping"},
  {key:"product",label:"Product",desc:"Tambah SKU induk ke Product Master",section:"product-master",icon:"product"},
  {key:"task",label:"Task",desc:"Tambah task ke Kanban",section:"kanban",icon:"kanban"},
];

function SearchIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
}
function PlusIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>;
}

function entityLabel(type:string){
  if(type==="creator")return"Creator";
  if(type==="product")return"Product";
  if(type==="campaign")return"Campaign";
  if(type==="shipping")return"Shipping";
  if(type==="task")return"Task";
  if(type==="listing")return"Listing";
  return type;
}

export default function GlobalCommandCenter({
  workspaceId,
  accessLocked=false,
}:{
  workspaceId:string;
  accessLocked?:boolean;
}){
  const supabase=useMemo(()=>createClient(),[]);
  const inputRef=useRef<HTMLInputElement|null>(null);
  const [open,setOpen]=useState(false);
  const [quickOpen,setQuickOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [rows,setRows]=useState<SearchRow[]>([]);
  const [loading,setLoading]=useState(false);
  const [activeIndex,setActiveIndex]=useState(0);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const command=(event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k";
      if(command){event.preventDefault();setOpen(value=>!value);setQuickOpen(false)}
      if(event.key==="Escape"){setOpen(false);setQuickOpen(false)}
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[]);

  useEffect(()=>{
    if(!open)return;
    window.setTimeout(()=>inputRef.current?.focus(),20);
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=previous};
  },[open]);

  useEffect(()=>{
    if(!open){setRows([]);setQuery("");setActiveIndex(0);return}
    const value=query.trim();
    if(value.length<2){setRows([]);setLoading(false);setActiveIndex(0);return}
    let alive=true;
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      const {data,error}=await supabase.rpc("luma_global_search_v1",{p_workspace_id:workspaceId,p_query:value,p_limit:28});
      if(!alive)return;
      setLoading(false);
      if(error){setRows([]);return}
      setRows((data||[]) as SearchRow[]);
      setActiveIndex(0);
    },180);
    return()=>{alive=false;window.clearTimeout(timer)};
  },[open,query,workspaceId,supabase]);

  function openResult(row:SearchRow){
    if(accessLocked&&!["dashboard","billing","profile"].includes(row.section)){
      window.dispatchEvent(new CustomEvent("lumaway-access-locked",{detail:{requestedSection:row.section}}));
      setOpen(false);
      return;
    }
    navigateToSection(row.section);
    setOpen(false);
    window.setTimeout(()=>{
      window.dispatchEvent(new CustomEvent("lumaway-global-select",{detail:{
        type:row.entity_type,id:row.entity_id,section:row.section,title:row.title
      }}));
    },90);
  }

  function quickCreate(item:(typeof QUICK_CREATE)[number]){
    if(accessLocked){
      window.dispatchEvent(new CustomEvent("lumaway-access-locked",{detail:{requestedSection:item.section}}));
      setQuickOpen(false);
      return;
    }
    navigateToSection(item.section);
    setQuickOpen(false);
    window.setTimeout(()=>{
      window.dispatchEvent(new CustomEvent("lumaway-quick-create",{detail:{type:item.key,section:item.section}}));
    },100);
  }

  function onInputKey(event:React.KeyboardEvent<HTMLInputElement>){
    if(event.key==="ArrowDown"){event.preventDefault();setActiveIndex(index=>Math.min(rows.length-1,index+1))}
    if(event.key==="ArrowUp"){event.preventDefault();setActiveIndex(index=>Math.max(0,index-1))}
    if(event.key==="Enter"&&rows[activeIndex]){event.preventDefault();openResult(rows[activeIndex])}
  }

  return <>
    <div className="global-command-root">
      <button className="global-search-trigger" type="button" onClick={()=>{setOpen(true);setQuickOpen(false)}} aria-label="Cari di Lumaway">
        <SearchIcon/><span>Cari creator, SKU, campaign...</span><kbd>⌘ K</kbd>
      </button>
      <div className="quick-create-root">
        <button className="quick-create-trigger" type="button" onClick={()=>{setQuickOpen(value=>!value);setOpen(false)}} aria-expanded={quickOpen}>
          <PlusIcon/><span>Buat</span>
        </button>
        {quickOpen&&<div className="quick-create-menu">
          <div className="quick-create-head"><strong>Quick Create</strong><span>Buat data tanpa mencari menu terlebih dahulu.</span></div>
          {QUICK_CREATE.map(item=><button key={item.key} type="button" onClick={()=>quickCreate(item)}>
            <i><LumaIcon name={item.icon}/></i><span><b>{item.label}</b><small>{item.desc}</small></span>
          </button>)}
        </div>}
      </div>
    </div>

    {open&&<div className="global-command-backdrop" onMouseDown={()=>setOpen(false)}>
      <section className="global-command-panel" role="dialog" aria-modal="true" aria-label="Pencarian global Lumaway" onMouseDown={event=>event.stopPropagation()}>
        <header>
          <SearchIcon/>
          <input ref={inputRef} value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={onInputKey} placeholder="Cari creator, SKU, produk, campaign, resi, task, atau listing..."/>
          <kbd>ESC</kbd>
        </header>
        <div className="global-command-body">
          {query.trim().length<2?<div className="global-command-start">
            <span>PENCARIAN GLOBAL</span>
            <strong>Temukan data lintas workspace lebih cepat.</strong>
            <p>Ketik minimal 2 karakter. Gunakan ↑ ↓ lalu Enter untuk membuka hasil.</p>
            <div>{QUICK_CREATE.slice(0,4).map(item=><button type="button" key={item.key} onClick={()=>quickCreate(item)}><LumaIcon name={item.icon}/>{item.label}</button>)}</div>
          </div>:loading?<div className="global-command-loading"><i/><span>Mencari di workspace...</span></div>:rows.length?<div className="global-command-results">
            {rows.map((row,index)=><button type="button" key={row.entity_type+"-"+row.entity_id} className={activeIndex===index?"active":""} onMouseEnter={()=>setActiveIndex(index)} onClick={()=>openResult(row)}>
              <span className={"global-result-icon type-"+row.entity_type}>{row.entity_type==="creator"?"C":row.entity_type==="product"?"P":row.entity_type==="campaign"?"M":row.entity_type==="shipping"?"S":row.entity_type==="task"?"T":"L"}</span>
              <span className="global-result-copy"><b>{row.title}</b>{row.subtitle&&<small>{row.subtitle}</small>}</span>
              <span className="global-result-meta"><em>{entityLabel(row.entity_type)}</em>{row.meta&&<small>{row.meta}</small>}</span>
            </button>)}
          </div>:<div className="global-command-empty"><strong>Tidak ada hasil.</strong><span>Coba nama, username, SKU, nomor resi, atau judul lain.</span></div>}
        </div>
        <footer><span><kbd>↑</kbd><kbd>↓</kbd> Navigasi</span><span><kbd>Enter</kbd> Buka</span><span><kbd>Esc</kbd> Tutup</span></footer>
      </section>
    </div>}
  </>;
}
