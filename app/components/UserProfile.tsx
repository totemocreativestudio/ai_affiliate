"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Row=Record<string,any>;

export default function UserProfile({workspaceId,userId}:{workspaceId:string;userId:string}){
  const supabase=createClient();
  const [profile,setProfile]=useState<Row|null>(null);
  const [form,setForm]=useState<Row>({full_name:"",position_title:"",bio:"",education:"",birth_date:"",phone:""});
  const [newEmail,setNewEmail]=useState("");
  const [newPhone,setNewPhone]=useState("");
  const [otp,setOtp]=useState("");
  const [phonePending,setPhonePending]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");

  async function load(){const {data,error}=await supabase.from("profiles").select("id,email,full_name,phone,phone_verified_at,avatar_url,bio,education,birth_date,position_title,updated_at").eq("id",userId).single();if(error)return setStatus(error.message);setProfile(data as Row);setForm({full_name:data.full_name||"",position_title:data.position_title||"",bio:data.bio||"",education:data.education||"",birth_date:data.birth_date||"",phone:data.phone||""});}
  useEffect(()=>{void load()},[userId]);

  async function saveProfile(){setBusy(true);const {error}=await supabase.from("profiles").update({full_name:form.full_name||"",position_title:form.position_title||null,bio:form.bio||null,education:form.education||null,birth_date:form.birth_date||null,updated_at:new Date().toISOString()}).eq("id",userId);setBusy(false);if(error)return setStatus(error.message);setStatus("Profil berhasil diperbarui.");await load();}

  async function uploadAvatar(file:File|null){if(!file)return;if(!file.type.startsWith("image/"))return setStatus("Avatar harus berupa gambar.");if(file.size>5*1024*1024)return setStatus("Avatar maksimal 5 MB.");setBusy(true);const ext=file.name.split(".").pop()?.toLowerCase()||"jpg";const path=`${userId}/avatar-${Date.now()}.${ext}`;const {error}=await supabase.storage.from("luma-avatars").upload(path,file,{upsert:true,contentType:file.type});if(error){setBusy(false);return setStatus(error.message)}const {data}=supabase.storage.from("luma-avatars").getPublicUrl(path);const {error:u}=await supabase.from("profiles").update({avatar_url:data.publicUrl,updated_at:new Date().toISOString()}).eq("id",userId);setBusy(false);if(u)return setStatus(u.message);setStatus("Foto profil diperbarui.");await load();}

  async function changeEmail(){if(!newEmail.includes("@"))return setStatus("Masukkan email baru yang valid.");setBusy(true);const {error}=await supabase.auth.updateUser({email:newEmail},{emailRedirectTo:`${window.location.origin}/#profile`});setBusy(false);if(error)return setStatus(error.message);setStatus("Link verifikasi sudah dikirim. Email aktif berubah setelah verifikasi selesai.");setNewEmail("");}

  async function requestPhone(){if(!newPhone.trim())return setStatus("Masukkan nomor HP dalam format internasional, contoh +62812...");setBusy(true);const {error}=await supabase.auth.updateUser({phone:newPhone.trim()});setBusy(false);if(error)return setStatus(`${error.message}. Pastikan SMS provider Supabase sudah dikonfigurasi.`);setPhonePending(true);setStatus("Kode OTP verifikasi nomor HP telah diminta.");}

  async function verifyPhone(){if(!otp.trim()||!newPhone.trim())return;setBusy(true);const {error}=await supabase.auth.verifyOtp({phone:newPhone.trim(),token:otp.trim(),type:"phone_change" as any});if(error){setBusy(false);return setStatus(error.message)}const {error:p}=await supabase.from("profiles").update({phone:newPhone.trim(),phone_verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",userId);setBusy(false);if(p)return setStatus(p.message);setStatus("Nomor HP berhasil diverifikasi.");setPhonePending(false);setOtp("");setNewPhone("");await load();}

  return <section id="profile" className="legacy-page-anchor profile-page">
    <div className="eyebrow">ACCOUNT</div><h1>My Profile</h1><p className="muted">Data profil personal. Hak akses sistem dikelola terpisah oleh platform dan tidak ditampilkan sebagai jabatan user.</p>
    <div className="profile-layout">
      <div className="card profile-identity-card">
        <div className="profile-avatar-large">{profile?.avatar_url?<img src={profile.avatar_url} alt="Profile"/>:<span>{String(profile?.full_name||profile?.email||"U").slice(0,1).toUpperCase()}</span>}</div>
        <h2>{profile?.full_name||"LUMA User"}</h2><p>{form.position_title||"Tambahkan posisi / profesi"}</p>
        <label className="avatar-upload">Change photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>uploadAvatar(e.target.files?.[0]||null)}/></label>
        <div className="profile-contact"><span>Email</span><b>{profile?.email||"-"}</b><span>Phone</span><b>{profile?.phone||"-"} {profile?.phone_verified_at&&<em>Verified</em>}</b></div>
      </div>
      <div>
        <div className="card"><h3>Personal Information</h3><div className="grid"><label>Nama Lengkap<input value={form.full_name||""} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><label>Posisi / Profesi<input value={form.position_title||""} onChange={e=>setForm({...form,position_title:e.target.value})} placeholder="Contoh: Marketing Specialist"/></label><label>Pendidikan<input value={form.education||""} onChange={e=>setForm({...form,education:e.target.value})} placeholder="Contoh: S1 Marketing"/></label><label>Tanggal Lahir<input type="date" value={form.birth_date||""} onChange={e=>setForm({...form,birth_date:e.target.value})}/></label></div><label>Bio Singkat<textarea value={form.bio||""} onChange={e=>setForm({...form,bio:e.target.value})} placeholder="Ceritakan fokus pekerjaan, pengalaman, atau minat profesional Anda."/></label><button className="primary" disabled={busy} onClick={saveProfile}>Save Profile</button></div>
        <div className="grid profile-security-grid">
          <div className="card"><h3>Change Email</h3><p className="muted">Email baru harus diverifikasi sebelum menjadi email login aktif.</p><label>Email baru<input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="new@email.com"/></label><button className="secondary" disabled={busy} onClick={changeEmail}>Send Verification</button></div>
          <div className="card"><h3>Verify Phone</h3><p className="muted">Nomor HP menggunakan OTP. Fitur membutuhkan SMS provider aktif di Supabase.</p><label>Nomor HP<input value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="+62812..."/></label>{phonePending&&<label>OTP<input value={otp} onChange={e=>setOtp(e.target.value)} placeholder="6 digit OTP"/></label>}<div className="button-row">{!phonePending?<button className="secondary" disabled={busy} onClick={requestPhone}>Send OTP</button>:<button className="primary" disabled={busy} onClick={verifyPhone}>Verify Phone</button>}</div></div>
        </div>
      </div>
    </div>
    {status&&<div className={`flash ${status.toLowerCase().includes("berhasil")||status.toLowerCase().includes("dikirim")?"success":"error"}`}>{status}</div>}
  </section>;
}
