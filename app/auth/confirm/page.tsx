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
    if(!tokenHash)return setStatus("Link verifikasi tidak lengkap. Kirim ulang email verifikasi dari halaman Sign in.");
    setBusy(true);setStatus("");
    const {error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type:type as any});
    if(error){
      setBusy(false);
      setStatus("Link verifikasi sudah tidak berlaku atau sudah pernah digunakan. Kirim ulang email verifikasi untuk mendapatkan link baru.");
      return;
    }
    await supabase.auth.signOut().catch(()=>undefined);
    window.location.assign("/app.lumaway/login?verified=1");
  }

  return <main className="standalone-auth">
    <section className="auth-shell" style={{maxWidth:620,margin:"0 auto"}}>
      <div className="auth-form-panel" style={{width:"100%"}}>
        <div className="lumaway-lockup"><img src="/luma-mark.png" alt=""/><div><strong>LUMAWAY<span>.</span></strong><small>Light Up Your Potential.</small></div></div>
        <div className="auth-heading"><span className="auth-kicker">EMAIL VERIFICATION</span><h1>Konfirmasi email Lumaway</h1><p>Tekan tombol di bawah untuk menyelesaikan verifikasi. Link tidak dijalankan otomatis agar tetap aman dari email security scanner.</p></div>
        <button className="primary auth-submit" type="button" disabled={busy||!tokenHash} onClick={()=>void confirm()}>{busy?"Memverifikasi...":"Konfirmasi email saya"}</button>
        {status&&<div className="auth-status error">{status}</div>}
        <a className="secondary auth-resend-button" href="/app.lumaway/login">Kembali ke Sign in</a>
      </div>
    </section>
  </main>;
}
