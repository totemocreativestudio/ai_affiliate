export type LiveDatasetType="shopee_session_list"|"shopee_product_list"|"shopee_overview"|"tiktok_core_stats"|"generic";
export type LiveDetection={platform:"Shopee"|"TikTok"|"Unknown";dataset_type:LiveDatasetType;confidence:number;header_row:number;parser_version:string;source_sheet?:string;reason:string};
export type ParsedLivePayload={detection:LiveDetection;normalized_rows:any[];overview?:any;traffic_sources?:any[];warnings:string[];preview:any[];period_start?:string|null;period_end?:string|null};

const clean=(v:any)=>v===null||v===undefined?"":String(v).replace(/\u00a0/g," ").trim();
export const normalizeHeader=(v:any)=>clean(v).normalize("NFKD").toLowerCase().replace(/[–—−]/g,"-").replace(/[():.%/\\]+/g," ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");

export function parseDelimitedMatrix(text:string){
 const input=text.replace(/^\uFEFF/,"");
 const sample=input.split(/\r?\n/).slice(0,8).join("\n");
 const candidates=[",",";","\t","|"];
 const count=(d:string)=>{let q=false,n=0;for(let i=0;i<sample.length;i++){const ch=sample[i];if(ch==='"'){if(q&&sample[i+1]==='"'){i++;continue}q=!q}else if(!q&&ch===d)n++}return n};
 const delimiter=candidates.sort((a,b)=>count(b)-count(a))[0]||",";
 const rows:any[][]=[];let row:any[]=[],cell="",quoted=false;
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(ch==='"'){
   if(quoted&&input[i+1]==='"'){cell+='"';i++;continue}
   quoted=!quoted;continue;
  }
  if(!quoted&&ch===delimiter){row.push(cell);cell="";continue}
  if(!quoted&&(ch==="\n"||ch==="\r")){
   if(ch==="\r"&&input[i+1]==="\n")i++;
   row.push(cell);cell="";if(row.some(x=>clean(x)!==""))rows.push(row);row=[];continue;
  }
  cell+=ch;
 }
 if(cell!==""||row.length){row.push(cell);if(row.some(x=>clean(x)!==""))rows.push(row)}
 return {delimiter,rows};
}

function headerTokens(row:any[]){return row.map(normalizeHeader).filter(Boolean)}
function hasAll(tokens:string[],needles:string[]){return needles.every(n=>tokens.some(t=>t===normalizeHeader(n)||t.includes(normalizeHeader(n))))}

export function detectLiveDataset(matrix:any[][],sourceSheet=""):LiveDetection{
 const scan=matrix.slice(0,8);
 for(let i=0;i<scan.length;i++){
  const t=headerTokens(scan[i]||[]);
  if(hasAll(t,["Nama Livestream","Start Time","Penjualan Pesanan Dibuat"]))return{platform:"Shopee",dataset_type:"shopee_session_list",confidence:0.99,header_row:i,parser_version:"unified_live_parser_v1",source_sheet:sourceSheet,reason:"Shopee session signature"};
  if(hasAll(t,["Ranking","Produk","Klik Produk","Penjualan Pesanan Dibuat"]))return{platform:"Shopee",dataset_type:"shopee_product_list",confidence:0.99,header_row:i,parser_version:"unified_live_parser_v1",source_sheet:sourceSheet,reason:"Shopee product signature"};
  if(hasAll(t,["Waktu","GMV dari LIVE Rp","Siaran LIVE","Tayangan LIVE"]))return{platform:"TikTok",dataset_type:"tiktok_core_stats",confidence:0.99,header_row:i,parser_version:"tiktok_live_parser_v1",source_sheet:sourceSheet,reason:"TikTok Live Core Stats signature"};
 }
 const first=scan.map(r=>r.map(clean).join(" | ")).join(" ");
 if(/Transaksi\s*[–—-]\s*Tinjauan/i.test(first)&&/Kunjungan\s*-\s*Performa/i.test(first))return{platform:"Shopee",dataset_type:"shopee_overview",confidence:0.99,header_row:1,parser_version:"shopee_live_parser_v1",source_sheet:sourceSheet,reason:"Shopee overview group headers"};
 return{platform:"Unknown",dataset_type:"generic",confidence:0.3,header_row:0,parser_version:"generic_live_parser_v1",source_sheet:sourceSheet,reason:"No known signature"};
}

