"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

export default function LiveDataHealthPanel({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]),[data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[msg,setMsg]=useState("");
 async function load(){setLoading(true);setMsg("");const x=await supabase.rpc("luma_live_data_health_v1",{p_workspace_id:workspaceId});if(x.error){setMsg(x.error.message);setData(null)}else setData(x.data||{});setLoading(false)}
 useEffect(()=>{void load()},[workspaceId]);
 const issues=[
  ["Failed Import",Number(data?.failed_imports||0),"Periksa file atau mapping yang gagal."],
  ["Completed tanpa Performance",Number(data?.completed_without_performance||0),"Session selesai tetapi belum memiliki row performance."],
  ["Session tanpa Host",Number(data?.sessions_without_host||0),"Assign host agar Host 360 dan ranking akurat."],
  ["Campaign belum terhubung",Number(data?.campaign_sessions_unlinked||0),"Nama campaign ada tetapi campaign_id belum terhubung."],
  ["Jam belum terbaca",Number(data?.performance_without_hour||0),"Histogram dan heatmap membutuhkan hour bucket."],
 ];
 const score=Math.max(0,100-issues.reduce((s,x)=>s+Math.min(20,Number(x[1]||0)*5),0));
 return <div className="live-health-panel">
  <div className="lh-head"><div><span>END-TO-END QA</span><h2>Live Data Health</h2><p>Cek alur Host → Session → Upload → Performance → Analytics sebelum membaca hasil dashboard.</p></div><button onClick={()=>void load()}>Refresh Check</button></div>
  {msg&&<div className="live-upload-msg">{msg}</div>}
  {loading?<div className="live-loading">Menjalankan health check...</div>:<>
   <div className="lh-score"><div><strong>{score}</strong><span>/100</span></div><section><b>{score>=90?"Data pipeline sehat":score>=70?"Ada beberapa data yang perlu dicek":"Data pipeline perlu perhatian"}</b><p>Health score adalah indikator operasional, bukan kualitas bisnis.</p></section></div>
   <div className="lh-summary">{[["Host",data?.hosts],["Session",data?.sessions],["Performance Rows",data?.performance_rows],["Imports",data?.imports],["Campaign",data?.campaigns]].map(([l,v])=><article key={String(l)}><span>{l}</span><strong>{Number(v||0).toLocaleString("id-ID")}</strong></article>)}</div>
   <div className="lh-issues">{issues.map(([label,count,help])=><article key={String(label)} className={Number(count)>0?"warning":"ok"}><div><i>{Number(count)>0?"!":"✓"}</i><span><strong>{label}</strong><small>{help}</small></span></div><b>{Number(count).toLocaleString("id-ID")}</b></article>)}</div>
   <div className="lh-meta"><span>Latest metric: <b>{data?.latest_metric_date||"-"}</b></span><span>Latest import: <b>{data?.latest_import_at?new Date(data.latest_import_at).toLocaleString("id-ID"):"-"}</b></span></div>
  </>}
 </div>
}
