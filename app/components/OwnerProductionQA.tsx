"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
type Row=Record<string,any>;

export default function OwnerProductionQA(){
 const supabase=useMemo(()=>createClient(),[]);
 const [runs,setRuns]=useState<Row[]>([]),[results,setResults]=useState<Row[]>([]),[activeRun,setActiveRun]=useState<Row|null>(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 async function load(runId?:number){
  const r=await supabase.from("luma_qa_runs").select("*").order("started_at",{ascending:false}).limit(20);
  const list=r.data||[];setRuns(list);
  const chosen=runId?list.find(x=>x.id===runId):list[0];setActiveRun(chosen||null);
  if(chosen){const x=await supabase.from("luma_qa_results").select("*,luma_qa_definitions(check_key,area,title,description,check_mode,severity,sort_order)").eq("run_id",chosen.id).order("id");setResults((x.data||[]).sort((a:any,b:any)=>(a.luma_qa_definitions?.sort_order||0)-(b.luma_qa_definitions?.sort_order||0)))}else setResults([]);
 }
 useEffect(()=>{void load()},[]);
 async function runQA(){setBusy(true);setMsg("");const x=await supabase.rpc("luma_owner_run_production_qa_v1");if(x.error)setMsg(x.error.message);else{setMsg("Production QA run selesai.");await load(x.data?.run_id)}setBusy(false)}
 async function mark(row:Row,status:string){const notes=window.prompt("Catatan / evidence untuk "+row.luma_qa_definitions?.title+" (opsional):",row.notes||"")??row.notes??"";const x=await supabase.rpc("luma_owner_set_qa_result_v1",{p_result_id:row.id,p_status:status,p_notes:notes});if(x.error)setMsg(x.error.message);else await load(activeRun?.id)}
 const criticalFails=results.filter(x=>x.status==="fail"&&x.luma_qa_definitions?.severity==="critical").length;
 const readiness=!activeRun?"Belum diuji":criticalFails>0?"BLOCKED":Number(activeRun.pending_count||0)>0?"REVIEW":"READY";
 return <section className="owner-panel production-qa">
  <div className="owner-panel-head"><div><span className="owner-kicker">PRODUCTION QA</span><h3>Release Readiness Matrix</h3><p>Automated structural checks + manual user-journey verification. Tidak menjalankan test destruktif di production.</p></div><button className="primary" disabled={busy} onClick={()=>void runQA()}>{busy?"Running...":"Run Production QA"}</button></div>
  {msg&&<div className="owner-inline-note">{msg}</div>}
  {activeRun&&<div className="qa-summary"><article className={"qa-readiness "+readiness.toLowerCase()}><span>Release Readiness</span><strong>{readiness}</strong><small>Critical fail: {criticalFails}</small></article><article><span>Pass</span><strong>{activeRun.pass_count}</strong></article><article><span>Fail</span><strong>{activeRun.fail_count}</strong></article><article><span>Pending Manual</span><strong>{activeRun.pending_count}</strong></article><article><span>Run</span><strong>#{activeRun.id}</strong><small>{new Date(activeRun.started_at).toLocaleString("id-ID")}</small></article></div>}
  <div className="qa-layout">
   <aside><span>QA RUN HISTORY</span>{runs.map(r=><button key={r.id} className={activeRun?.id===r.id?"active":""} onClick={()=>void load(r.id)}><strong>Run #{r.id}</strong><small>{new Date(r.started_at).toLocaleString("id-ID")}</small><em>{r.pass_count} pass · {r.fail_count} fail · {r.pending_count} pending</em></button>)}</aside>
   <main>{results.length?<div className="qa-list">{results.map(row=>{const d=row.luma_qa_definitions||{};return <article key={row.id} className={"qa-row qa-"+row.status}><div className="qa-state">{row.status==="pass"?"✓":row.status==="fail"?"!":"…"}</div><div className="qa-copy"><div><span>{d.area} · {d.check_mode}</span><b className={"qa-severity "+d.severity}>{d.severity}</b></div><h4>{d.title}</h4><p>{d.description}</p>{row.details&&<small>{row.details}</small>}{row.notes&&<blockquote>{row.notes}</blockquote>}</div><div className="qa-actions">{d.check_mode==="manual"?<><button onClick={()=>void mark(row,"pass")}>Pass</button><button onClick={()=>void mark(row,"fail")}>Fail</button><button onClick={()=>void mark(row,"pending")}>Pending</button></>:<span className={"qa-status "+row.status}>{row.status}</span>}</div></article>})}</div>:<div className="incident-empty large">Belum ada QA run. Klik Run Production QA.</div>}</main>
  </div>
 </section>
}