function inferDecimalSeparator(s:string){
 const commas=(s.match(/,/g)||[]).length,dots=(s.match(/\./g)||[]).length;
 if(commas&&dots)return s.lastIndexOf(",")>s.lastIndexOf(".")?",":".";
 if(commas===1){
  const [,d=""]=s.split(",");
  return d.length>0&&d.length<=2?",":null;
 }
 if(dots===1){
  const [,d=""]=s.split(".");
  return d.length>0&&d.length<=2?".":null;
 }
 return null;
}

export function parseLocaleNumber(v:any,semantic:"money"|"count"|"decimal"="decimal"){
 if(typeof v==="number")return Number.isFinite(v)?v:null;
 let s=clean(v);
 if(!s||/^(-|—|–|n\/?a|null|none)$/i.test(s))return null;
 s=s.replace(/Rp\.?|IDR|USD/gi,"").replace(/\s+/g,"").replace(/[^0-9,.-]/g,"");
 if(!s)return null;
 if(semantic==="count"){
  const neg=s.startsWith("-");s=s.replace(/-/g,"");
  if(/^\d{1,3}([.,]\d{3})+$/.test(s))s=s.replace(/[.,]/g,"");
  else if((s.match(/[.,]/g)||[]).length===1){const sep=s.includes(",")?",":".";const p=s.split(sep);if(p[1]?.length===3)s=p.join("");else s=p.join(".")}
  else s=s.replace(/,/g,"");
  const n=Number((neg?"-":"")+s);return Number.isFinite(n)?n:null;
 }
 const dec=inferDecimalSeparator(s);
 if(dec===",")s=s.replace(/\./g,"").replace(",",".");
 else if(dec===".")s=s.replace(/,/g,"");
 else s=s.replace(/[.,]/g,"");
 const n=Number(s);return Number.isFinite(n)?n:null;
}

export function parsePercent(v:any){
 if(typeof v==="number")return Math.abs(v)<=1?v*100:v;
 const s=clean(v);if(!s||/^(-|—|–|n\/?a)$/i.test(s))return null;
 return parseLocaleNumber(s.replace("%",""),"decimal");
}

export function parseDurationSeconds(v:any){
 if(typeof v==="number")return Number.isFinite(v)?v:null;
 const s=clean(v).toLowerCase();if(!s||/^(-|—|–)$/i.test(s))return null;
 if(/^\d{1,3}:\d{1,2}:\d{1,2}$/.test(s)){const [h,m,sec]=s.split(":").map(Number);return h*3600+m*60+sec}
 if(/^\d{1,3}:\d{1,2}$/.test(s)){const [m,sec]=s.split(":").map(Number);return m*60+sec}
 let total=0,hit=false;
 const h=s.match(/(\d+(?:[.,]\d+)?)\s*(?:j|h|jam)/);if(h){total+=Number(h[1].replace(",","."))*3600;hit=true}
 const m=s.match(/(\d+(?:[.,]\d+)?)\s*(?:m|menit|min)/);if(m){total+=Number(m[1].replace(",","."))*60;hit=true}
 const sec=s.match(/(\d+(?:[.,]\d+)?)\s*(?:d|s|detik|sec)/);if(sec){total+=Number(sec[1].replace(",","."));hit=true}
 return hit?total:null;
}

