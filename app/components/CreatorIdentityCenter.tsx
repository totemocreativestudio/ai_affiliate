"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {navigateToSection} from "../../lib/luma-navigation";
import Creator360Modal from "./Creator360Modal";

type Row=Record<string,any>;
type Group={group_key:string;duplicate_count:number;match_reason:string;confidence?:"High"|"Medium"|"Low"|string;priority_score?:number;linked_total?:number;junk_identity?:boolean;review_decision?:string;review_note?:string;reviewed_at?:string|null;creators:Row[]};

const fmt=(v:any)=>Number(v||0).toLocaleString("id-ID");
const label=(row:Row)=>String(row?.name||row?.username||row?.creator_code||("Creator #"+row?.id));
const refs=(row:Row)=>Object.entries(row?.refs||{}).filter(([,v])=>Number(v||0)>0);
const COMPARE_FIELDS=[
  ["name","Name"],["username","Username"],["platform","Platform"],["affiliate_id","Affiliate ID"],
  ["phone","Phone"],["ratecard","Ratecard"],["profile_url","Profile URL"]
] as const;
function cleanDisplay(value:any){const text=String(value??"").trim();return text||"—"}
function normalizeCompare(value:any){return String(value??"").trim().toLowerCase().replace(/^@+/,"")}
function confidenceTone(value:any){const v=String(value||"Low").toLowerCase();return v==="high"?"high":v==="medium"?"medium":"low"}
function compareState(rows:Row[],field:string,value:any){
  const normalized=normalizeCompare(value);
  if(!normalized||["-","--","---","n/a","na","null","none","unknown"].includes(normalized))return"junk";
  const values=rows.map(row=>normalizeCompare(row?.[field])).filter(Boolean);
  return values.length>1&&new Set(values).size===1?"same":"different";
}

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
  const [reviewState,setReviewState]=useState<"pending"|"confirmed_duplicate"|"not_duplicate"|"all">("pending");
  const [reviewNote,setReviewNote]=useState("");
  const [reviewBusy,setReviewBusy]=useState(false);
  const [confidence,setConfidence]=useState<"all"|"High"|"Medium"|"Low">("all");
  const [includeJunk,setIncludeJunk]=useState(false);

  async function load(q=search,state=reviewState,nextConfidence=confidence,nextIncludeJunk=includeJunk){
    setLoading(true);setError("");
    const {data:payload,error:e}=await supabase.rpc("luma_creator_identity_candidates_v3",{p_workspace_id:workspaceId,p_search:q.trim()||null,p_review_state:state,p_confidence:nextConfidence,p_include_junk:nextIncludeJunk,p_limit:100});
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

  useEffect(()=>{void load("",reviewState,confidence,includeJunk)},[workspaceId,reviewState,confidence,includeJunk]);

  const groups=(data?.groups||[]) as Group[];
  const selected=groups.find(g=>g.group_key===selectedKey)||groups[0]||null;
  const primary=selected?.creators?.find(x=>Number(x.id)===Number(primaryId))||null;
  const secondaries=(selected?.creators||[]).filter(x=>secondaryIds.includes(Number(x.id))&&Number(x.id)!==Number(primaryId));

  function pickGroup(group:Group){
    setSelectedKey(group.group_key);setMessage("");setError("");setReviewNote(group.review_note||"");
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

  async function reviewGroup(decision:"pending"|"confirmed_duplicate"|"not_duplicate"){
    if(!selected)return;
    setReviewBusy(true);setError("");setMessage("");
    const {data:result,error:e}=await supabase.rpc("luma_review_creator_identity_group_v1",{
      p_workspace_id:workspaceId,p_group_key:selected.group_key,p_decision:decision,p_note:reviewNote.trim()||null
    });
    setReviewBusy(false);
    if(e){setError(e.message);return}
    if(result?.ok){
      setMessage(decision==="not_duplicate"?"Group ditandai bukan duplikat.":decision==="confirmed_duplicate"?"Group dikonfirmasi sebagai duplikat.":"Status review dikembalikan ke pending.");
      await load(search,reviewState);
    }
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
    <header className="creator-id-head"><div><span>AFFILIATE & CREATOR</span><h1>Creator Identity Center</h1><p>Review duplicate creator dengan confidence scoring, pisahkan identity sampah, lalu prioritaskan creator yang paling banyak terhubung ke data operasional.</p></div><div className="button-row"><button className="secondary" onClick={()=>navigateToSection("data-health")}>Data Health</button><button className="secondary" onClick={()=>void load(search,reviewState,confidence,includeJunk)} disabled={loading}>Refresh</button></div></header>
    <div className="creator-id-stats"><article><span>Active Creator</span><b>{loading?"—":fmt(data?.active_creators)}</b></article><article><span>Pending Review</span><b>{loading?"—":fmt(data?.pending_groups)}</b></article><article><span>High Confidence</span><b>{loading?"—":fmt(data?.high_groups)}</b></article><article><span>Medium Confidence</span><b>{loading?"—":fmt(data?.medium_groups)}</b></article><article><span>Low Confidence</span><b>{loading?"—":fmt(data?.low_groups)}</b></article><article><span>Junk Identity</span><b>{loading?"—":fmt(data?.junk_groups)}</b></article></div>
    <div className="creator-id-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void load(search,reviewState,confidence,includeJunk)}} placeholder="Cari creator, username, affiliate ID..."/><select value={reviewState} onChange={e=>setReviewState(e.target.value as any)}><option value="pending">Pending Review</option><option value="confirmed_duplicate">Confirmed Duplicate</option><option value="not_duplicate">Not Duplicate</option><option value="all">Semua Status</option></select><select value={confidence} onChange={e=>setConfidence(e.target.value as any)}><option value="all">Semua Confidence</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select><label className="creator-junk-toggle"><input type="checkbox" checked={includeJunk} onChange={e=>setIncludeJunk(e.target.checked)}/><span>Tampilkan identity sampah</span></label><button className="primary" onClick={()=>void load(search,reviewState,confidence,includeJunk)}>Cari</button>{search&&<button className="secondary" onClick={()=>{setSearch("");void load("",reviewState,confidence,includeJunk)}}>Reset</button>}</div>
    {error&&<div className="flash error">{error}</div>}{message&&<div className="flash success">{message}</div>}

    <div className="creator-id-layout">
      <aside className="creator-id-groups">
        <div className="creator-id-section-head"><h3>Duplicate Queue</h3><p>Pilih group untuk review · {reviewState.replaceAll("_"," ")}.</p></div>
        {groups.map(group=><button type="button" key={group.group_key} className={"creator-id-group-card "+(selectedKey===group.group_key?"active":"")} onClick={()=>pickGroup(group)}><div className="creator-id-avatar">{label(group.creators?.[0]||{}).slice(0,1).toUpperCase()}</div><div><div className="creator-id-queue-title"><strong>{label(group.creators?.[0]||{})}</strong><em className={"creator-confidence "+confidenceTone(group.confidence)}>{group.confidence||"Low"}</em></div><span>@{group.creators?.[0]?.username||"-"} · {group.creators?.[0]?.platform||"-"}</span><small>{group.match_reason} · {fmt(group.linked_total)} linked data</small></div><div className="creator-id-priority"><b>{group.duplicate_count}</b><small>P{fmt(group.priority_score)}</small></div></button>)}
        {!loading&&!groups.length&&<div className="creator-id-empty"><b>Tidak ada duplicate group.</b><span>Coba pencarian lain atau kembali ke Data Health.</span></div>}
      </aside>

      <section className="creator-id-detail">
        {!selected?<div className="creator-id-empty large"><b>Pilih duplicate group.</b></div>:<>
          <div className="creator-id-detail-head"><div><span>IDENTITY MATCH</span><div className="creator-id-detail-title"><h2>{selected.match_reason}</h2><em className={"creator-confidence "+confidenceTone(selected.confidence)}>{selected.confidence||"Low"} Confidence</em>{selected.junk_identity&&<em className="creator-junk-badge">Junk Identity</em>}</div><p>{selected.group_key} · Priority {fmt(selected.priority_score)} · {fmt(selected.linked_total)} linked data</p></div><div className="button-row">{primary&&<button className="secondary" onClick={()=>setCreator360Id(Number(primary.id))}>Customer 360</button>}<button className="primary" disabled={!primaryId||!secondaries.length||selected.junk_identity} onClick={()=>void review()}>Review Merge · {secondaries.length}</button></div></div><div className={"creator-review-status decision-"+(selected.review_decision||"pending")}><span>Status Review</span><b>{(selected.review_decision||"pending").replaceAll("_"," ")}</b>{selected.reviewed_at&&<small>{new Date(selected.reviewed_at).toLocaleString("id-ID")}</small>}</div>
          <div className="creator-id-guidance"><b>Pilih 1 canonical creator.</b><span>Record lain akan diarsipkan sebagai Merged. Alias lama tetap dipakai untuk upload berikutnya.</span></div><div className="creator-review-actions"><label><span>Catatan review</span><textarea value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Opsional: alasan duplicate / bukan duplicate..."/></label><div><button type="button" className="secondary" disabled={reviewBusy} onClick={()=>void reviewGroup("not_duplicate")}>Bukan Duplikat</button><button type="button" className="secondary" disabled={reviewBusy} onClick={()=>void reviewGroup("pending")}>Kembalikan Pending</button><button type="button" className="primary" disabled={reviewBusy} onClick={()=>void reviewGroup("confirmed_duplicate")}>Konfirmasi Duplikat</button></div></div>
          <div className="creator-id-records">{selected.creators.map(row=>{const id=Number(row.id),canonical=id===Number(primaryId);return <article key={id} className={canonical?"canonical":""}><div className="creator-id-record-top"><label className="creator-id-radio"><input type="radio" checked={canonical} onChange={()=>pickPrimary(id)}/><span/></label><div className="creator-id-avatar">{label(row).slice(0,1).toUpperCase()}</div><div className="creator-id-record-copy"><div><strong>{label(row)}</strong>{canonical&&<em>CANONICAL</em>}</div><span>@{row.username||"-"} · {row.platform||"-"} · ID {row.id}</span><small>{row.affiliate_id?"Affiliate ID "+row.affiliate_id:"Affiliate ID belum ada"}</small></div><div className="creator-id-record-score"><b>{fmt(row.link_score)}</b><span>linked data</span></div></div><div className="creator-id-refchips">{refs(row).map(([key,value])=><span key={key}><b>{fmt(value)}</b>{key}</span>)}<span>{fmt(row.completeness)}/5 profile fields</span></div>{!canonical&&<label className="creator-id-include"><input type="checkbox" checked={secondaryIds.includes(id)} onChange={()=>setSecondaryIds(curr=>curr.includes(id)?curr.filter(x=>x!==id):[...curr,id])}/><span>Gabungkan ke canonical creator</span></label>}</article>})}</div>
          <section className="creator-id-compare"><div className="creator-id-section-head"><h3>Side-by-side comparison</h3><p>Bandingkan field sebelum menentukan canonical creator.</p></div><div className="creator-id-compare-wrap"><table><thead><tr><th>Field</th>{selected.creators.map(row=><th key={row.id}>{label(row)}<small>ID {row.id}</small></th>)}</tr></thead><tbody>{COMPARE_FIELDS.map(([field,fieldLabel])=><tr key={field}><td>{fieldLabel}</td>{selected.creators.map(row=>{const state=compareState(selected.creators,field,row[field]);return <td key={row.id} className={"compare-"+state}><span>{field==="ratecard"?"Rp "+Number(row[field]||0).toLocaleString("id-ID"):cleanDisplay(row[field])}</span><small>{state==="same"?"Sama":state==="junk"?"Kosong / Junk":"Berbeda"}</small></td>})}</tr>)}</tbody></table></div></section>
        </>}
      </section>
    </div>

    {confirmOpen&&<div className="creator-id-confirm-backdrop"><section className="creator-id-confirm"><div className="creator-id-confirm-head"><div><span>FINAL REVIEW</span><h2>Gabungkan creator?</h2></div><button disabled={merging} onClick={()=>setConfirmOpen(false)}>×</button></div><div className="creator-id-merge-route"><div><small>CANONICAL</small><strong>{label(primary||{})}</strong><span>ID {primaryId}</span></div><b>←</b><div><small>MERGE</small><strong>{secondaries.length} record</strong><span>{secondaries.map(label).join(", ")}</span></div></div><div className="creator-id-impact"><h3>Linked data yang diarahkan</h3><div>{Object.entries(impact).filter(([,v])=>Number(v)>0).map(([key,value])=><span key={key}><b>{fmt(value)}</b>{key.replaceAll("_"," ")}</span>)}</div></div><div className="creator-id-safe-note"><b>Non-destructive merge.</b><span>Duplicate record tetap disimpan sebagai arsip dan semua histori terhubung ke canonical creator.</span></div><label className="creator-id-verify">Kode persetujuan <strong>{verifyCode}</strong><input inputMode="numeric" maxLength={3} value={verifyInput} onChange={e=>setVerifyInput(e.target.value.replace(/\D/g,"").slice(0,3))}/></label><div className="button-row"><button className="secondary" disabled={merging} onClick={()=>setConfirmOpen(false)}>Batal</button><button className="primary" disabled={merging||verifyInput!==verifyCode} onClick={()=>void merge()}>{merging?"Menggabungkan...":"Gabungkan Creator"}</button></div></section></div>}

    {creator360Id&&<Creator360Modal workspaceId={workspaceId} creatorId={creator360Id} startDate="" endDate="" onClose={()=>setCreator360Id(null)}/>}
  </section>;
}