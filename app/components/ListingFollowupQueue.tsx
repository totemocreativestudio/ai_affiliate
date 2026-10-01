"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

const dt=(v:any)=>v?new Date(v).toLocaleString("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"-";

export default function ListingFollowupQueue({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [data,setData]=useState<any>({}),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){setLoading(true);const x=await supabase.rpc("luma_listing_followup_queue_v1",{p_workspace_id:workspaceId});if(x.error){setError(x.error.message);setData({})}else{setError("");setData(x.data||{})}setLoading(false)}
 useEffect(()=>{void load();const refresh=()=>void load();window.addEventListener("lumaway-database-updated",refresh);return()=>window.removeEventListener("lumaway-database-updated",refresh)},[workspaceId]);
 async function done(id:number){const x=await supabase.from("listings").update({follow_up_completed_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",id);if(x.error)return setError(x.error.message);window.dispatchEvent(new Event("lumaway-database-updated"));await load()}
 async function reschedule(id:number,current?:string|null){const initial=current?new Date(new Date(current).getTime()-new Date(current).getTimezoneOffset()*60000).toISOString().slice(0,16):"";const value=window.prompt("Jadwal follow-up baru (YYYY-MM-DDTHH:mm)",initial);if(!value)return;const d=new Date(value);if(Number.isNaN(d.getTime()))return setError("Format jadwal tidak valid.");const x=await supabase.from("listings").update({next_follow_up_at:d.toISOString(),follow_up_completed_at:null}).eq("workspace_id",workspaceId).eq("id",id);if(x.error)return setError(x.error.message);window.dispatchEvent(new Event("lumaway-database-updated"));await load()}
 function open(item:any){window.dispatchEvent(new CustomEvent("lumaway-global-select",{detail:{type:"listing",id:item.id,title:item.creator_name}}))}
 const s=data.summary||{},items=(data.items||[]).filter((x:any)=>["overdue","today","upcoming"].includes(x.queue_status)).slice(0,20);
 return <section className="listing-followup-queue">
  <header><div><span>FOLLOW-UP QUEUE</span><h3>Creator yang perlu ditindaklanjuti</h3><p>Prioritas berdasarkan jadwal, urgency, dan channel follow-up.</p></div><button onClick={()=>void load()}>Refresh</button></header>
  <div className="lfq-summary"><article className="overdue"><span>Overdue</span><strong>{Number(s.overdue||0)}</strong></article><article><span>Hari Ini</span><strong>{Number(s.today||0)}</strong></article><article><span>7 Hari</span><strong>{Number(s.upcoming||0)}</strong></article><article><span>Belum Dijadwalkan</span><strong>{Number(s.no_schedule||0)}</strong></article></div>
  {error&&<div className="listing-v2-alert error">{error}</div>}
  {loading?<div className="listing-v2-empty small">Memuat follow-up queue...</div>:items.length?<div className="lfq-list">{items.map((x:any)=><article key={x.id} className={"lfq-"+x.queue_status}><div className="lfq-time"><b>{x.queue_status==="overdue"?"OVERDUE":x.queue_status==="today"?"TODAY":"UPCOMING"}</b><span>{dt(x.next_follow_up_at)}</span></div><div className="lfq-main"><strong>{x.creator_name||"Creator"}</strong><small>{[x.platform,x.product_name||x.sku].filter(Boolean).join(" · ")}</small><div>{x.follow_up_channel&&<span>{x.follow_up_channel}</span>}<em>{x.follow_up_priority||"normal"}</em>{x.follow_up_owner_name&&<span className="pic">PIC: {x.follow_up_owner_name}</span>}</div></div><div className="lfq-action"><button onClick={()=>open(x)}>Detail</button><button onClick={()=>void reschedule(x.id,x.next_follow_up_at)}>Jadwal Ulang</button><button className="done" onClick={()=>void done(x.id)}>Selesai</button></div></article>)}</div>:<div className="listing-v2-empty small">Tidak ada follow-up yang jatuh tempo dalam 7 hari.</div>}
 </section>
}
