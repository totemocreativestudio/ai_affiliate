import {randomUUID} from "crypto";
import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";

export const runtime="nodejs";
type Row=Record<string,any>;
const clean=(v:any)=>v===null||v===undefined?"":String(v).trim();
const norm=(v:any)=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,"");
function findHeader(row:Row,candidates:string[]){const keys=Object.keys(row||{});for(const c of candidates){const hit=keys.find(k=>norm(k)===norm(c));if(hit)return hit}for(const c of candidates){const nc=norm(c);const hit=keys.find(k=>norm(k).includes(nc)||nc.includes(norm(k)));if(hit)return hit}return ""}
function raw(row:Row,h:string){return h?row[h]:""}
function num(v:any){if(typeof v==="number")return Number.isFinite(v)?v:0;let s=clean(v).replace(/Rp|IDR|USD/gi,"").replace(/%/g,"").replace(/\s+/g,"").replace(/[^0-9,.-]/g,"");if(!s)return 0;if(s.includes(",")&&s.includes(".")){const lastComma=s.lastIndexOf(","),lastDot=s.lastIndexOf(".");if(lastComma>lastDot)s=s.replace(/\./g,"").replace(",",".");else s=s.replace(/,/g,"")}else if(s.includes(",")){const p=s.split(",");s=p.length===2&&p[1].length<=2?p[0]+"."+p[1]:p.join("")}else if((s.match(/\./g)||[]).length===1){const p=s.split(".");if(p[1]?.length===3)s=p.join("")}else s=s.replace(/\./g,"");const n=Number(s);return Number.isFinite(n)?n:0}
function dateOnly(v:any,fallback:string){if(!v)return fallback;const d=new Date(v);return Number.isNaN(d.getTime())?fallback:d.toISOString().slice(0,10)}
function hourValue(v:any){const s=clean(v);const m=s.match(/(\d{1,2})(?::\d{2})?/);return m?Math.min(23,Math.max(0,Number(m[1]))):null}

