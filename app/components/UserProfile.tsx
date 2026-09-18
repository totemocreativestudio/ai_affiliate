"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Row=Record<string,any>;

export default function UserProfile({workspaceId,userId}:{workspaceId:string;userId:string}){
  const supabase=createClient();
  const [profile,setProfile]=useState<Row|null>(null);
  const [form,setForm]=useState<Row>({full_name:"",nickname:"",position_title:"",bio:"",education:"",birth_date:""});
  const [newEmail,setNewEmail]=useState("");
  const [newPhone,setNewPhone]=useState("");
  const [otp,setOtp]=useState("");
  const [phonePending,setPhonePending]=useState(false);
  const [channelUrl,setChannelUrl]=useState("");
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");

  async function load(){
    const [p,s]=await Promise.all([
      supabase.from("profiles").select("id,email,full_name,nickname,phone,phone_verified_at,email_verified_at,profile_completed,avatar_url,bio,education,birth_date,position_title,social_alias,social_avatar_key,whatsapp_opt_in,whatsapp_opt_in_at,whatsapp_channel_joined_at,updated_at").eq("id",userId).single(),
      supabase.from("luma_platform_settings").select("setting_value").eq("setting_key","whatsapp_channel_url").maybeSingle(),
    ]);
    if(p.error)return setStatus(p.error.message);
    const data=p.data as Row;setProfile(data);setForm({full_name:data.full_name||"",nickname:data.nickname||"",position_title:data.position_title||"",bio:data.bio||"",education:data.education||"",birth_date:data.birth_date||""});setChannelUrl(s.data?.setting_value||"");
  }
  useEffect(()=>{void load()},[userId]);

  async function saveProfile(){
    if(!String(form.full_name||"").trim()||!String(form.nickname||"").trim()||!String(form.education||"").trim()||!String(form.birth_date||"").trim()||!String(form.bio||"").trim()) return setStatus("Lengkapi nama, nama panggilan, pendidikan, tanggal lahir, dan bio singkat.");
    setBusy(true);
    const {data:{user}}=await supabase.auth.getUser();
    const emailVerifiedAt=(user as any)?.email_confirmed_at||profile?.email_verified_at||null;
    const phoneVerifiedAt=profile?.phone_verified_at||null;
    const completed=Boolean(emailVerifiedAt&&phoneVerifiedAt);
    const {error}=await supabase.from("profiles").update({
      full_name:String(form.full_name||"").trim(),
      nickname:String(form.nickname||"").trim(),
      position_title:form.position_title||null,
      bio:String(form.bio||"").trim(),
      education:String(form.education||"").trim(),
      birth_date:form.birth_date||null,
      email_verified_at:emailVerifiedAt,
      profile_completed:completed,
      updated_at:new Date().toISOString()
    }).eq("id",userId);
    setBusy(false);
    if(error)return setStatus(error.message);
    setStatus(completed?"Profil lengkap. Anda dapat menggunakan seluruh fitur sesuai masa aktif.":"Data profil tersimpan. Verifikasi email dan WhatsApp untuk menyelesaikan profil.");
    window.dispatchEvent(new Event("lumaway-profile-updated"));
    await load();
  }

  async function uploadAvatar(file:File|null){if(!file)return;if(!file.type.startsWith("image/"))return setStatus("Avatar harus berupa gambar.");if(file.size>5*1024*1024)return setStatus("Avatar maksimal 5 MB.");setBusy(true);const ext=file.name.split(".").pop()?.toLowerCase()||"jpg";const path=`${userId}/avatar-${Date.now()}.${ext}`;const {error}=await supabase.storage.from("luma-avatars").upload(path,file,{upsert:true,contentType:file.type});if(error){setBusy(false);return setStatus(error.message)}const {data}=supabase.storage.from("luma-avatars").getPublicUrl(path);const {error:u}=await supabase.from("profiles").update({avatar_url:data.publicUrl,updated_at:new Date().toISOString()}).eq("id",userId);setBusy(false);if(u)return setStatus(u.message);setStatus("Foto profil diperbarui.");await load();}

  async function changeEmail(){if(!newEmail.includes("@"))return setStatus("Masukkan email baru yang valid.");setBusy(true);const {error}=await supabase.auth.updateUser({email:newEmail},{emailRedirectTo:`${window.location.origin}/app.lumaway/profile`});setBusy(false);if(error)return setStatus(error.message);setStatus("Link verifikasi email sudah dikirim. Email login berubah setelah verifikasi selesai.");setNewEmail("");}

  async function requestPhone(){
    if(!newPhone.trim())return setStatus("Masukkan nomor WhatsApp dalam format +62812...");setBusy(true);setStatus("Mengirim OTP melalui WhatsApp bot...");
    try{const r=await fetch("/api/profile/whatsapp-otp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,action:"request",phone:newPhone.trim()})});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Gagal mengirim OTP.");setPhonePending(true);setStatus("OTP WhatsApp dikirim. Kode berlaku 5 menit.");}catch(e:any){setStatus(e?.message||"Gagal mengirim OTP WhatsApp.")}finally{setBusy(false)}
  }

  async function verifyPhone(){
    if(!otp.trim()||!newPhone.trim())return;setBusy(true);setStatus("Memverifikasi OTP...");
    try{const r=await fetch("/api/profile/whatsapp-otp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,action:"verify",phone:newPhone.trim(),otp:otp.trim()})});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"OTP gagal diverifikasi.");const {data:{user}}=await supabase.auth.getUser();
    const emailVerifiedAt=(user as any)?.email_confirmed_at||profile?.email_verified_at||null;
    const completed=Boolean(emailVerifiedAt&&String(form.full_name||"").trim()&&String(form.nickname||"").trim()&&String(form.education||"").trim()&&String(form.birth_date||"").trim()&&String(form.bio||"").trim());
    await supabase.from("profiles").update({email_verified_at:emailVerifiedAt,profile_completed:completed,updated_at:new Date().toISOString()}).eq("id",userId);
    setStatus(completed?"Nomor WhatsApp terverifikasi. Profil Anda sudah lengkap.":"Nomor WhatsApp berhasil diverifikasi. Lengkapi data profil untuk melanjutkan.");window.dispatchEvent(new Event("lumaway-profile-updated"));setPhonePending(false);setOtp("");setNewPhone("");await load();}catch(e:any){setStatus(e?.message||"OTP gagal diverifikasi.")}finally{setBusy(false)}
  }

  async function confirmChannel(){const now=new Date().toISOString();const {error}=await supabase.from("profiles").update({whatsapp_channel_joined_at:now,updated_at:now}).eq("id",userId);if(error)return setStatus(error.message);setStatus("Status bergabung ke saluran WhatsApp disimpan.");await load();}

  return <section id="profile" className="legacy-page-anchor profile-page">
    <div className="eyebrow">ACCOUNT</div><h1>My Profile</h1>{!profile?.profile_completed&&<div className="profile-completion-notice"><strong>Lengkapi profil sebelum melanjutkan</strong><span>Isi data wajib dan verifikasi email serta WhatsApp. Foto profil tetap opsional.</span></div>}<p className="muted">Data pribadi Anda terpisah dari identitas komunitas. Social Lumaway hanya menampilkan nama samaran dan mascot yang ditentukan sistem.</p>
    <div className="profile-layout">
      <div className="card profile-identity-card">
        <div className="profile-avatar-large">{profile?.avatar_url?<img src={profile.avatar_url} alt="Profile"/>:<span>{String(profile?.full_name||profile?.email||"U").slice(0,1).toUpperCase()}</span>}</div>
        <h2>{profile?.full_name||"LUMA User"}</h2><p>{form.position_title||"Tambahkan posisi / profesi"}</p>
        <label className="avatar-upload">Change photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>uploadAvatar(e.target.files?.[0]||null)}/></label>
        <div className="profile-contact"><span>Email</span><b>{profile?.email||"-"}</b><span>WhatsApp</span><b>{profile?.phone||"-"} {profile?.phone_verified_at&&<em>Verified</em>}</b><span>Community Alias</span><b>{profile?.social_alias||"-"}</b></div>
      </div>
      <div>
        <div className="card"><h3>Personal Information</h3><div className="grid"><label>Nama Lengkap<input value={form.full_name||""} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><label>Nama Panggilan<input value={form.nickname||""} onChange={e=>setForm({...form,nickname:e.target.value})} placeholder="Nama yang dipakai Luma"/></label><label>Posisi / Profesi<input value={form.position_title||""} onChange={e=>setForm({...form,position_title:e.target.value})} placeholder="Contoh: Marketing Specialist"/></label><label>Pendidikan<input value={form.education||""} onChange={e=>setForm({...form,education:e.target.value})} placeholder="Contoh: S1 Marketing"/></label><label>Tanggal Lahir<input type="date" value={form.birth_date||""} onChange={e=>setForm({...form,birth_date:e.target.value})}/></label></div><label>Bio Singkat<textarea value={form.bio||""} onChange={e=>setForm({...form,bio:e.target.value})} placeholder="Ceritakan fokus pekerjaan, pengalaman, atau minat profesional Anda."/></label><button className="primary" disabled={busy} onClick={saveProfile}>Save Profile</button></div>
        <div className="grid profile-security-grid">
          <div className="card"><h3>Change Email</h3><p className="muted">Email baru wajib diverifikasi melalui link keamanan sebelum menjadi email login aktif.</p><label>Email baru<input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="new@email.com"/></label><button className="secondary" disabled={busy} onClick={changeEmail}>Send Verification</button></div>
          <div className="card"><h3>Verify WhatsApp</h3><p className="muted">OTP dikirim melalui bot WhatsApp Lumaway. Nomor terverifikasi dipakai untuk keamanan akun dan komunikasi yang Anda setujui.</p><label>Nomor WhatsApp<input value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="+62812..."/></label>{phonePending&&<label>OTP<input inputMode="numeric" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6 digit OTP"/></label>}<div className="button-row">{!phonePending?<button className="secondary" disabled={busy} onClick={requestPhone}>Send WhatsApp OTP</button>:<><button className="primary" disabled={busy||otp.length!==6} onClick={verifyPhone}>Verify OTP</button><button className="secondary" disabled={busy} onClick={()=>{setPhonePending(false);setOtp("")}}>Cancel</button></>}</div></div>
        </div>
        <div className="card whatsapp-channel-card"><div><span className="eyebrow">LUMAWAY WHATSAPP</span><h3>Community Channel</h3><p className="muted">Promo, edukasi, update fitur, dan pengumuman penting. Bergabung membutuhkan tindakan dan persetujuan Anda di WhatsApp.</p></div><div className="button-row">{channelUrl?<a className="button primary" href={channelUrl} target="_blank" rel="noreferrer">Open WhatsApp Channel</a>:<button disabled>Channel belum dikonfigurasi owner</button>}{channelUrl&&!profile?.whatsapp_channel_joined_at&&<button className="secondary" onClick={confirmChannel}>Saya sudah bergabung</button>}{profile?.whatsapp_channel_joined_at&&<span className="status-pill s-paid">Joined ✓</span>}</div></div>
      </div>
    </div>
    {status&&<div className={`flash ${/(berhasil|dikirim|disimpan)/i.test(status)?"success":"error"}`}>{status}</div>}
  </section>;
}
