"use client";
import {useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {parseDelimitedMatrix,normalizeHeader} from "../../lib/live-import-parser";

declare global {interface Window{XLSX?:any}}
type Raw=Record<string,any>;
type Fields="creator"|"date"|"order_id"|"sku"|"qty_gross"|"qty_net"|"refund_qty"|"gmv_net"|"orders"|"commission"|"videos"|"live_count"|"views"|"ads_spend"|"store_id";
type MapState=Record<Fields,string>;
const FIELDS:{id:Fields;label:string;aliases:string[]}[]=[
 {id:"creator",label:"Creator / Username",aliases:["nama kreator","nama creator","creator username","creator name","affiliate username","nama affiliate","username","kreator","creator","affiliate"]},
 {id:"date",label:"Tanggal transaksi",aliases:["created time","waktu pesanan","order date","transaction date","tanggal transaksi","tanggal pesanan","date","tanggal","waktu","created at"]},
 {id:"order_id",label:"Order ID",aliases:["order id","id pesanan","order no","nomor pesanan","order sn","id transaksi","transaction id","video id","live id","content id"]},
 {id:"sku",label:"SKU / Kode Item",aliases:["seller sku","seller sku produk","kode item","sku id","item id","sku","kode produk","product sku"]},
 {id:"qty_gross",label:"Qty Gross",aliases:["qty gross pcs","qty gross","jumlah pesanan","qty awal","quantity gross","item sold"]},
 {id:"qty_net",label:"Qty Bersih",aliases:["qty bersih pcs","qty bersih","qty net","net qty","items sold","produk terjual","jumlah barang terjual","jumlah item","qty"]},
 {id:"refund_qty",label:"Qty Refund",aliases:["refunded items sold","refund quantity","refund qty","qty refund","barang dikembalikan"]},
 {id:"gmv_net",label:"Sales / GMV Bersih",aliases:["sales bersih rp","sales bersih","gmv net","net gmv","gmv dari kreator","penjualan bersih","gmv","sales rp","sales","nilai penjualan"]},
 {id:"orders",label:"Orders",aliases:["total order","total orders","jumlah order","pesanan teratribusi","jumlah pesanan","orders","order"]},
 {id:"commission",label:"Komisi Platform",aliases:["komisi dasar rp","estimasi komisi","estimated commission","est commission","komisi","commission"]},
 {id:"videos",label:"Jumlah Video",aliases:["videos","jumlah video","total videos","video count","total video"]},
 {id:"live_count",label:"Jumlah LIVE",aliases:["live streams","jumlah live","live count","siaran live","total live"]},
 {id:"views",label:"Views / Tayangan",aliases:["video views","views","tayangan video","impressions","penayangan"]},
 {id:"ads_spend",label:"Biaya Spark Ads",aliases:["ads spend","spend","biaya iklan","ad spend","spark ads spend"]},
 {id:"store_id",label:"Store ID",aliases:["shop id","store id","id toko","seller id"]}
];
const blank=()=>Object.fromEntries(FIELDS.map(x=>[x.id,""])) as MapState;
const clean=(x:any)=>String(x??"").trim();
const key=(x:any)=>normalizeHeader(x).replace(/\s/g,"");
function number(x:any){
 if(typeof x==="number")return Number.isFinite(x)?x:0;
 let v=clean(x).replace(/[^\d,\.\-()]/g,"");if(!v)return 0;
 let neg=false;if(v.startsWith("(")&&v.endsWith(")")){neg=true;v=v.slice(1,-1)}
 const comma=v.lastIndexOf(","),dot=v.lastIndexOf(".");
 if(comma>=0&&dot>=0)v=comma>dot?v.replace(/\./g,"").replace(",","."):v.replace(/,/g,"");
 else if(comma>=0)v=/,\d{1,2}$/.test(v)?v.replace(",","."):v.replace(/,/g,"");
 else if(dot>=0&&/\.\d{3}$/.test(v))v=v.replace(/\./g,"");
 const n=Number(v);return Number.isFinite(n)?(neg?-n:n):0;
}
function dateValue(x:any){
 if(x instanceof Date&&!Number.isNaN(x.getTime())){
  const y=x.getFullYear(),m=String(x.getMonth()+1).padStart(2,"0"),d=String(x.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+d;
 }
 const text=clean(x);
 if(/^\d{4}-\d{2}-\d{2}/.test(text))return text.slice(0,10);
 const match=text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
 if(match)return match[3]+"-"+match[2].padStart(2,"0")+"-"+match[1].padStart(2,"0");
 if(/^\d{5}(?:\.\d+)?$/.test(text)){
  const dt=new Date(Date.UTC(1899,11,30)+Math.floor(Number(text))*86400000);
  return dt.toISOString().slice(0,10);
 }
 return "";
}
async function readXlsx(){if(window.XLSX)return window.XLSX;await new Promise<void>((resolve,reject)=>{
 const script=document.createElement("script");script.src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
 script.onload=()=>resolve();script.onerror=()=>reject(new Error("Parser XLSX belum dapat dimuat."));document.head.appendChild(script);
});return window.XLSX}
async function sha256(buffer:ArrayBuffer){const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",buffer));return Array.from(bytes).map(x=>x.toString(16).padStart(2,"0")).join("")}
function parseMatrix(matrix:any[][]){
 let best=-1,bestScore=-1;
 for(let i=0;i<Math.min(matrix.length,15);i++){
  const headers=(matrix[i]||[]).map(key);
  const score=FIELDS.reduce((sum,f)=>sum+(f.aliases.some(a=>headers.includes(key(a)))?1:0),0);
  if(score>bestScore){bestScore=score;best=i}
 }
 const headers=(matrix[best]||[]).map((x:any,i:number)=>clean(x)||"Column "+(i+1));
 const rows=matrix.slice(best+1).filter(r=>r.some(x=>clean(x)!=="")).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])));
 return {headers,rows,score:bestScore};
}
type Props={workspaceId:string;program:any;onImported:()=>void};
export default function AffiliateProgramImporter({workspaceId,program,onImported}:Props){
 const supabase=useMemo(()=>createClient(),[]);
 const [file,setFile]=useState<File|null>(null),[hash,setHash]=useState(""),[sheet,setSheet]=useState("");
 const [rows,setRows]=useState<Raw[]>([]),[headers,setHeaders]=useState<string[]>([]),[mapping,setMapping]=useState<MapState>(blank());
 const [reportDate,setReportDate]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 const [sourceChannel,setSourceChannel]=useState(program.channel==="all"?"product":program.channel);
 const [dailySummaryConfirmed,setDailySummaryConfirmed]=useState(false);
 const [storeConfirmed,setStoreConfirmed]=useState(false);
 
 async function choose(selected:File){
  setBusy(true);setMsg("Membaca format laporan...");setFile(selected);setRows([]);
  try{
   if(selected.size>10*1024*1024)throw new Error("Maksimal ukuran file 10 MB.");
   const buffer=await selected.arrayBuffer();setHash(await sha256(buffer));
   const ext=selected.name.split(".").pop()?.toLowerCase();
   const matrices:{name:string;matrix:any[][]}[]=[];
   if(ext==="csv"||ext==="tsv"){
    const {rows:matrix}=parseDelimitedMatrix(new TextDecoder("utf-8").decode(buffer));matrices.push({name:"CSV",matrix});
   }else if(ext==="xlsx"||ext==="xls"){
    const XLSX=await readXlsx();const wb=XLSX.read(buffer,{type:"array",cellDates:true});
    for(const name of wb.SheetNames){
     const matrix=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:"",raw:true}) as any[][];
     matrices.push({name,matrix});
    }
   }else throw new Error("Gunakan file Excel (.xlsx/.xls) atau CSV.");
   const candidates=matrices.map(x=>({...x,...parseMatrix(x.matrix)})).sort((a,b)=>b.score-a.score||b.rows.length-a.rows.length);
   const best=candidates[0];
   if(!best||!best.rows.length||best.score<2)throw new Error("Header laporan belum dikenali. Pastikan file memiliki kolom creator, tanggal, dan performa.");
   if(best.rows.length>5000)throw new Error("File berisi lebih dari 5.000 baris. Pisahkan menjadi beberapa file.");
   const auto=blank();
   for(const field of FIELDS){
    const match=field.aliases.map(a=>best.headers.find(h=>key(h)===key(a))).find(Boolean);
    if(match)auto[field.id]=match;
   }
   setRows(best.rows);setHeaders(best.headers);setMapping(auto);setSheet(best.name);setDailySummaryConfirmed(false);setStoreConfirmed(false);
   setMsg(best.rows.length+" baris dari sheet "+best.name+". Periksa mapping dan tanggal laporan sebelum impor.");
  }catch(error){setMsg(error instanceof Error?error.message:"File belum dapat dibaca.");setFile(null)}
  finally{setBusy(false)}
 }
 async function importFile(){
  if(!file||!rows.length)return;
  if(!mapping.creator)return setMsg("Mapping Creator/Username wajib dipilih.");
  if(!mapping.date&&!reportDate)return setMsg("Pilih kolom tanggal transaksi atau isi Tanggal Laporan manual.");
  if(!mapping.qty_net&&!mapping.gmv_net&&!mapping.orders&&!mapping.videos&&!mapping.live_count&&!mapping.views)
   return setMsg("Map minimal satu metrik penjualan/performa.");
  if(!window.confirm("Impor "+rows.length+" baris ke tracker "+program.program_name+"? Data hanya untuk periode "+program.start_date+" — "+program.end_date+"."))return;
  setBusy(true);setMsg("Validasi creator, SKU, periode, dan duplikasi...");
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||!user)throw new Error("Silakan login kembali.");
   if(program.channel!=="all"&&program.channel!==sourceChannel)
     throw new Error("Jenis laporan harus sesuai channel challenge: "+program.channel+".");
   const requiredMetric=String(program.metric||"qty_net");
   if(requiredMetric==="qty_net"&&!mapping.qty_net&&!mapping.qty_gross)
      throw new Error("Program Qty Bersih membutuhkan kolom Qty Bersih atau Qty Gross + Qty Refund.");
   if(requiredMetric==="orders"&&!mapping.orders&&!mapping.order_id)
      throw new Error("Program Order membutuhkan kolom Orders atau Order ID.");
   if(!["qty_net","orders"].includes(requiredMetric)&&!mapping[requiredMetric as Fields])
      throw new Error("Kolom untuk metrik program "+requiredMetric+" wajib dipetakan sebelum import.");
   if(!mapping.order_id&&!dailySummaryConfirmed)
     throw new Error("Laporan tanpa Order ID/Content ID perlu konfirmasi bahwa setiap baris merupakan agregasi harian unik per creator dan SKU.");
   if(program.store_id&&!mapping.store_id&&!storeConfirmed)
     throw new Error("Toko program memiliki Store ID. Petakan kolom Store ID atau konfirmasi laporan khusus toko ini.");
   if(program.product_master_id&&!mapping.sku)
     throw new Error("Program khusus satu SKU memerlukan mapping kolom SKU agar tidak memasukkan produk lain.");
   const tokensCreators=[...new Set(rows.map(r=>key(r[mapping.creator])).filter(Boolean))];
   const tokensSkus=[...new Set(rows.map(r=>key(r[mapping.sku])).filter(Boolean))];
   const resolved=await supabase.rpc("luma_affiliate_resolve_import_master_v2",{
     p_workspace_id:workspaceId,p_program_id:program.id,
     p_creator_tokens:tokensCreators,p_sku_tokens:tokensSkus
   });
   if(resolved.error)throw new Error("Gagal mencocokkan Master Creator/SKU: "+resolved.error.message);
   const creatorMap=new Map<string,number>(Object.entries(resolved.data?.creator_ids||{}).map(([k,v])=>[k,Number(v)]));
   const skuMap=new Map<string,number>(Object.entries(resolved.data?.product_ids||{}).map(([k,v])=>[k,Number(v)]));
   const normalized:any[]=[];const seenKeys=new Set<string>();const orderCountKeys=new Set<string>();
   let rejected=0,outside=0,missingCreator=0,unmappedSku=0,storeRejected=0,duplicateInFile=0;
   for(let i=0;i<rows.length;i++){
    const row=rows[i],read=(f:Fields)=>mapping[f]?row[mapping[f]]:null;
    const creatorId=creatorMap.get(key(read("creator")));
    const rawDate=read("date");
    const metricDate=mapping.date && clean(rawDate)?dateValue(rawDate):reportDate;
    if(!creatorId){rejected++;missingCreator++;continue}
    if(!metricDate||metricDate<program.start_date||metricDate>program.end_date){rejected++;outside++;continue}
    const sku=clean(read("sku")),productId=sku?skuMap.get(key(sku))||null:null;
    if((sku&&!productId)||(program.product_master_id&&productId!==Number(program.product_master_id))){rejected++;unmappedSku++;continue}
    const qtyGross=number(read("qty_gross")),refundQty=number(read("refund_qty"));
    const qtyNet=mapping.qty_net?number(read("qty_net")):Math.max(0,qtyGross-refundQty);
    const orderId=clean(read("order_id")),storeId=clean(read("store_id"));
    if(program.store_id&&storeId!==program.store_id&&!(storeConfirmed&&!storeId)){rejected++;storeRejected++;continue}
    const idParts=[key(program.platform),key(sourceChannel),creatorId,key(metricDate),key(sku||"no-sku"),key(storeId||program.store_id||"no-store")].join(":");
    const rowKey=orderId?"detail:"+idParts+":"+key(orderId):"daily:"+idParts;
    if(seenKeys.has(rowKey)){rejected++;duplicateInFile++;continue}
    seenKeys.add(rowKey);
    const orderUniqKey=creatorId+":"+key(orderId);
    const orderCount=orderId?(orderCountKeys.has(orderUniqKey)?0:Math.max(1,number(read("orders")))):number(read("orders"));
    if(orderId)orderCountKeys.add(orderUniqKey);
    normalized.push({
     workspace_id:workspaceId,program_id:program.id,creator_id:creatorId,
     platform:program.platform,source_channel:sourceChannel,row_key:rowKey,order_id:orderId||null,store_id:storeId||program.store_id||null,
     product_master_id:productId||null,metric_date:metricDate,
     qty_gross:qtyGross||qtyNet,qty_net:Math.max(0,qtyNet),refund_qty:Math.max(0,refundQty),
     gmv_net:Math.max(0,number(read("gmv_net"))),orders:Math.max(0,orderCount),
     commission:Math.max(0,number(read("commission"))),videos:Math.max(0,number(read("videos"))),
     live_count:Math.max(0,number(read("live_count"))),views:Math.max(0,number(read("views"))),
     ads_spend:Math.max(0,number(read("ads_spend")))
    });
   }
   if(!normalized.length)throw new Error("Tidak ada baris valid. Cek creator yang terdaftar, SKU program dan periode. Di luar periode: "+outside+", creator tidak cocok: "+missingCreator+".");
   const {data:importRow,error:importError}=await supabase.from("luma_affiliate_program_imports")
    .insert({workspace_id:workspaceId,program_id:program.id,platform:program.platform,
      filename:file.name,file_hash:hash,rows_total:rows.length,rows_rejected:rejected,imported_by:user.id})
    .select("id").single();
   if(importError)throw new Error(importError.code==="23505"?"File yang sama sudah pernah diimpor ke program ini.":importError.message);
   let inserted=0,fail=0;
   for(let i=0;i<normalized.length;i+=150){
    const payload=normalized.slice(i,i+150).map(x=>({...x,import_id:importRow.id}));
    const result=await supabase.from("luma_affiliate_program_performance")
      .upsert(payload,{onConflict:"program_id,row_key",ignoreDuplicates:true}).select("id");
    if(result.error){fail+=payload.length;setMsg("Batch "+(i+1)+" gagal: "+result.error.message)}
    else inserted+=(result.data||[]).length;
   }
   const totalRejected=rejected+fail+Math.max(0,normalized.length-fail-inserted);
   await supabase.from("luma_affiliate_program_imports")
     .update({rows_imported:inserted,rows_rejected:totalRejected,status:totalRejected>0?"partial":"completed"})
     .eq("id",importRow.id).eq("workspace_id",workspaceId);
   setMsg("Import "+(totalRejected>0?"PARTIAL":"SELESAI")+": "+inserted+" baris baru; "+totalRejected+" ditolak/duplikat. Periode salah "+outside+", creator tidak cocok/belum peserta "+missingCreator+", SKU tidak cocok "+unmappedSku+", toko tidak cocok "+storeRejected+", baris duplikat dalam file "+duplicateInFile+". Data partial tidak memenuhi syarat klaim hingga diperbaiki. Cocokkan angka dengan Excel.");
   onImported();
  }catch(error){setMsg(error instanceof Error?error.message:"Import gagal.")}
  finally{setBusy(false)}
 }
 return <section className="asp-importer">
  <header><div><span>IMPORT TRACKER · {program.platform.toUpperCase()}</span><h3>Upload Performa Creator</h3><p>Excel/CSV dari TikTok, Shopee dan laporan lain dipetakan berdasarkan header, creator, SKU dan tanggal.</p></div><label className="asp-upload-btn">Pilih Excel/CSV<input type="file" accept=".xlsx,.xls,.csv,.tsv" onChange={e=>{const f=e.target.files?.[0];if(f)void choose(f)}}/></label></header>
  {file&&<p className="asp-import-file"><b>{file.name}</b> · {sheet} · {rows.length} baris</p>}
  {!!rows.length&&<><div className="asp-import-grid">{FIELDS.map(field=><label key={field.id}>{field.label}<select value={mapping[field.id]} onChange={e=>setMapping(p=>({...p,[field.id]:e.target.value}))}><option value="">Tidak ada di file</option>{headers.map((h,i)=><option key={h+"-"+i} value={h}>{h}</option>)}</select></label>)}
   <label>Tanggal laporan (jika tidak ada kolom tanggal)<input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)}/></label>
   <label>Jenis sumber data<select value={sourceChannel} onChange={e=>setSourceChannel(e.target.value)}><option value="product">Produk / Transaksi</option><option value="video">Video</option><option value="live">LIVE</option><option value="ads">Spark Ads</option><option value="all">Gabungan / Umum</option></select></label></div>
   <div className="asp-import-confirmations">
    {!mapping.order_id&&<label><input type="checkbox" checked={dailySummaryConfirmed} onChange={e=>setDailySummaryConfirmed(e.target.checked)}/> <span>Saya sudah memastikan data merupakan agregasi unik per creator, tanggal, SKU, toko dan channel. Laporan raw per transaksi wajib memiliki Order ID/Content ID agar tidak salah hitung.</span></label>}
    {Boolean(program.store_id)&&!mapping.store_id&&<label><input type="checkbox" checked={storeConfirmed} onChange={e=>setStoreConfirmed(e.target.checked)}/> <span>Saya memastikan seluruh baris file hanya milik toko ID {program.store_id}. Jangan aktifkan untuk laporan gabungan beberapa toko.</span></label>}
   </div>
   <div className="asp-import-preview"><b>Preview sumber, sebelum masuk database</b><div>{rows.slice(0,4).map((r,i)=><p key={i}>{clean(r[mapping.creator])||"Creator belum terbaca"} · {dateValue(r[mapping.date])||reportDate||"Tanggal belum ada"} · Qty {number(r[mapping.qty_net])||number(r[mapping.qty_gross])} · GMV Rp {number(r[mapping.gmv_net]).toLocaleString("id-ID")}</p>)}</div></div>
   <button className="asp-primary" disabled={busy} onClick={()=>void importFile()}>{busy?"Mengimpor...":"Validasi & Import ke Program"}</button></>}
  {msg&&<p role="status" className="asp-message">{msg}</p>}
  <p className="asp-import-note">Hanya data pada periode program yang masuk. File sama tidak diimpor ulang. Creator wajib menjadi peserta program; SKU/toko/periode harus sesuai. Baris tanpa ID memakai identitas agregat harian dan harus diperiksa sebelum import. Angka reward hanya estimasi sampai disetujui pemilik workspace.</p>
 </section>;
}
