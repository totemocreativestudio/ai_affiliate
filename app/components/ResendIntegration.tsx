"use client";
import {useEffect,useState} from "react";

type Health={
  configured:boolean;
  source:string;
  from_address:string;
  smtp_host:string;
  smtp_port:number;
  smtp_user:string;
  smtp_security:string;
  can_configure:boolean;
  key_last4?:string;
  masked_key?:string;
};

export default function ResendIntegration({workspaceId}:{workspaceId:string}){
  const [health,setHealth]=useState<Health|null>(null);
  const [apiKey,setApiKey]=useState("");
  const [showApiKey,setShowApiKey]=useState(false);
  const [fromAddress,setFromAddress]=useState("Lumaway <marketing@lumaway.online>");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("Memeriksa Resend...");

  async function load(){
    setBusy(true);
    try{
      const r=await fetch(`/api/integrations/resend?workspace_id=${encodeURIComponent(workspaceId)}`,{cache:"no-store"});
      const d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.error||"Gagal membaca integrasi Resend.");
      setHealth(d);
      if(d.from_address)setFromAddress(d.from_address);
      setMessage(d.configured?"Resend API key tersimpan dan siap dipakai aplikasi.":"Resend API key belum disimpan.");
    }catch(e:any){setMessage(e?.message||"Gagal membaca integrasi Resend.")}finally{setBusy(false)}
  }

  useEffect(()=>{void load()},[workspaceId]);

  async function save(){
    if(!apiKey.trim())return setMessage("Masukkan Resend API key terlebih dahulu.");
    setBusy(true);setMessage("Menyimpan API key ke secure vault...");
    try{
      const r=await fetch("/api/integrations/resend",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        workspace_id:workspaceId,
        action:"save",
        api_key:apiKey.trim(),
        from_address:fromAddress.trim()
      })});
      const d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.error||"Gagal menyimpan Resend API key.");
      setApiKey("");
      setShowApiKey(false);
      setHealth(d);
      setMessage(`Resend API key tersimpan aman di Supabase Vault. Token: ${d.masked_key||"re_••••••••••••"}.`);
    }catch(e:any){setMessage(e?.message||"Gagal menyimpan Resend API key.")}finally{setBusy(false)}
  }

  async function test(){
    setBusy(true);setMessage("Mengirim email test ke akun owner...");
    try{
      const r=await fetch("/api/integrations/resend",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        workspace_id:workspaceId,
        action:"test"
      })});
      const d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.error||"Test Resend gagal.");
      setMessage(`Resend berhasil diverifikasi. Email test dikirim ke ${d.test_to||"akun owner"}.`);
      await load();
    }catch(e:any){setMessage(e?.message||"Test Resend gagal.")}finally{setBusy(false)}
  }

  return <section id="owner-integration-resend" className="owner-panel">
    <div className="owner-panel-head">
      <div><span className="owner-kicker">TRANSACTIONAL EMAIL</span><h3>Resend API & SMTP SSL</h3><p>API key disimpan server-side di Supabase Vault. Untuk Supabase Auth, Resend dapat dipakai melalui SMTPS terenkripsi.</p></div>
      <span className={`integration-badge ${health?.configured?"connected":"disconnected"}`}>{health?.configured?"Connected":"Not Connected"}</span>
    </div>

    <div className="owner-kpi-grid small">
      <div className="owner-metric"><span>API Key</span><b>{health?.configured?(health?.masked_key||`re_••••••••••${health?.key_last4||"••••"}`):"Missing"}</b><small>{health?.configured?`Secure Vault · Last 4: ${health?.key_last4||"••••"}`:(health?.source||"none")}</small></div>
      <div className="owner-metric"><span>SMTP Host</span><b>{health?.smtp_host||"smtp.resend.com"}</b><small>Resend SMTP</small></div>
      <div className="owner-metric"><span>Port</span><b>{health?.smtp_port||465}</b><small>SMTPS</small></div>
      <div className="owner-metric"><span>Security</span><b>{health?.smtp_security||"SSL/TLS"}</b><small>Encrypted transport</small></div>
    </div>

    {health?.can_configure&&<div className="card" style={{marginTop:14}}>
      <div className="grid">
        <label>Resend API Key
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input style={{flex:1}} type={showApiKey?"text":"password"} autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={health?.configured?(health?.masked_key||"re_••••••••••••"):"re_..."} />
            <button type="button" className="secondary compact" disabled={!apiKey} onClick={()=>setShowApiKey(v=>!v)}>{showApiKey?"Hide":"Show"}</button>
          </div>
          <small>{health?.configured?`Token tersimpan aman · hanya 4 karakter terakhir ditampilkan: ${health?.key_last4||"••••"}`:"Full token hanya terlihat selama Anda mengetik dan belum disimpan."}</small>
        </label>
        <label>Sender
          <input value={fromAddress} onChange={e=>setFromAddress(e.target.value)} placeholder="Lumaway <marketing@lumaway.online>" />
        </label>
      </div>
      <div className="owner-inline-note">SMTP untuk Supabase Auth: host <b>smtp.resend.com</b> · port <b>465</b> · username <b>resend</b> · password menggunakan Resend API key · SSL aktif.</div>
      <div className="button-row">
        <button className="primary" disabled={busy||!apiKey.trim()} onClick={()=>void save()}>{busy?"Saving...":health?.configured?"Replace API Key":"Save API Key"}</button>
        <button className="secondary" disabled={busy||!health?.configured} onClick={()=>void test()}>{busy?"Testing...":"Test Resend"}</button>
        <button className="secondary" disabled={busy} onClick={()=>void load()}>Refresh</button>
      </div>
    </div>}
    <div className="owner-inline-note">{message}</div>
  </section>;
}
