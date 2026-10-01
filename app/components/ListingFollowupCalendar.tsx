"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
type Row=Record<string,any>;

const idDate=(d:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const monthStart=(d=new Date())=>{const x=new Date(d);x.setDate(1);return idDate(x)};
const dt=(v:any)=>v?new Date(v).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"-";

export default function ListingFollowupCalendar({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [month,setMonth]=useState(monthStart()),[data,setData]=useState<Row>({}),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [owner,setOwner]=useState(""),[platform,setPlatform]=useState(""),[channel,setChannel]=useState(""),[priority,setPriority]=useState("");
 async function load(){
   setLoading(true);setError("");
   const x=await supabase.rpc("luma_listing_followup_calendar_v1",{p_workspace_id:workspaceId,p_month_start:month});
   if(x.error){setError(x.error.message);setData({})}else setData(x.data||{});
   setLoading(false);
 }
 useEffect(()=>{void load()},[workspaceId,month]);
 function shiftMonth(delta:number){const d=new Date(month+"T12:00:00");d.setMonth(d.getMonth()+delta);setMonth(monthStart(d))}
 function open(item:Row){window.dispatchEvent(new CustomEvent("lumaway-global-select",{detail:{type:"listing",id:item.id,title:item.creator_name}}))}
 async function move(item:Row,targetDate:string){
   if(!item.next_follow_up_at)return;
   const old=new Date(item.next_follow_up_at);
   const [y,m,d]=targetDate.split("-").map(Number);
   const jakartaParts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(old);
   const hh=Number(jakartaParts.find(x=>x.type==="hour")?.value||9),mm=Number(jakartaParts.find(x=>x.type==="minute")?.value||0);
   const local=new Date(y,m-1,d,hh,mm,0,0);
   const res=await supabase.from("listings").update({next_follow_up_at:local.toISOString(),follow_up_completed_at:null}).eq("workspace_id",workspaceId).eq("id",item.id);
   if(res.error){setError(res.error.message);return}
   window.dispatchEvent(new Event("lumaway-database-updated"));await load();
 }
 const raw=(data.items||[]) as Row[];
 const items=raw.filter(x=>(!owner||x.follow_up_owner_user_id===owner)&&(!platform||x.platform===platform)&&(!channel||x.follow_up_channel===channel)&&(!priority||x.follow_up_priority===priority));
 const start=new Date(month+"T12:00:00"),firstDay=(start.getDay()+6)%7,days=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();
 const cells=Array.from({length:firstDay+days},(_,i)=>i<firstDay?null:i-firstDay+1);
 const byDate=new Map<string,Row[]>();for(const x of items){const key=idDate(new Date(x.next_follow_up_at));byDate.set(key,[...(byDate.get(key)||[]),x])}
 const owners=(data.workload||[]) as Row[];
 const platforms=[...new Set(raw.map(x=>x.platform).filter(Boolean))];
 const channels=[...new Set(raw.map(x=>x.follow_up_channel).filter(Boolean))];
 const overdue=((data.overdue||[]) as Row[]).filter(x=>(!owner||x.follow_up_owner_user_id===owner)&&(!platform||x.platform===platform)&&(!channel||x.follow_up_channel===channel)&&(!priority||x.follow_up_priority===priority)).slice(0,12);
 return <section className="listing-calendar">
  <header><div><span>FOLLOW-UP PLANNER</span><h3>Calendar & Team Workload</h3><p>Atur jadwal follow-up creator dan pindahkan tanggal dengan drag & drop.</p></div><div className="lc-month"><button onClick={()=>shiftMonth(-1)}>‹</button><strong>{new Date(month+"T12:00:00").toLocaleDateString("id-ID",{month:"long",year:"numeric"})}</strong><button onClick={()=>shiftMonth(1)}>›</button></div></header>
  <div className="lc-filters"><select value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Semua PIC</option>{owners.map(x=><option key={x.user_id} value={x.user_id}>{x.name}</option>)}</select><select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="">Semua Platform</option>{platforms.map(x=><option key={x}>{x}</option>)}</select><select value={channel} onChange={e=>setChannel(e.target.value)}><option value="">Semua Channel</option>{channels.map(x=><option key={x}>{x}</option>)}</select><select value={priority} onChange={e=>setPriority(e.target.value)}><option value="">Semua Priority</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select><button onClick={()=>void load()}>Refresh</button></div>
  {error&&<div className="listing-v2-alert error">{error}</div>}
  {overdue.length>0&&<div className="lc-overdue"><div className="lc-overdue-head"><b>Overdue</b><span>{overdue.length} follow-up perlu perhatian</span></div><div className="lc-overdue-list">{overdue.map(x=><button key={x.id} onClick={()=>open(x)}><strong>{x.creator_name||"Creator"}</strong><small>{dt(x.next_follow_up_at)} · {x.follow_up_channel||"Channel belum ditentukan"}</small></button>)}</div></div>}
  {loading?<div className="listing-v2-empty small">Memuat calendar...</div>:<div className="lc-calendar-wrap"><div className="lc-calendar"><div className="lc-weekdays">{["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map(x=><span key={x}>{x}</span>)}</div><div className="lc-grid">{cells.map((day,i)=>{if(!day)return <div key={"blank-"+i} className="lc-day blank"/>;const key=`${month.slice(0,7)}-${String(day).padStart(2,"0")}`,list=byDate.get(key)||[];return <div key={key} className="lc-day" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=Number(e.dataTransfer.getData("text/listing-id"));const item=raw.find(x=>Number(x.id)===id);if(item)void move(item,key)}}><div className="lc-date"><b>{day}</b><span>{list.length||""}</span></div><div className="lc-events">{list.slice(0,5).map(x=><button key={x.id} draggable onDragStart={e=>e.dataTransfer.setData("text/listing-id",String(x.id))} onClick={()=>open(x)} className={"priority-"+(x.follow_up_priority||"normal")}><strong>{x.creator_name||"Creator"}</strong><small>{new Date(x.next_follow_up_at).toLocaleTimeString("id-ID",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit"})} · {x.follow_up_channel||"-"}</small>{x.follow_up_owner_name&&<em>{x.follow_up_owner_name}</em>}</button>)}{list.length>5&&<span className="lc-more">+{list.length-5} lainnya</span>}</div></div>})}</div></div></div>}
  <div className="lc-workload"><header><span>TEAM WORKLOAD</span><h4>Follow-up per PIC bulan ini</h4></header><div>{owners.map(x=><article key={x.user_id}><div><strong>{x.name||"Member"}</strong><small>{x.scheduled} scheduled · {x.completed} completed</small></div><span>{x.overdue} overdue</span><span>{x.today} today</span><span>{x.high_priority} high/urgent</span></article>)}</div></div>
 </section>
}
