"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
type Row=Record<string,any>;
const idDate=(d:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const monthStart=(d=new Date())=>{const x=new Date(d);x.setDate(1);return idDate(x)};
const dt=(v:any)=>v?new Date(v).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"-";
const idNow=()=>idDate(new Date());

export default function ListingFollowupCalendar({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [month,setMonth]=useState(monthStart()),[data,setData]=useState<Row>({}),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [selectedDate,setSelectedDate]=useState(idNow()),[quickView,setQuickView]=useState<"all"|"today"|"overdue"|"upcoming">("all");
 const [owner,setOwner]=useState(""),[platform,setPlatform]=useState(""),[channel,setChannel]=useState(""),[priority,setPriority]=useState("");
 const [newMemberEmail,setNewMemberEmail]=useState(""),[addingMember,setAddingMember]=useState(false),[memberMessage,setMemberMessage]=useState("");
 async function load(){
  setLoading(true);setError("");
  const result=await supabase.rpc("luma_listing_followup_calendar_v1",{p_workspace_id:workspaceId,p_month_start:month});
  if(result.error){setError(result.error.message);setData({})}else setData(result.data||{});
  setLoading(false);
 }
 useEffect(()=>{
  void load();
  const refresh=()=>void load();
  window.addEventListener("lumaway-database-updated",refresh);
  window.addEventListener("lumaway-team-updated",refresh);
  return()=>{window.removeEventListener("lumaway-database-updated",refresh);window.removeEventListener("lumaway-team-updated",refresh)};
 },[workspaceId,month]);
 function shiftMonth(delta:number){const d=new Date(month+"T12:00:00");d.setMonth(d.getMonth()+delta);const next=monthStart(d);setMonth(next);setSelectedDate(next);setQuickView("all")}
 function open(item:Row){window.dispatchEvent(new CustomEvent("lumaway-global-select",{detail:{type:"listing",id:item.id,title:item.creator_name}}))}
 async function move(item:Row,targetDate:string){
  if(!item.next_follow_up_at)return;
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date(item.next_follow_up_at));
  const hh=String(parts.find(x=>x.type==="hour")?.value||"09").padStart(2,"0");
  const mm=String(parts.find(x=>x.type==="minute")?.value||"00").padStart(2,"0");
  // Always convert in Asia/Jakarta; browser local timezone may be different.
  const target=new Date(targetDate+"T"+hh+":"+mm+":00+07:00");
  const result=await supabase.from("listings").update({next_follow_up_at:target.toISOString(),follow_up_completed_at:null}).eq("workspace_id",workspaceId).eq("id",item.id);
  if(result.error){setError(result.error.message);return}
  window.dispatchEvent(new Event("lumaway-database-updated"));
 }
 async function addMember(){
  if(!newMemberEmail.trim())return;
  setAddingMember(true);setMemberMessage("");
  const response=await supabase.rpc("luma_workspace_add_existing_member_v1",{p_workspace_id:workspaceId,p_email:newMemberEmail.trim()});
  if(response.error)setMemberMessage(response.error.message);
  else if(!response.data?.ok)setMemberMessage(response.data?.message||"Email belum terdaftar.");
  else{
   setMemberMessage((response.data.already_member?"Sudah terdaftar: ":"Anggota ditambahkan: ")+(response.data.name||newMemberEmail));
   setNewMemberEmail("");
   window.dispatchEvent(new Event("lumaway-team-updated"));
  }
  setAddingMember(false);
 }
 const raw=(data.items||[]) as Row[];
 const matches=(x:Row)=>(!owner||x.follow_up_owner_user_id===owner)&&(!platform||x.platform===platform)&&(!channel||x.follow_up_channel===channel)&&(!priority||x.follow_up_priority===priority);
 const items=raw.filter(matches);
 const todayDate=idNow();
 const start=new Date(month+"T12:00:00"),firstDay=(start.getDay()+6)%7,days=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();
 const cells=Array.from({length:firstDay+days},(_,i)=>i<firstDay?null:i-firstDay+1);
 const byDate=new Map<string,Row[]>();
 for(const x of items){const key=idDate(new Date(x.next_follow_up_at));byDate.set(key,[...(byDate.get(key)||[]),x])}
 const owners=(data.workload||[]) as Row[];
 const platforms=[...new Set(raw.map(x=>x.platform).filter(Boolean))];
 const channels=[...new Set(raw.map(x=>x.follow_up_channel).filter(Boolean))];
 const overdue=((data.overdue||[]) as Row[]).filter(matches);
 const today=idNow();
 const upcoming=items.filter(x=>x.next_follow_up_at&&idDate(new Date(x.next_follow_up_at))>=today&&
   new Date(x.next_follow_up_at).getTime()<Date.now()+7*86400000 &&
   (!x.follow_up_completed_at||new Date(x.follow_up_completed_at)<new Date(x.next_follow_up_at)));
 const reminders=([...overdue.map(x=>({...x,reminder_state:"overdue"})),...upcoming.map(x=>({...x,reminder_state:idDate(new Date(x.next_follow_up_at))===today?"today":"upcoming"}))] as Row[])
   .sort((a,b)=>String(a.next_follow_up_at).localeCompare(String(b.next_follow_up_at))).slice(0,12);
 const selectedItems=items.filter(x=>x.next_follow_up_at&&idDate(new Date(x.next_follow_up_at))===selectedDate);
 const workloadScheduled=owners.reduce((a,x)=>a+Number(x.scheduled||0),0);
 const workloadDone=owners.reduce((a,x)=>a+Number(x.completed||0),0);
 const workloadUrgent=owners.reduce((a,x)=>a+Number(x.high_priority||0),0);
 const progress=workloadScheduled+workloadDone>0?Math.round(100*workloadDone/(workloadScheduled+workloadDone)):0;
 return <section className="listing-calendar">
  <header><div><span>FOLLOW-UP PLANNER</span><h3>Kalender & Team Workload</h3><p>Jadwal dari Listing otomatis masuk ke kalender dan pengingat PIC. Tarik kartu untuk menjadwal ulang.</p></div><div className="lc-month"><button onClick={()=>shiftMonth(-1)}>‹</button><strong>{new Date(month+"T12:00:00").toLocaleDateString("id-ID",{month:"long",year:"numeric"})}</strong><button onClick={()=>shiftMonth(1)}>›</button></div></header>
  <div className="lc-team-overview">
    <button className={quickView==="today"?"active":""} onClick={()=>{setQuickView("today");setSelectedDate(todayDate);setMonth(monthStart())}}>
      <small>FOLLOW-UP HARI INI</small><strong>{items.filter(x=>x.next_follow_up_at&&idDate(new Date(x.next_follow_up_at))===todayDate).length}</strong><span>Jadwal hari ini</span></button>
    <button className={quickView==="overdue"?"active":""} onClick={()=>setQuickView("overdue")}>
      <small>PERLU PERHATIAN</small><strong>{overdue.length}</strong><span>Overdue</span></button>
    <button className={quickView==="upcoming"?"active":""} onClick={()=>setQuickView("upcoming")}>
      <small>7 HARI MENDATANG</small><strong>{upcoming.length}</strong><span>Jadwal terdekat</span></button>
    <button className={quickView==="all"?"active":""} onClick={()=>setQuickView("all")}>
      <small>PROGRESS TIM</small><strong>{progress}%</strong><span>{workloadDone} selesai · {workloadScheduled} terjadwal</span>
      <i className="lc-progress-track"><em style={{width:progress+"%"}}/></i></button>
  </div>
  <div className="lc-filters"><select value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Semua PIC</option>{owners.map(x=><option key={x.user_id} value={x.user_id}>{x.name}</option>)}</select><select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="">Semua Platform</option>{platforms.map(x=><option key={x}>{x}</option>)}</select><select value={channel} onChange={e=>setChannel(e.target.value)}><option value="">Semua Channel</option>{channels.map(x=><option key={x}>{x}</option>)}</select><select value={priority} onChange={e=>setPriority(e.target.value)}><option value="">Semua Prioritas</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select><button onClick={()=>void load()}>Refresh</button></div>
  {error&&<div className="listing-v2-alert error">{error}</div>}
  <div className="lc-calendar-reminders-layout">
   {loading?<div className="listing-v2-empty small">Memuat kalender...</div>:<div className="lc-calendar-wrap"><div className="lc-calendar"><div className="lc-weekdays">{["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map(x=><span key={x}>{x}</span>)}</div><div className="lc-grid">{cells.map((day,i)=>{
    if(!day)return <div key={"blank-"+i} className="lc-day blank"/>;
    const key=month.slice(0,7)+"-"+String(day).padStart(2,"0"),list=byDate.get(key)||[];
    return <div key={key} className={"lc-day "+(key===today?"is-today ":"")+(key===selectedDate?"is-selected":"")} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=Number(e.dataTransfer.getData("text/listing-id"));const item=raw.find(x=>Number(x.id)===id);if(item)void move(item,key)}}>
     <button type="button" className="lc-date" aria-label={"Lihat agenda "+key} onClick={()=>{setSelectedDate(key);setQuickView("all")}}><b>{day}</b><span>{list.length||""}</span></button>
     <div className="lc-events">{list.slice(0,5).map(x=><button key={x.id} draggable onDragStart={e=>e.dataTransfer.setData("text/listing-id",String(x.id))} onClick={()=>open(x)} className={"priority-"+(x.follow_up_priority||"normal")}><strong>{x.creator_name||"Creator"}</strong><small>{new Date(x.next_follow_up_at).toLocaleTimeString("id-ID",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit"})} · {x.follow_up_channel||"-"}</small>{x.follow_up_owner_name&&<em>{x.follow_up_owner_name}</em>}</button>)}{list.length>5&&<span className="lc-more">+{list.length-5} lainnya</span>}</div>
    </div>;
   })}</div></div></div>}
   <aside className="lc-reminders">
    <section className="lc-selected-agenda"><header><span>AGENDA TERPILIH</span><h4>{new Date(selectedDate+"T12:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}</h4></header>
      {selectedItems.length?<div>{selectedItems.slice(0,8).map(x=><button key={x.id} onClick={()=>open(x)}>
        <b>{x.creator_name||"Creator"}</b><small>{dt(x.next_follow_up_at)} · {x.follow_up_owner_name||"PIC belum dipilih"}</small></button>)}</div>:
        <p>Belum ada jadwal follow-up pada tanggal ini. Pilih tanggal lain untuk melihat agenda.</p>}
    </section>
    <header><span>PERLU DITINDAKLANJUTI</span><h4>Pengingat Follow-up</h4><small>{overdue.length} terlambat · {upcoming.length} dalam 7 hari</small></header>
    {reminders.length?<div className="lc-reminder-list">{reminders.filter(x=>quickView==="all"||quickView==="today"&&x.reminder_state==="today"||quickView==="overdue"&&x.reminder_state==="overdue"||quickView==="upcoming"&&x.reminder_state==="upcoming").map(x=><button key={x.id} className={"lc-reminder "+x.reminder_state} onClick={()=>open(x)}><span>{x.reminder_state==="overdue"?"Terlambat":x.reminder_state==="today"?"Hari ini":"Mendatang"}</span><b>{x.creator_name||"Creator"}</b><small>{dt(x.next_follow_up_at)} · {x.follow_up_owner_name||"Belum ada PIC"}</small><small>{x.next_action||x.follow_up_channel||"Buka listing untuk tindak lanjut"}</small></button>)}</div>:<div className="lc-reminders-empty"><b>Belum ada follow-up pada filter ini</b><p>Buat atau edit Listing, isi Next Follow Up dan PIC agar jadwal muncul otomatis.</p></div>}
   </aside>
  </div>
  <div className="lc-workload"><header><span>TEAM WORKLOAD</span><h4>Follow-up per PIC bulan ini</h4><p>Berdasarkan anggota aktif dalam satu workspace.</p></header><div>{owners.map(x=><article key={x.user_id}><div><strong>{x.name||"Anggota Tim"}</strong><small>{x.scheduled} terjadwal · {x.completed} selesai</small></div><span>{x.overdue} terlambat</span><span>{x.today} hari ini</span><span>{x.high_priority} penting</span></article>)}</div>
   <div className="lc-add-member"><div><b>Tambah PIC ke workspace</b><small>Gunakan email akun Lumaway yang sudah terdaftar. Owner workspace dapat menambahkan anggota untuk mengelola Listing yang sama.</small></div><input type="email" value={newMemberEmail} onChange={e=>setNewMemberEmail(e.target.value)} placeholder="email@anggota.com" aria-label="Email anggota tim"/><button disabled={addingMember||!newMemberEmail.trim()} onClick={()=>void addMember()}>{addingMember?"Memeriksa...":"+ Tambah Anggota"}</button></div>
   {memberMessage&&<p className="lc-member-message" role="status">{memberMessage}</p>}
   <button className="lc-team-invite-link" onClick={async()=>{
      const url="https://app.lumaway.online/login?workspace="+encodeURIComponent(workspaceId);
      try{await navigator.clipboard.writeText(url);setMemberMessage("Link akses workspace tersalin. Kirim hanya kepada anggota yang sudah Anda tambahkan.")}catch{setMemberMessage(url)}
    }}>Salin link login workspace untuk anggota terdaftar</button>
  </div>
 </section>;
}
