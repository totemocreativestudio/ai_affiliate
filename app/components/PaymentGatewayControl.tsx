"use client";
import {useEffect,useState} from "react";

type Provider={provider:string;enabled:boolean;priority:number;health_status:string;configured:boolean;last_success_at?:string|null;last_error_at?:string|null;last_error?:string|null};

export default function PaymentGatewayControl({workspaceId}:{workspaceId:string}){
  const [provider,setProvider]=useState<Provider|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    setBusy(true);setMessage("");
    try{
      const r=await fetch(`/api/payments/providers?workspace_id=${encodeURIComponent(workspaceId)}`,{cache:"no-store"});
      const d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.error||"Gagal membaca status Mayar.id.");
      setProvider((d.providers||[]).find((row:Provider)=>row.provider==="mayar")||null);
    }catch(e:any){setMessage(e?.message||"Gagal membaca status Mayar.id.")}finally{setBusy(false)}
  }

  useEffect(()=>{void load()},[workspaceId]);

  return <section className="owner-panel payment-routing-panel">
    <div className="owner-panel-head">
      <div><span className="owner-kicker">PAYMENT GATEWAY</span><h3>Mayar.id · Primary Checkout</h3><p>Checkout subscription dan top-up Lumaway hanya menggunakan Mayar.id. Xendit dan Midtrans dinonaktifkan sebagai payment gateway checkout.</p></div>
      <span className="priority-badge p-high">MAYAR ONLY</span>
    </div>
    <div className="payment-provider-grid">
      <article className="payment-provider-admin">
        <div><strong>Mayar.id</strong><span className={`integration-badge ${provider?.configured?"connected":"disconnected"}`}>{provider?.configured?"Credential Ready":"Credential Belum Siap"}</span></div>
        <small>Status: <b>{provider?.enabled?"Active":"Inactive"}</b> · Health: <b>{provider?.health_status||"unknown"}</b></small>
        {provider?.last_error&&<small>Last error: {String(provider.last_error).slice(0,120)}</small>}
      </article>
    </div>
    <div className="owner-inline-note">DOKU tidak digunakan. Xendit/Midtrans tidak menjadi fallback checkout. Pengaturan credential Mayar tetap tersedia pada panel Mayar.id.</div>
    <div className="button-row"><button className="secondary" disabled={busy} onClick={()=>void load()}>{busy?"Refreshing...":"Refresh Status"}</button></div>
    {message&&<div className="owner-inline-note error">{message}</div>}
  </section>;
}
