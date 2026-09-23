"use client";
import {useEffect,useState} from "react";

export default function MayarIntegration({workspaceId}:{workspaceId:string}){
  const [configured,setConfigured]=useState(false),[webhookConfigured,setWebhookConfigured]=useState(false);
  const [canConfigure,setCanConfigure]=useState(false),[source,setSource]=useState("none");
  const [apiKey,setApiKey]=useState(""),[webhook,setWebhook]=useState(""),[busy,setBusy]=useState(false),[status,setStatus]=useState("Memeriksa Mayar.id...");
  async function check(){
    setBusy(true);
    try{
      const r=await fetch(`/api/integrations/mayar?workspace_id=${encodeURIComponent(workspaceId)}`,{cache:"no-store"});
      const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Gagal membaca status Mayar.id.");
      setConfigured(Boolean(d.configured));setWebhookConfigured(Boolean(d.webhook_configured));setCanConfigure(Boolean(d.can_configure));setSource(d.source||"none");
      setStatus(d.configured?"Token API Mayar.id tersedia server-side.":"Mayar.id belum dikonfigurasi.");
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
  return <div className="card integration-panel">
    <div className="section-head"><div><h3>Mayar.id</h3><p className="muted">Credential payment API disimpan server-side melalui secure vault / environment variable.</p></div><span className={`integration-badge ${configured&&webhookConfigured?"connected":"disconnected"}`}>{configured&&webhookConfigured?"Ready":"Setup Required"}</span></div>
    <div className="integration-meta"><span>Environment Alias</span><strong>API_Key_Mayar_ID · Webhook_Token_Mayar_ID</strong></div>
    {canConfigure&&<><div className="grid"><label>Token API Mayar.id<input type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="API_Key_Mayar_ID"/></label><label>Webhook Token Mayar.id<input type="password" autoComplete="off" value={webhook} onChange={e=>setWebhook(e.target.value)} placeholder="Webhook_Token_Mayar_ID"/></label></div><div className="button-row"><button className="primary" disabled={busy||!apiKey.trim()} onClick={()=>void save()}>{busy?"Saving...":"Save Securely"}</button><button className="secondary" disabled={busy} onClick={()=>void check()}>Check Status</button></div></>}
    <div className={`flash ${configured?"success":"error"}`}>{status} Storage: {source==="none"?"Not configured":source}.</div>
  </div>;
}
