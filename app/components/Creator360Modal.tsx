"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Props={workspaceId:string;creatorId:number|null;startDate:string;endDate:string;onClose:()=>void};
type Row=Record<string,any>;
type PeriodMode="7d"|"30d"|"month"|"year";
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const num=(v:any)=>new Intl.NumberFormat("id-ID").format(Number(v||0));
const DEFAULT_MANUAL={favorite:false,rating:0,program_status:"Not Joined",top_creator:false,ads_support:0,target_sales:0,target_live:0,target_video:0,video_links:["","",""]};
const MONTHS=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function iso(d:Date){return d.toISOString().slice(0,10)}
function utcDate(value:string){return new Date(`${value}T00:00:00Z`)}
function daysInMonth(year:number,month:number){return new Date(Date.UTC(year,month,0)).getUTCDate()}
function rangeFor(mode:PeriodMode,anchor:string,year:number,month:number){
  const safeAnchor=anchor||iso(new Date());
  const end=utcDate(safeAnchor);
  if(mode==="7d"){const start=new Date(end);start.setUTCDate(start.getUTCDate()-6);return{start:iso(start),end:iso(end),label:"7 hari terakhir"}}
  if(mode==="30d"){const start=new Date(end);start.setUTCDate(start.getUTCDate()-29);return{start:iso(start),end:iso(end),label:"30 hari terakhir"}}
  if(mode==="month"){const start=new Date(Date.UTC(year,month-1,1));const finish=new Date(Date.UTC(year,month,0));return{start:iso(start),end:iso(finish),label:`${MONTHS[month-1]} ${year}`}}
  return{start:`${year}-01-01`,end:`${year}-12-31`,label:`Tahun ${year}`};
}
function previousFor(mode:PeriodMode,current:{start:string;end:string}){
  const s=utcDate(current.start),e=utcDate(current.end);
  if(mode==="month"){const ps=new Date(Date.UTC(s.getUTCFullYear(),s.getUTCMonth()-1,1));const pe=new Date(Date.UTC(s.getUTCFullYear(),s.getUTCMonth(),0));return{start:iso(ps),end:iso(pe),label:`${MONTHS[ps.getUTCMonth()]} ${ps.getUTCFullYear()}`}}
  if(mode==="year"){const y=s.getUTCFullYear()-1;return{start:`${y}-01-01`,end:`${y}-12-31`,label:`Tahun ${y}`}}
  const days=Math.round((e.getTime()-s.getTime())/86400000)+1;const pe=new Date(s);pe.setUTCDate(pe.getUTCDate()-1);const ps=new Date(pe);ps.setUTCDate(ps.getUTCDate()-days+1);return{start:iso(ps),end:iso(pe),label:`${iso(ps)} → ${iso(pe)}`};
}
function delta(current:any,previous:any){const c=Number(current||0),p=Number(previous||0);if(!p)return c>0?100:0;return((c-p)/Math.abs(p))*100}
function sortRows(rows:Row[],key:string,asc:boolean){return[...rows].sort((a,b)=>{const av=a?.[key],bv=b?.[key];const an=Number(av),bn=Number(bv);if(av!==""&&bv!==""&&Number.isFinite(an)&&Number.isFinite(bn))return(an-bn)*(asc?1:-1);return String(av??"").localeCompare(String(bv??""),"id",{numeric:true,sensitivity:"base"})*(asc?1:-1)})}
function overlapDays(aStart:string,aEnd:string,bStart:string,bEnd:string){const start=Math.max(utcDate(aStart).getTime(),utcDate(bStart).getTime());const end=Math.min(utcDate(aEnd).getTime(),utcDate(bEnd).getTime());return end<start?0:Math.floor((end-start)/86400000)+1}

