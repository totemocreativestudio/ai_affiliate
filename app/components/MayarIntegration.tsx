"use client";
import {useEffect,useState} from "react";

export default function MayarIntegration({workspaceId}:{workspaceId:string}){
  const [configured,setConfigured]=useState(false),[webhookConfigured,setWebhookConfigured]=useState(false),[webhookRegistered,setWebhookRegistered]=useState(false);
  const [canConfigure,setCanConfigure]=useState(false),[source,setSource]=useState("none"),[webhookSource,setWebhookSource]=useState("none"),[health,setHealth]=useState("unknown"),[checkedAt,setCheckedAt]=useState<string|null>(null);
  const [apiKey,setApiKey]=useState(""),[webhook,setWebhook]=useState(""),[busy,setBusy]=useState(false),[status,setStatus]=useState("Memeriksa Mayar.id...");
  async function check(){
    setBusy(true);
    try{
      const r=await fetch(`/api/integrations/mayar?workspace_id=${encodeURIComponent(workspaceId)}`,{cache:"no-store"});
      const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Gagal membaca status Mayar.id.");
      setConfigured(Boolean(d.configured));setWebhookConfigured(Boolean(d.webhook_configured));setWebhookRegistered(Boolean(d.webhook_registered));setCanConfigure(Boolean(d.can_configure));setSource(d.source||"none");setWebhookSource(d.webhook_source||"none");setHealth(d.health_status||"unknown");setCheckedAt(d.last_success_at||null);
      setStatus(d.configured&&d.webhook_configured?(d.webhook_registered?"Mayar.id credential dan webhook production siap.":"Credential Mayar.id terbaca. Jalankan Production Check untuk registrasi webhook."):"Mayar.id belum dikonfigurasi.");
    }catch(e:any){setStatus(e?.message||"Gagal membaca status Mayar.id.")}finally{setBusy(false)}
  }
  useEffect(()=>{void check()},[workspaceId]);
  async function save(){
    if(!apiKey.trim())return setStatus("Masukkan Token API Mayar.id.");
    setBusy(true);
    try{
      const r=await fetch("/api/integrations/mayar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,api_key:apiKey.trim(),webhook_token:webhook.trim()})});
      const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Gagal menyimpan Mayar.id.");
      setApiKey("");setWebhook("");setConfigured(true);setWebhookConfigured(Boolean(d.webhook_configured));setStatus("Credential Mayar.id tersimpan aman dan tidak ditampilkan kembali.");
    }catch(e:any){setStatus(e?.message||"Gagal menyimpan Mayar.id.")}finally{setBusy(false)}
  }
  async function productionCheck(){
    setBusy(true);
    setStatus("Menjalankan production check Mayar.id...");
    try{
      const r=await fetch("/api/integrations/mayar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,action:"production_check"})});
      const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Production check Mayar.id gagal.");
      setConfigured(true);setWebhookConfigured(true);setWebhookRegistered(Boolean(d.webhook_registered));setHealth(d.health_status||"healthy");setCheckedAt(d.checked_at||new Date().toISOString());setSource(d.source||source);setWebhookSource(d.webhook_source||webhookSource);
      setStatus("Production Check berhasil: Token API valid, koneksi Mayar aktif, dan webhook payment Lumaway sudah diregistrasikan.");
    }catch(e:any){setHealth("error");setStatus(e?.message||"Production check Mayar.id gagal.")}finally{setBusy(false)}
  }
  async function registerWebhook(){
    setBusy(true);
    try{
      const r=await fetch("/api/integrations/mayar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,action:"register_webhook"})});
      const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Gagal register webhook Mayar.id.");
      setWebhookRegistered(true);setHealth("healthy");setStatus("Webhook Mayar.id berhasil diregistrasikan ke endpoint pembayaran Lumaway.");
    }catch(e:any){setStatus(e?.message||"Gagal register webhook Mayar.id.")}finally{setBusy(false)}
  }
  return <div className="card integration-panel">
    <div className="section-head"><div><h3>Mayar.id</h3><p className="muted">Credential payment API disimpan server-side melalui secure vault / environment variable. Production Ready hanya aktif setelah API dan webhook berhasil diverifikasi.</p></div><span className={`integration-badge ${configured&&webhookConfigured&&webhookRegistered&&health==="healthy"?"connected":"disconnected"}`}>{configured&&webhookConfigured&&webhookRegistered&&health==="healthy"?"Production Ready":"Check Required"}</span></div>
    <div className="integration-meta"><span>Environment Alias</span><strong>API_Key_Mayar_ID · Webhook_Token_Mayar_ID</strong></div><div className="integration-meta"><span>Runtime Source</span><strong>API: {source} · Webhook: {webhookSource}</strong></div><div className="integration-meta"><span>Gateway Health</span><strong>{health} · Webhook {webhookRegistered?"registered":"not registered"}{checkedAt?` · last check ${new Date(checkedAt).toLocaleString("id-ID")}`:""}</strong></div>
    {canConfigure&&<><div className="grid"><label>Token API Mayar.id<input type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="API_Key_Mayar_ID"/></label><label>Webhook Token Mayar.id<input type="password" autoComplete="off" value={webhook} onChange={e=>setWebhook(e.target.value)} placeholder="Webhook_Token_Mayar_ID"/></label></div><div className="button-row"><button className="primary" disabled={busy||!apiKey.trim()} onClick={()=>void save()}>{busy?"Saving...":"Save Securely"}</button><button className="primary" disabled={busy||!configured||!webhookConfigured} onClick={()=>void productionCheck()}>{busy?"Checking...":"Production Check"}</button><button className="secondary" disabled={busy||!configured||!webhookConfigured} onClick={()=>void registerWebhook()}>Register Payment Webhook</button><button className="secondary" disabled={busy} onClick={()=>void check()}>Refresh Status</button></div></>}
    <div className={`flash ${configured?"success":"error"}`}>{status} Storage: {source==="none"?"Not configured":source}.</div>
  </div>;
}
