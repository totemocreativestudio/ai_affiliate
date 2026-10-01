"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

type Check={key:string;label:string;expected:any;actual:any;status:"EXACT"|"DIFFERENCE"|"SOURCE_MISSING"|"NOT_APPLICABLE";difference?:number|null;difference_pct?:number|null;note?:string|null};
const nf=(v:any)=>Number(v||0).toLocaleString("id-ID",{maximumFractionDigits:2});
const money=(v:any)=>"Rp "+Number(v||0).toLocaleString("id-ID",{maximumFractionDigits:2});
const isMoney=(key:string)=>key.includes("gmv")||key.includes("revenue");
const displayValue=(key:string,v:any)=>typeof v==="number"?(isMoney(key)?money(v):nf(v)):String(v??"-");
const statusLabel=(s:string)=>s==="EXACT"?"Exact":s==="DIFFERENCE"?"Difference":s==="SOURCE_MISSING"?"Sumber Belum Lengkap":"Tidak Dibandingkan";

export default function LiveDataHealthPanel({workspaceId,start,end}:{workspaceId:string;start?:string;end?:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const now=new Date(),fallbackEnd=now.toISOString().slice(0,10),fallbackStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);
 const rangeStart=start||fallbackStart,rangeEnd=end||fallbackEnd;
 const [data,setData]=useState<any>(null),[rec,setRec]=useState<any>(null),[truth,setTruth]=useState<any>(null),[uploadContextHealth,setUploadContextHealth]=useState<any>(null),[loading,setLoading]=useState(true),[msg,setMsg]=useState("");

 async function load(){
  setLoading(true);setMsg("");
  const [x,r,u]=await Promise.all([
   supabase.rpc("luma_live_data_health_v1",{p_workspace_id:workspaceId}),
   supabase.rpc("luma_live_source_truth_qc_v1",{p_workspace_id:workspaceId,p_start:rangeStart,p_end:rangeEnd}),
   supabase.rpc("luma_live_upload_context_health_v1",{p_workspace_id:workspaceId,p_start:rangeStart,p_end:rangeEnd})
  ]);
  if(x.error||r.error||u.error){setMsg(x.error?.message||r.error?.message||u.error?.message||"Data Health gagal dimuat.");setData(x.data||null);setTruth(r.data||null);setRec(r.data?.reconciliation||null);setUploadContextHealth(u.data||null)}
  else{setData(x.data||{});setTruth(r.data||{});setRec(r.data?.reconciliation||{});setUploadContextHealth(u.data||{})}
  setLoading(false);
 }

 useEffect(()=>{
  void load();
  const fn=()=>void load();
  window.addEventListener("lumaway-live-updated",fn);
  return()=>window.removeEventListener("lumaway-live-updated",fn);
 },[workspaceId,rangeStart,rangeEnd]);

 const issues=[
  ["Failed Import",Number(data?.failed_imports||0),"Periksa file atau mapping yang gagal."],
  ["Completed tanpa Performance",Number(data?.completed_without_performance||0),"Session selesai tetapi belum memiliki row performance."],
  ["Session tanpa Host",Number(data?.sessions_without_host||0),"Shopee source session boleh belum punya Host; assign Host hanya jika identitasnya diketahui."],
  ["Campaign belum terhubung",Number(data?.campaign_sessions_unlinked||0),"Nama campaign ada tetapi campaign_id belum terhubung."],
  ["Jam belum terbaca",Number(data?.performance_without_hour||0),"Histogram dan heatmap membutuhkan hour bucket."],
 ];
 const allChecks:Check[]=[...(rec?.shopee?.checks||[]),...(rec?.tiktok?.checks||[])];
 const diffCount=allChecks.filter(x=>x.status==="DIFFERENCE").length;
 const missingCount=allChecks.filter(x=>x.status==="SOURCE_MISSING").length;
 const exactCount=allChecks.filter(x=>x.status==="EXACT").length;
 const importProblems=Number(rec?.imports?.failed||0)+Number(rec?.imports?.partial||0);
 const score=Math.max(0,100-diffCount*10-importProblems*8-Math.min(20,missingCount*2)-issues.reduce((s,x)=>s+Math.min(10,Number(x[1]||0)*2),0));
 const healthLabel=score>=90&&diffCount===0?"Sehat":missingCount>0&&diffCount===0?"Sumber Belum Lengkap":"Perlu Dicek";

 function Checks({title,subtitle,checks,source}:{title:string;subtitle:string;checks:Check[];source:any}){
  return <section className="lh-recon-card">
   <header><div><span>RECONCILIATION</span><h3>{title}</h3><p>{subtitle}</p></div><div className="lh-source-badges">{Object.entries(source||{}).map(([k,v])=><i key={k} className={v?"ok":"missing"}>{k.replaceAll("_"," ")} · {v?"ada":"belum"}</i>)}</div></header>
   <div className="lh-check-table">
    {checks.map(c=><article key={c.key} className={"status-"+String(c.status).toLowerCase()}>
      <div><strong>{c.label}</strong><small>{c.note||"-"}</small></div>
      <div><span>Source</span><b>{displayValue(c.key,c.expected)}</b></div>
      <div><span>Compare</span><b>{displayValue(c.key,c.actual)}</b></div>
      <div><span>Selisih</span><b>{c.difference===null||c.difference===undefined?"-":displayValue(c.key,c.difference)}</b></div>
      <em>{statusLabel(c.status)}</em>
    </article>)}
   </div>
  </section>
 }

 return <div className="live-health-panel">
  <div className="lh-head"><div><span>END-TO-END QA</span><h2>Live Data Health</h2><p>Validasi kualitas data Shopee dan TikTok sebelum angka dipakai untuk analisis.</p></div><div className="lh-head-actions"><small>{rangeStart} → {rangeEnd}</small><button onClick={()=>void load()}>Refresh Check</button></div></div>
  {msg&&<div className="live-upload-msg">{msg}</div>}
  {loading?<div className="live-loading">Menjalankan reconciliation & health check...</div>:<>
   <div className={"lh-score status-"+healthLabel.toLowerCase().replaceAll(" ","-")}><div><strong>{score}</strong><span>/100</span></div><section><b>{healthLabel}</b><p>Skor ini hanya mengukur konsistensi dan kelengkapan data, bukan performa bisnis.</p></section></div>

   <div className="lh-source-truth">
    <article><span>Unified GMV</span><strong>{money(truth?.canonical?.unified?.gmv)}</strong><small>Shopee canonical + TikTok attributed</small></article>
    <article><span>Shopee GMV</span><strong>{money(truth?.canonical?.shopee?.gmv_created)}</strong><small>{nf(truth?.canonical?.shopee?.orders_created)} orders · {nf(truth?.canonical?.shopee?.qty_created)} qty</small></article>
    <article><span>TikTok GMV</span><strong>{money(truth?.canonical?.tiktok?.gmv)}</strong><small>{nf(truth?.canonical?.tiktok?.orders)} SKU orders · {nf(truth?.canonical?.tiktok?.qty)} qty</small></article>
    <article><span>QC Status</span><strong>{truth?.status||"-"}</strong><small>source truth reconciliation</small></article>
   </div>

   <div className="lh-summary">
    {[["Exact",exactCount],["Difference",diffCount],["Source Missing",missingCount],["Import Warning",rec?.imports?.with_warnings],["Failed/Partial",importProblems]].map(([l,v])=><article key={String(l)}><span>{l}</span><strong>{Number(v||0).toLocaleString("id-ID")}</strong></article>)}
   </div>

   <Checks title="Shopee Live" subtitle="Bandingkan Live Session List, Overview, dan Product List tanpa mencampur semantic yang memang berbeda." checks={rec?.shopee?.checks||[]} source={rec?.shopee?.source_presence}/>
   <Checks title="TikTok Live" subtitle="Integrity check untuk daily Core Stats: tanggal unik dan identitas Direct + Indirect." checks={rec?.tiktok?.checks||[]} source={rec?.tiktok?.source_presence}/>

   <section className="lh-upload-context-audit">
    <header><div><span>UPLOAD CONTEXT QA</span><h3>Store & Host Attribution</h3><p>Memastikan setiap file Live dapat ditelusuri ke toko dan host yang dipilih saat upload.</p></div><b>{uploadContextHealth?.status||"-"}</b></header>
    <div className="lh-context-grid">
     <article><span>Completed Imports</span><strong>{nf(uploadContextHealth?.completed_imports)}</strong></article>
     <article className={Number(uploadContextHealth?.missing_store_context||0)>0?"warning":"ok"}><span>Missing Store</span><strong>{nf(uploadContextHealth?.missing_store_context)}</strong></article>
     <article className={Number(uploadContextHealth?.missing_host_context||0)>0?"warning":"ok"}><span>Missing Host</span><strong>{nf(uploadContextHealth?.missing_host_context)}</strong></article>
     <article className={Number(uploadContextHealth?.session_host_mismatch||0)>0?"warning":"ok"}><span>Host Mismatch</span><strong>{nf(uploadContextHealth?.session_host_mismatch)}</strong></article>
    </div>
   </section>

   <section className="lh-import-audit">
    <header><div><span>IMPORT AUDIT</span><h3>Parser warnings & failed imports</h3></div></header>
    {(rec?.imports?.recent_issues||[]).length?<div>{(rec.imports.recent_issues||[]).slice(0,12).map((x:any)=><article key={x.import_id}><div><strong>{x.filename}</strong><small>{x.platform||"-"} · {x.dataset_type||"legacy"} · {new Date(x.created_at).toLocaleString("id-ID")}</small></div><span>{x.status}</span><small>{Array.isArray(x.warnings)&&x.warnings.length?x.warnings.join(" · "):"Tidak ada parser warning."}</small></article>)}</div>:<div className="live-empty">Tidak ada failed import atau parser warning pada periode ini.</div>}
   </section>

   <div className="lh-operational">
    <h3>Operational checks</h3>
    <div className="lh-issues">{issues.map(([label,count,help])=><article key={String(label)} className={Number(count)>0?"warning":"ok"}><div><i>{Number(count)>0?"!":"✓"}</i><span><strong>{label}</strong><small>{help}</small></span></div><b>{Number(count).toLocaleString("id-ID")}</b></article>)}</div>
   </div>
   <div className="lh-meta"><span>Latest metric: <b>{data?.latest_metric_date||"-"}</b></span><span>Latest import: <b>{data?.latest_import_at?new Date(data.latest_import_at).toLocaleString("id-ID"):"-"}</b></span></div>
  </>}
 </div>
}
