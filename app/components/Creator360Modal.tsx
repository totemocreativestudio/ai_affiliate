"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Props={workspaceId:string;creatorId:number|null;startDate:string;endDate:string;onClose:()=>void};
type Row=Record<string,any>;
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const num=(v:any)=>new Intl.NumberFormat("id-ID").format(Number(v||0));
const DEFAULT_MANUAL={favorite:false,rating:0,program_status:"Not Joined",top_creator:false,ads_support:0,target_sales:0,target_live:0,target_video:0,video_links:["","",""]};

function previousRange(start:string,end:string){
  if(!start||!end)return null;
  const s=new Date(`${start}T00:00:00Z`),e=new Date(`${end}T00:00:00Z`);
  if(Number.isNaN(s.getTime())||Number.isNaN(e.getTime()))return null;
  const sameMonth=s.getUTCFullYear()===e.getUTCFullYear()&&s.getUTCMonth()===e.getUTCMonth();
  const endOfMonth=new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth()+1,0));
  if(sameMonth&&s.getUTCDate()===1&&e.getUTCDate()===endOfMonth.getUTCDate()){
    const ps=new Date(Date.UTC(s.getUTCFullYear(),s.getUTCMonth()-1,1));
    const pe=new Date(Date.UTC(s.getUTCFullYear(),s.getUTCMonth(),0));
    return {start:ps.toISOString().slice(0,10),end:pe.toISOString().slice(0,10),label:`${ps.toISOString().slice(0,7)}`};
  }
  const days=Math.round((e.getTime()-s.getTime())/86400000)+1;
  const pe=new Date(s);pe.setUTCDate(pe.getUTCDate()-1);
  const ps=new Date(pe);ps.setUTCDate(ps.getUTCDate()-days+1);
  return {start:ps.toISOString().slice(0,10),end:pe.toISOString().slice(0,10),label:`${ps.toISOString().slice(0,10)} → ${pe.toISOString().slice(0,10)}`};
}
function delta(current:any,previous:any){const c=Number(current||0),p=Number(previous||0);if(!p)return c>0?100:0;return((c-p)/Math.abs(p))*100}
function sortRows(rows:Row[],key:string,asc:boolean){return[...rows].sort((a,b)=>{const av=a?.[key],bv=b?.[key];const an=Number(av),bn=Number(bv);if(av!==""&&bv!==""&&Number.isFinite(an)&&Number.isFinite(bn))return(an-bn)*(asc?1:-1);return String(av??"").localeCompare(String(bv??""),"id",{numeric:true,sensitivity:"base"})*(asc?1:-1)})}