function dateParts(v:any){
 if(v instanceof Date&&!Number.isNaN(v.getTime()))return{date:v.toISOString().slice(0,10),datetime:v.toISOString()};
 const s=clean(v);if(!s)return null;
 let m=s.match(/^(\d{1,2})[-\/]([0-1]?\d)[-\/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
 if(m){const dd=m[1].padStart(2,"0"),mo=m[2].padStart(2,"0"),y=m[3],hh=(m[4]||"00").padStart(2,"0"),mi=m[5]||"00",ss=m[6]||"00";return{date:`${y}-${mo}-${dd}`,datetime:`${y}-${mo}-${dd}T${hh}:${mi}:${ss}+07:00`}}
 m=s.match(/^(\d{4})[-\/]([0-1]?\d)[-\/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
 if(m){const y=m[1],mo=m[2].padStart(2,"0"),dd=m[3].padStart(2,"0"),hh=(m[4]||"00").padStart(2,"0"),mi=m[5]||"00",ss=m[6]||"00";return{date:`${y}-${mo}-${dd}`,datetime:`${y}-${mo}-${dd}T${hh}:${mi}:${ss}+07:00`}}
 const d=new Date(s);return Number.isNaN(d.getTime())?null:{date:d.toISOString().slice(0,10),datetime:d.toISOString()};
}
export const parseDateOnly=(v:any)=>dateParts(v)?.date||null;
export const parseDateTime=(v:any)=>dateParts(v)?.datetime||null;

export function parsePeriod(v:any){
 const s=clean(v);
 const dates=s.match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/g)||[];
 if(dates.length>=2)return{start:parseDateOnly(dates[0]),end:parseDateOnly(dates[1])};
 return{start:null,end:null};
}

function objects(matrix:any[][],headerRow:number){
 const headers=(matrix[headerRow]||[]).map(clean);
 return matrix.slice(headerRow+1).filter(r=>r.some(x=>clean(x)!=="")).map(r=>Object.fromEntries(headers.map((h,i)=>[h||`__col_${i}`,r[i]??""])));
}
function byHeader(row:any,candidates:string[]){
 const entries=Object.entries(row);
 for(const c of candidates){const n=normalizeHeader(c);const e=entries.find(([k])=>normalizeHeader(k)===n);if(e)return e[1]}
 return null;
}
function rawMap(row:any){return JSON.parse(JSON.stringify(row,(k,v)=>v instanceof Date?v.toISOString():v))}

const sourceCode=(label:string)=>{
 const n=normalizeHeader(label);
 const known:Record<string,string>={"toko saya":"my_shop","pencarian":"search","keranjang":"cart","rekomendasi":"recommendation","riwayat pesanan pembeli":"buyer_order_history","tab live video":"live_video_tab","beranda":"home","chat":"chat","video":"video","lainnya":"other"};
 return known[n]||"other:"+n.replace(/\s+/g,"_");
};

export function normalizeLiveDataset(matrix:any[][],detection:LiveDetection):ParsedLivePayload{
 const warnings:string[]=[];let normalized_rows:any[]=[];let overview:any;let traffic_sources:any[]=[];let period_start:string|null=null,period_end:string|null=null;

 if(detection.dataset_type==="tiktok_core_stats"){
  const rangeCell=clean(matrix[0]?.[0]);const range=parsePeriod(rangeCell.replace(/^Date Range:\s*/i,""));period_start=range.start;period_end=range.end;
  for(const row of objects(matrix,detection.header_row)){
   const metric_date=parseDateOnly(byHeader(row,["Waktu"]));if(!metric_date)continue;
   normalized_rows.push({
    metric_date,period_start,period_end,
    gmv_attributed:parseLocaleNumber(byHeader(row,["GMV dari LIVE (Rp)"]),"money"),
    gmv_direct:parseLocaleNumber(byHeader(row,["GMV LIVE (Rp)"]),"money"),
    gmv_indirect:parseLocaleNumber(byHeader(row,["GMV tidak langsung dari LIVE (Rp)"]),"money"),
    display_gpm:parseLocaleNumber(byHeader(row,["Tampilkan GPM (Rp)"]),"money"),
    live_stream_count:parseLocaleNumber(byHeader(row,["Siaran LIVE"]),"count"),
    live_streams_with_gmv:parseLocaleNumber(byHeader(row,["Jumlah Siaran LIVE yang menghasilkan GMV."]),"count"),
    products_sold_attributed:parseLocaleNumber(byHeader(row,["Produk yang terjual melalui LIVE"]),"count"),
    products_sold_direct:parseLocaleNumber(byHeader(row,["Produk yang terjual dari LIVE"]),"count"),
    products_sold_indirect:parseLocaleNumber(byHeader(row,["Produk yang terjual dari LIVE secara tidak langsung"]),"count"),
    sku_orders_attributed:parseLocaleNumber(byHeader(row,["Pesanan SKU teratribusi"]),"count"),
    sku_orders_direct:parseLocaleNumber(byHeader(row,["Pesanan SKU dari LIVE"]),"count"),
    sku_orders_indirect:parseLocaleNumber(byHeader(row,["Pesanan SKU tidak langsung dari LIVE"]),"count"),
    buyers_search:parseLocaleNumber(byHeader(row,["Pembeli (Pencarian)"]),"count"),
    live_ctr_pct:parsePercent(byHeader(row,["Rasio klik tayang (LIVE)"])),
    live_ctor_order_pct:parsePercent(byHeader(row,["CTOR (pesanan SKU) (LIVE)"])),
    live_impressions:parseLocaleNumber(byHeader(row,["Tayangan LIVE"]),"count"),
    avg_watch_duration_seconds:parseLocaleNumber(byHeader(row,["Durasi menonton rata-rata (Siaran LIVE)"]),"decimal"),
    raw_payload:rawMap(row)
   });
  }
 }
 if(detection.dataset_type==="shopee_session_list"){
  for(const row of objects(matrix,detection.header_row)){
   const p=parsePeriod(byHeader(row,["Periode Data"]));period_start=period_start||p.start;period_end=period_end||p.end;
   const started_at=parseDateTime(byHeader(row,["Start Time"]));if(!started_at)continue;
   const title=clean(byHeader(row,["Nama Livestream"]));const source_user_id=clean(byHeader(row,["User Id"]));
   const duration_seconds=parseDurationSeconds(byHeader(row,["Durasi:","Durasi"]));
   normalized_rows.push({
    period_start:p.start,period_end:p.end,source_user_id,
    source_rank_no:parseLocaleNumber(byHeader(row,["No."]),"count"),session_title:title,started_at,
    session_date:parseDateOnly(started_at),duration_seconds,duration_minutes:duration_seconds===null?null:duration_seconds/60,
    active_viewers:parseLocaleNumber(byHeader(row,["Penonton Aktif"]),"count"),
    comments:parseLocaleNumber(byHeader(row,["Komentar"]),"count"),
    add_to_cart:parseLocaleNumber(byHeader(row,["Tambah ke Keranjang"]),"count"),
    avg_watch_duration_seconds:parseDurationSeconds(byHeader(row,["Rata-rata durasi ditonton"])),
    viewers:parseLocaleNumber(byHeader(row,["Penonton"]),"count"),
    orders_created:parseLocaleNumber(byHeader(row,["Pesanan(Pesanan Dibuat)","Pesanan (Pesanan Dibuat)"]),"count"),
    orders_ready_to_ship:parseLocaleNumber(byHeader(row,["Pesanan(Pesanan Siap Dikirim)","Pesanan (Pesanan Siap Dikirim)"]),"count"),
    qty_created:parseLocaleNumber(byHeader(row,["Produk Terjual(Pesanan Dibuat)","Produk Terjual (Pesanan Dibuat)"]),"count"),
    qty_ready_to_ship:parseLocaleNumber(byHeader(row,["Produk Terjual(Pesanan Siap Dikirim)","Produk Terjual (Pesanan Siap Dikirim)"]),"count"),
    gmv_created:parseLocaleNumber(byHeader(row,["Penjualan(Pesanan Dibuat)","Penjualan (Pesanan Dibuat)"]),"money"),
    gmv_ready_to_ship:parseLocaleNumber(byHeader(row,["Penjualan(Pesanan Siap Dikirim)","Penjualan (Pesanan Siap Dikirim)"]),"money"),
    raw_payload:rawMap(row)
   });
  }
 }
 if(detection.dataset_type==="shopee_product_list"){
  for(const row of objects(matrix,detection.header_row)){
   const p=parsePeriod(byHeader(row,["Periode Data"]));period_start=period_start||p.start;period_end=period_end||p.end;
   const product_name_raw=clean(byHeader(row,["Produk"]));if(!product_name_raw)continue;
   normalized_rows.push({
    period_start:p.start,period_end:p.end,source_user_id:clean(byHeader(row,["User Id"])),
    ranking:parseLocaleNumber(byHeader(row,["Ranking"]),"count"),product_name_raw,
    product_clicks:parseLocaleNumber(byHeader(row,["Klik Produk"]),"count"),add_to_cart:parseLocaleNumber(byHeader(row,["Tambah ke Keranjang"]),"count"),
    product_orders_created:parseLocaleNumber(byHeader(row,["Pesanan(Pesanan Dibuat)"]),"count"),product_orders_ready_to_ship:parseLocaleNumber(byHeader(row,["Pesanan(Pesanan Siap Dikirim)"]),"count"),
    qty_created:parseLocaleNumber(byHeader(row,["Produk Terjual(Pesanan Dibuat)"]),"count"),qty_ready_to_ship:parseLocaleNumber(byHeader(row,["Produk Terjual(Pesanan Siap Dikirim)"]),"count"),
    gmv_created:parseLocaleNumber(byHeader(row,["Penjualan(Pesanan Dibuat)"]),"money"),gmv_ready_to_ship:parseLocaleNumber(byHeader(row,["Penjualan(Pesanan Siap Dikirim)"]),"money"),
    raw_payload:rawMap(row)
   });
  }
 }
 if(detection.dataset_type==="shopee_overview"){
  const hdr=matrix[1]||[],vals=matrix[2]||[];const row=Object.fromEntries(hdr.map((h,i)=>[clean(h)||`__col_${i}`,vals[i]??""]));
  const p=parsePeriod(byHeader(row,["Periode Data"]));period_start=p.start;period_end=p.end;
  overview={
   source_user_id:clean(byHeader(row,["User Id"])),period_start,period_end,
   gmv_created:parseLocaleNumber(byHeader(row,["Penjualan(Pesanan Dibuat)"]),"money"),gmv_ready_to_ship:parseLocaleNumber(byHeader(row,["Penjualan(Pesanan Siap Dikirim)"]),"money"),
   new_buyer_gmv_created:parseLocaleNumber(byHeader(row,["Penjualan dari Pembeli Baru(Pesanan Dibuat)"]),"money"),new_buyer_gmv_ready:parseLocaleNumber(byHeader(row,["Penjualan dari Pembeli Baru(Pesanan Siap Dikirim)"]),"money"),
   returning_buyer_gmv_created:parseLocaleNumber(byHeader(row,["Penjualan dari Pembeli Lama(Pesanan Dibuat)"]),"money"),returning_buyer_gmv_ready:parseLocaleNumber(byHeader(row,["Penjualan dari Pembeli Lama(Pesanan Siap Dikirim)"]),"money"),
   orders_created:parseLocaleNumber(byHeader(row,["Pesanan(Pesanan Dibuat)"]),"count"),orders_ready_to_ship:parseLocaleNumber(byHeader(row,["Pesanan(Pesanan Siap Dikirim)"]),"count"),
   qty_created:parseLocaleNumber(byHeader(row,["Produk Terjual(Pesanan Dibuat)"]),"count"),qty_ready_to_ship:parseLocaleNumber(byHeader(row,["Produk Terjual(Pesanan Siap Dikirim)"]),"count"),
   aov_created:parseLocaleNumber(byHeader(row,["Nilai Penjualan per Pesanan(Pesanan Dibuat)"]),"money"),aov_ready:parseLocaleNumber(byHeader(row,["Nilai Penjualan per Pesanan(Pesanan Siap Dikirim)"]),"money"),
   sales_per_buyer_created:parseLocaleNumber(byHeader(row,["Penjualan per Pembeli(Pesanan Dibuat)"]),"money"),sales_per_buyer_ready:parseLocaleNumber(byHeader(row,["Penjualan per Pembeli(Pesanan Siap Dikirim)"]),"money"),
   livestream_count:parseLocaleNumber(byHeader(row,["Jumlah Livestream"]),"count"),live_duration_seconds:parseDurationSeconds(byHeader(row,["Jumlah Durasi Livestream"])),avg_live_duration_seconds:parseDurationSeconds(byHeader(row,["Rata-rata durasi Livestream"])),
   viewers:parseLocaleNumber(byHeader(row,["Penonton"]),"count"),period_active_viewers:parseLocaleNumber(byHeader(row,["Penonton Aktif"]),"count"),views:parseLocaleNumber(byHeader(row,["Dilihat"]),"count"),peak_viewers:parseLocaleNumber(byHeader(row,["Penonton Tertinggi"]),"count"),avg_watch_duration_seconds:parseDurationSeconds(byHeader(row,["Rata-rata durasi ditonton"])),
   click_pct:parsePercent(byHeader(row,["Persentase Klik"])),buyers_created:parseLocaleNumber(byHeader(row,["Pembeli(Pesanan Dibuat)"]),"count"),buyers_ready:parseLocaleNumber(byHeader(row,["Pembeli(Pesanan Siap Dikirim)"]),"count"),
   orders_per_click_created_pct:parsePercent(byHeader(row,["Pesanan per Klik(Pesanan Dibuat)"])),orders_per_click_ready_pct:parsePercent(byHeader(row,["Pesanan per Klik(Pesanan Siap Dikirim)"])),
   add_to_cart:parseLocaleNumber(byHeader(row,["Tambah ke Keranjang"]),"count"),sales_per_mille_created:parseLocaleNumber(byHeader(row,["Penjualan per mil(Pesanan Dibuat)"]),"money"),sales_per_mille_ready:parseLocaleNumber(byHeader(row,["Penjualan per mil(Pesanan Siap Dikirim)"]),"money"),
   products_viewed:parseLocaleNumber(byHeader(row,["Jumlah Produk Dilihat"]),"count"),conversion_click_pct:parsePercent(byHeader(row,["Persentase Klik"])),product_clicks:parseLocaleNumber(byHeader(row,["Klik Produk"]),"count"),
   order_pct_created:parsePercent(byHeader(row,["Persentase Pesanan(Pesanan Dibuat)"])),order_pct_ready:parsePercent(byHeader(row,["Persentase Pesanan(Pesanan Siap Dikirim)"])),
   conversion_orders_created:parseLocaleNumber(byHeader(row,["Pesanan Dibuat"]),"count"),conversion_orders_confirmed:parseLocaleNumber(byHeader(row,["Pesanan Terkonfirmasi"]),"count"),
   likes:parseLocaleNumber(byHeader(row,["Suka"]),"count"),shares:parseLocaleNumber(byHeader(row,["Share"]),"count"),comments:parseLocaleNumber(byHeader(row,["Komentar"]),"count"),new_followers:parseLocaleNumber(byHeader(row,["Pengikut Baru dari Livestream"]),"count"),
   store_vouchers_claimed:parseLocaleNumber(byHeader(row,["Voucher Toko Diklaim"]),"count"),special_live_vouchers_claimed:parseLocaleNumber(byHeader(row,["Voucher Spesial Live Diklaim"]),"count"),coins_claimed:parseLocaleNumber(byHeader(row,["Koin Diklaim"]),"count"),
   raw_payload:rawMap(row)
  };
  for(let i=3;i<matrix.length-2;i++){
   const group=(matrix[i]||[]).map(clean).find(x=>/^Kunjungan\s*-\s*Sumber Penonton\s*-/i.test(x));
   if(!group)continue;
   const label=group.replace(/^Kunjungan\s*-\s*Sumber Penonton\s*-/i,"").trim();if(!label||/Semua Sumber/i.test(label))continue;
   const hrow=matrix[i+1]||[],vrow=matrix[i+2]||[];const sr=Object.fromEntries(hrow.map((h,j)=>[clean(h)||`__col_${j}`,vrow[j]??""]));
   traffic_sources.push({source_user_id:overview.source_user_id,period_start,period_end,traffic_source_code:sourceCode(label),traffic_source_label:label,
    live_view_ratio_pct:parsePercent(byHeader(sr,["Rasio Live Ditonton"])),live_viewer_ratio_pct:parsePercent(byHeader(sr,["Rasio Penonton Live"])),active_viewer_ratio_pct:parsePercent(byHeader(sr,["Rasio Penonton Aktif"])),
    live_views:parseLocaleNumber(byHeader(sr,["Live Ditonton"]),"count"),live_viewers:parseLocaleNumber(byHeader(sr,["Penonton Live"]),"count"),active_viewers:parseLocaleNumber(byHeader(sr,["Penonton Aktif"]),"count"),raw_payload:rawMap(sr)});
  }
 }

 if(detection.dataset_type==="generic")warnings.push("Format belum dikenali otomatis. Gunakan manual mapping.");
 if(!normalized_rows.length&&!overview&&detection.dataset_type!=="generic")warnings.push("Tidak ada row valid yang berhasil dinormalisasi.");
 const preview=(normalized_rows.length?normalized_rows:[overview].filter(Boolean)).slice(0,5);
 return{detection,normalized_rows,overview,traffic_sources,warnings,preview,period_start,period_end};
}
