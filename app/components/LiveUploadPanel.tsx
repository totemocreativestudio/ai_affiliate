"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {detectLiveDataset,normalizeLiveDataset,parseDelimitedMatrix,type LiveDetection,type ParsedLivePayload} from "../../lib/live-import-parser";
import SmartEmptyState from "./SmartEmptyState";

declare global{interface Window{XLSX?:any}}
type Row=Record<string,any>;
const targets=[["host_username","Host Username"],["host_name","Host Name"],["session_title","Session Title"],["metric_date","Date"],["hour","Hour"],["gmv","GMV"],["orders","Orders"],["qty","Qty"],["active_viewers","Active Viewers"],["peak_viewers","Peak Viewers"],["avg_viewers","Avg Viewers"],["clicks","Clicks"],["impressions","Impressions"],["ctr","CTR"],["cvr","CVR"],["duration_minutes","Duration Minutes"],["campaign_name","Campaign"],["gimmick","Gimmick"]];

async function loadXlsx(){if(window.XLSX)return window.XLSX;await new Promise<void>((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";s.onload=()=>resolve();s.onerror=()=>reject(new Error("Parser XLSX gagal dimuat."));document.head.appendChild(s)});return window.XLSX}
async function hash(buffer:ArrayBuffer){const h=await crypto.subtle.digest("SHA-256",buffer);return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,"0")).join("")}
const clean=(v:any)=>v===null||v===undefined?"":String(v).trim();
function matrixObjects(matrix:any[][],headerRow=0){const h=(matrix[headerRow]||[]).map(clean);return matrix.slice(headerRow+1).filter(r=>r.some(x=>clean(x)!=="")).map(r=>Object.fromEntries(h.map((x,i)=>[x||("__col_"+i),r[i]??""])))}
function shortValue(v:any){if(v===null||v===undefined||v==="")return "-";if(typeof v==="object")return JSON.stringify(v).slice(0,80);return String(v)}
const typeLabel=(d?:LiveDetection|null)=>d?.dataset_type==="shopee_session_list"?"Shopee · Live Session List":d?.dataset_type==="shopee_product_list"?"Shopee · Live Product List":d?.dataset_type==="shopee_overview"?"Shopee · Live Overview":d?.dataset_type==="tiktok_core_stats"?"TikTok · Live Performance Core Stats":"Generic Live · Manual Mapping";

export default function LiveUploadPanel({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [file,setFile]=useState<File|null>(null),[matrix,setMatrix]=useState<any[][]>([]),[rows,setRows]=useState<Row[]>([]),[mapping,setMapping]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[removingId,setRemovingId]=useState(""),[msg,setMsg]=useState(""),[history,setHistory]=useState<any[]>([]);
 const [detection,setDetection]=useState<LiveDetection|null>(null),[parsed,setParsed]=useState<ParsedLivePayload|null>(null),[fileHash,setFileHash]=useState(""),[delimiter,setDelimiter]=useState(""),[sourceSheet,setSourceSheet]=useState("");
 const headers=Object.keys(rows[0]||{});

 async function loadHistory(){const x=await supabase.from("live_imports").select("*").eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(25);setHistory(x.data||[])}
 useEffect(()=>{void loadHistory()},[workspaceId]);

 async function choose(f:File){
  setFile(f);setMsg("Membaca dan mendeteksi format file...");setRows([]);setParsed(null);setDetection(null);setDelimiter("");setSourceSheet("");
  try{
   const buffer=await f.arrayBuffer();setFileHash(await hash(buffer));let m:any[][]=[];let sheet="";
   if(f.name.toLowerCase().endsWith(".csv")){
    const decoded=new TextDecoder("utf-8").decode(buffer);const p=parseDelimitedMatrix(decoded);m=p.rows;setDelimiter(p.delimiter==="\t"?"TAB":p.delimiter);
   }else{
    const XLSX=await loadXlsx();const wb=XLSX.read(buffer,{type:"array",cellDates:true});sheet=wb.SheetNames[0]||"";setSourceSheet(sheet);
    m=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:"",raw:true,dateNF:"yyyy-mm-dd"});
   }
   setMatrix(m);
   const d=detectLiveDataset(m,sheet);setDetection(d);
   const p=normalizeLiveDataset(m,d);setParsed(p);
   if(d.dataset_type==="generic"){
    const genericRows=matrixObjects(m,d.header_row);setRows(genericRows);
    const lower=Object.fromEntries(Object.keys(genericRows[0]||{}).map(h=>[h.toLowerCase().replace(/[^a-z0-9]/g,""),h]));const auto:Record<string,string>={};
    for(const [key,label] of targets){const token=label.toLowerCase().replace(/[^a-z0-9]/g,"");auto[key]=lower[token]||Object.entries(lower).find(([k])=>k.includes(token)||token.includes(k))?.[1]||""}
    setMapping(auto);
   }else{setRows([]);setMapping({})}
   const count=p.normalized_rows.length+(p.overview?1:0)+(p.traffic_sources?.length||0);
   setMsg(d.dataset_type==="generic"?"Format belum dikenali otomatis. Gunakan Manual Mapping.":`Terdeteksi otomatis: ${typeLabel(d)} · ${count.toLocaleString("id-ID")} record siap.`);
  }catch(e:any){setMsg(e?.message||"File gagal dibaca.");setFile(null)}
 }

 async function submit(){
  if(!file||!detection||!parsed)return;
  if(detection.dataset_type==="generic"&&!rows.length)return;
  setBusy(true);setMsg("Mengimport Live Streaming...");
  try{
   const payload:any={workspace_id:workspaceId,filename:file.name,file_hash:fileHash,platform:detection.platform,dataset_type:detection.dataset_type,parser_version:detection.parser_version,source_sheet:sourceSheet||null,
    parser_meta:{confidence:detection.confidence,reason:detection.reason,delimiter:delimiter||null,source_sheet:sourceSheet||null},
    warnings:parsed.warnings,period_start:parsed.period_start||null,period_end:parsed.period_end||null,
    normalized_rows:parsed.normalized_rows,overview:parsed.overview||null,traffic_sources:parsed.traffic_sources||[],mapping_overrides:mapping};
   if(detection.dataset_type==="generic")payload.rows=rows;
   const r=await fetch("/api/live/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const j=await r.json().catch(()=>({}));
   if(!r.ok||!j.ok)throw new Error(j.error||"Import gagal");
   setMsg(`Import selesai · ${Number(j.persisted_rows||0).toLocaleString("id-ID")} record tersimpan · ${j.period_start||"-"} s.d. ${j.period_end||"-"}`);
   setRows([]);setMatrix([]);setParsed(null);setDetection(null);setFile(null);setFileHash("");setDelimiter("");setSourceSheet("");
   await loadHistory();window.dispatchEvent(new CustomEvent("lumaway-live-updated"));
  }catch(e:any){setMsg(e.message||"Import gagal")}finally{setBusy(false)}
 }

 async function removeImport(item:any){
   const id=String(item.import_id||"");if(!id||removingId)return;
   if(!window.confirm("Hapus file ini dan seluruh data Live yang berasal dari file tersebut? Tindakan ini tidak dapat dibatalkan."))return;
   setRemovingId(id);setMsg("Menghapus import dan data terkait...");
   const x=await supabase.rpc("luma_delete_live_import_v1",{p_workspace_id:workspaceId,p_import_id:id});
   if(x.error)setMsg(x.error.message);
   else{setMsg("Import dan data terkait sudah dihapus.");await loadHistory();window.dispatchEvent(new CustomEvent("lumaway-live-updated"))}
   setRemovingId("");
 }

 const preview=parsed?.preview||[];
 const previewKeys=Object.keys(preview[0]||{}).filter(k=>k!=="raw_payload").slice(0,10);
 const normalizedCount=(parsed?.normalized_rows?.length||0)+(parsed?.overview?1:0)+(parsed?.traffic_sources?.length||0);

 return <div className="live-upload-panel">
  <div className="live-upload-hero"><div><span>UNIFIED LIVE DATA PIPELINE</span><h2>Upload Shopee / TikTok Live</h2><p>XLSX/CSV dideteksi otomatis berdasarkan struktur file. Format angka koma/titik, persen, tanggal, durasi dan delimiter dinormalisasi sebelum masuk database.</p></div><label className="live-drop"><input type="file" accept=".xlsx,.xls,.csv" onChange={e=>e.target.files?.[0]&&void choose(e.target.files[0])}/><strong>{file?file.name:"Pilih file XLSX/CSV"}</strong><small>Shopee Live List · Product List · Overview · TikTok Core Stats</small></label></div>

  {msg&&<div className="live-upload-msg">{msg}</div>}

  {file&&detection&&parsed&&<section className="live-detect-card">
   <header><div><span>AUTO DETECT</span><h3>{typeLabel(detection)}</h3></div><b>{Math.round(detection.confidence*100)}% confidence</b></header>
   <div className="live-detect-grid"><div><span>Platform</span><strong>{detection.platform}</strong></div><div><span>Dataset</span><strong>{detection.dataset_type}</strong></div><div><span>Parser</span><strong>{detection.parser_version}</strong></div><div><span>Sheet / Delimiter</span><strong>{sourceSheet||delimiter||"-"}</strong></div><div><span>Periode</span><strong>{parsed.period_start||"-"} → {parsed.period_end||"-"}</strong></div><div><span>Normalized</span><strong>{normalizedCount.toLocaleString("id-ID")} record</strong></div></div>
   {parsed.warnings.length>0&&<div className="live-parser-warnings">{parsed.warnings.map((w,i)=><p key={i}>{w}</p>)}</div>}
  </section>}

  {detection?.dataset_type==="generic"&&rows.length>0&&<section className="live-mapping"><header><span>MANUAL FALLBACK</span><h3>Mapping kolom</h3></header><div>{targets.map(([key,label])=><label key={key}>{label}<select value={mapping[key]||""} onChange={e=>setMapping({...mapping,[key]:e.target.value})}><option value="">Tidak dipetakan</option>{headers.map(h=><option key={h}>{h}</option>)}</select></label>)}</div></section>}

  {file&&parsed&&<section className="live-preview"><header><span>NORMALIZED PREVIEW</span><h3>Preview hasil parser</h3></header>
   {preview.length?<div className="scroll"><table><thead><tr>{previewKeys.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{preview.slice(0,5).map((r,i)=><tr key={i}>{previewKeys.map(h=><td key={h}>{shortValue(r[h])}</td>)}</tr>)}</tbody></table></div>:<div className="live-empty">Belum ada preview normalized.</div>}
   {parsed.traffic_sources&&parsed.traffic_sources.length>0&&<p className="live-preview-note">Traffic source Shopee terdeteksi: <b>{parsed.traffic_sources.length}</b> sumber.</p>}
   <button disabled={busy||detection?.dataset_type==="generic"&&!rows.length} onClick={()=>void submit()}>{busy?"Mengimport...":"Import ke Live Streaming"}</button>
  </section>}

  <section className="live-import-history"><header><div><span>IMPORT HISTORY</span><h3>Upload Live terbaru</h3></div><small>Hapus akan membersihkan data sumber dan history import</small></header>{history.length?history.map(x=><article key={x.id}><div><strong>{x.filename}</strong><small>{x.import_id} · {x.platform||"-"} · {x.dataset_type||"legacy"} · {new Date(x.created_at).toLocaleString("id-ID")}</small></div><div className="live-history-actions"><div><b>{x.persisted_rows} row</b><span className={"status-"+x.status}>{x.status}</span></div><button className="danger" disabled={removingId===x.import_id} onClick={()=>void removeImport(x)}>{removingId===x.import_id?"Menghapus...":"Hapus"}</button></div></article>):<SmartEmptyState compact eyebrow="LIVE STREAMING" title="Belum ada upload Live Streaming" description="Upload report Shopee atau TikTok pertama agar Analytics, Data Health, dan Product Intelligence mulai terisi." primaryLabel="Pilih file Live" onPrimary={()=>document.querySelector<HTMLInputElement>('.live-drop input[type="file"]')?.click()} checklist={["Shopee Live List / Product List / Overview","TikTok Live Performance Core Stats"]} hint="Format angka, tanggal, durasi, dan delimiter akan dinormalisasi otomatis."/>}</section>
 </div>
}
