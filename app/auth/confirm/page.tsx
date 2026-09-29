"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../../lib/supabase-browser";

export default function EmailConfirmationPage(){
  const supabase=useMemo(()=>createClient(),[]);
  const [tokenHash,setTokenHash]=useState("");
  const [type,setType]=useState("email");
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    setTokenHash(String(params.get("token_hash")||""));
    setType(String(params.get("type")||"email"));
  },[]);

  async function confirm(){
    if(!tokenHash)return setStatus("Link verifikasi tidak lengkap. Minta link baru dari halaman Lumaway.");
    setBusy(true);setStatus("");
    const {error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type:type as any});
    if(error){
      setBusy(false);
      setStatus("Link sudah tidak berlaku atau sudah pernah digunakan. Minta link baru lalu coba lagi.");
      return;
    }
    if(type==="recovery"){
      window.location.assign("/auth/reset-password");
      return;
    }
    await supabase.auth.signOut().catch(()=>undefined);
    window.location.assign("/app.lumaway/login?verified=1");
  }

  const recovery=type==="recovery";
  return <main className="auth-static-page">
    <section className="auth-static-card">
      <div className="auth-static-brand"><img src="/luma-logo.png" alt="Lumaway"/></div>
      <h1>{recovery?"Lanjutkan reset password":"Konfirmasi email Lumaway"}</h1>
      <p>{recovery?"Tekan tombol di bawah untuk memvalidasi link reset password sebelum membuat password baru.":"Tekan tombol di bawah untuk menyelesaikan verifikasi email. Link dijalankan manual agar tidak otomatis terpakai oleh email security scanner."}</p>
      {status&&<div className="auth-static-status">{status}</div>}
      <div className="auth-static-actions">
        <button className="primary" type="button" disabled={busy||!tokenHash} onClick={()=>void confirm()}>{busy?"Memverifikasi...":recovery?"Lanjutkan":"Konfirmasi email saya"}</button>
        <a className="secondary" href="/app.lumaway/login">Kembali ke Login</a>
      </div>
    </section>
  </main>;
}