export default function Creator360Modal({workspaceId,creatorId,startDate,endDate,onClose}:Props){
  const supabase=useMemo(()=>createClient(),[]);
  const [data,setData]=useState<Row|null>(null);const [prevData,setPrevData]=useState<Row|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [expanded,setExpanded]=useState(false);const [minimized,setMinimized]=useState(false);const [tab,setTab]=useState("overview");
  const [manual,setManual]=useState<Row>(DEFAULT_MANUAL);const [manualSaved,setManualSaved]=useState(false);const [editingManual,setEditingManual]=useState(false);const [saveMessage,setSaveMessage]=useState("");
  const [periodMode,setPeriodMode]=useState<PeriodMode>("month");const [anchorDate,setAnchorDate]=useState("");const [filterYear,setFilterYear]=useState(new Date().getUTCFullYear());const [filterMonth,setFilterMonth]=useState(new Date().getUTCMonth()+1);const [periodReady,setPeriodReady]=useState(false);
  const [targetRows,setTargetRows]=useState<Row[]>([]);const [showTargetEditor,setShowTargetEditor]=useState(false);const [targetType,setTargetType]=useState<"month"|"year">("month");const [targetForm,setTargetForm]=useState<Row>({target_year:new Date().getUTCFullYear(),target_month:new Date().getUTCMonth()+1,target_sales:"",target_live:"",target_video:"",notes:""});const [targetMessage,setTargetMessage]=useState("");

  const range=useMemo(()=>rangeFor(periodMode,anchorDate,filterYear,filterMonth),[periodMode,anchorDate,filterYear,filterMonth]);
  const previous=useMemo(()=>previousFor(periodMode,range),[periodMode,range.start,range.end]);
  const availableYears=useMemo(()=>{const base=filterYear||new Date().getUTCFullYear();return Array.from({length:9},(_,i)=>base-4+i)},[filterYear]);

  useEffect(()=>{if(!creatorId)return;setPeriodReady(false);void bootstrap()},[creatorId,workspaceId]);
  useEffect(()=>{if(periodReady&&creatorId)void loadMetrics()},[periodReady,creatorId,periodMode,filterYear,filterMonth,anchorDate]);

  async function bootstrap(){
    if(!creatorId)return;
    setBusy(true);setError("");
    try{
      const [{data:latest,error:latestError},{data:targets,error:targetError}]=await Promise.all([
        supabase.from("sales").select("data_date").eq("workspace_id",workspaceId).eq("creator_id",creatorId).not("data_date","is",null).order("data_date",{ascending:false}).limit(1).maybeSingle(),
        supabase.from("creator_360_targets").select("*").eq("workspace_id",workspaceId).eq("creator_id",creatorId).order("target_year",{ascending:false}).order("target_month",{ascending:false}).limit(200)
      ]);
      if(latestError)throw latestError;if(targetError)throw targetError;
      const preferred=(endDate||latest?.data_date||iso(new Date())).slice(0,10);const d=utcDate(preferred);
      setAnchorDate(preferred);setFilterYear(d.getUTCFullYear());setFilterMonth(d.getUTCMonth()+1);setTargetRows((targets||[]) as Row[]);
      if(startDate&&endDate){const s=utcDate(startDate),e=utcDate(endDate);const sameMonth=s.getUTCFullYear()===e.getUTCFullYear()&&s.getUTCMonth()===e.getUTCMonth();if(sameMonth)setPeriodMode("month")}
      setPeriodReady(true);
    }catch(e:any){setError(e?.message||"Gagal menyiapkan periode Customer 360.");setBusy(false)}
  }

  async function loadTargets(){
    if(!creatorId)return;
    const {data:targets,error:e}=await supabase.from("creator_360_targets").select("*").eq("workspace_id",workspaceId).eq("creator_id",creatorId).order("target_year",{ascending:false}).order("target_month",{ascending:false}).limit(200);
    if(e)throw e;setTargetRows((targets||[]) as Row[]);
  }

  async function activity(start:string,end:string){
    if(!creatorId)return {};
    let query=supabase.from("sales").select("live_count,video_count,clicks,buyers,impressions,video_views,sample_content,sample_sent").eq("workspace_id",workspaceId).eq("creator_id",creatorId);
    if(start)query=query.gte("data_date",start);if(end)query=query.lte("data_date",end);
    const {data:rows,error:e}=await query;if(e)throw e;
    return (rows||[]).reduce((acc:Row,row:Row)=>{for(const key of ["live_count","video_count","clicks","buyers","impressions","video_views","sample_content","sample_sent"])acc[key]=Number(acc[key]||0)+Number(row[key]||0);return acc},{});
  }

  async function loadMetrics(){
    if(!creatorId)return;
    setBusy(true);setError("");
    try{
      const currentPromise=supabase.rpc("get_creator_360",{p_workspace_id:workspaceId,p_creator_id:creatorId,p_start_date:range.start,p_end_date:range.end});
      const previousPromise=supabase.rpc("get_creator_360",{p_workspace_id:workspaceId,p_creator_id:creatorId,p_start_date:previous.start,p_end_date:previous.end});
      const profilePromise=supabase.from("creator_360_profiles").select("id").eq("workspace_id",workspaceId).eq("creator_id",creatorId).maybeSingle();
      const [currentRes,previousRes,profileRes,currentActivity,previousActivity]=await Promise.all([currentPromise,previousPromise,profilePromise,activity(range.start,range.end),activity(previous.start,previous.end)]);
      if(currentRes.error)throw currentRes.error;if(previousRes.error)throw previousRes.error;
      const row=Array.isArray(currentRes.data)?currentRes.data[0]:currentRes.data;const old=Array.isArray(previousRes.data)?previousRes.data[0]:previousRes.data;
      if(row)row.kpi={...(row.kpi||{}),...currentActivity};if(old)old.kpi={...(old.kpi||{}),...previousActivity};
      setData(row||null);setPrevData(old?{...old,comparison_label:previous.label}:null);setManualSaved(Boolean(profileRes.data?.id));setEditingManual(false);
      if(row?.manual_profile)setManual({...DEFAULT_MANUAL,...row.manual_profile,video_links:Array.isArray(row.manual_profile.video_links)?row.manual_profile.video_links:["","",""]});
    }catch(e:any){setError(e?.message||"Gagal memuat Customer 360.")}finally{setBusy(false)}
  }

  async function saveManual(){
    if(!creatorId)return;setBusy(true);setError("");setSaveMessage("");
    const {error:e}=await supabase.from("creator_360_profiles").upsert({workspace_id:workspaceId,creator_id:creatorId,favorite:Boolean(manual.favorite),rating:Number(manual.rating||0),program_status:manual.program_status||"Not Joined",top_creator:Boolean(manual.top_creator),ads_support:Number(manual.ads_support||0),target_sales:Number(manual.target_sales||0),target_live:Number(manual.target_live||0),target_video:Number(manual.target_video||0),video_links:(manual.video_links||[]).slice(0,3),updated_at:new Date().toISOString()},{onConflict:"workspace_id,creator_id"});
    setBusy(false);if(e)return setError(e.message);setManualSaved(true);setEditingManual(false);setSaveMessage("Data Customer 360 disimpan ✓");await loadMetrics();setSaveMessage("Data Customer 360 disimpan ✓");
  }
  async function cancelEdit(){setEditingManual(false);setSaveMessage("");await loadMetrics()}

  function openTarget(kind:"month"|"year",year=filterYear,month=filterMonth){
    const monthValue=kind==="year"?0:month;const existing=targetRows.find(row=>Number(row.target_year)===year&&Number(row.target_month)===monthValue);
    setTargetType(kind);setTargetForm({target_year:year,target_month:monthValue,target_sales:String(existing?.target_sales??""),target_live:String(existing?.target_live??""),target_video:String(existing?.target_video??""),notes:String(existing?.notes||"")});setTargetMessage("");setShowTargetEditor(true);
  }
  async function saveTarget(){
    if(!creatorId)return;setBusy(true);setTargetMessage("");
    const monthValue=targetType==="year"?0:Number(targetForm.target_month||filterMonth);
    const payload={workspace_id:workspaceId,creator_id:creatorId,target_year:Number(targetForm.target_year||filterYear),target_month:monthValue,target_sales:Math.max(0,Number(targetForm.target_sales||0)),target_live:Math.max(0,Number(targetForm.target_live||0)),target_video:Math.max(0,Number(targetForm.target_video||0)),notes:String(targetForm.notes||"").trim()||null,updated_at:new Date().toISOString()};
    const {error:e}=await supabase.from("creator_360_targets").upsert(payload,{onConflict:"workspace_id,creator_id,target_year,target_month"});
    setBusy(false);if(e)return setTargetMessage(e.message);await loadTargets();setTargetMessage("Target periode tersimpan ✓");setShowTargetEditor(false);
  }
  async function deleteTarget(){
    if(!creatorId)return;const monthValue=targetType==="year"?0:Number(targetForm.target_month||filterMonth);if(!confirm("Hapus target periode ini?"))return;
    const {error:e}=await supabase.from("creator_360_targets").delete().eq("workspace_id",workspaceId).eq("creator_id",creatorId).eq("target_year",Number(targetForm.target_year)).eq("target_month",monthValue);
    if(e)return setTargetMessage(e.message);await loadTargets();setShowTargetEditor(false);setTargetMessage("Target periode dihapus.");
  }

  const effectiveTarget=useMemo(()=>{
    const zero={sales:0,live:0,video:0,source:"Target belum diset"};
    if(periodMode==="month"){
      const row=targetRows.find(x=>Number(x.target_year)===filterYear&&Number(x.target_month)===filterMonth);
      if(row)return{sales:Number(row.target_sales||0),live:Number(row.target_live||0),video:Number(row.target_video||0),source:`Target ${MONTHS[filterMonth-1]} ${filterYear}`};
    }
    if(periodMode==="year"){
      const yearly=targetRows.find(x=>Number(x.target_year)===filterYear&&Number(x.target_month)===0);
      if(yearly)return{sales:Number(yearly.target_sales||0),live:Number(yearly.target_live||0),video:Number(yearly.target_video||0),source:`Target Tahun ${filterYear}`};
      const rows=targetRows.filter(x=>Number(x.target_year)===filterYear&&Number(x.target_month)>0);
      if(rows.length)return{sales:rows.reduce((s,x)=>s+Number(x.target_sales||0),0),live:rows.reduce((s,x)=>s+Number(x.target_live||0),0),video:rows.reduce((s,x)=>s+Number(x.target_video||0),0),source:`Akumulasi target bulanan ${filterYear}`};
    }
    if(periodMode==="7d"||periodMode==="30d"){
      let sales=0,live=0,video=0,matched=0;const start=utcDate(range.start),end=utcDate(range.end);let cursor=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),1));
      while(cursor<=end){const y=cursor.getUTCFullYear(),m=cursor.getUTCMonth()+1;const monthStart=`${y}-${String(m).padStart(2,"0")}-01`,monthEnd=`${y}-${String(m).padStart(2,"0")}-${String(daysInMonth(y,m)).padStart(2,"0")}`;const days=overlapDays(range.start,range.end,monthStart,monthEnd);const row=targetRows.find(x=>Number(x.target_year)===y&&Number(x.target_month)===m);if(row&&days>0){const ratio=days/daysInMonth(y,m);sales+=Number(row.target_sales||0)*ratio;live+=Number(row.target_live||0)*ratio;video+=Number(row.target_video||0)*ratio;matched++}cursor=new Date(Date.UTC(y,m,1))}
      if(matched)return{sales,live,video,source:`Target prorata ${range.label}`};
    }
    if(Number(manual.target_sales||0)||Number(manual.target_live||0)||Number(manual.target_video||0))return{sales:Number(manual.target_sales||0),live:Number(manual.target_live||0),video:Number(manual.target_video||0),source:"Target legacy · atur target bulanan/tahunan"};
    return zero;
  },[targetRows,periodMode,filterYear,filterMonth,range.start,range.end,manual.target_sales,manual.target_live,manual.target_video]);

  if(!creatorId)return null;
  const k=data?.kpi||{},pk=prevData?.kpi||{};const spend=Number(k.product_value_sent||0)+Number(k.shipping_cost||0)+Number(k.commission||0)+Number(manual.ads_support||0);const prevSpend=Number(pk.product_value_sent||0)+Number(pk.shipping_cost||0)+Number(pk.commission||0)+Number(manual.ads_support||0);const roi=spend>0?Number(k.gmv||0)/spend:0,prevRoi=prevSpend>0?Number(pk.gmv||0)/prevSpend:0;const locked=manualSaved&&!editingManual;

  return <div className={`c360-shell ${expanded?"expanded":""} ${minimized?"minimized":""}`} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="c360-window"><div className="c360-bar"><div><strong>Customer 360 · {data?.creator?.name||data?.creator?.username||"Creator"}</strong><small>{range.label} · {range.start} → {range.end}{prevData?<>&nbsp; · vs {prevData.comparison_label||"previous period"}</>:""}</small></div><div className="button-row"><button onClick={()=>setMinimized(v=>!v)}>{minimized?"▣":"—"}</button><button onClick={()=>setExpanded(v=>!v)}>{expanded?"↙":"↗"}</button><button onClick={onClose}>×</button></div></div>{!minimized&&<div className="c360-body">
      {busy&&!data?<div className="empty-state"><strong>Loading Customer 360...</strong></div>:error?<div className="flash error">{error}</div>:data&&<>
        <div className="c360-head"><div><div className="c360-avatar">{String(data.creator?.name||"C").slice(0,1).toUpperCase()}</div><div><h2>{data.creator?.name||"-"}</h2><p>@{data.creator?.username||"-"} · {data.creator?.platform||"-"}</p></div></div><button disabled={locked} className={manual.favorite?"primary":"secondary"} onClick={()=>setManual({...manual,favorite:!manual.favorite})}>{manual.favorite?"★ Favorite":"☆ Favorite"}</button></div>

        <div className="c360-period-filter card">
          <div className="c360-period-buttons">{([["7d","7 Hari Terakhir"],["30d","30 Hari Terakhir"],["month","Per Bulan"],["year","Per Tahun"]] as [PeriodMode,string][]).map(([mode,label])=><button key={mode} className={periodMode===mode?"active":""} onClick={()=>setPeriodMode(mode)}>{label}</button>)}</div>
          <div className="c360-period-selects">{periodMode==="month"&&<label>Bulan<select value={filterMonth} onChange={e=>setFilterMonth(Number(e.target.value))}>{MONTHS.map((label,index)=><option key={label} value={index+1}>{label}</option>)}</select></label>}{(periodMode==="month"||periodMode==="year")&&<label>Tahun<select value={filterYear} onChange={e=>setFilterYear(Number(e.target.value))}>{availableYears.map(y=><option key={y} value={y}>{y}</option>)}</select></label>}{(periodMode==="7d"||periodMode==="30d")&&<span>Anchor data terakhir: <b>{anchorDate||"-"}</b></span>}<span className="c360-target-source">{effectiveTarget.source}</span></div>
        </div>

        <div className="c360-tabs">{[["overview","Overview"],["sales","Sales & ROI"],["products","Products"],["support","Support"],["stores","Stores"],["profile","Profile & Notes"]].map(([x,l])=><button className={tab===x?"active":""} key={x} onClick={()=>setTab(x)}>{l}</button>)}</div>

        {tab==="overview"&&<><div className="c360-kpis"><Metric label="GMV" value={money(k.gmv)} deltaValue={prevData?delta(k.gmv,pk.gmv):null}/><Metric label="Orders" value={num(k.orders)} deltaValue={prevData?delta(k.orders,pk.orders):null}/><Metric label="Qty" value={num(k.qty)} deltaValue={prevData?delta(k.qty,pk.qty):null}/><Metric label="Commission" value={money(k.commission)} deltaValue={prevData?delta(k.commission,pk.commission):null}/><Metric label="Spend" value={money(spend)} deltaValue={prevData?delta(spend,prevSpend):null}/><Metric label="ROI" value={roi.toFixed(2)+"x"} deltaValue={prevData?delta(roi,prevRoi):null}/><Metric label="Points" value={num(k.points)} deltaValue={prevData?delta(k.points,pk.points):null}/><Metric label="Samples" value={num(k.samples_sent)} deltaValue={prevData?delta(k.samples_sent,pk.samples_sent):null}/></div>
        <div className="c360-target-card card"><div className="section-head"><div><h3>Target Achievement · {range.label}</h3><p className="muted">{effectiveTarget.source}. Target rolling 7/30 hari dihitung prorata dari target bulanan.</p></div><div className="button-row"><button className="secondary" onClick={()=>openTarget("month",filterYear,filterMonth)}>Target Bulanan</button><button className="secondary" onClick={()=>openTarget("year",filterYear,0)}>Target Tahunan</button></div></div><TargetProgress label="Sales / GMV" actual={Number(k.gmv||0)} target={effectiveTarget.sales} formatter={money}/><TargetProgress label="LIVE Content" actual={Number(k.live_count||0)} target={effectiveTarget.live} formatter={num}/><TargetProgress label="Video Content" actual={Number(k.video_count||0)} target={effectiveTarget.video} formatter={num}/></div>
        <div className="grid"><div className="card"><h3>Status</h3><p>Top Creator: <b>{manual.top_creator?"Yes":"No"}</b></p><p>Agreement: <b>{data.agreement?.status||"Not Active"}</b></p><p>Program: <b>{manual.program_status||"Not Joined"}</b></p><p>Rating: <b>{Number(manual.rating||0).toFixed(1)}/5</b></p></div><div className="card"><h3>Target Periode Aktif</h3><p>Sales: <b>{money(effectiveTarget.sales)}</b></p><p>Live: <b>{num(effectiveTarget.live)}</b></p><p>Video: <b>{num(effectiveTarget.video)}</b></p><p>Top category: <b>{data.top_category||"-"}</b></p></div></div></>}

        {tab==="sales"&&<><div className="c360-kpis"><Metric label="GMV" value={money(k.gmv)} deltaValue={prevData?delta(k.gmv,pk.gmv):null}/><Metric label="Live GMV" value={money(k.live_gmv)} deltaValue={prevData?delta(k.live_gmv,pk.live_gmv):null}/><Metric label="Video GMV" value={money(k.video_gmv)} deltaValue={prevData?delta(k.video_gmv,pk.video_gmv):null}/><Metric label="Showcase GMV" value={money(k.showcase_gmv)} deltaValue={prevData?delta(k.showcase_gmv,pk.showcase_gmv):null}/><Metric label="Refund" value={money(k.refund)} deltaValue={prevData?delta(k.refund,pk.refund):null}/><Metric label="LIVE" value={num(k.live_count)} deltaValue={prevData?delta(k.live_count,pk.live_count):null}/><Metric label="Video" value={num(k.video_count)} deltaValue={prevData?delta(k.video_count,pk.video_count):null}/><Metric label="Buyers" value={num(k.buyers)} deltaValue={prevData?delta(k.buyers,pk.buyers):null}/></div><div className="card"><h3>Cost Composition</h3><CompareLine label="Value barang dikirim" current={Number(k.product_value_sent||0)} previous={prevData?Number(pk.product_value_sent||0):null}/><CompareLine label="Ongkir" current={Number(k.shipping_cost||0)} previous={prevData?Number(pk.shipping_cost||0):null}/><CompareLine label="Komisi" current={Number(k.commission||0)} previous={prevData?Number(pk.commission||0):null}/><p>Support Ads (manual): <b>{money(manual.ads_support)}</b></p><CompareLine label="Total Spend" current={spend} previous={prevData?prevSpend:null}/><p>ROI = GMV ÷ Spend: <b>{roi.toFixed(2)}x</b>{prevData&&<Delta value={delta(roi,prevRoi)}/>}</p></div></>}

        {tab==="products"&&<div className="card"><h3>Top Products</h3><Table rows={data.top_products||[]} cols={["product_name","sku","qty","orders","gmv","commission","points"]}/></div>}
        {tab==="support"&&<><div className="card"><h3>Samples & Shipping</h3><Table rows={data.samples||[]} cols={["sent_date","product_name","sku","qty","product_value","sample_status","tracking"]}/></div><div className="card"><h3>Last 3 Video Links</h3>{[0,1,2].map(i=><label key={i}>Video {i+1}<input disabled={locked} value={(manual.video_links||[])[i]||""} onChange={e=>{const links=[...(manual.video_links||[])];links[i]=e.target.value;setManual({...manual,video_links:links})}} placeholder="https://..."/></label>)}</div></>}
        {tab==="stores"&&<div className="card"><h3>Affiliated Stores</h3><Table rows={data.stores||[]} cols={["store_name","platform","status","gmv","orders","qty","spend","roi"]}/></div>}
        {tab==="profile"&&<><div className="grid"><div className="card"><h3>Creator Profile</h3><p>Phone: <b>{data.creator?.phone||"-"}</b></p><p>Address: <b>{data.creator?.address||"-"}</b></p><p>Social/Profile: {data.creator?.profile_url?<a href={data.creator.profile_url} target="_blank" rel="noreferrer">Open Profile</a>:"-"}</p><p>Payment type: <b>{data.creator?.payment_type||"-"}</b></p><p>Ratecard: <b>{money(data.creator?.ratecard)}</b></p><p>Notes: {data.creator?.notes||"-"}</p></div><div className="card"><div className="section-head"><h3>Manual Management</h3>{locked&&<span className="status-pill s-paid">Data tersimpan ✓</span>}</div><label>Rating<select disabled={locked} value={manual.rating||0} onChange={e=>setManual({...manual,rating:Number(e.target.value)})}>{[0,1,2,3,4,5].map(v=><option key={v} value={v}>{v}</option>)}</select></label><label>Program Status<select disabled={locked} value={manual.program_status||"Not Joined"} onChange={e=>setManual({...manual,program_status:e.target.value})}><option>Not Joined</option><option>Invited</option><option>Active</option><option>Paused</option><option>Completed</option></select></label><label className="inline-check"><input disabled={locked} type="checkbox" checked={Boolean(manual.top_creator)} onChange={e=>setManual({...manual,top_creator:e.target.checked})}/>Mark as Top Creator</label><label>Ads Support<input disabled={locked} type="number" value={manual.ads_support||0} onChange={e=>setManual({...manual,ads_support:e.target.value})}/></label><p className="muted">Target Sales/LIVE/Video sekarang dikelola per bulan dan per tahun melalui Target Management.</p></div></div>
        <div className="card c360-target-management"><div className="section-head"><div><h3>Target Management</h3><p className="muted">Simpan target creator berdasarkan bulan atau tahun. Target ini otomatis mengikuti filter metrik Customer 360.</p></div><div className="button-row"><button onClick={()=>openTarget("month",filterYear,filterMonth)}>+ Target Bulanan</button><button onClick={()=>openTarget("year",filterYear,0)}>+ Target Tahunan</button></div></div><Table rows={targetRows.map(row=>({...row,period:Number(row.target_month)===0?`Tahun ${row.target_year}`:`${MONTHS[Number(row.target_month)-1]} ${row.target_year}`}))} cols={["period","target_sales","target_live","target_video","notes"]}/></div></>}

        {showTargetEditor&&<div className="c360-target-editor card"><div className="section-head"><div><h3>{targetType==="month"?"Target Bulanan":"Target Tahunan"}</h3><p className="muted">Target disimpan khusus untuk creator ini.</p></div><button className="secondary" onClick={()=>setShowTargetEditor(false)}>×</button></div><div className="grid"><label>Tahun<select value={targetForm.target_year} onChange={e=>setTargetForm({...targetForm,target_year:Number(e.target.value)})}>{availableYears.map(y=><option key={y} value={y}>{y}</option>)}</select></label>{targetType==="month"&&<label>Bulan<select value={targetForm.target_month||filterMonth} onChange={e=>setTargetForm({...targetForm,target_month:Number(e.target.value)})}>{MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select></label>}<label>Target Sales / GMV<input type="number" min="0" value={targetForm.target_sales} onChange={e=>setTargetForm({...targetForm,target_sales:e.target.value})}/></label><label>Target LIVE<input type="number" min="0" value={targetForm.target_live} onChange={e=>setTargetForm({...targetForm,target_live:e.target.value})}/></label><label>Target Video<input type="number" min="0" value={targetForm.target_video} onChange={e=>setTargetForm({...targetForm,target_video:e.target.value})}/></label><label>Notes<input value={targetForm.notes} onChange={e=>setTargetForm({...targetForm,notes:e.target.value})}/></label></div><div className="button-row"><button className="primary" disabled={busy} onClick={()=>void saveTarget()}>{busy?"Saving...":"Save Target"}</button>{targetRows.some(x=>Number(x.target_year)===Number(targetForm.target_year)&&Number(x.target_month)===(targetType==="year"?0:Number(targetForm.target_month)))&&<button className="secondary" disabled={busy} onClick={()=>void deleteTarget()}>Delete Target</button>}</div>{targetMessage&&<div className="owner-inline-note">{targetMessage}</div>}</div>}

        {saveMessage&&<div className="flash success c360-save-message">{saveMessage}</div>}{targetMessage&&!showTargetEditor&&<div className="flash success c360-save-message">{targetMessage}</div>}
        <div className="c360-save">{locked?<button className="secondary" onClick={()=>{setEditingManual(true);setSaveMessage("")}}>✎ Edit Customer 360</button>:<><button className="primary" disabled={busy} onClick={saveManual}>{busy?"Saving...":manualSaved?"Save Change":"Save Customer 360"}</button>{manualSaved&&<button className="secondary" disabled={busy} onClick={()=>void cancelEdit()}>× Cancel</button>}</>}</div>
      </>}
    </div>}</div>
  </div>
}

