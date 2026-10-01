"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
type Row=Record<string,any>;

export default function OwnerAlertCenter(){
 const supabase=useMemo(()=>createClient(),[]);
 const [rules,setRules]=useState<Row[]>([]),[events,setEvents]=useState<Row[]>([]),[msg,setMsg]=useState("");
 async function load(){
  const [r,e]=await Promise.all([
   supabase.from("luma_operational_alert_rules").select("*").order("id"),
   supabase.from("luma_operational_alert_events").select("*,luma_operational_alert_rules(name)").order("opened_at",{ascending:false}).limit(100)
  ]);
  setRules(r.data||[]);setEvents(e.data||[]);
 }
 useEffect(()=>{void load()},[]);
 async function toggle(rule:Row){const x=await supabase.from("luma_operational_alert_rules").update({active:!rule.active,updated_at:new Date().toISOString()}).eq("id",rule.id);if(x.error)setMsg(x.error.message);else await load()}
 async function updateThreshold(rule:Row,value:string){const n=Number(value);if(!Number.isFinite(n))return;const x=await supabase.from("luma_operational_alert_rules").update({threshold:n,updated_at:new Date().toISOString()}).eq("id",rule.id);if(x.error)setMsg(x.error.message);else await load()}
 async function resolve(event:Row){const x=await supabase.from("luma_operational_alert_events").update({status:"resolved",resolved_at:new Date().toISOString()}).eq("id",event.id);if(x.error)setMsg(x.error.message);else await load()}
 return <section className="owner-panel owner-alert-center">
  <div className="owner-panel-head"><div><span className="owner-kicker">ALERT CENTER</span><h3>Operational Threshold Alerts</h3><p>Threshold untuk latency, API error, import, payment, checkout, dan issue queue.</p></div><button className="secondary" onClick={()=>void load()}>Refresh Alerts</button></div>
  {msg&&<div className="owner-inline-note">{msg}</div>}
  <div className="owner-alert-rules">{rules.map(r=><article key={r.id}><div><strong>{r.name}</strong><small>{r.metric_key} · {r.operator}</small></div><label>Threshold<input type="number" defaultValue={r.threshold} onBlur={e=>void updateThreshold(r,e.target.value)}/></label><span className={"integration-badge "+(r.active?"connected":"")}>{r.active?"ACTIVE":"PAUSED"}</span><button onClick={()=>void toggle(r)}>{r.active?"Pause":"Aktifkan"}</button></article>)}</div>
  <div className="owner-table-wrap"><table><thead><tr><th>Opened</th><th>Alert</th><th>Severity</th><th>Value</th><th>Threshold</th><th>Status</th><th></th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td>{new Date(e.opened_at).toLocaleString("id-ID")}</td><td><b>{e.luma_operational_alert_rules?.name||e.metric_key}</b><small>{e.message}</small></td><td>{e.severity}</td><td>{Number(e.metric_value||0).toLocaleString("id-ID")}</td><td>{Number(e.threshold||0).toLocaleString("id-ID")}</td><td>{e.status}</td><td><button disabled={e.status==="resolved"} onClick={()=>void resolve(e)}>Resolve</button></td></tr>)}</tbody></table></div>
 </section>
}