export async function POST(req:NextRequest){
 try{
  const b=await req.json();
  const workspaceId=clean(b.workspace_id),filename=clean(b.filename)||"live-upload.xlsx",fileHash=clean(b.file_hash),platform=clean(b.platform)||"TikTok";
  const importId=clean(b.import_id)||"LIVE-"+randomUUID().replace(/-/g,"").slice(0,10).toUpperCase();
  const rows:Row[]=Array.isArray(b.rows)?b.rows:[];
  const overrides:Record<string,string>=b.mapping_overrides&&typeof b.mapping_overrides==="object"?b.mapping_overrides:{};
  if(!workspaceId||!rows.length)return NextResponse.json({ok:false,error:"Workspace dan data wajib diisi."},{status:400});
  const ctx=await getServerContext(workspaceId);if(!ctx.canManage)return NextResponse.json({ok:false,error:"Role Anda tidak dapat melakukan import."},{status:403});const {admin}=ctx;
  if(fileHash){
   const dup=await admin.from("live_imports").select("id,import_id").eq("workspace_id",workspaceId).eq("file_hash",fileHash).eq("status","completed").limit(1);
   if(dup.data?.length)return NextResponse.json({ok:false,error:"File identik sudah pernah diimport ke Live Streaming."},{status:409});
  }
  const first=rows[0]||{};
  const auto:any={
    host_username:findHeader(first,["Host Username","Username Host","Host","Presenter","Nama Host"]),
    host_name:findHeader(first,["Host Name","Nama Host","Presenter Name"]),
    session_title:findHeader(first,["Session Title","Nama Session","Live Session","Session"]),
    metric_date:findHeader(first,["Date","Tanggal","Metric Date","Live Date"]),
    hour:findHeader(first,["Hour","Jam","Time","Waktu"]),
    gmv:findHeader(first,["GMV","Live GMV","Revenue","Sales","Penjualan"]),
    orders:findHeader(first,["Orders","Order","Pesanan"]),
    qty:findHeader(first,["Qty","Quantity","Items Sold","Produk Terjual"]),
    active_viewers:findHeader(first,["Active Viewers","Viewer Aktif","Viewers"]),
    peak_viewers:findHeader(first,["Peak Viewers","Peak Viewer"]),
    avg_viewers:findHeader(first,["Avg Viewers","Average Viewers","Rata-rata Viewer"]),
    clicks:findHeader(first,["Clicks","Klik"]),
    impressions:findHeader(first,["Impressions","Impresi"]),
    ctr:findHeader(first,["CTR","Click Through Rate"]),
    cvr:findHeader(first,["CVR","Conversion Rate"]),
    duration_minutes:findHeader(first,["Duration Minutes","Duration","Durasi Menit","Durasi"]),
    campaign_name:findHeader(first,["Campaign","Campaign Name","Nama Campaign"]),
    gimmick:findHeader(first,["Gimmick","Live Gimmick","Promo Mechanic"])
  };
  const map={...auto,...overrides};
  await admin.from("live_imports").insert({workspace_id:workspaceId,import_id:importId,filename,file_hash:fileHash||null,platform,row_count:rows.length,status:"processing",mapping:map,created_by:ctx.user.id});
  let persisted=0;const hostCache=new Map<string,string>();const sessionCache=new Map<string,string>();let minDate="",maxDate="";
  for(const row of rows){
    const hostUsername=clean(raw(row,map.host_username)||raw(row,map.host_name)||"Unknown Host");
    const hostName=clean(raw(row,map.host_name)||hostUsername);
    const hostKey=hostUsername.toLowerCase();
    let hostId=hostCache.get(hostKey);
    if(!hostId){
      const ex=await admin.from("live_hosts").select("id").eq("workspace_id",workspaceId).or("username.ilike."+hostUsername+",name.ilike."+hostName).limit(1).maybeSingle();
      if(ex.data?.id)hostId=ex.data.id;else{const cr=await admin.from("live_hosts").insert({workspace_id:workspaceId,name:hostName,username:hostUsername,platform,host_type:"inhouse",status:"active"}).select("id").single();if(cr.error)throw cr.error;hostId=cr.data.id}
      hostCache.set(hostKey,hostId!);
    }
    const fallback=new Date().toISOString().slice(0,10);const metricDate=dateOnly(raw(row,map.metric_date),fallback);if(!minDate||metricDate<minDate)minDate=metricDate;if(!maxDate||metricDate>maxDate)maxDate=metricDate;
    const title=clean(raw(row,map.session_title))||("Live "+hostName+" "+metricDate);const sessionKey=hostId+"|"+title.toLowerCase()+"|"+metricDate;let sessionId=sessionCache.get(sessionKey);
    if(!sessionId){
      const ex=await admin.from("live_sessions").select("id").eq("workspace_id",workspaceId).eq("host_id",hostId).eq("session_date",metricDate).ilike("title",title).limit(1).maybeSingle();
      if(ex.data?.id)sessionId=ex.data.id;else{const cr=await admin.from("live_sessions").insert({workspace_id:workspaceId,host_id:hostId,title,platform,campaign_name:clean(raw(row,map.campaign_name))||null,gimmick:clean(raw(row,map.gimmick))||null,session_date:metricDate,status:"completed"}).select("id").single();if(cr.error)throw cr.error;sessionId=cr.data.id}
      sessionCache.set(sessionKey,sessionId!);
    }
    const performance={workspace_id:workspaceId,session_id:sessionId,metric_date:metricDate,hour_bucket:hourValue(raw(row,map.hour)),gmv:num(raw(row,map.gmv)),orders:num(raw(row,map.orders)),qty:num(raw(row,map.qty)),active_viewers:num(raw(row,map.active_viewers)),peak_viewers:num(raw(row,map.peak_viewers)),avg_viewers:num(raw(row,map.avg_viewers)),clicks:num(raw(row,map.clicks)),impressions:num(raw(row,map.impressions)),ctr:num(raw(row,map.ctr)),cvr:num(raw(row,map.cvr)),duration_minutes:num(raw(row,map.duration_minutes)),source_import_id:importId};
    const ins=await admin.from("live_session_performance").insert(performance);if(ins.error)throw ins.error;persisted++;
  }
  await admin.from("live_imports").update({status:"completed",persisted_rows:persisted,period_start:minDate||null,period_end:maxDate||null,completed_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("import_id",importId);
  return NextResponse.json({ok:true,import_id:importId,persisted_rows:persisted,period_start:minDate,period_end:maxDate,mapping:map});
 }catch(error:any){
  return NextResponse.json({ok:false,error:String(error?.message||"Import Live Streaming gagal.")},{status:500});
 }
}
