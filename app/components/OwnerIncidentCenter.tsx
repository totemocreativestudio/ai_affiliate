"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
type Row=Record<string,any>;

function remain(ts?:string|null){
 if(!ts)return "-";
 const diff=new Date(ts).getTime()-Date.now();
 const abs=Math.abs(diff),m=Math.floor(abs/60000),h=Math.floor(m/60),mm=m%60;
 return (diff<0?"Overdue ":"")+h+"j "+mm+"m";
}

export default function OwnerIncidentCenter(){
 const supabase=useMemo(()=>createClient(),[]);
 const [incidents,setIncidents]=useState<Row[]>([]),[profiles,setProfiles]=useState<Row[]>([]),[timeline,setTimeline]=useState<Row[]>([]),[selected,setSelected]=useState<Row|null>(null),[note,setNote]=useState(""),[msg,setMsg]=useState("");
 async function load(){
   const [i,p]=await Promise.all([
    supabase.from("luma_incidents").select("*,profiles:assignee_user_id(id,full_name,email,username),luma_operational_alert_events(metric_key,metric_value,threshold)").order("created_at",{ascending:false}).limit(100),
    supabase.from("profiles").select("id,full_name,email,username,role").eq("active",true).order("full_name").limit(300)
   ]);
   setIncidents(i.data||[]);setProfiles(p.data||[]);
 }
 async function loadTimeline(id:number){const x=await supabase.from("luma_incident_timeline").select("*,profiles:actor_user_id(full_name,email,username)").eq("incident_id",id).order("created_at",{ascending:false});setTimeline(x.data||[])}
 useEffect(()=>{void load()},[]);
 async function selectIncident(x:Row){setSelected(x);await loadTimeline(x.id)}
 async function update(status?:string,assignee?:string,noteText?:string){
   if(!selected)return;
   const x=await supabase.rpc("luma_owner_update_incident_v1",{p_incident_id:selected.id,p_status:status||null,p_assignee_user_id:assignee||null,p_note:noteText||null});
   if(x.error){setMsg(x.error.message);return}
   setNote("");await load();const refreshed=(await supabase.from("luma_incidents").select("*,profiles:assignee_user_id(id,full_name,email,username),luma_operational_alert_events(metric_key,metric_value,threshold)").eq("id",selected.id).single()).data;if(refreshed)setSelected(refreshed);await loadTimeline(selected.id)
 }
 const open=incidents.filter(x=>x.status!=="resolved");
 return <section className="owner-panel incident-center">
  <div className="owner-panel-head"><div><span className="owner-kicker">INCIDENT RESPONSE</span><h3>Incident Timeline & Escalation</h3><p>Acknowledge, assign, monitor SLA, dan catat tindakan dari alert operasional.</p></div><div className="incident-head-stats"><b>{open.length}</b><span>open incident</span></div></div>
  {msg&&<div className="owner-inline-note">{msg}</div>}
  <div className="incident-layout">
   <aside>{incidents.length?incidents.map(x=><button key={x.id} className={selected?.id===x.id?"active":""} onClick={()=>void selectIncident(x)}><div><strong>{x.title}</strong><small>{x.severity} · L{x.escalation_level} · {new Date(x.created_at).toLocaleString("id-ID")}</small></div><span className={"incident-status status-"+x.status}>{x.status}</span></button>):<div className="incident-empty">Belum ada incident.</div>}</aside>
   <main>{selected?<><div className="incident-hero"><div><span>INCIDENT #{selected.id}</span><h4>{selected.title}</h4><p>{selected.luma_operational_alert_events?.metric_key||"-"} · value {Number(selected.luma_operational_alert_events?.metric_value||0).toLocaleString("id-ID")} / threshold {Number(selected.luma_operational_alert_events?.threshold||0).toLocaleString("id-ID")}</p></div><div className={"incident-severity "+selected.severity}>{selected.severity}</div></div>
    <div className="incident-sla"><article><span>Acknowledge SLA</span><strong>{selected.acknowledged_at?"Done":remain(selected.sla_ack_due_at)}</strong><small>{selected.sla_ack_due_at?new Date(selected.sla_ack_due_at).toLocaleString("id-ID"):"-"}</small></article><article><span>Resolve SLA</span><strong>{selected.status==="resolved"?"Done":remain(selected.sla_resolve_due_at)}</strong><small>{selected.sla_resolve_due_at?new Date(selected.sla_resolve_due_at).toLocaleString("id-ID"):"-"}</small></article><article><span>Escalation</span><strong>Level {selected.escalation_level}</strong><small>{selected.assignee_user_id?"Assigned":"Belum ada PIC"}</small></article></div>
    <div className="incident-controls"><label>Status<select value={selected.status} onChange={e=>void update(e.target.value,undefined,undefined)}>{["open","acknowledged","investigating","monitoring","resolved"].map(x=><option key={x}>{x}</option>)}</select></label><label>Assignee<select value={selected.assignee_user_id||""} onChange={e=>void update(undefined,e.target.value||undefined,undefined)}><option value="">Pilih PIC</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.full_name||p.username||p.email}</option>)}</select></label></div>
    <div className="incident-note"><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Tambahkan investigasi, root cause sementara, action, atau hasil monitoring..."/><button disabled={!note.trim()} onClick={()=>void update(undefined,undefined,note)}>Tambah Catatan</button></div>
    <div className="incident-timeline"><header><span>TIMELINE</span><h4>Incident activity</h4></header>{timeline.map(t=><article key={t.id}><i/><div><strong>{String(t.event_type).replaceAll("_"," ")}</strong><p>{t.note||([t.from_status,t.to_status].filter(Boolean).join(" → "))}</p><small>{new Date(t.created_at).toLocaleString("id-ID")} {t.profiles?.full_name?"· "+t.profiles.full_name:""}</small></div></article>)}</div>
   </>:<div className="incident-empty large">Pilih incident untuk membuka detail dan timeline.</div>}</main>
  </div>
 </section>
}
