"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
type Row=Record<string,any>;

export default function OwnerReleaseGate(){
 const supabase=useMemo(()=>createClient(),[]);
 const [gate,setGate]=useState<Row>({}),[snapshots,setSnapshots]=useState<Row[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 async function load(){const [g,s]=await Promise.all([supabase.rpc("luma_owner_release_gate_v1"),supabase.from("luma_release_gate_snapshots").select("*").order("created_at",{ascending:false}).limit(12)]);if(g.error)setMsg(g.error.message);else setGate(g.data||{});setSnapshots(s.data||[])}
 useEffect(()=>{void load()},[]);
 async function snapshot(){const label=window.prompt("Label release / versi:",new Date().toISOString().slice(0,10))||"";if(!label)return;const notes=window.prompt("Catatan release gate (opsional):","")||"";setBusy(true);const x=await supabase.rpc("luma_owner_snapshot_release_gate_v1",{p_release_label:label,p_notes:notes});if(x.error)setMsg(x.error.message);else{setMsg("Release gate snapshot tersimpan.");await load()}setBusy(false)}
 const status=String(gate.gate_status||"REVIEW");
 const blockers=gate.blockers||[],reviews=gate.review_items||[];
 return <section className="owner-panel release-gate">
  <div className="owner-panel-head"><div><span className="owner-kicker">RELEASE CONTROL</span><h3>Production Release Gate</h3><p>Ringkasan QA, incident, alert, performance, backup, dan security review sebelum release.</p></div><div className="release-actions"><button className="secondary" onClick={()=>void load()}>Refresh</button><button className="primary" disabled={busy} onClick={()=>void snapshot()}>{busy?"Saving...":"Save Release Snapshot"}</button></div></div>
  {msg&&<div className="owner-inline-note">{msg}</div>}
  <div className={"release-status-card "+status.toLowerCase()}><div><span>CURRENT GATE</span><strong>{status}</strong><p>{status==="READY"?"Tidak ada blocker/review item dari checks yang aktif.":status==="BLOCKED"?"Ada blocker critical. Release sebaiknya tidak diteruskan sebelum diselesaikan.":"Ada item yang masih perlu review sebelum release."}</p></div><div className="release-ring"><b>{blockers.length}</b><span>blocker</span><b>{reviews.length}</b><span>review</span></div></div>
  <div className="release-grid">
   <section><header><span>BLOCKERS</span><h4>Critical stop</h4></header>{blockers.length?blockers.map((x:Row,i:number)=><article key={i}><i>!</i><div><strong>{x.message}</strong><small>{x.count!=null?"Count: "+x.count:x.key}</small></div></article>):<div className="release-empty">Tidak ada blocker critical.</div>}</section>
   <section><header><span>REVIEW ITEMS</span><h4>Perlu dicek</h4></header>{reviews.length?reviews.map((x:Row,i:number)=><article key={i}><i>•</i><div><strong>{x.message}</strong><small>{x.count!=null?"Count: "+x.count:x.key}</small></div></article>):<div className="release-empty">Tidak ada review item.</div>}</section>
  </div>
  <div className="release-kpis"><article><span>Latest QA</span><strong>{gate.latest_qa?"#"+gate.latest_qa.id:"-"}</strong><small>{gate.latest_qa?gate.latest_qa.pass_count+" pass · "+gate.latest_qa.fail_count+" fail · "+gate.latest_qa.pending_count+" pending":"Belum ada run"}</small></article><article><span>Critical Incident</span><strong>{gate.incidents?.critical_open||0}</strong></article><article><span>Critical Alert</span><strong>{gate.alerts?.critical_open||0}</strong></article><article><span>Backup Fresh</span><strong>{gate.backup?.checkpoint_fresh?"YES":"NO"}</strong><small>{gate.backup?.checkpoint_age_hours!=null?Number(gate.backup.checkpoint_age_hours).toFixed(1)+" jam":"-"}</small></article><article><span>RPC Needs Review</span><strong>{gate.security?.needs_review||0}</strong></article></div>
  <div className="release-history"><header><span>RELEASE SNAPSHOTS</span><h4>Riwayat keputusan</h4></header>{snapshots.length?snapshots.map(x=><article key={x.id}><div><strong>{x.release_label||"Release snapshot"}</strong><small>#{x.id} · {new Date(x.created_at).toLocaleString("id-ID")}</small></div><span className={"release-pill "+String(x.gate_status).toLowerCase()}>{x.gate_status}</span></article>):<div className="release-empty">Belum ada snapshot release.</div>}</div>
 </section>
}
