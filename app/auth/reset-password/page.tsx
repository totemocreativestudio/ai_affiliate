"use client";

export const dynamic = "force-dynamic";

import {useMemo,useState} from "react";
import {createClient} from "../../../lib/supabase-browser";

export default function ResetPasswordPage(){
  const supabase=useMemo(()=>createClient(),[]);
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [done,setDone]=useState(false);

  async function save(){
    if(password.length<8)return setStatus("Gunakan password minimal 8 karakter.");
    if(password!==confirm)return setStatus("Konfirmasi password belum sama.");
    setBusy(true);setStatus("");
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){
      setBusy(false);setStatus("Sesi reset password tidak tersedia atau sudah kedaluwarsa. Minta link baru dari halaman login.");return;
    }
    const {error}=await supabase.auth.updateUser({password});
    if(error){setBusy(false);setStatus("Password belum dapat diperbarui. Minta link reset baru dan coba lagi.");return}
    await supabase.auth.signOut().catch(()=>undefined);
    setDone(true);setBusy(false);setStatus("Password berhasil diperbarui. Silakan masuk kembali ke Lumaway.");
  }

  return <main className="auth-static-page">
    <section className="auth-static-card">
      <div className="auth-static-brand"><img src="/luma-logo.png" alt="Lumaway"/></div>
      <h1>{done?"Password baru sudah aktif":"Buat password baru"}</h1>
      <p>{done?"Anda sekarang dapat masuk menggunakan password yang baru.":"Gunakan minimal 8 karakter dan hindari password yang dipakai pada layanan lain."}</p>
      {!done&&<>
        <label>Password baru<input type={show?"text":"password"} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 8 karakter"/></label>
        <label>Ulangi password<input type={show?"text":"password"} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Ketik ulang password"/></label>
        <label style={{display:"flex",gridTemplateColumns:"auto 1fr",alignItems:"center",gap:8,fontWeight:500}}><input style={{minHeight:0,width:16}} type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)}/> Tampilkan password</label>
      </>}
      {status&&<div className="auth-static-status">{status}</div>}
      <div className="auth-static-actions">
        {!done?<button type="button" className="primary" disabled={busy} onClick={()=>void save()}>{busy?"Menyimpan...":"Simpan password baru"}</button>:<a className="primary" href="/app.lumaway/login">Masuk ke Lumaway</a>}
        {!done&&<a className="secondary" href="/app.lumaway/login">Batal</a>}
      </div>
    </section>
  </main>;
}
