"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {parseDelimitedMatrix,normalizeHeader} from "../../lib/live-import-parser";

declare global{interface Window{XLSX?:any}}
type Kind="shopee_creator"|"tiktok_video"|"tiktok_product"|"tiktok_live";
type Prepared={file:File;source:Kind;rows:Record<string,unknown>[];hash:string;start:string;end:string;status:string};
type Item=Record<string,any>;
const labels:Record<Kind,string>={
 shopee_creator:"Shopee · Creator Summary",
 tiktok_video:"TikTok · Video + Creator + Product",
 tiktok_product:"TikTok · Product Summary",
 tiktok_live:"TikTok · LIVE Session"
};
const k=(s:string)=>normalizeHeader(s).replace(/\s/g,"");
function kindOf(headers:string[]):Kind|null{
 const h=headers.map(k),contains=(...tokens:string[])=>tokens.every(t=>h.includes(k(t)));
 if(contains("ID Affiliates","Username Affiliate","Omzet Penjualan(Rp)"))return "shopee_creator";
 if(contains("Video ID","Video link","Product ID","GMV dari video afiliasi"))return "tiktok_video";
 if(contains("LIVE ID","LIVE start time","GMV dari LIVE kreator"))return "tiktok_live";
 if(contains("Product ID","Product name","GMV dari kreator"))return "tiktok_product";
 return null;
}
async function getXlsx(){
 if(window.XLSX)return window.XLSX;
 await new Promise<void>((resolve,reject)=>{
  const script=document.createElement("script");
  script.src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
  script.onload=()=>resolve();script.onerror=()=>reject(new Error("Parser Excel belum bisa dimuat."));
  document.head.appendChild(script);
 });
 return window.XLSX;
}
async function prepareFile(file:File,start:string,end:string):Promise<Prepared>{
 if(file.size>10*1024*1024)throw new Error(file.name+": batas 10 MB per file.");
 const buffer=await file.arrayBuffer();
 const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",buffer))]
  .map(x=>x.toString(16).padStart(2,"0")).join("");
 let matrices:any[][][]=[];
 if(/\.csv$/i.test(file.name))matrices=[parseDelimitedMatrix(new TextDecoder("utf-8").decode(buffer)).rows];
 else if(/\.xlsx?$/i.test(file.name)){
  const XLSX=await getXlsx(),wb=XLSX.read(buffer,{type:"array"});
  matrices=wb.SheetNames.map((name:string)=>XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:false,defval:""}));
 }else throw new Error(file.name+": gunakan .xlsx, .xls, atau .csv.");
 const candidates=matrices.flatMap(matrix=>{
  const result:{source:Kind;rows:Record<string,unknown>[]}[]=[];
  for(let i=0;i<Math.min(matrix.length,24);i++){
   const headers=(matrix[i]||[]).map((v:any)=>String(v??"").trim());
   const kind=kindOf(headers);
   if(!kind)continue;
   const rows=matrix.slice(i+1).filter(row=>row.some(x=>String(x??"").trim()!==""))
    .map(row=>Object.fromEntries(headers.map((h,index)=>[h,String(row[index]??"").trim()])));
   const id:Record<Kind,string>={shopee_creator:"ID Affiliates",tiktok_video:"Video ID",tiktok_product:"Product ID",tiktok_live:"LIVE ID"};
   result.push({source:kind,rows:rows.filter(row=>String(row[id[kind]]??"").length>0)});
   break;
  }
  return result;
 });
 candidates.sort((a,b)=>b.rows.length-a.rows.length);
 const found=candidates[0];
 if(!found||found.rows.length===0)throw new Error(file.name+": format kolom belum dikenali. Periksa template asli marketplace.");
 if(found.rows.length>1000)throw new Error(file.name+": lebih dari 1.000 baris. Pecah file agar upload bisa diaudit.");
 const range=file.name.match(/(20\d{2})(\d{2})(\d{2})[-_](20\d{2})(\d{2})(\d{2})/);
 const first=range?range[1]+"-"+range[2]+"-"+range[3]:start;
 const last=range?range[4]+"-"+range[5]+"-"+range[6]:end;
 return {file,source:found.source,rows:found.rows,hash,start:first,end:last,status:"Siap · "+found.rows.length+" baris"};
}
const money=(n:any)=>"Rp "+Number(n||0).toLocaleString("id-ID",{maximumFractionDigits:0});
export default function AffiliateBatchEvidencePanel({workspaceId,program,onImported}:{workspaceId:string;program:Item;onImported:()=>void}){
 const supabase=useMemo(()=>createClient(),[]);
 const [prepared,setPrepared]=useState<Prepared[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [records,setRecords]=useState<Item[]>([]),[imports,setImports]=useState<Item[]>([]);
 const [creator,setCreator]=useState(""),[product,setProduct]=useState(""),[platform,setPlatform]=useState("");
 const [detailsOpen,setDetailsOpen]=useState(false);
 async function load(){
  const links=await supabase.from("luma_affiliate_program_evidence").select("source_import_id")
   .eq("workspace_id",workspaceId).eq("program_id",program.id).limit(100);
  if(links.error){setMessage(links.error.message);return}
  const ids=(links.data||[]).map(x=>x.source_import_id);
  if(!ids.length){setRecords([]);setImports([]);return}
  const [a,b]=await Promise.all([
   supabase.from("luma_creator_attribution_imports")
    .select("id,source_type,platform,file_name,period_start,period_end,row_count,store_name")
    .eq("workspace_id",workspaceId).in("id",ids),
   supabase.from("luma_creator_attribution_rows")
    .select("id,import_id,platform,source_type,creator_id,creator_username,creator_name,product_code,product_codes,product_name,asset_id,asset_url,gmv,qty,orders,commission,content_posted_at")
    .eq("workspace_id",workspaceId).in("import_id",ids).order("id",{ascending:false}).limit(2000)
  ]);
  if(a.error||b.error)setMessage(a.error?.message||b.error?.message||"Gagal memuat atribusi");
  else{setImports(a.data||[]);setRecords(b.data||[])}
 }
 useEffect(()=>{setPrepared([]);setCreator("");setProduct("");setPlatform("");void load()},[workspaceId,program.id]);
 async function choose(files:FileList|null){
  if(!files?.length)return;
  if(files.length>20)return setMessage("Maksimal 20 berkas dalam satu batch.");
  setBusy(true);setMessage("Memvalidasi "+files.length+" file...");
  const results:Prepared[]=[],errors:string[]=[];
  for(const file of Array.from(files)){
   try{
    const item=await prepareFile(file,program.start_date,program.end_date);
    const platform=item.source.startsWith("shopee")?"Shopee":"TikTok";
    if(platform.toLowerCase()!==String(program.platform).toLowerCase())
      throw new Error(file.name+": platform "+platform+" berbeda dari program "+program.platform+".");
    results.push(item);
   }catch(error){errors.push(error instanceof Error?error.message:"File tidak dikenal.")}
  }
  setPrepared(results);setBusy(false);
  setMessage(errors.length?errors.join(" • "):results.length+" file terdeteksi otomatis. Review sebelum mengunggah.");
 }
 async function upload(){
  if(!prepared.length)return;
  if(!window.confirm("Import "+prepared.length+" file referensi ke program "+program.program_name+"? GMV antar Product/Video/LIVE tidak dijumlahkan."))
   return;
  setBusy(true);let accepted=0;const feedback:string[]=[];
  for(let i=0;i<prepared.length;i++){
   const item=prepared[i];
   try{
    const response=await fetch("/api/creator-attribution",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({workspace_id:workspaceId,source_type:item.source,filename:item.file.name,
       file_hash:item.hash,period_start:item.start,period_end:item.end,store_id:program.store_id||null,
       store_name:program.store_name||null,rows:item.rows})});
    const result=await response.json();
    if(!response.ok&&response.status!==409)throw new Error(result.error||"Gagal menyimpan data.");
    const importId=String(result.import_id||"");
    if(!importId)throw new Error("Import ID tidak dikembalikan.");
    const auth=await supabase.auth.getUser();
    if(!auth.data.user)throw new Error("Sesi login berakhir.");
    const link=await supabase.from("luma_affiliate_program_evidence").upsert({
      workspace_id:workspaceId,program_id:program.id,source_import_id:importId,attached_by:auth.data.user.id
     },{onConflict:"program_id,source_import_id",ignoreDuplicates:true});
    if(link.error)throw link.error;
    accepted++;setPrepared(p=>p.map((f,n)=>n===i?{...f,status:"Tersimpan · "+f.rows.length+" baris"}:f));
   }catch(error:any){
    feedback.push(item.file.name+": "+(error?.message||"Unknown error"));
    setPrepared(p=>p.map((f,n)=>n===i?{...f,status:"Gagal: "+(error?.message||"Periksa file")}:f));
   }
  }
  await load();onImported();setBusy(false);
  setMessage("Batch selesai: "+accepted+" berhasil, "+feedback.length+" perlu diperbaiki. "+feedback.join(" • "));
 }
 const creatorOptions=[...new Set(records.map(r=>r.creator_username||r.creator_name).filter(Boolean))] as string[];
 const filteredByCreator=creator?records.filter(r=>(r.creator_username||r.creator_name)===creator):records;
 const productOptions=[...new Set(filteredByCreator.map(r=>r.product_code).filter(Boolean))] as string[];
 const filteredByProduct=product?filteredByCreator.filter(r=>r.product_code===product):filteredByCreator;
 const platformOptions=[...new Set(filteredByProduct.map(r=>r.platform).filter(Boolean))] as string[];
 const shown=(platform?filteredByProduct.filter(r=>r.platform===platform):filteredByProduct).slice(0,120);
 const group=(source:string)=>imports.find(f=>f.id===source);
 return <section className="asp-batch-panel">
  <header><div><span>BATCH UPLOAD · AUTO-DETECT</span><h4>Upload Banyak File Excel/CSV</h4>
   <p>Pilih sekaligus laporan TikTok Video, Product, LIVE atau Shopee Creator. File dikenali dari header, disimpan menurut sumber, dan ditautkan ke program ini.</p></div>
   <label className="asp-batch-select">+ Pilih Banyak Excel/CSV<input type="file" accept=".xlsx,.xls,.csv" multiple
       disabled={busy} onChange={e=>{void choose(e.target.files);e.target.value=""}}/></label></header>
  {prepared.length>0&&<div className="asp-batch-files">{prepared.map((f,i)=><article key={i}>
    <b>{f.file.name}</b><span>{labels[f.source]}</span><small>{f.start} — {f.end} · {f.status}</small>
   </article>)}</div>}
  {prepared.length>0&&<button className="asp-primary" disabled={busy} onClick={()=>void upload()}>
    {busy?"Memproses batch...":"Validasi dan Impor "+prepared.length+" File Sekaligus"}</button>}
  {message&&<p role="status" className="asp-batch-message">{message}</p>}
  <p className="asp-batch-disclaimer">Penting: Product List tidak memiliki creator; LIVE List mungkin tidak memiliki username; laporan Video memiliki tanggal publikasi, bukan tanggal transaksi. File-file ini menjadi bukti analisis dan tidak otomatis menambah pembayaran/leaderboard reward sebelum data creator + tanggal transaksi + SKU benar-benar valid.</p>
  <div className="asp-batch-linked"><div><strong>{imports.length} file tertaut · {records.length} baris sumber</strong><button onClick={()=>void load()}>Refresh</button></div>
   {imports.map(f=><small key={f.id}>{labels[f.source_type as Kind]} · {f.file_name} · {f.period_start} — {f.period_end}</small>)}</div>
  <div className="asp-batch-explore">
   <header><div><h4>Telusuri Creator → Produk → Platform → Periode</h4><p>Pilih creator terlebih dahulu untuk menampilkan produk terkait. Laporan yang tidak mencantumkan creator tetap dapat ditinjau sebagai bukti produk/sesi.</p></div>
    <button onClick={()=>setDetailsOpen(v=>!v)}>{detailsOpen?"Tutup Detail":"Lihat Detail Data"}</button></header>
   {detailsOpen&&<><div className="asp-batch-filters">
     <label>1. Creator<select value={creator} onChange={e=>{setCreator(e.target.value);setProduct("");setPlatform("")}}>
       <option value="">Semua (termasuk sumber tanpa creator)</option>{creatorOptions.map(v=><option key={v} value={v}>@{v}</option>)}</select></label>
     <label>2. Product ID<select value={product} onChange={e=>{setProduct(e.target.value);setPlatform("")}}>
       <option value="">Semua Produk</option>{productOptions.map(v=><option key={v}>{v}</option>)}</select></label>
     <label>3. Platform<select value={platform} onChange={e=>setPlatform(e.target.value)}>
       <option value="">Semua Platform</option>{platformOptions.map(v=><option key={v}>{v}</option>)}</select></label>
   </div><div className="asp-table-scroll"><table className="asp-claims-table">
     <thead><tr>{["Creator","Produk / Sesi","Platform / Sumber","Periode laporan","Qty","GMV","Komisi","Validasi"].map(v=><th key={v}>{v}</th>)}</tr></thead>
     <tbody>{shown.map(r=><tr key={r.id}><td>{r.creator_username||r.creator_name||"Tidak ada di file"}</td>
      <td>{r.product_name||r.product_code||r.asset_id||"Tidak ada SKU"}</td><td>{labels[r.source_type as Kind]}</td>
      <td>{group(r.import_id)?.period_start} — {group(r.import_id)?.period_end}</td>
      <td>{Number(r.qty||0).toLocaleString("id-ID")}</td><td>{money(r.gmv)}</td><td>{money(r.commission)}</td>
      <td>{r.creator_username&&r.product_code?"Creator–SKU diketahui":"Perlu sumber tambahan"}</td></tr>)}
      {!shown.length&&<tr><td colSpan={8}>Belum ada data sesuai pilihan.</td></tr>}</tbody>
    </table></div><small>Menampilkan maksimal 120 baris dari {filteredByProduct.length}. Gunakan filter untuk mempersempit.</small></>}
  </div>
 </section>;
}
