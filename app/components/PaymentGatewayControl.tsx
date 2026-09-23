"use client";
import {useEffect,useState} from "react";

type Provider={provider:string;enabled:boolean;priority:number;weight:number;health_status:string;configured:boolean;last_success_at?:string|null;last_error_at?:string|null;last_error?:string|null};

export default function PaymentGatewayControl({workspaceId}:{workspaceId:string}){
  const [mode,setMode]=useState("priority_fallback");
  const [providers,setProviders]=useState<Provider[]>([]);
  const [midServer,setMidServer]=useState("");const [midClient,setMidClient]=useState("");
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");

  async function load(){
    setBusy(true);
    try{
      const r=await fetch(`/api/payments/providers?workspace_id=${encodeURIComponent(workspaceId)}`,{cache:"no-store"});
      const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Gagal membaca payment routing.");
      setMode(d.mode||"priority_fallback");setProviders(d.providers||[]);
    }catch(e:any){setMessage(e?.message||"Gagal membaca payment routing.")}finally{setBusy(false)}
  }
  useEffect(()=>{void load()},[workspaceId]);

  function patch(index:number,key:keyof Provider,value:any){setProviders(rows=>rows.map((row,i)=>i===index?{...row,[key]:value}:row))}
  async function save(){
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/payments/providers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        workspace_id:workspaceId,mode,
        providers:providers.map(p=>({provider:p.provider,enabled:p.enabled,priority:Number(p.priority),weight:Number(p.weight)})),
        midtrans_server_key:midServer.trim()||undefined,midtrans_client_key:midClient.trim()||undefined
      })});
      const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Gagal menyimpan payment routing.");
      setProviders(d.providers||providers);setMidServer("");setMidClient("");setMessage("Payment routing tersimpan. Checkout baru langsung menggunakan konfigurasi ini.");
    }catch(e:any){setMessage(e?.message||"Gagal menyimpan payment routing.")}finally{setBusy(false)}
  }

  return <section className="owner-panel payment-routing-panel">
    <div className="owner-panel-head"><div><span className="owner-kicker">PAYMENT ORCHESTRATION</span><h3>Payment Gateway Routing</h3><p>Mayar.id, Xendit, dan Midtrans dapat aktif bersamaan. Priority + fallback mencoba provider sesuai urutan; Weighted membagi checkout baru berdasarkan bobot lalu fallback jika provider gagal.</p></div><span className="priority-badge p-high">{mode==="weighted"?"LOAD SHARE":"FALLBACK"}</span></div>
    <div className="grid">
      <label>Routing Mode<select value={mode} onChange={e=>setMode(e.target.value)}><option value="priority_fallback">Priority + Fallback</option><option value="weighted">Weighted Load Share</option></select></label>
      <label>Midtrans Server Key<input type="password" autoComplete="off" value={midServer} onChange={e=>setMidServer(e.target.value)} placeholder="MIDTRANS_SERVER_KEY"/></label>
      <label>Midtrans Client Key<input type="password" autoComplete="off" value={midClient} onChange={e=>setMidClient(e.target.value)} placeholder="MIDTRANS_CLIENT_KEY (opsional untuk redirect mode)"/></label>
    </div>
    <div className="payment-provider-grid">
      {providers.map((p,i)=><article className="payment-provider-admin" key={p.provider}>
        <div><strong>{p.provider==="mayar"?"Mayar.id":p.provider==="xendit"?"Xendit":"Midtrans"}</strong><span className={`integration-badge ${p.configured?"connected":"disconnected"}`}>{p.configured?"Credential Ready":"No Credential"}</span></div>
        <label className="inline-check"><input type="checkbox" checked={Boolean(p.enabled)} onChange={e=>patch(i,"enabled",e.target.checked)}/>Enabled</label>
        <label>Priority<input type="number" min="1" max="999" value={p.priority} onChange={e=>patch(i,"priority",Number(e.target.value))}/></label>
        <label>Weight<input type="number" min="1" max="100" value={p.weight} onChange={e=>patch(i,"weight",Number(e.target.value))}/></label>
        <small>Health: <b>{p.health_status||"unknown"}</b>{p.last_error?<> · {String(p.last_error).slice(0,90)}</>:null}</small>
      </article>)}
    </div>
    <div className="button-row"><button className="primary" disabled={busy} onClick={()=>void save()}>{busy?"Saving...":"Save Payment Routing"}</button><button className="secondary" disabled={busy} onClick={()=>void load()}>Refresh</button></div>
    {message&&<div className="owner-inline-note">{message}</div>}
  </section>;
}
