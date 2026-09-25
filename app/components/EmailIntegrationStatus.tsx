"use client";
import {useEffect,useState} from "react";

type EmailHealth={configured:boolean;provider:string;api_key_configured:boolean;secret_source:string;from_configured:boolean;from_address:string|null;last_status:string|null;last_at:string|null;weekly_last_status:string|null;weekly_last_at:string|null;transactional_last_status:string|null;transactional_last_at:string|null};

export default function EmailIntegrationStatus({workspaceId}:{workspaceId:string}){
  const [health,setHealth]=useState<EmailHealth|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function load(){
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/admin/email-status?workspace_id="+encodeURIComponent(workspaceId),{cache:"no-store"});
      const d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.error||"Gagal membaca status email.");
      setHealth(d.email);
    }catch(error:any){setMessage(error?.message||"Gagal membaca status email.")}finally{setBusy(false)}
  }
  useEffect(()=>{void load()},[workspaceId]);
  const date=(v:string|null)=>v?new Date(v).toLocaleString("id-ID"):"Belum ada";
  return <section className="owner-panel">
    <div className="owner-panel-head"><div><span className="owner-kicker">EMAIL MARKETING</span><h3>Resend & Weekly Insight</h3><p>Status koneksi transactional email dan email mingguan. Nilai API key tidak pernah ditampilkan di browser.</p></div><button className="secondary" disabled={busy} onClick={()=>void load()}>{busy?"Checking...":"Refresh"}</button></div>
    {message&&<div className="owner-inline-note">{message}</div>}
    <div className="owner-kpi-grid small">
      <div className="owner-metric"><span>Provider</span><b>{health?.provider||"Resend"}</b><small>{health?.configured?"Connected":"Belum siap"}</small></div>
      <div className="owner-metric"><span>API Key</span><b>{health?.api_key_configured?"Configured":"Missing"}</b><small>{health?.api_key_configured?health.secret_source:"Tambahkan RESEND_API_KEY / secure vault"}</small></div>
      <div className="owner-metric"><span>Sender</span><b>{health?.from_configured?"Configured":"Missing"}</b><small>{health?.from_address||"Atur LUMA_EMAIL_FROM / email_from"}</small></div>
      <div className="owner-metric"><span>Weekly Email</span><b>{health?.weekly_last_status||"Belum terkirim"}</b><small>{date(health?.weekly_last_at||null)}</small></div>
      <div className="owner-metric"><span>Transactional Email</span><b>{health?.transactional_last_status||"Belum terkirim"}</b><small>{date(health?.transactional_last_at||null)}</small></div>
    </div>
    <div className="owner-inline-note">Weekly Insight dijadwalkan setiap Senin 08.00 WIB dan hanya dikirim ke user yang mengaktifkan Email Insight Mingguan.</div>
  </section>;
}
