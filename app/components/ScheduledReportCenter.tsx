"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

type Schedule={id:string;name:string;report_type:string;cadence:string;timezone:string;recipients:string[];formats:string[];active:boolean;next_run_at:string;last_run_at:string|null};
const weekdays=["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
function isoLocal(date:Date,time="09:00"){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");return y+"-"+m+"-"+d+"T"+time+":00+07:00"}
function monthCells(anchor:Date){const first=new Date(anchor.getFullYear(),anchor.getMonth(),1),start=new Date(first);start.setDate(first.getDate()-first.getDay());return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})}

export default function ScheduledReportCenter({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [anchor,setAnchor]=useState(new Date());
  const [items,setItems]=useState<Schedule[]>([]);
  const [runs,setRuns]=useState<any[]>([]);
  const [open,setOpen]=useState(false);
  const [message,setMessage]=useState("");
  const [draft,setDraft]=useState({name:"Weekly Growth Report",report_type:"goal_forecast",cadence:"weekly",date:new Date().toISOString().slice(0,10),time:"09:00",recipients:""});

  async function load(){
    const [a,b]=await Promise.all([
      supabase.from("luma_scheduled_reports").select("id,name,report_type,cadence,timezone,recipients,formats,active,next_run_at,last_run_at").eq("workspace_id",workspaceId).order("next_run_at",{ascending:true}),
      supabase.from("luma_scheduled_report_runs").select("id,schedule_id,status,report_type,error_message,created_at,completed_at").eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(12)
    ]);
    if(a.error||b.error)setMessage("Scheduled Report belum dapat dimuat.");
    setItems((a.data||[]) as Schedule[]);setRuns(b.data||[]);
  }
  useEffect(()=>{void load()},[workspaceId]);

  async function createSchedule(){
    const recipients=draft.recipients.split(",").map(x=>x.trim()).filter(Boolean);
    const next=new Date(draft.date+"T"+draft.time+":00+07:00").toISOString();
    const result=await supabase.from("luma_scheduled_reports").insert({workspace_id:workspaceId,name:draft.name,report_type:draft.report_type,cadence:draft.cadence,timezone:"Asia/Jakarta",recipients,formats:["email"],active:true,next_run_at:next});
    if(result.error){setMessage(result.error.message);return}
    setOpen(false);setMessage("Jadwal report berhasil dibuat.");await load();
  }
  async function move(id:string,date:Date){
    const item=items.find(x=>x.id===id);if(!item)return;
    const old=new Date(item.next_run_at);
    const hh=String(old.getHours()).padStart(2,"0"),mm=String(old.getMinutes()).padStart(2,"0");
    const next=new Date(isoLocal(date,hh+":"+mm)).toISOString();
    const result=await supabase.from("luma_scheduled_reports").update({next_run_at:next,updated_at:new Date().toISOString()}).eq("id",id).eq("workspace_id",workspaceId);
    if(result.error){setMessage(result.error.message);return}
    setMessage("Jadwal dipindahkan.");await load();
  }
  async function toggle(item:Schedule){
    await supabase.from("luma_scheduled_reports").update({active:!item.active,updated_at:new Date().toISOString()}).eq("id",item.id).eq("workspace_id",workspaceId);await load();
  }
  async function remove(item:Schedule){
    if(!window.confirm("Hapus jadwal "+item.name+"?"))return;
    await supabase.from("luma_scheduled_reports").delete().eq("id",item.id).eq("workspace_id",workspaceId);await load();
  }

  const cells=monthCells(anchor);
  const inMonth=(d:Date)=>d.getMonth()===anchor.getMonth();
  const sameDay=(a:Date,b:Date)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();

  return <section id="scheduled-reports" className="legacy-page-anchor scheduled-report-page">
    <div className="sr-head"><div><div className="eyebrow">GROWTH & WORKFLOW</div><h1>Scheduled Report</h1><p>Atur laporan berulang dan pindahkan jadwal langsung dari kalender.</p></div><button onClick={()=>setOpen(true)}>+ Jadwalkan Report</button></div>
    {message&&<div className="sr-message">{message}</div>}
    <div className="sr-summary"><article><span>Jadwal aktif</span><strong>{items.filter(x=>x.active).length}</strong><small>Report yang akan berjalan otomatis.</small></article><article><span>Report terkirim</span><strong>{runs.filter(x=>x.status==="delivered").length}</strong><small>Dari histori terbaru.</small></article><article><span>Gagal</span><strong>{runs.filter(x=>x.status==="failed").length}</strong><small>Cek email/API jika ada kegagalan.</small></article></div>

    <div className="sr-grid">
      <article className="sr-calendar">
        <header><button onClick={()=>setAnchor(new Date(anchor.getFullYear(),anchor.getMonth()-1,1))}>‹</button><h2>{anchor.toLocaleDateString("id-ID",{month:"long",year:"numeric"})}</h2><button onClick={()=>setAnchor(new Date(anchor.getFullYear(),anchor.getMonth()+1,1))}>›</button></header>
        <div className="sr-week">{weekdays.map(x=><span key={x}>{x}</span>)}</div>
        <div className="sr-days">{cells.map((d,i)=>{
          const dayItems=items.filter(x=>sameDay(new Date(x.next_run_at),d));
          return <div key={i} className={"sr-day "+(!inMonth(d)?"muted":"")} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=e.dataTransfer.getData("text/plain");if(id)void move(id,d)}}>
            <b>{d.getDate()}</b>{dayItems.map(item=><button draggable key={item.id} onDragStart={e=>e.dataTransfer.setData("text/plain",item.id)} className={item.active?"active":"paused"} title="Drag ke tanggal lain"><strong>{item.name}</strong><small>{new Date(item.next_run_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</small></button>)}
          </div>
        })}</div>
      </article>

      <aside className="sr-side">
        <section><header><span>NEXT REPORTS</span><h2>Jadwal terdekat</h2></header>{items.length===0?<div className="sr-empty">Belum ada schedule.</div>:items.slice(0,8).map(item=><article key={item.id}><div><strong>{item.name}</strong><span>{item.report_type.replaceAll("_"," ")} · {item.cadence}</span><small>{new Date(item.next_run_at).toLocaleString("id-ID")}</small></div><div><button onClick={()=>void toggle(item)}>{item.active?"Pause":"Aktifkan"}</button><button onClick={()=>void remove(item)}>×</button></div></article>)}</section>
        <section><header><span>RUN HISTORY</span><h2>Pengiriman terbaru</h2></header>{runs.length===0?<div className="sr-empty">Belum ada histori pengiriman.</div>:runs.slice(0,6).map(r=><article key={r.id}><div><strong>{r.report_type.replaceAll("_"," ")}</strong><span className={"run-"+r.status}>{r.status}</span><small>{new Date(r.created_at).toLocaleString("id-ID")}</small></div></article>)}</section>
      </aside>
    </div>

    {open&&<div className="sr-modal-backdrop" onClick={()=>setOpen(false)}><div className="sr-modal" onClick={e=>e.stopPropagation()}><header><div><span>SCHEDULE REPORT</span><h2>Buat jadwal baru</h2></div><button onClick={()=>setOpen(false)}>×</button></header><div className="sr-form">
      <label>Nama report<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      <label>Jenis<select value={draft.report_type} onChange={e=>setDraft({...draft,report_type:e.target.value})}><option value="goal_forecast">Goal & Forecast</option><option value="daily_brief">Daily Brief</option></select></label>
      <label>Frekuensi<select value={draft.cadence} onChange={e=>setDraft({...draft,cadence:e.target.value})}><option value="one_time">Sekali</option><option value="daily">Harian</option><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option></select></label>
      <label>Tanggal berikutnya<input type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>
      <label>Jam<input type="time" value={draft.time} onChange={e=>setDraft({...draft,time:e.target.value})}/></label>
      <label className="wide">Penerima email<input value={draft.recipients} onChange={e=>setDraft({...draft,recipients:e.target.value})} placeholder="finance@brand.com, owner@brand.com"/><small>Pisahkan beberapa email dengan koma.</small></label>
    </div><footer><button onClick={()=>setOpen(false)}>Batal</button><button onClick={()=>void createSchedule()}>Simpan Jadwal</button></footer></div></div>}
  </section>
}
