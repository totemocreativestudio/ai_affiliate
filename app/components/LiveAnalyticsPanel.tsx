"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

const rp=(v:any)=>"Rp "+Math.round(Number(v||0)).toLocaleString("id-ID");
const no=(v:any)=>Math.round(Number(v||0)).toLocaleString("id-ID");
const range=()=>{const d=new Date(),y=d.getFullYear(),m=d.getMonth();return{start:new Date(y,m,1).toISOString().slice(0,10),end:new Date(y,m+1,0).toISOString().slice(0,10)}};

function BarChart({items,labelKey,valueKey,formatter=rp}:{items:any[];labelKey:string;valueKey:string;formatter?:(v:any)=>string}){
 const max=Math.max(...items.map(x=>Number(x[valueKey]||0)),1);
 return <div className="la-bars">{items.slice(0,10).map((x,i)=><div key={i}><div className="la-bar-label"><span>{String(x[labelKey]??"-")}</span><b>{formatter(x[valueKey])}</b></div><div className="la-bar-track"><i style={{width:String(Number(x[valueKey]||0)/max*100)+"%"}}/></div></div>)}</div>
}

function Donut({items}:{items:any[]}){
 const total=items.reduce((s,x)=>s+Number(x.gmv||0),0)||1;
 let acc=0;
 const parts=items.slice(0,5).map((x,i)=>{const start=acc/total*100;acc+=Number(x.gmv||0);const end=acc/total*100;return {start,end,i,name:x.platform||"Other",gmv:x.gmv}});
 const bg=parts.map((p,i)=>"var(--c"+i+") "+p.start+"% "+p.end+"%").join(",");
 return <div className="la-donut-wrap"><div className="la-donut" style={{background:"conic-gradient("+bg+")"} as any}><div><b>{rp(total)}</b><span>Total GMV</span></div></div><div className="la-donut-legend">{parts.map((p,i)=><div key={i}><i style={{background:"var(--c"+i+")"}}/><span>{p.name}</span><b>{Math.round((Number(p.gmv||0)/total)*1000)/10}%</b></div>)}</div></div>
}

export default function LiveAnalyticsPanel({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]),r=range();
 const [start,setStart]=useState(r.start),[end,setEnd]=useState(r.end),[data,setData]=useState<any>({}),[metric,setMetric]=useState("gmv"),[loading,setLoading]=useState(true);
 async function load(){setLoading(true);const x=await supabase.rpc("luma_live_analytics_v1",{p_workspace_id:workspaceId,p_start:start,p_end:end});setData(x.data||{});setLoading(false)}
 useEffect(()=>{void load()},[workspaceId,start,end]);
 const byDay=data.by_day||[],byHour=data.by_hour||[],byHost=data.by_host||[],byGimmick=data.by_gimmick||[],byPlatform=data.by_platform||[],bySession=data.by_session||[];
 const points=byDay.map((x:any)=>Number(x[metric]||0)),max=Math.max(...points,1);
 const path=points.length>1?points.map((v:number,i:number)=>(i?"L":"M")+" "+i/(points.length-1)*100+" "+(90-v/max*72)).join(" "):"";
 const heatMax=Math.max(...byHour.map((x:any)=>Number(x.gmv||0)),1);
 return <div className="live-analytics-panel">
  <div className="la-toolbar"><div><input type="date" value={start} onChange={e=>setStart(e.target.value)}/><span>→</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></div><div>{[["gmv","GMV"],["orders","Orders"],["avg_viewers","Viewer"]].map(([k,l])=><button key={k} className={metric===k?"active":""} onClick={()=>setMetric(k)}>{l}</button>)}</div></div>
  {loading?<div className="live-loading">Mengolah visual Live Analytics...</div>:<>
   <div className="la-grid-main">
    <section className="la-card la-line"><header><div><span>TREND</span><h2>{metric==="gmv"?"GMV":metric==="orders"?"Orders":"Average Viewer"} per hari</h2></div><small>{byDay.length} hari</small></header><div>{points.length>1?<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d={path} fill="none" vectorEffect="non-scaling-stroke"/><line x1="0" y1="94" x2="100" y2="94"/></svg>:<div className="live-empty">Belum cukup data harian.</div>}</div></section>
    <section className="la-card"><header><div><span>CHANNEL SHARE</span><h2>GMV per platform</h2></div></header><Donut items={byPlatform}/></section>
   </div>

   <div className="la-grid-two">
    <section className="la-card"><header><div><span>HOST COMPARISON</span><h2>GMV per host</h2></div></header><BarChart items={byHost} labelKey="host_name" valueKey="gmv"/></section>
    <section className="la-card"><header><div><span>GIMMICK COMPARISON</span><h2>GMV per gimmick</h2></div></header><BarChart items={byGimmick} labelKey="gimmick" valueKey="gmv"/></section>
   </div>

   <div className="la-grid-two">
    <section className="la-card"><header><div><span>HISTOGRAM</span><h2>GMV per jam</h2></div></header><div className="la-hist">{byHour.map((x:any)=><div key={x.hour_bucket}><span>{String(x.hour_bucket).padStart(2,"0")}</span><div><i style={{height:String(Math.max(5,Number(x.gmv||0)/heatMax*100))+"%"}}/></div><small>{rp(x.gmv)}</small></div>)}</div></section>
    <section className="la-card"><header><div><span>PEAK HOUR HEATMAP</span><h2>Intensitas performa</h2></div></header><div className="la-heat">{Array.from({length:24},(_,h)=>{const x=byHour.find((z:any)=>Number(z.hour_bucket)===h);const ratio=x?Number(x.gmv||0)/heatMax:0;return <div key={h} style={{opacity:0.18+ratio*0.82}} title={String(h).padStart(2,"0")+":00 · "+rp(x?.gmv||0)}><b>{String(h).padStart(2,"0")}</b><span>{x?no(x.orders):"0"} ord</span></div>})}</div></section>
   </div>

   <section className="la-card"><header><div><span>SESSION COMPARISON</span><h2>Performa antar sesi</h2></div></header><div className="la-session-table"><table><thead><tr><th>Session</th><th>Host</th><th>Gimmick</th><th>GMV</th><th>Orders</th><th>Peak Viewer</th><th>Avg Viewer</th><th>Revenue/Hour</th></tr></thead><tbody>{bySession.map((x:any)=><tr key={x.session_id}><td>{x.title}</td><td>{x.host_name||"-"}</td><td>{x.gimmick||"-"}</td><td>{rp(x.gmv)}</td><td>{no(x.orders)}</td><td>{no(x.peak_viewers)}</td><td>{no(x.avg_viewers)}</td><td>{Number(x.duration_minutes||0)>0?rp(Number(x.gmv||0)/(Number(x.duration_minutes)/60)):"-"}</td></tr>)}{!bySession.length&&<tr><td colSpan={8}>Belum ada data sesi.</td></tr>}</tbody></table></div></section>
  </>}
 </div>
}
