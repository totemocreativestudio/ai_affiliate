import {randomUUID} from "crypto";
import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";

export const runtime="nodejs";
type Row=Record<string,any>;
const clean=(v:any)=>v===null||v===undefined?"":String(v).trim();
const norm=(v:any)=>clean(v).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"");
const keyPart=(v:any)=>norm(v).slice(0,180)||"na";
const hourJakarta=(iso:any)=>{if(!iso)return null;const d=new Date(String(iso));if(Number.isNaN(d.getTime()))return null;const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Jakarta",hour:"2-digit",hour12:false}).formatToParts(d);return Number(parts.find(x=>x.type==="hour")?.value||0)};
const jsonSafe=(v:any)=>JSON.parse(JSON.stringify(v??{}));

function findHeader(row:Row,candidates:string[]){const keys=Object.keys(row||{});for(const c of candidates){const hit=keys.find(k=>norm(k)===norm(c));if(hit)return hit}for(const c of candidates){const nc=norm(c);const hit=keys.find(k=>norm(k).includes(nc)||nc.includes(norm(k)));if(hit)return hit}return ""}
function raw(row:Row,h:string){return h?row[h]:""}
function num(v:any){if(typeof v==="number")return Number.isFinite(v)?v:0;let s=clean(v).replace(/Rp|IDR|USD/gi,"").replace(/%/g,"").replace(/\s+/g,"").replace(/[^0-9,.-]/g,"");if(!s)return 0;if(s.includes(",")&&s.includes(".")){const lastComma=s.lastIndexOf(","),lastDot=s.lastIndexOf(".");if(lastComma>lastDot)s=s.replace(/\./g,"").replace(",",".");else s=s.replace(/,/g,"")}else if(s.includes(",")){const p=s.split(",");s=p.length===2&&p[1].length<=2?p[0]+"."+p[1]:p.join("")}else if((s.match(/\./g)||[]).length===1){const p=s.split(".");if(p[1]?.length===3)s=p.join("")}else s=s.replace(/\./g,"");const n=Number(s);return Number.isFinite(n)?n:0}
function dateOnly(v:any,fallback:string){if(!v)return fallback;const d=new Date(v);return Number.isNaN(d.getTime())?fallback:d.toISOString().slice(0,10)}
function hourValue(v:any){const s=clean(v);const m=s.match(/(\d{1,2})(?::\d{2})?/);return m?Math.min(23,Math.max(0,Number(m[1]))):null}

async function upsertKnownDataset(admin:any,workspaceId:string,importId:string,platform:string,datasetType:string,b:any){
 const rows:Row[]=Array.isArray(b.normalized_rows)?b.normalized_rows:[];
 let persisted=0;
 let minDate=clean(b.period_start),maxDate=clean(b.period_end);

 if(datasetType==="tiktok_core_stats"){
  const payload=rows.map((r:any)=>({
   workspace_id:workspaceId,platform:"TikTok",dataset_type:"core_stats",metric_date:r.metric_date,
   period_start:r.period_start||b.period_start||null,period_end:r.period_end||b.period_end||null,
   gmv_attributed:r.gmv_attributed,gmv_direct:r.gmv_direct,gmv_indirect:r.gmv_indirect,display_gpm:r.display_gpm,
   live_stream_count:r.live_stream_count,live_streams_with_gmv:r.live_streams_with_gmv,
   products_sold_attributed:r.products_sold_attributed,products_sold_direct:r.products_sold_direct,products_sold_indirect:r.products_sold_indirect,
   sku_orders_attributed:r.sku_orders_attributed,sku_orders_direct:r.sku_orders_direct,sku_orders_indirect:r.sku_orders_indirect,
   buyers_search:r.buyers_search,live_ctr_pct:r.live_ctr_pct,live_ctor_order_pct:r.live_ctor_order_pct,
   live_impressions:r.live_impressions,avg_watch_duration_seconds:r.avg_watch_duration_seconds,
   source_import_id:importId,source_row_key:`tiktok:core:${r.metric_date}`,raw_payload:jsonSafe(r.raw_payload),updated_at:new Date().toISOString()
  }));
  if(payload.length){const x=await admin.from("live_daily_performance").upsert(payload,{onConflict:"workspace_id,source_row_key"});if(x.error)throw x.error;persisted=payload.length}
  minDate=minDate||rows[0]?.metric_date||"";maxDate=maxDate||rows[rows.length-1]?.metric_date||"";
  return{persisted,minDate,maxDate};
 }

 if(datasetType==="shopee_product_list"){
  const payload=rows.map((r:any)=>({
   workspace_id:workspaceId,platform:"Shopee",source_user_id:clean(r.source_user_id)||null,period_start:r.period_start||null,period_end:r.period_end||null,
   ranking:r.ranking,product_name_raw:clean(r.product_name_raw),product_clicks:r.product_clicks,add_to_cart:r.add_to_cart,
   product_orders_created:r.product_orders_created,product_orders_ready_to_ship:r.product_orders_ready_to_ship,
   qty_created:r.qty_created,qty_ready_to_ship:r.qty_ready_to_ship,gmv_created:r.gmv_created,gmv_ready_to_ship:r.gmv_ready_to_ship,
   source_import_id:importId,source_row_key:`shopee:product:${keyPart(r.source_user_id)}:${r.period_start}:${r.period_end}:${keyPart(r.product_name_raw)}`,
   raw_payload:jsonSafe(r.raw_payload),updated_at:new Date().toISOString()
  }));
  if(payload.length){const x=await admin.from("live_product_performance").upsert(payload,{onConflict:"workspace_id,source_row_key"});if(x.error)throw x.error;persisted=payload.length}
  minDate=minDate||rows[0]?.period_start||"";maxDate=maxDate||rows[0]?.period_end||"";
  return{persisted,minDate,maxDate};
 }

 if(datasetType==="shopee_overview"){
  const o=b.overview||{};
  if(!o.period_start||!o.period_end)throw new Error("Periode Shopee Overview tidak terbaca.");
  const overviewPayload={...o,workspace_id:workspaceId,platform:"Shopee",source_user_id:clean(o.source_user_id)||null,source_import_id:importId,raw_payload:jsonSafe(o.raw_payload),updated_at:new Date().toISOString()};
  const ox=await admin.from("live_period_overview").upsert(overviewPayload,{onConflict:"workspace_id,platform,source_user_id,period_start,period_end"});if(ox.error)throw ox.error;persisted++;
  const traffic:Array<any>=Array.isArray(b.traffic_sources)?b.traffic_sources:[];
  if(traffic.length){
   const tx=await admin.from("live_traffic_sources").upsert(traffic.map((r:any)=>({...r,workspace_id:workspaceId,platform:"Shopee",source_user_id:clean(r.source_user_id)||clean(o.source_user_id)||null,source_import_id:importId,raw_payload:jsonSafe(r.raw_payload),updated_at:new Date().toISOString()})),{onConflict:"workspace_id,platform,source_user_id,period_start,period_end,traffic_source_code"});
   if(tx.error)throw tx.error;persisted+=traffic.length;
  }
  return{persisted,minDate:o.period_start,maxDate:o.period_end};
 }

 if(datasetType==="shopee_session_list"){
  for(const r of rows){
   const started=clean(r.started_at);const sessionDate=clean(r.session_date)||dateOnly(started,new Date().toISOString().slice(0,10));
   const natural=`${keyPart(r.source_user_id)}:${keyPart(started)}:${keyPart(r.session_title)}`;
   const sessionPayload={
    workspace_id:workspaceId,host_id:null,title:clean(r.session_title)||"Shopee Live",platform:"Shopee",
    session_date:sessionDate,start_at:started||null,end_at:null,status:"completed",
    source_user_id:clean(r.source_user_id)||null,source_rank_no:r.source_rank_no||null,
    source_natural_key:natural,source_import_id:importId,source_raw:jsonSafe(r.raw_payload),updated_at:new Date().toISOString()
   };
   const sx=await admin.from("live_sessions").upsert(sessionPayload,{onConflict:"workspace_id,platform,source_natural_key"}).select("id").single();
   if(sx.error)throw sx.error;
   const sourceRowKey=`shopee:session:${natural}`;
   const perf={
    workspace_id:workspaceId,session_id:sx.data.id,metric_at:started||null,metric_date:sessionDate,hour_bucket:hourJakarta(started),
    gmv:Number(r.gmv_created||0),orders:Number(r.orders_created||0),qty:Number(r.qty_created||0),
    active_viewers:Number(r.active_viewers||0),peak_viewers:0,avg_viewers:0,clicks:0,impressions:0,ctr:0,cvr:0,
    duration_minutes:Number(r.duration_minutes||0),duration_seconds:r.duration_seconds,
    gmv_created:r.gmv_created,gmv_ready_to_ship:r.gmv_ready_to_ship,orders_created:r.orders_created,orders_ready_to_ship:r.orders_ready_to_ship,
    qty_created:r.qty_created,qty_ready_to_ship:r.qty_ready_to_ship,comments:r.comments,add_to_cart:r.add_to_cart,viewers:r.viewers,
    avg_watch_duration_seconds:r.avg_watch_duration_seconds,source_import_id:importId,source_row_key:sourceRowKey,raw_payload:jsonSafe(r.raw_payload)
   };
   const px=await admin.from("live_session_performance").upsert(perf,{onConflict:"workspace_id,source_row_key"});if(px.error)throw px.error;
   persisted++;
   if(!minDate||sessionDate<minDate)minDate=sessionDate;if(!maxDate||sessionDate>maxDate)maxDate=sessionDate;
  }
  return{persisted,minDate,maxDate};
 }

 return null;
}

export async function POST(req:NextRequest){
 let workspaceId="",importId="";
 try{
  const b=await req.json();
  workspaceId=clean(b.workspace_id);const filename=clean(b.filename)||"live-upload.xlsx",fileHash=clean(b.file_hash),platform=clean(b.platform)||"Unknown";
  const datasetType=clean(b.dataset_type)||"generic";
  importId=clean(b.import_id)||"LIVE-"+randomUUID().replace(/-/g,"").slice(0,10).toUpperCase();
  const normalizedRows:Row[]=Array.isArray(b.normalized_rows)?b.normalized_rows:[];
  const rawRows:Row[]=Array.isArray(b.rows)?b.rows:[];
  if(!workspaceId||(!normalizedRows.length&&!rawRows.length&&!b.overview))return NextResponse.json({ok:false,error:"Workspace dan data wajib diisi."},{status:400});

  const ctx=await getServerContext(workspaceId);if(!ctx.canManage)return NextResponse.json({ok:false,error:"Role Anda tidak dapat melakukan import."},{status:403});const {admin}=ctx;
  if(fileHash){
   const dup=await admin.from("live_imports").select("id,import_id").eq("workspace_id",workspaceId).eq("file_hash",fileHash).eq("status","completed").limit(1);
   if(dup.data?.length)return NextResponse.json({ok:false,error:"File identik sudah pernah diimport ke Live Streaming.",duplicate_import_id:dup.data[0].import_id},{status:409});
  }

  const rowCount=normalizedRows.length+(b.overview?1:0)+(Array.isArray(b.traffic_sources)?b.traffic_sources.length:0);
  const importPayload={workspace_id:workspaceId,import_id:importId,filename,file_hash:fileHash||null,platform,row_count:rowCount||rawRows.length,status:"processing",
   mapping:b.mapping_overrides||{},dataset_type:datasetType,parser_version:clean(b.parser_version)||null,source_sheet:clean(b.source_sheet)||null,
   parser_meta:jsonSafe(b.parser_meta),warnings:jsonSafe(b.warnings),created_by:ctx.user.id};
  const startImport=await admin.from("live_imports").insert(importPayload);if(startImport.error)throw startImport.error;

  if(datasetType!=="generic"){
   const known=await upsertKnownDataset(admin,workspaceId,importId,platform,datasetType,b);
   if(!known)throw new Error("Dataset Live tidak dikenali.");
   await admin.from("live_imports").update({status:"completed",persisted_rows:known.persisted,period_start:known.minDate||null,period_end:known.maxDate||null,completed_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("import_id",importId);
   return NextResponse.json({ok:true,import_id:importId,dataset_type:datasetType,platform,persisted_rows:known.persisted,period_start:known.minDate,period_end:known.maxDate,warnings:b.warnings||[]});
  }

  const rows=rawRows;const overrides:Record<string,string>=b.mapping_overrides&&typeof b.mapping_overrides==="object"?b.mapping_overrides:{};
  const first=rows[0]||{};
  const auto:any={
    host_username:findHeader(first,["Host Username","Username Host","Host","Presenter","Nama Host"]),
    host_name:findHeader(first,["Host Name","Nama Host","Presenter Name"]),
    session_title:findHeader(first,["Session Title","Nama Session","Live Session","Session"]),
    metric_date:findHeader(first,["Date","Tanggal","Metric Date","Live Date"]),
    hour:findHeader(first,["Hour","Jam","Time","Waktu"]),
    gmv:findHeader(first,["GMV","Live GMV","Revenue","Sales","Penjualan"]),
    orders:findHeader(first,["Orders","Order","Pesanan"]),qty:findHeader(first,["Qty","Quantity","Items Sold","Produk Terjual"]),
    active_viewers:findHeader(first,["Active Viewers","Viewer Aktif","Viewers"]),peak_viewers:findHeader(first,["Peak Viewers","Peak Viewer"]),
    avg_viewers:findHeader(first,["Avg Viewers","Average Viewers","Rata-rata Viewer"]),clicks:findHeader(first,["Clicks","Klik"]),
    impressions:findHeader(first,["Impressions","Impresi"]),ctr:findHeader(first,["CTR","Click Through Rate"]),cvr:findHeader(first,["CVR","Conversion Rate"]),
    duration_minutes:findHeader(first,["Duration Minutes","Duration","Durasi Menit","Durasi"]),campaign_name:findHeader(first,["Campaign","Campaign Name","Nama Campaign"]),
    gimmick:findHeader(first,["Gimmick","Live Gimmick","Promo Mechanic"])
  };
  const map={...auto,...overrides};
  let persisted=0;const hostCache=new Map<string,string>();const sessionCache=new Map<string,string>();let minDate="",maxDate="";
  for(const row of rows){
    const hostUsername=clean(raw(row,map.host_username)||raw(row,map.host_name)||"Unknown Host");const hostName=clean(raw(row,map.host_name)||hostUsername);const hostKey=hostUsername.toLowerCase();
    let hostId=hostCache.get(hostKey);
    if(!hostId){const ex=await admin.from("live_hosts").select("id").eq("workspace_id",workspaceId).or("username.ilike."+hostUsername+",name.ilike."+hostName).limit(1).maybeSingle();if(ex.data?.id)hostId=ex.data.id;else{const cr=await admin.from("live_hosts").insert({workspace_id:workspaceId,name:hostName,username:hostUsername,platform,host_type:"inhouse",status:"active"}).select("id").single();if(cr.error)throw cr.error;hostId=cr.data.id}hostCache.set(hostKey,hostId!)}
    const fallback=new Date().toISOString().slice(0,10);const metricDate=dateOnly(raw(row,map.metric_date),fallback);if(!minDate||metricDate<minDate)minDate=metricDate;if(!maxDate||metricDate>maxDate)maxDate=metricDate;
    const title=clean(raw(row,map.session_title))||("Live "+hostName+" "+metricDate);const sessionKey=hostId+"|"+title.toLowerCase()+"|"+metricDate;let sessionId=sessionCache.get(sessionKey);
    if(!sessionId){const ex=await admin.from("live_sessions").select("id").eq("workspace_id",workspaceId).eq("host_id",hostId).eq("session_date",metricDate).ilike("title",title).limit(1).maybeSingle();if(ex.data?.id)sessionId=ex.data.id;else{const cr=await admin.from("live_sessions").insert({workspace_id:workspaceId,host_id:hostId,title,platform,campaign_name:clean(raw(row,map.campaign_name))||null,gimmick:clean(raw(row,map.gimmick))||null,session_date:metricDate,status:"completed"}).select("id").single();if(cr.error)throw cr.error;sessionId=cr.data.id}sessionCache.set(sessionKey,sessionId!)}
    const performance={workspace_id:workspaceId,session_id:sessionId,metric_date:metricDate,hour_bucket:hourValue(raw(row,map.hour)),gmv:num(raw(row,map.gmv)),orders:num(raw(row,map.orders)),qty:num(raw(row,map.qty)),active_viewers:num(raw(row,map.active_viewers)),peak_viewers:num(raw(row,map.peak_viewers)),avg_viewers:num(raw(row,map.avg_viewers)),clicks:num(raw(row,map.clicks)),impressions:num(raw(row,map.impressions)),ctr:num(raw(row,map.ctr)),cvr:num(raw(row,map.cvr)),duration_minutes:num(raw(row,map.duration_minutes)),source_import_id:importId};
    const ins=await admin.from("live_session_performance").insert(performance);if(ins.error)throw ins.error;persisted++;
  }
  await admin.from("live_imports").update({status:"completed",persisted_rows:persisted,period_start:minDate||null,period_end:maxDate||null,completed_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("import_id",importId);
  return NextResponse.json({ok:true,import_id:importId,dataset_type:"generic",persisted_rows:persisted,period_start:minDate,period_end:maxDate,mapping:map});
 }catch(error:any){
  try{if(workspaceId&&importId){const ctx=await getServerContext(workspaceId);await ctx.admin.from("live_imports").update({status:"failed",error_message:String(error?.message||"Import failed").slice(0,500),completed_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("import_id",importId)}}catch{}
  return NextResponse.json({ok:false,error:String(error?.message||"Import Live Streaming gagal.")},{status:500});
 }
}
