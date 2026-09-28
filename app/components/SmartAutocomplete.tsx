"use client";

import { useEffect, useRef, useState } from "react";

export type CreatorSearchResult={
  id:number; creator_code:string|null; name:string|null; username:string|null; platform:string|null;
  affiliate_id?:string|null; phone?:string|null; payment_type?:string|null; ratecard?:number|null; status?:string|null;
};
export type ProductSearchResult={
  id:number; sku:string; product_name:string|null; category?:string|null;
  selling_price?:number|null; cost_price?:number|null; status?:string|null;
};

function useDebouncedSearch(endpoint:string,workspaceId:string,query:string,enabled:boolean){
  const [results,setResults]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const requestRef=useRef(0);
  useEffect(()=>{
    if(!enabled||!query.trim()){setResults([]);setLoading(false);return}
    const id=++requestRef.current;
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      try{
        const r=await fetch(`${endpoint}?workspace_id=${encodeURIComponent(workspaceId)}&q=${encodeURIComponent(query.trim())}&limit=15`,{cache:"no-store"});
        const d=await r.json();
        if(id!==requestRef.current)return;
        setResults(r.ok&&d.ok?(d.results||[]):[]);
      }catch{if(id===requestRef.current)setResults([])}
      finally{if(id===requestRef.current)setLoading(false)}
    },180);
    return()=>window.clearTimeout(timer);
  },[endpoint,workspaceId,query,enabled]);
  return{results,loading,setResults};
}

export function CreatorAutocomplete({
  workspaceId,value,selectedId,onTextChange,onSelect,onCreate,placeholder="Ketik username atau nama creator",disabled=false
}:{workspaceId:string;value:string;selectedId?:string|number|null;onTextChange:(value:string)=>void;onSelect:(creator:CreatorSearchResult)=>void;onCreate?:(value:string)=>void;placeholder?:string;disabled?:boolean}){
  const {results,loading,setResults}=useDebouncedSearch("/api/search/creators",workspaceId,value,!disabled&&!selectedId);
  const typed=value.trim();
  const normalized=typed.replace(/^@+/,"").trim().toLowerCase();
  const exactMatch=results.some((c:CreatorSearchResult)=>
    [c.name,c.username,c.creator_code].some(v=>String(v||"").replace(/^@+/,"").trim().toLowerCase()===normalized)
  );
  function createTyped(){
    if(!typed||disabled||selectedId||!onCreate)return;
    onCreate(typed);
    setResults([]);
  }
  return <div className="smart-autocomplete">
    <input
      disabled={disabled}
      value={value}
      onChange={e=>onTextChange(e.target.value)}
      onKeyDown={e=>{
        if(e.key==="Enter"&&!selectedId&&typed&&onCreate&&!exactMatch){
          e.preventDefault();
          createTyped();
        }
      }}
      placeholder={placeholder}
      autoComplete="off"
    />
    {!disabled&&!selectedId&&typed&&<div className="smart-autocomplete-menu" role="listbox">
      {loading&&<div className="smart-autocomplete-empty">Mencari creator...</div>}
      {!loading&&results.map((c:CreatorSearchResult)=>{
        const name=String(c.name||"").trim();
        const username=String(c.username||"").trim();
        const label=name&&username&&name.toLowerCase()!==username.toLowerCase()?`${name} · @${username}`:username?`@${username}`:name||"-";
        return <button type="button" key={c.id} onMouseDown={e=>{e.preventDefault();onSelect(c);setResults([])}}>
          <strong>{label}</strong>
          {c.platform&&<span>{c.platform}</span>}
        </button>
      })}
      {!loading&&onCreate&&!exactMatch&&<button type="button" className="smart-autocomplete-create" onMouseDown={e=>{e.preventDefault();createTyped()}}>
        <strong>+ Tambahkan “{typed}” sebagai creator baru</strong>
        <span>Username baru akan dibuat di Master Creator saat data disimpan.</span>
      </button>}
      {!loading&&!results.length&&!onCreate&&<div className="smart-autocomplete-empty">Tidak ada creator yang cocok.</div>}
    </div>}
  </div>;
}

export function ProductAutocomplete({
  workspaceId,value,selectedId,onTextChange,onSelect,placeholder="Ketik SKU produk atau nama produk",disabled=false
}:{workspaceId:string;value:string;selectedId?:string|number|null;onTextChange:(value:string)=>void;onSelect:(product:ProductSearchResult)=>void;placeholder?:string;disabled?:boolean}){
  const {results,loading,setResults}=useDebouncedSearch("/api/search/products",workspaceId,value,!disabled&&!selectedId);
  return <div className="smart-autocomplete">
    <input disabled={disabled} value={value} onChange={e=>onTextChange(e.target.value)} placeholder={placeholder} autoComplete="off"/>
    {!disabled&&!selectedId&&value.trim()&&<div className="smart-autocomplete-menu" role="listbox">
      {loading&&<div className="smart-autocomplete-empty">Mencari produk...</div>}
      {!loading&&results.map((p:ProductSearchResult)=><button type="button" key={p.id} onMouseDown={e=>{e.preventDefault();onSelect(p);setResults([])}}>
        <strong>{p.sku}</strong>
        <span>{p.product_name||"-"} · HPP Rp {Number(p.cost_price||0).toLocaleString("id-ID")}</span>
      </button>)}
      {!loading&&!results.length&&<div className="smart-autocomplete-empty">Tidak ada produk yang cocok.</div>}
    </div>}
  </div>;
}
