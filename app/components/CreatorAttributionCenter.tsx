"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {parseDelimitedMatrix,normalizeHeader} from "../../lib/live-import-parser";

declare global{interface Window{XLSX?:any}}
type Source="shopee_creator"|"tiktok_video"|"tiktok_product"|"tiktok_live";
type Item=Record<string,any>;
const sourceLabels:Record<Source,string>={
 shopee_creator:"Shopee · Creator Summary",
 tiktok_video:"TikTok · Video → Creator → Product",
 tiktok_product:"TikTok · Product Summary",
 tiktok_live:"TikTok · LIVE Session"
};
const sourceNotes:Record<Source,string>={
 shopee_creator:"Laporan creator ini tidak berisi SKU atau Order ID. Kolom produk tetap 'Belum teratribusi' sampai tersedia sumber yang menghubungkan creator dengan SKU.",
 tiktok_video:"Username berasal dari @akun pada tautan video. Tanggal post berbeda dari periode perhitungan GMV. Video dan Product Summary tidak dijumlahkan.",
 tiktok_product:"Data rekap per Product ID, tanpa username creator. Berfungsi sebagai verifikasi total SKU, bukan tambahan GMV.",
 tiktok_live:"Product ID bisa berupa daftar banyak produk, bukan rincian penjualan per produk. Kolom 'Produk terjual' berisi jumlah produk unik, bukan unit terjual."
};
const sig=(h:string[])=>{
 const keys=h.map(normalizeHeader);
 const has=(...v:string[])=>v.every(s=>keys.includes(normalizeHeader(s)));
 if(has("ID Affiliates","Username Affiliate","Omzet Penjualan(Rp)"))return "shopee_creator";
 if(has("Video ID","Video link","Product ID","GMV dari video afiliasi"))return "tiktok_video";
 if(has("LIVE ID","LIVE start time","GMV dari LIVE kreator"))return "tiktok_live";
 if(has("Product ID","Product name","GMV dari kreator"))return "tiktok_product";
 return null;
};
function toObjects(matrix:any[][]){
 const index=matrix.findIndex(row=>sig((row||[]).map(String))!==null);
 if(index<0)return null;
 const headers=(matrix[index]||[]).map((x:any,i:number)=>String(x??"").trim()||"Column "+(i+1));
 const kind=sig(headers) as Source;
 const rows=matrix.slice(index+1).filter(row=>row.some(x=>x!==null&&x!==undefined&&String(x).trim()!==""))
  .map(row=>Object.fromEntries(headers.map((h,i)=>[h,typeof row[i]==="number"&&Math.abs(row[i])>Number.MAX_SAFE_INTEGER?"":row[i]??""])));
 const idColumn:Record<Source,string>={shopee_creator:"ID Affiliates",tiktok_video:"Video ID",tiktok_product:"Product ID",tiktok_live:"LIVE ID"};
 const usable=rows.filter(row=>String(row[idColumn[kind]]||"").trim()!=="");
 return {source:kind,headers,rows:usable,skipped:rows.length-usable.length};
}
async function sheetParser(){
 if(window.XLSX)return window.XLSX;
 await new Promise<void>((resolve,reject)=>{
  const script=document.createElement("script");
  script.src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
  script.onload=()=>resolve();
  script.onerror=()=>reject(new Error("Parser Excel tidak dapat dimuat. Coba CSV atau periksa koneksi."));
  document.head.appendChild(script);
 });
 return window.XLSX;
}
function periodFromFilename(name:string){
 const match=name.match(/(20\d{2})(\d{2})(\d{2})[-_](20\d{2})(\d{2})(\d{2})/);
 return match?{start:match[1]+"-"+match[2]+"-"+match[3],end:match[4]+"-"+match[5]+"-"+match[6]}:null;
}
const rupiah=(v:number)=>"Rp "+Number(v||0).toLocaleString("id-ID",{maximumFractionDigits:0});
const number=(v:number)=>Number(v||0).toLocaleString("id-ID");
export default function CreatorAttributionCenter({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [file,setFile]=useState<File|null>(null),[hash,setHash]=useState(""),[kind,setKind]=useState<Source|null>(null),[preview,setPreview]=useState<Item[]>([]);
 const [start,setStart]=useState(""),[end,setEnd]=useState(""),[store,setStore]=useState(""),[storeId,setStoreId]=useState("");
 const [warning,setWarning]=useState(""),[status,setStatus]=useState(""),[busy,setBusy]=useState(false);
 const [history,setHistory]=useState<Item[]>([]),[filter,setFilter]=useState<Source|"all">("all"),[creator,setCreator]=useState(""),[page,setPage]=useState(1);
 const [records,setRecords]=useState<Item[]>([]),[total,setTotal]=useState(0),[productNames,setProductNames]=useState<Record<string,string>>({});
 const [lastResult,setLastResult]=useState<Item|null>(null);
 async function loadHistory(){
  const result=await supabase.from("luma_creator_attribution_imports")
   .select("id,platform,source_type,file_name,period_start,period_end,store_name,row_count,created_at")
   .eq("workspace_id",workspaceId).eq("import_status","completed").order("created_at",{ascending:false}).limit(30);
  if(!result.error)setHistory(result.data||[]);
 }
 async function loadPage(){
  const q=supabase.from("luma_creator_attribution_rows")
   .select("id,platform,source_type,creator_name,creator_username,affiliate_id,attribution_level,asset_id,asset_url,product_code,product_codes,product_name,gmv,qty,orders,commission,refund_gmv,refund_qty",{count:"exact"})
   .eq("workspace_id",workspaceId);
  if(filter!=="all")q.eq("source_type",filter);
  if(creator.trim()){
   const term=creator.trim().replace(/[,()]/g,"");
   q.or("creator_username.ilike.%"+term+"%,creator_name.ilike.%"+term+"%");
  }
  const response=await q.order("id",{ascending:false}).range((page-1)*20,page*20-1);
  if(response.error)setWarning(response.error.message);
  else{setRecords(response.data||[]);setTotal(response.count||0)}
 }
 async function names(){
  const r=await supabase.from("luma_creator_attribution_rows")
   .select("product_code,product_name").eq("workspace_id",workspaceId)
   .eq("source_type","tiktok_product").not("product_code","is",null).limit(1000);
  if(!r.error){
   const lookup:Record<string,string>={};
   for(const row of r.data||[])if(row.product_code&&row.product_name)lookup[row.product_code]=row.product_name;
   setProductNames(lookup);
  }
 }
 useEffect(()=>{void loadHistory();void names()},[workspaceId]);
 useEffect(()=>{void loadPage()},[workspaceId,filter,page,creator]);
 async function choose(selected:File){
  setFile(selected);setBusy(true);setLastResult(null);setStatus("");setWarning("");setPreview([]);setKind(null);
  try{
   if(selected.size>8*1024*1024)throw new Error("File maksimum 8 MB.");
   const buffer=await selected.arrayBuffer();
   const digest=await crypto.subtle.digest("SHA-256",buffer);
   setHash([...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join(""));
   const sheets:any[][][]=[];
   if(/\.csv$/i.test(selected.name)){
    const text=new TextDecoder("utf-8").decode(buffer);
    sheets.push(parseDelimitedMatrix(text).rows);
   }else if(/\.xlsx?$/i.test(selected.name)){
    const XLSX=await sheetParser();
    const wb=XLSX.read(buffer,{type:"array",cellDates:false});
    for(const name of wb.SheetNames)sheets.push(XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:false,defval:""}));
   }else throw new Error("Hanya .csv, .xls, atau .xlsx yang didukung.");
   const all=sheets.map(toObjects).filter(Boolean).sort((a:any,b:any)=>b.rows.length-a.rows.length);
   const detected=all[0] as NonNullable<ReturnType<typeof toObjects>>|undefined;
   if(!detected)throw new Error("Format tidak cocok dengan keempat jenis file contoh. Pastikan baris header masih utuh.");
   if(detected.rows.length>1000)throw new Error("File berisi lebih dari 1.000 baris. Pisahkan per periode agar proses dapat diaudit.");
   if(detected.rows.some(row=>Object.values(row).some(x=>typeof x==="string"&&x.length>20000)))
    throw new Error("Salah satu kolom terlalu panjang; periksa file.");
   setKind(detected.source);setPreview(detected.rows);
   const period=periodFromFilename(selected.name);
   if(period){setStart(period.start);setEnd(period.end)}
   const contextual=detected.source==="shopee_creator"?
    "File Shopee hanya rekap creator. Produk tidak bisa diketahui dari file ini.":
    detected.source==="tiktok_video"?"Tanggal Post Video adalah waktu publikasi, bukan tanggal penjualan. Gunakan periode laporan yang benar.":
    detected.source==="tiktok_live"?"LIVE tidak memiliki username creator dan Product ID adalah daftar produk, bukan atribusi GMV per SKU.":"Produk merupakan rekap SKU, bukan penjualan tambahan terhadap Video.";
   setStatus(detected.rows.length+" baris siap diperiksa. "+contextual);
   if(detected.skipped)setWarning(detected.skipped+" baris penjelasan/metadata diabaikan, bukan transaksi.");
  }catch(error){setWarning(error instanceof Error?error.message:"File gagal dibaca.");setFile(null)}
  finally{setBusy(false)}
 }
 async function submit(){
  if(!kind||!file||!preview.length||!start||!end)return setWarning("Pilih file dan tentukan tanggal mulai dan akhir periode laporan.");
  if(start>end)return setWarning("Tanggal mulai tidak boleh setelah akhir periode.");
  if(!window.confirm("Simpan "+preview.length+" baris "+sourceLabels[kind]+" untuk periode "+start+" – "+end+"? Data ini tidak otomatis ditambahkan pada total platform lain."))return;
  setBusy(true);setWarning("");
  try{
   const response=await fetch("/api/creator-attribution",{method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({workspace_id:workspaceId,source_type:kind,filename:file.name,file_hash:hash,
     period_start:start,period_end:end,store_name:store.trim()||null,store_id:storeId.trim()||null,rows:preview})});
   const data=await response.json();
   if(!response.ok||!data.ok)throw new Error(data.error||"Gagal mengimpor laporan.");
   setLastResult(data);setStatus("Import berhasil: "+data.imported+" baris tersimpan tanpa penjumlahan lintas sumber.");
   window.dispatchEvent(new Event("lumaway-database-updated"));
   await loadHistory();await loadPage();await names();
  }catch(error){setWarning(error instanceof Error?error.message:"Import gagal.");}
  finally{setBusy(false)}
 }
 async function remove(item:Item){
  if(!window.confirm("Hapus seluruh "+item.row_count+" baris sumber dari "+item.file_name+"?"))return;
  setBusy(true);setWarning("");
  try{
   const response=await fetch("/api/creator-attribution",{method:"DELETE",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({workspace_id:workspaceId,import_id:item.id})});
   const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||"Hapus gagal.");
   setStatus("Sumber "+item.file_name+" dan baris turunannya berhasil dihapus.");setLastResult(null);
   await loadHistory();await loadPage();await names();
  }catch(error){setWarning(error instanceof Error?error.message:"Hapus gagal")}
  finally{setBusy(false)}
 }
 return <section className="luma-attribution-center card">
  <div className="section-head"><div><span className="eyebrow">CREATOR ATTRIBUTION · SOURCE RECONCILIATION</span>
    <h3>Penjualan Teratribusi Kreator · TikTok & Shopee</h3>
    <p className="muted">Pisahkan laporan creator, video, produk, dan LIVE. Setiap baris disimpan sesuai level atribusi sumbernya, tidak digabung sebagai GMV tambahan.</p></div></div>
  <div className="luma-attribution-note"><strong>Mengapa produk Shopee belum muncul?</strong>
   <p>File AMSAffiliatePerformance hanya mempunyai ID/username affiliate dan total GMV, qty, pesanan serta komisi. Tidak ada Order ID/SKU. Untuk hasil “Creator X menjual Produk Y”, upload laporan yang memiliki hubungan creator–order–produk. Sistem tidak mengalokasikan SKU berdasarkan tebakan.</p></div>
  <div className="luma-attribution-upload">
   <label>File sumber Shopee / TikTok<input type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void choose(f)}}/></label>
   <label>Periode mulai<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
   <label>Periode akhir<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
   <label>Nama toko (opsional)<input value={store} onChange={e=>setStore(e.target.value)} placeholder="Toko dari workspace"/></label>
   <label>Store ID (opsional)<input value={storeId} onChange={e=>setStoreId(e.target.value)} placeholder="ID toko marketplace"/></label>
  </div>
  {kind&&<div className="luma-attribution-detected"><strong>{sourceLabels[kind]}</strong><span>{preview.length} baris dikenali</span><p>{sourceNotes[kind]}</p></div>}
  {kind&&preview.length>0&&<div className="luma-attribution-preview"><strong>Preview sumber asli (3 baris)</strong>
    {preview.slice(0,3).map((row,i)=><p key={i}>{Object.entries(row).slice(0,5).map(([k,v])=>k+": "+String(v??"").slice(0,72)).join(" · ")}</p>)}</div>}
  <div className="button-row"><button className="primary" onClick={()=>void submit()} disabled={busy||!kind||!start||!end||!preview.length}>{busy?"Memproses...":"Validasi & Simpan Atribusi"}</button><button type="button" className="secondary" onClick={()=>{void loadHistory();void loadPage()}} disabled={busy}>Refresh Data</button></div>
  {status&&<p role="status" className="luma-attribution-status">{status}</p>}
  {warning&&<p role="alert" className="luma-attribution-warning">{warning}</p>}
  {lastResult&&<div className="luma-attribution-metrics"><article><small>GMV sumber</small><b>{rupiah(lastResult.totals.gmv)}</b></article><article><small>Qty unit</small><b>{number(lastResult.totals.qty)}</b></article><article><small>Order</small><b>{number(lastResult.totals.orders)}</b></article><article><small>Komisi</small><b>{rupiah(lastResult.totals.commission)}</b></article><p>{lastResult.caveat}</p></div>}
  <div className="luma-attribution-history"><h4>Riwayat import sumber</h4>{history.length?<div className="luma-attribution-files">{history.map(item=><article key={item.id}><div><b>{item.file_name}</b><small>{sourceLabels[item.source_type as Source]} · {item.period_start}–{item.period_end} · {item.store_name||"Toko belum ditentukan"} · {item.row_count} baris</small></div><button disabled={busy} onClick={()=>void remove(item)}>Hapus</button></article>)}</div>:<p className="muted">Belum ada laporan creator attribution pada workspace ini.</p>}</div>
  <div className="luma-attribution-results"><div className="section-head"><h4>Detail atribusi yang dapat dibuktikan</h4><span>{number(total)} baris</span></div>
   <div className="luma-attribution-filters"><select value={filter} onChange={e=>{setFilter(e.target.value as Source|"all");setPage(1)}}><option value="all">Semua sumber (tidak dijumlahkan)</option>{Object.entries(sourceLabels).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
   <input value={creator} onChange={e=>{setCreator(e.target.value);setPage(1)}} placeholder="Cari username atau nama creator"/></div>
   <div className="scroll"><table><thead><tr>{["Sumber","Creator","Konten/Sesi","Produk","GMV","Qty","Order","Komisi","Refund GMV"].map(x=><th key={x}>{x}</th>)}</tr></thead>
   <tbody>{records.map(row=><tr key={row.id}><td>{sourceLabels[row.source_type as Source]}</td><td>{row.creator_username?"@"+row.creator_username:row.creator_name||"Creator tidak tersedia"}</td>
    <td>{row.asset_url?<a href={row.asset_url} target="_blank" rel="noreferrer">Video {row.asset_id} ↗</a>:row.asset_id||"Rekap"}</td>
    <td>{row.source_type==="shopee_creator"?"Produk belum teratribusi":row.product_code?(productNames[row.product_code]||row.product_name||"Product ID "+row.product_code):row.source_type==="tiktok_live"?"Beberapa produk (belum dapat dibagi GMV)":"—"}</td>
    <td>{rupiah(row.gmv)}</td><td>{number(row.qty)}</td><td>{number(row.orders)}</td><td>{rupiah(row.commission)}</td><td>{rupiah(row.refund_gmv)}</td></tr>)}
   {!records.length&&<tr><td colSpan={9}>Belum ada data atribusi untuk filter ini.</td></tr>}</tbody></table></div>
   <footer className="luma-attribution-pages"><span>Halaman {page} dari {Math.max(1,Math.ceil(total/20))}</span><div><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Sebelumnya</button><button disabled={page*20>=total} onClick={()=>setPage(p=>p+1)}>Berikutnya →</button></div></footer>
  </div>
 </section>;
}
