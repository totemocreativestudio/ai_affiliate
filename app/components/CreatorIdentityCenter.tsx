"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {navigateToSection} from "../../lib/luma-navigation";
import Creator360Modal from "./Creator360Modal";

type Row=Record<string,any>;
type Group={group_key:string;duplicate_count:number;match_reason:string;creators:Row[]};

const fmt=(v:any)=>Number(v||0).toLocaleString("id-ID");
const label=(row:Row)=>String(row?.name||row?.username||row?.creator_code||("Creator #"+row?.id));
const refs=(row:Row)=>Object.entries(row?.refs||{}).filter(([,v])=>Number(v||0)>0);

export default function CreatorIdentityCenter({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [data,setData]=useState<Row|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [search,setSearch]=useState("");
  const [selectedKey,setSelectedKey]=useState("");
  const [primaryId,setPrimaryId]=useState<number|null>(null);
  const [secondaryIds,setSecondaryIds]=useState<number[]>([]);
  const [confirmOpen,setConfirmOpen]=useState(false);
  const [verifyCode,setVerifyCode]=useState("");
  const [verifyInput,setVerifyInput]=useState("");
  const [merging,setMerging]=useState(false);
  const [impact,setImpact]=useState<Record<string,number>>({});
  const [creator360Id,setCreator360Id]=useState<number|null>(null);

  async function load(q=search){
    setLoading(true);setError("");
    const {data:payload,error:e}=await supabase.rpc("luma_creator_identity_candidates_v1",{p_workspace_id:workspaceId,p_search:q.trim()||null,p_limit:50});
    if(e){setError(e.message);setData(null)}
    else{
      const next=(payload||{}) as Row;setData(next);
      const groups=(next.groups||[]) as Group[];
      const chosen=groups.find(g=>g.group_key===selectedKey)||groups[0]||null;
      setSelectedKey(chosen?.group_key||"");
      if(chosen?.creators?.length){
        const best=[...chosen.creators].sort((a,b)=>Number(b.link_score||0)-Number(a.link_score||0)||Number(b.completeness||0)-Number(a.completeness||0))[0];
        setPrimaryId(Number(best.id));
        setSecondaryIds(chosen.creators.filter(x=>Number(x.id)!==Number(best.id)).map(x=>Number(x.id)));
      }else{setPrimaryId(null);setSecondaryIds([])}
    }
    setLoading(false);
  }

  useEffect(()=>{void load("")},[workspaceId]);

  const groups=(data?.groups||[]) as Group[];
  const selected=groups.find(g=>g.group_key===selectedKey)||groups[0]||null;
  const primary=selected?.creators?.find(x=>Number(x.id)===Number(primaryId))||null;
  const secondaries=(selected?.creators||[]).filter(x=>secondaryIds.includes(Number(x.id))&&Number(x.id)!==Number(primaryId));

  function pickGroup(group:Group){
    setSelectedKey(group.group_key);setMessage("");setError("");
    const best=[...group.creators].sort((a,b)=>Number(b.link_score||0)-Number(a.link_score||0)||Number(b.completeness||0)-Number(a.completeness||0))[0];
    setPrimaryId(Number(best.id));
    setSecondaryIds(group.creators.filter(x=>Number(x.id)!==Number(best.id)).map(x=>Number(x.id)));
  }

  function pickPrimary(id:number){
    setPrimaryId(id);
    setSecondaryIds((selected?.creators||[]).filter(x=>Number(x.id)!==id).map(x=>Number(x.id)));
  }

  async function review(){
    if(!primaryId||!secondaries.length)return;
    setError("");const totals:Record<string,number>={};
    for(const secondary of secondaries){
      const {data:preview,error:e}=await supabase.rpc("luma_creator_merge_preview_v1",{p_workspace_id:workspaceId,p_primary_creator_id:primaryId,p_secondary_creator_id:Number(secondary.id)});
      if(e){setError(e.message);return}
      for(const [key,value] of Object.entries(preview?.counts||{}))totals[key]=(totals[key]||0)+Number(value||0);
    }
    setImpact(totals);setVerifyCode(String(Math.floor(100+Math.random()*900)));setVerifyInput("");setConfirmOpen(true);
  }

  async function merge(){
    if(!primaryId||verifyInput!==verifyCode)return;
    setMerging(true);setError("");
    try{
      let total=0;
      for(const secondary of secondaries){
        const {data:result,error:e}=await supabase.rpc("luma_merge_creator_v1",{p_workspace_id:workspaceId,p_primary_creator_id:primaryId,p_secondary_creator_id:Number(secondary.id),p_note:"Merged through Creator Identity Center"});
        if(e)throw e;if(result?.ok)total++;
      }
      setConfirmOpen(false);setMessage(total+" duplicate creator berhasil diarahkan ke canonical creator.");
      window.dispatchEvent(new CustomEvent("lumaway-database-updated",{detail:{creator_identity_merged:true,primary_creator_id:primaryId}}));
      await load(search);
    }catch(e:any){setError(e?.message||"Merge creator gagal.")}finally{setMerging(false)}
  }

  return <section id="creator-identity" className="legacy-page-anchor creator-identity-page">
    <header className="creator-id-head"><div><span>AFFILIATE & CREATOR</span><h1>Creator Identity Center</h1><p>Satukan record creator yang sama menjadi satu canonical creator tanpa menghapus histori operasional.</p></div><div className="button-row"><button className="secondary" onClick={()=>navigateToSection("data-health")}>Data Health</button><button className="secondary" onClick={()=>void load(search)} disabled={loading}>Refresh</button></div></header>
    <div className="creator-id-stats"><article><span>Active Creator</span><b>{loading?"—":fmt(data?.active_creators)}</b></article><article><span>Duplicate Groups</span><b>{loading?"—":fmt(data?.duplicate_groups)}</b></article><article><span>Duplicate Records</span><b>{loading?"—":fmt(data?.duplicate_records)}</b></article><article><span>Review Queue</span><b>{loading?"—":fmt(groups.length)}</b></article></div>
    <div className="creator-id-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void load(search)}} placeholder="Cari creator, username, affiliate ID..."/><button className="primary" onClick={()=>void load(search)}>Cari</button>{search&&<button className="secondary" onClick={()=>{setSearch("");void load("")}}>Reset</button>}</div>
    {error&&<div className="flash error">{error}</div>}{message&&<div className="flash success">{message}</div>}

    <div className="creator-id-layout">
      <aside className="creator-id-groups">
        <div className="creator-id-section-head"><h3>Duplicate Queue</h3><p>Pilih group untuk review.</p></div>
        {groups.map(group=><button type="button" key={group.group_key} className={"creator-id-group-card "+(selectedKey===group.group_key?"active":"")} onClick={()=>pickGroup(group)}><div className="creator-id-avatar">{label(group.creators?.[0]||{}).slice(0,1).toUpperCase()}</div><div><strong>{label(group.creators?.[0]||{})}</strong><span>@{group.creators?.[0]?.username||"-"} · {group.creators?.[0]?.platform||"-"}</span><small>{group.match_reason}</small></div><b>{group.duplicate_count}</b></button>)}
        {!loading&&!groups.length&&<div className="creator-id-empty"><b>Tidak ada duplicate group.</b><span>Coba pencarian lain atau kembali ke Data Health.</span></div>}
      </aside>

      <section className="creator-id-detail">
        {!selected?<div className="creator-id-empty large"><b>Pilih duplicate group.</b></div>:<>
          <div className="creator-id-detail-head"><div><span>IDENTITY MATCH</span><h2>{selected.match_reason}</h2><p>{selected.group_key}</p></div><div className="button-row">{primary&&<button className="secondary" onClick={()=>setCreator360Id(Number(primary.id))}>Customer 360</button>}<button className="primary" disabled={!primaryId||!secondaries.length} onClick={()=>void review()}>Review Merge · {secondaries.length}</button></div></div>
          <div className="creator-id-guidance"><b>Pilih 1 canonical creator.</b><span>Record lain akan diarsipkan sebagai Merged. Alias lama tetap dipakai untuk upload berikutnya.</span></div>
          <div className="creator-id-records">{selected.creators.map(row=>{const id=Number(row.id),canonical=id===Number(primaryId);return <article key={id} className={canonical?"canonical":""}><div className="creator-id-record-top"><label className="creator-id-radio"><input type="radio" checked={canonical} onChange={()=>pickPrimary(id)}/><span/></label><div className="creator-id-avatar">{label(row).slice(0,1).toUpperCase()}</div><div className="creator-id-record-copy"><div><strong>{label(row)}</strong>{canonical&&<em>CANONICAL</em>}</div><span>@{row.username||"-"} · {row.platform||"-"} · ID {row.id}</span><small>{row.affiliate_id?"Affiliate ID "+row.affiliate_id:"Affiliate ID belum ada"}</small></div><div className="creator-id-record-score"><b>{fmt(row.link_score)}</b><span>linked data</span></div></div><div className="creator-id-refchips">{refs(row).map(([key,value])=><span key={key}><b>{fmt(value)}</b>{key}</span>)}<span>{fmt(row.completeness)}/5 profile fields</span></div>{!canonical&&<label className="creator-id-include"><input type="checkbox" checked={secondaryIds.includes(id)} onChange={()=>setSecondaryIds(curr=>curr.includes(id)?curr.filter(x=>x!==id):[...curr,id])}/><span>Gabungkan ke canonical creator</span></label>}</article>})}</div>
        </>}
      </section>
    </div>

    {confirmOpen&&<div className="creator-id-confirm-backdrop"><section className="creator-id-confirm"><div className="creator-id-confirm-head"><div><span>FINAL REVIEW</span><h2>Gabungkan creator?</h2></div><button disabled={merging} onClick={()=>setConfirmOpen(false)}>×</button></div><div className="creator-id-merge-route"><div><small>CANONICAL</small><strong>{label(primary||{})}</strong><span>ID {primaryId}</span></div><b>←</b><div><small>MERGE</small><strong>{secondaries.length} record</strong><span>{secondaries.map(label).join(", ")}</span></div></div><div className="creator-id-impact"><h3>Linked data yang diarahkan</h3><div>{Object.entries(impact).filter(([,v])=>Number(v)>0).map(([key,value])=><span key={key}><b>{fmt(value)}</b>{key.replaceAll("_"," ")}</span>)}</div></div><div className="creator-id-safe-note"><b>Non-destructive merge.</b><span>Duplicate record tetap disimpan sebagai arsip dan semua histori terhubung ke canonical creator.</span></div><label className="creator-id-verify">Kode persetujuan <strong>{verifyCode}</strong><input inputMode="numeric" maxLength={3} value={verifyInput} onChange={e=>setVerifyInput(e.target.value.replace(/\D/g,"").slice(0,3))}/></label><div className="button-row"><button className="secondary" disabled={merging} onClick={()=>setConfirmOpen(false)}>Batal</button><button className="primary" disabled={merging||verifyInput!==verifyCode} onClick={()=>void merge()}>{merging?"Menggabungkan...":"Gabungkan Creator"}</button></div></section></div>}

    {creator360Id&&<Creator360Modal workspaceId={workspaceId} creatorId={creator360Id} startDate="" endDate="" onClose={()=>setCreator360Id(null)}/>}
  </section>;
}