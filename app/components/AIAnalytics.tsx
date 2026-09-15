"use client";

import { useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import KanbanBoard from "./KanbanBoard";

type Props = { workspaceId: string };
const TYPES = [
  ["performance", "Performance Analysis", "KPI, efisiensi, dan kesehatan performa"],
  ["creator", "Creator Analysis", "Kontribusi, konsentrasi, dan peluang creator"],
  ["product", "Product Analysis", "SKU, produk, kontribusi GMV dan volume"],
  ["trend", "Trend Analysis", "Pergerakan periode, momentum, dan arah performa"],
  ["anomaly", "Anomaly Detection", "Lonjakan, penurunan, dan pola tidak biasa"],
  ["recommendation", "Recommendations", "Prioritas tindakan berbasis seluruh temuan"],
] as const;

const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const num=(v:any)=>new Intl.NumberFormat("id-ID").format(Number(v||0));

export default function AIAnalytics({ workspaceId }: Props) {
  const supabase = createClient();
  const [type, setType] = useState("performance");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Siap menganalisis data workspace.");
  const [result, setResult] = useState<any>(null);
  const [runId, setRunId] = useState("");
  const [reportOpen,setReportOpen]=useState(false);
  const [reportSaved,setReportSaved]=useState(false);
  const [taskAdded,setTaskAdded]=useState<Record<number,boolean>>({});

  const active=TYPES.find(x=>x[0]===type)!;

  async function buildContext(){
    const effectiveStart=start||null; const effectiveEnd=end||null;
    const { data:kpi, error:kpiError }=await supabase.rpc("get_dashboard_kpi",{p_workspace_id:workspaceId,p_start_date:effectiveStart,p_end_date:effectiveEnd,p_platform:null,p_creator_id:null});
    if(kpiError)throw kpiError;
    const { data:ranking, error:rankingError }=await supabase.rpc("get_creator_ranking",{p_workspace_id:workspaceId,p_start_date:effectiveStart,p_end_date:effectiveEnd,p_platform:null,p_creator_id:null,p_search:null,p_page:1,p_page_size:50});
    if(rankingError)throw rankingError;

    let q=supabase.from("sales").select("data_date,creator_name,username,platform,sku,product_name,qty,orders,gmv,commission,refund,clicks,buyers,live_gmv,video_gmv,showcase_gmv").eq("workspace_id",workspaceId).order("data_date",{ascending:true}).limit(5000);
    if(start)q=q.gte("data_date",start); if(end)q=q.lte("data_date",end);
    const {data:sales,error:salesError}=await q; if(salesError)throw salesError;
    const rows=sales||[];

    const monthly:Record<string,any>={}; const products:Record<string,any>={}; const platforms:Record<string,any>={};
    for(const r of rows as any[]){
      const m=r.data_date?String(r.data_date).slice(0,7):"undated"; monthly[m]??={gmv:0,qty:0,orders:0,commission:0,rows:0}; monthly[m].gmv+=Number(r.gmv||0);monthly[m].qty+=Number(r.qty||0);monthly[m].orders+=Number(r.orders||0);monthly[m].commission+=Number(r.commission||0);monthly[m].rows++;
      const p=r.sku||r.product_name; if(p){products[p]??={sku:r.sku||null,product:r.product_name||null,gmv:0,qty:0,orders:0,commission:0};products[p].gmv+=Number(r.gmv||0);products[p].qty+=Number(r.qty||0);products[p].orders+=Number(r.orders||0);products[p].commission+=Number(r.commission||0)}
      const pf=r.platform||"Unknown";platforms[pf]??={gmv:0,qty:0,orders:0,commission:0};platforms[pf].gmv+=Number(r.gmv||0);platforms[pf].qty+=Number(r.qty||0);platforms[pf].orders+=Number(r.orders||0);platforms[pf].commission+=Number(r.commission||0);
    }
    return {
      analysis_focus:active[2], period:{start:start||"ALL DATA",end:end||"ALL DATA"},
      kpi:kpi?.[0]||{}, platforms,
      top_creators:(ranking||[]).slice(0,30).map((x:any)=>({rank:x.rank,creator:x.creator_name||x.username,platform:x.platform,qty:x.qty,orders:x.orders,gmv:x.gmv,commission:x.commission})),
      top_products:Object.values(products).sort((a:any,b:any)=>b.gmv-a.gmv).slice(0,30),
      monthly_trend:Object.entries(monthly).map(([period,v])=>({period,...v})),
      sampled_rows:rows.length,
    };
  }

  async function run() {
    setBusy(true); setResult(null); setReportOpen(false); setReportSaved(false); setTaskAdded({});
    try {
      if(start&&end&&start>end)throw new Error("Start Date tidak boleh melewati End Date.");
      setStatus("Menyiapkan dataset workspace..."); const context=await buildContext();
      setStatus(`Memproses ${active[1]}...`);
      const r=await fetch("/api/ai/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,analysis_type:type,start_date:start||null,end_date:end||null,context})});
      const d=await r.json(); if(!r.ok||!d.ok)throw new Error(d.error||"Analisis AI gagal.");
      setResult(d.result); setRunId(d.run_id||""); setStatus(`Selesai · ${d.model||"AI"}`);
    } catch(e:any){setStatus(e?.message||"Analisis AI gagal.");} finally{setBusy(false);}
  }

  const report=useMemo(()=>{
    if(!result)return null;
    return {
      data:[`Periode: ${start||"Seluruh data"} – ${end||"Seluruh data"}`,`Status: ${result.performance_status||"INFO"}`,...(result.key_findings||[])],
      analysis:[result.executive_summary,...(result.creator_findings||[]),...(result.product_findings||[]),...(result.trend_findings||[]),...(result.anomalies||[])].filter(Boolean),
      do:[...(result.recommendations||[])],
      dont:["Jangan mengambil kesimpulan di luar data yang tersedia.","Jangan mengubah data operasional berdasarkan satu anomali tanpa verifikasi.",result.confidence_note].filter(Boolean),
    };
  },[result,start,end]);

  async function addTask(text:string,index:number){
    const {data:{user}}=await supabase.auth.getUser();
    const {error}=await supabase.from("creator_tasks").insert({workspace_id:workspaceId,title:text.slice(0,160),description:text,status:"backlog",priority:"normal",source:"ai_analysis",source_ref:runId||null,analysis_type:type,created_by:user?.id||null,sort_order:Date.now()});
    if(error)return setStatus(error.message); setTaskAdded(x=>({...x,[index]:true})); setStatus("Recommendation ditambahkan ke Kanban.");
  }

  async function saveReport(){
    if(!report)return; const {data:{user}}=await supabase.auth.getUser(); if(!user)return;
    const {error}=await supabase.from("luma_pdf_reports").insert({workspace_id:workspaceId,user_id:user.id,title:`LUMA ${active[1]}`,period_start:start||null,period_end:end||null,language:"id",tone:"minimalist",tokens_used:0,file_name:`luma-${type}-${Date.now()}.html`,run_id:runId||null,analysis_type:type,content_json:report,status:"ready"});
    if(error)return setStatus(error.message); setReportSaved(true); setStatus("Report disimpan ke history.");
  }

  function downloadReport(){
    if(!report)return;
    const section=(title:string,items:string[])=>`<section><h2>${title}</h2>${items.map(x=>`<div class="item">${String(x).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]||c))}</div>`).join("")}</section>`;
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>LUMA ${active[1]}</title><style>body{font-family:Arial,sans-serif;color:#111827;margin:0;background:#fff}main{max-width:820px;margin:0 auto;padding:56px}header{border-bottom:2px solid #111827;padding-bottom:18px;margin-bottom:28px}small{color:#635bff;font-weight:700;letter-spacing:.12em}h1{font-size:30px;margin:8px 0}h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;margin:28px 0 10px}.item{border-bottom:1px solid #e5e7eb;padding:10px 0;line-height:1.55;font-size:13px}.meta{color:#667085;font-size:12px}@media print{main{padding:20mm}}</style></head><body><main><header><small>LUMA AFFILIATE INTELLIGENCE</small><h1>${active[1]}</h1><div class="meta">${start||"All data"} – ${end||"All data"}</div></header>${section("Data",report.data)}${section("Analysis",report.analysis)}${section("Do",report.do)}${section("Don't",report.dont)}<script>window.onload=()=>{}</script></main></body></html>`;
    const blob=new Blob([html],{type:"text/html;charset=utf-8"}); const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`LUMA-${type}-${new Date().toISOString().slice(0,10)}.html`;a.click();URL.revokeObjectURL(a.href);
  }

  function printReport(){
    const el=document.getElementById("luma-report-preview"); if(!el)return; const w=window.open("","_blank","width=900,height=1000"); if(!w)return; w.document.write(`<html><head><title>LUMA ${active[1]}</title><style>body{font-family:Arial;color:#111827;padding:40px}h1{font-size:28px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;margin-top:28px}.report-row{padding:9px 0;border-bottom:1px solid #e5e7eb;line-height:1.5;font-size:13px}.report-brand{color:#635bff;font-size:10px;font-weight:800;letter-spacing:.15em}</style></head><body>${el.innerHTML}</body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }

  return <>
    <section id="ai-analytics" className="legacy-page-anchor ai-page">
      <div className="ai-page-head"><div><div className="eyebrow">LUMA AFFILIATE INTELLIGENCE · AI ANALYTICS</div><h1>{active[1]}</h1><p className="muted">{active[2]}. Setiap tipe memakai fokus analisis berbeda dan membaca database workspace aktif.</p></div></div>
      <div className="ai-type-grid">{TYPES.map(([key,label,desc])=><button key={key} className={`ai-type-card ${type===key?"active":""}`} onClick={()=>{setType(key);setResult(null);setReportOpen(false)}}><strong>{label}</strong><span>{desc}</span></button>)}</div>
      <div className="card ai-control-card"><div className="filters"><label>Start <span className="field-note">Opsional</span><input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>End <span className="field-note">Opsional</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><button className="primary" onClick={run} disabled={busy}>{busy?"Menganalisis...":"✦ Analisis dengan AI"}</button><button className="secondary" onClick={()=>{setStart("");setEnd("")}}>Reset Date</button></div><div className="ai-status">{status}</div></div>
      {result&&<><div className="ai-result-grid"><div className="card ai-summary-card"><div className="eyebrow">EXECUTIVE SUMMARY</div><h3>{result.performance_status||"INFO"}</h3><p>{result.executive_summary}</p><div className="button-row"><button className="primary" onClick={()=>setReportOpen(true)}>Preview Report</button><button className="secondary" onClick={saveReport}>{reportSaved?"Saved ✓":"Save Report"}</button><button className="secondary" onClick={downloadReport}>Download Document</button><button className="secondary" onClick={printReport}>Print / Save PDF</button></div></div>
      {[["Key Findings",result.key_findings],["Creator Findings",result.creator_findings],["Product Findings",result.product_findings],["Trend Findings",result.trend_findings],["Anomalies",result.anomalies]].map(([title,items]:any)=><div className="card" key={title}><h3>{title}</h3><ul className="legacy-list">{(items||[]).map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></div>)}
      <div className="card ai-do-card"><h3>DO · Recommendations</h3><div className="recommendation-list">{(result.recommendations||[]).map((x:string,i:number)=><div className="recommendation-row" key={i}><span>{x}</span><button className="secondary" disabled={taskAdded[i]} onClick={()=>addTask(x,i)}>{taskAdded[i]?"Added ✓":"+ Kanban"}</button></div>)}</div></div>
      <div className="card"><h3>Confidence Note</h3><p className="muted">{result.confidence_note}</p></div></div>
      {reportOpen&&report&&<div className="report-modal-backdrop" onClick={()=>setReportOpen(false)}><div className="report-modal" onClick={e=>e.stopPropagation()}><div className="report-modal-actions"><strong>Report Preview</strong><div className="button-row"><button onClick={downloadReport}>Download</button><button onClick={printReport}>Print / PDF</button><button onClick={()=>setReportOpen(false)}>Close</button></div></div><div id="luma-report-preview" className="luma-report-preview"><div className="report-brand">LUMA AFFILIATE INTELLIGENCE</div><h1>{active[1]}</h1><p className="muted">{start||"All data"} – {end||"All data"}</p>{[["DATA",report.data],["ANALYSIS",report.analysis],["DO",report.do],["DON'T",report.dont]].map(([h,items]:any)=><section key={h}><h2>{h}</h2>{items.map((x:string,i:number)=><div className="report-row" key={i}>{x}</div>)}</section>)}</div></div></div>}</>}
    </section>
    <KanbanBoard workspaceId={workspaceId} userId="" />
  </>;
}