export default function Creator360Modal({workspaceId,creatorId,startDate,endDate,onClose}:Props){
  const supabase=useMemo(()=>createClient(),[]);
  const [data,setData]=useState<Row|null>(null);const [prevData,setPrevData]=useState<Row|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [expanded,setExpanded]=useState(false);const [minimized,setMinimized]=useState(false);const [tab,setTab]=useState("overview");
  const [manual,setManual]=useState<Row>(DEFAULT_MANUAL);const [manualSaved,setManualSaved]=useState(false);const [editingManual,setEditingManual]=useState(false);const [saveMessage,setSaveMessage]=useState("");
  useEffect(()=>{if(!creatorId)return;void load()},[creatorId,startDate,endDate,workspaceId]);

  async function activity(start:string,end:string){
    if(!creatorId)return {};
    let query=supabase.from("sales").select("live_count,video_count,clicks,buyers,impressions,video_views,sample_content,sample_sent").eq("workspace_id",workspaceId).eq("creator_id",creatorId);
    if(start)query=query.gte("data_date",start);if(end)query=query.lte("data_date",end);
    const {data:rows,error:e}=await query;if(e)throw e;
    return (rows||[]).reduce((acc:Row,row:Row)=>{for(const key of ["live_count","video_count","clicks","buyers","impressions","video_views","sample_content","sample_sent"])acc[key]=Number(acc[key]||0)+Number(row[key]||0);return acc},{});
  }

  async function load(){
    if(!creatorId)return;
    setBusy(true);setError("");
    try{
      const pr=previousRange(startDate,endDate);
      const currentPromise=supabase.rpc("get_creator_360",{p_workspace_id:workspaceId,p_creator_id:creatorId,p_start_date:startDate||null,p_end_date:endDate||null});
      const previousPromise=pr?supabase.rpc("get_creator_360",{p_workspace_id:workspaceId,p_creator_id:creatorId,p_start_date:pr.start,p_end_date:pr.end}):Promise.resolve({data:null,error:null} as any);
      const profilePromise=supabase.from("creator_360_profiles").select("id").eq("workspace_id",workspaceId).eq("creator_id",creatorId).maybeSingle();
      const [currentRes,previousRes,profileRes,currentActivity,previousActivity]=await Promise.all([currentPromise,previousPromise,profilePromise,activity(startDate,endDate),pr?activity(pr.start,pr.end):Promise.resolve({})]);
      if(currentRes.error)throw currentRes.error;
      const row=Array.isArray(currentRes.data)?currentRes.data[0]:currentRes.data;
      const previous=Array.isArray(previousRes.data)?previousRes.data[0]:previousRes.data;
      if(row)row.kpi={...(row.kpi||{}),...currentActivity};
      if(previous)previous.kpi={...(previous.kpi||{}),...previousActivity};
      setData(row||null);setPrevData(previous?{...previous,comparison_label:pr?.label}:null);
      setManualSaved(Boolean(profileRes.data?.id));setEditingManual(false);
      if(row?.manual_profile)setManual({...DEFAULT_MANUAL,...row.manual_profile,video_links:Array.isArray(row.manual_profile.video_links)?row.manual_profile.video_links:["","",""]});
    }catch(e:any){setError(e?.message||"Gagal memuat Customer 360.")}finally{setBusy(false)}
  }

  async function saveManual(){
    if(!creatorId)return;setBusy(true);setError("");setSaveMessage("");
    const {error:e}=await supabase.from("creator_360_profiles").upsert({workspace_id:workspaceId,creator_id:creatorId,favorite:Boolean(manual.favorite),rating:Number(manual.rating||0),program_status:manual.program_status||"Not Joined",top_creator:Boolean(manual.top_creator),ads_support:Number(manual.ads_support||0),target_sales:Number(manual.target_sales||0),target_live:Number(manual.target_live||0),target_video:Number(manual.target_video||0),video_links:(manual.video_links||[]).slice(0,3),updated_at:new Date().toISOString()},{onConflict:"workspace_id,creator_id"});
    setBusy(false);if(e)return setError(e.message);setManualSaved(true);setEditingManual(false);setSaveMessage("Data Customer 360 disimpan ✓");await load();setSaveMessage("Data Customer 360 disimpan ✓");
  }
  async function cancelEdit(){setEditingManual(false);setSaveMessage("");await load()}

  if(!creatorId)return null;
  const k=data?.kpi||{},pk=prevData?.kpi||{};
  const spend=Number(k.product_value_sent||0)+Number(k.shipping_cost||0)+Number(k.commission||0)+Number(manual.ads_support||0);
  const prevSpend=Number(pk.product_value_sent||0)+Number(pk.shipping_cost||0)+Number(pk.commission||0)+Number(manual.ads_support||0);
  const roi=spend>0?Number(k.gmv||0)/spend:0,prevRoi=prevSpend>0?Number(pk.gmv||0)/prevSpend:0;
  const locked=manualSaved&&!editingManual;

  return <div className={`c360-shell ${expanded?"expanded":""} ${minimized?"minimized":""}`} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="c360-window"><div className="c360-bar"><div><strong>Customer 360 · {data?.creator?.name||data?.creator?.username||"Creator"}</strong><small>{startDate||"All data"} → {endDate||"All data"}{prevData?<>&nbsp; · vs {prevData.comparison_label||"previous period"}</>:""}</small></div><div className="button-row"><button onClick={()=>setMinimized(v=>!v)}>{minimized?"▣":"—"}</button><button onClick={()=>setExpanded(v=>!v)}>{expanded?"↙":"↗"}</button><button onClick={onClose}>×</button></div></div>{!minimized&&<div className="c360-body">
      {busy&&!data?<div className="empty-state"><strong>Loading Customer 360...</strong></div>:error?<div className="flash error">{error}</div>:data&&<>
        <div className="c360-head"><div><div className="c360-avatar">{String(data.creator?.name||"C").slice(0,1).toUpperCase()}</div><div><h2>{data.creator?.name||"-"}</h2><p>@{data.creator?.username||"-"} · {data.creator?.platform||"-"}</p></div></div><button disabled={locked} className={manual.favorite?"primary":"secondary"} onClick={()=>setManual({...manual,favorite:!manual.favorite})}>{manual.favorite?"★ Favorite":"☆ Favorite"}</button></div>
        <div className="c360-tabs">{[["overview","Overview"],["sales","Sales & ROI"],["products","Products"],["support","Support"],["stores","Stores"],["profile","Profile & Notes"]].map(([x,l])=><button className={tab===x?"active":""} key={x} onClick={()=>setTab(x)}>{l}</button>)}</div>

        {tab==="overview"&&<><div className="c360-kpis"><Metric label="GMV" value={money(k.gmv)} deltaValue={prevData?delta(k.gmv,pk.gmv):null}/><Metric label="Orders" value={num(k.orders)} deltaValue={prevData?delta(k.orders,pk.orders):null}/><Metric label="Qty" value={num(k.qty)} deltaValue={prevData?delta(k.qty,pk.qty):null}/><Metric label="Commission" value={money(k.commission)} deltaValue={prevData?delta(k.commission,pk.commission):null}/><Metric label="Spend" value={money(spend)} deltaValue={prevData?delta(spend,prevSpend):null}/><Metric label="ROI" value={roi.toFixed(2)+"x"} deltaValue={prevData?delta(roi,prevRoi):null}/><Metric label="Points" value={num(k.points)} deltaValue={prevData?delta(k.points,pk.points):null}/><Metric label="Samples" value={num(k.samples_sent)} deltaValue={prevData?delta(k.samples_sent,pk.samples_sent):null}/></div>
        <div className="c360-target-card card"><div className="section-head"><div><h3>Target Achievement</h3><p className="muted">Progress berjalan berdasarkan periode Customer 360 yang sedang dipilih.</p></div></div><TargetProgress label="Sales / GMV" actual={Number(k.gmv||0)} target={Number(manual.target_sales||0)} formatter={money}/><TargetProgress label="LIVE Content" actual={Number(k.live_count||0)} target={Number(manual.target_live||0)} formatter={num}/><TargetProgress label="Video Content" actual={Number(k.video_count||0)} target={Number(manual.target_video||0)} formatter={num}/></div>
        <div className="grid"><div className="card"><h3>Status</h3><p>Top Creator: <b>{manual.top_creator?"Yes":"No"}</b></p><p>Agreement: <b>{data.agreement?.status||"Not Active"}</b></p><p>Program: <b>{manual.program_status||"Not Joined"}</b></p><p>Rating: <b>{Number(manual.rating||0).toFixed(1)}/5</b></p></div><div className="card"><h3>Target</h3><p>Sales: <b>{money(manual.target_sales)}</b></p><p>Live: <b>{num(manual.target_live)}</b></p><p>Video: <b>{num(manual.target_video)}</b></p><p>Top category: <b>{data.top_category||"-"}</b></p></div></div></>}

        {tab==="sales"&&<><div className="c360-kpis"><Metric label="GMV" value={money(k.gmv)} deltaValue={prevData?delta(k.gmv,pk.gmv):null}/><Metric label="Live GMV" value={money(k.live_gmv)} deltaValue={prevData?delta(k.live_gmv,pk.live_gmv):null}/><Metric label="Video GMV" value={money(k.video_gmv)} deltaValue={prevData?delta(k.video_gmv,pk.video_gmv):null}/><Metric label="Showcase GMV" value={money(k.showcase_gmv)} deltaValue={prevData?delta(k.showcase_gmv,pk.showcase_gmv):null}/><Metric label="Refund" value={money(k.refund)} deltaValue={prevData?delta(k.refund,pk.refund):null}/><Metric label="LIVE" value={num(k.live_count)} deltaValue={prevData?delta(k.live_count,pk.live_count):null}/><Metric label="Video" value={num(k.video_count)} deltaValue={prevData?delta(k.video_count,pk.video_count):null}/><Metric label="Buyers" value={num(k.buyers)} deltaValue={prevData?delta(k.buyers,pk.buyers):null}/></div>
        <div className="card"><h3>Cost Composition</h3><CompareLine label="Value barang dikirim" current={Number(k.product_value_sent||0)} previous={prevData?Number(pk.product_value_sent||0):null}/><CompareLine label="Ongkir" current={Number(k.shipping_cost||0)} previous={prevData?Number(pk.shipping_cost||0):null}/><CompareLine label="Komisi" current={Number(k.commission||0)} previous={prevData?Number(pk.commission||0):null}/><p>Support Ads (manual): <b>{money(manual.ads_support)}</b></p><CompareLine label="Total Spend" current={spend} previous={prevData?prevSpend:null}/><p>ROI = GMV ÷ Spend: <b>{roi.toFixed(2)}x</b>{prevData&&<Delta value={delta(roi,prevRoi)}/>}</p></div></>}

        {tab==="products"&&<div className="card"><h3>Top Products</h3><Table rows={data.top_products||[]} cols={["product_name","sku","qty","orders","gmv","commission","points"]}/></div>}
        {tab==="support"&&<><div className="card"><h3>Samples & Shipping</h3><Table rows={data.samples||[]} cols={["sent_date","product_name","sku","qty","product_value","sample_status","tracking"]}/></div><div className="card"><h3>Last 3 Video Links</h3>{[0,1,2].map(i=><label key={i}>Video {i+1}<input disabled={locked} value={(manual.video_links||[])[i]||""} onChange={e=>{const links=[...(manual.video_links||[])];links[i]=e.target.value;setManual({...manual,video_links:links})}} placeholder="https://..."/></label>)}</div></>}
        {tab==="stores"&&<div className="card"><h3>Affiliated Stores</h3><Table rows={data.stores||[]} cols={["store_name","platform","status","gmv","orders","qty","spend","roi"]}/></div>}
        {tab==="profile"&&<div className="grid"><div className="card"><h3>Creator Profile</h3><p>Phone: <b>{data.creator?.phone||"-"}</b></p><p>Address: <b>{data.creator?.address||"-"}</b></p><p>Social/Profile: {data.creator?.profile_url?<a href={data.creator.profile_url} target="_blank" rel="noreferrer">Open Profile</a>:"-"}</p><p>Payment type: <b>{data.creator?.payment_type||"-"}</b></p><p>Ratecard: <b>{money(data.creator?.ratecard)}</b></p><p>Notes: {data.creator?.notes||"-"}</p></div><div className="card"><div className="section-head"><h3>Manual Management</h3>{locked&&<span className="status-pill s-paid">Data tersimpan ✓</span>}</div><label>Rating<select disabled={locked} value={manual.rating||0} onChange={e=>setManual({...manual,rating:Number(e.target.value)})}>{[0,1,2,3,4,5].map(v=><option key={v} value={v}>{v}</option>)}</select></label><label>Program Status<select disabled={locked} value={manual.program_status||"Not Joined"} onChange={e=>setManual({...manual,program_status:e.target.value})}><option>Not Joined</option><option>Invited</option><option>Active</option><option>Paused</option><option>Completed</option></select></label><label className="inline-check"><input disabled={locked} type="checkbox" checked={Boolean(manual.top_creator)} onChange={e=>setManual({...manual,top_creator:e.target.checked})}/>Mark as Top Creator</label><label>Ads Support<input disabled={locked} type="number" value={manual.ads_support||0} onChange={e=>setManual({...manual,ads_support:e.target.value})}/></label><label>Target Sales<input disabled={locked} type="number" value={manual.target_sales||0} onChange={e=>setManual({...manual,target_sales:e.target.value})}/></label><div className="grid"><label>Target Live<input disabled={locked} type="number" value={manual.target_live||0} onChange={e=>setManual({...manual,target_live:e.target.value})}/></label><label>Target Video<input disabled={locked} type="number" value={manual.target_video||0} onChange={e=>setManual({...manual,target_video:e.target.value})}/></label></div></div></div>}

        {saveMessage&&<div className="flash success c360-save-message">{saveMessage}</div>}
        <div className="c360-save">{locked?<button className="secondary" onClick={()=>{setEditingManual(true);setSaveMessage("")}}>✎ Edit Customer 360</button>:<><button className="primary" disabled={busy} onClick={saveManual}>{busy?"Saving...":manualSaved?"Save Change":"Save Customer 360"}</button>{manualSaved&&<button className="secondary" disabled={busy} onClick={()=>void cancelEdit()}>× Cancel</button>}</>}</div>
      </>}
    </div>}</div>
  </div>
}