function Metric({label,value,deltaValue}:{label:string;value:string;deltaValue:number|null}){return <div><span>{label}</span><b>{value}</b>{deltaValue!==null&&<Delta value={deltaValue}/>}</div>}
function Delta({value}:{value:number}){return <small className={`c360-delta ${value>0?"up":value<0?"down":"flat"}`}>{value>0?"↑":value<0?"↓":"→"} {Math.abs(value).toFixed(1)}% vs prev.</small>}
function CompareLine({label,current,previous}:{label:string;current:number;previous:number|null}){return <p>{label}: <b>{money(current)}</b>{previous!==null&&<Delta value={delta(current,previous)}/>}</p>}
function TargetProgress({label,actual,target,formatter}:{label:string;actual:number;target:number;formatter:(value:any)=>string}){const pct=target>0?actual/target*100:0;return <div className="c360-target-row"><div><strong>{label}</strong><span>{target>0?`${formatter(actual)} / ${formatter(target)}`:`${formatter(actual)} · target belum diset`}</span></div><div className="c360-progress"><i style={{width:`${Math.min(100,pct)}%`}}/><em style={{left:`calc(${Math.min(100,pct)}% - 5px)`}}/></div><b>{target>0?`${pct.toFixed(1)}%`:"—"}</b></div>}
function Table({rows,cols}:{rows:Row[];cols:string[]}){const [sort,setSort]=useState({key:cols[0]||"",asc:true});const sorted=useMemo(()=>sortRows(rows,sort.key,sort.asc),[rows,sort]);const toggle=(key:string)=>setSort(v=>({key,asc:v.key===key?!v.asc:true}));return rows.length?<div className="scroll"><table><thead><tr>{cols.map(c=><th key={c}><button className="table-sort" onClick={()=>toggle(c)}>{c.replaceAll("_"," ")}<span>{sort.key===c?(sort.asc?"↑":"↓"):"↕"}</span></button></th>)}</tr></thead><tbody>{sorted.map((r,i)=><tr key={r.id||i}>{cols.map(c=><td key={c}>{c==="gmv"||c==="commission"||c==="spend"||c==="product_value"||c==="target_sales"?money(r[c]):String(r[c]??"-")}</td>)}</tr>)}</tbody></table></div>:<div className="empty-state"><strong>Belum ada data.</strong></div>}