function Metric({label,value,deltaValue}:{label:string;value:string;deltaValue:number|null}){return <div><span>{label}</span><b>{value}</b>{deltaValue!==null&&<Delta value={deltaValue}/>}</div>}
function Delta({value}:{value:number}){return <small className={`c360-delta ${value>0?"up":value<0?"down":"flat"}`}>{value>0?"↑":value<0?"↓":"→"} {Math.abs(value).toFixed(1)}% vs prev.</small>}
function CompareLine({label,current,previous}:{label:string;current:number;previous:number|null}){return <p>{label}: <b>{money(current)}</b>{previous!==null&&<Delta value={delta(current,previous)}/>}</p>}
function TargetProgress({label,actual,target,formatter}:{label:string;actual:number;target:number;formatter:(value:any)=>string}){const pct=target>0?actual/target*100:0;return <div className="c360-target-row"><div><strong>{label}</strong><span>{target>0?`${formatter(actual)} / ${formatter(target)}`:`${formatter(actual)} · target belum diset`}</span></div><div className="c360-progress"><i style={{width:`${Math.min(100,pct)}%`}}/><em style={{left:`calc(${Math.min(100,pct)}% - 5px)`}}/></div><b>{target>0?`${pct.toFixed(1)}%`:"—"}</b></div>}

function Table({rows,cols}:{rows:Row[];cols:string[]}){const [sort,setSort]=useState({key:cols[0]||"",asc:true});const sorted=useMemo(()=>sortRows(rows,sort.key,sort.asc),[rows,sort]);const toggle=(key:string)=>setSort(v=>({key,asc:v.key===key?!v.asc:true}));return rows.length?<div className="scroll"><table><thead><tr>{cols.map(c=><th key={c}><button className="table-sort" onClick={()=>toggle(c)}>{c.replaceAll("_"," ")}<span>{sort.key===c?(sort.asc?"↑":"↓"):"↕"}</span></button></th>)}</tr></thead><tbody>{sorted.map((r,i)=><tr key={r.id||i}>{cols.map(c=><td key={c}>{c==="gmv"||c==="commission"||c==="spend"||c==="product_value"?money(r[c]):String(r[c]??"-")}</td>)}</tr>)}</tbody></table></div>:<div className="empty-state"><strong>Belum ada data.</strong></div>}
