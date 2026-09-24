"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Row=Record<string,any>;
const LUMAWAY_COMMUNITY_URL="https://chat.whatsapp.com/L5UA1dmP7BYFNgQfwwXg8C";

export default function UserProfile({workspaceId,userId}:{workspaceId:string;userId:string}){
  const supabase=createClient();
  const [profile,setProfile]=useState<Row|null>(null);
  const [form,setForm]=useState<Row>({full_name:"",nickname:"",position_title:"",bio:"",education:"",birth_date:""});
  const [socialAlias,setSocialAlias]=useState("");
  const [socialBusy,setSocialBusy]=useState(false);
  const [newEmail,setNewEmail]=useState("");
  const [newPhone,setNewPhone]=useState("");
  const [otp,setOtp]=useState("");
  const [phonePending,setPhonePending]=useState(false);
  const [channelUrl,setChannelUrl]=useState("");
  const [busy,setBusy]=useState(false);
  const [emailBusy,setEmailBusy]=useState(false);
  const [phoneBusy,setPhoneBusy]=useState(false);
  const [otpExpiresAt,setOtpExpiresAt]=useState<number|null>(null);
  const [otpRemaining,setOtpRemaining]=useState(0);
  const [status,setStatus]=useState("");
  const [editingProfile,setEditingProfile]=useState(false);

  async function load(){
    const [p,s]=await Promise.all([
      supabase.from("profiles").select("id,email,full_name,nickname,phone,phone_verified_at,email_verified_at,profile_completed,avatar_url,bio,education,birth_date,position_title,social_alias,social_avatar_key,social_avatar_url,whatsapp_opt_in,whatsapp_opt_in_at,whatsapp_channel_joined_at,updated_at").eq("id",userId).single(),
      supabase.from("luma_platform_settings").select("setting_value").eq("setting_key","whatsapp_channel_url").maybeSingle(),
    ]);
    if(p.error)return setStatus(p.error.message);
    const data=p.data as Row;setProfile(data);setForm({full_name:data.full_name||"",nickname:data.nickname||"",position_title:data.position_title||"",bio:data.bio||"",education:data.education||"",birth_date:data.birth_date||""});setSocialAlias(data.social_alias||"LumaUser");setEditingProfile(!Boolean(data.profile_completed));setChannelUrl(s.data?.setting_value||LUMAWAY_COMMUNITY_URL);
  }
  useEffect(()=>{void load()},[userId]);
  useEffect(()=>{
    if(!otpExpiresAt){setOtpRemaining(0);return}
    const tick=()=>{
      const remaining=Math.max(0,Math.ceil((otpExpiresAt-Date.now())/1000));
      setOtpRemaining(remaining);
      if(remaining<=0)setOtp("");
    };
    tick();
    const timer=window.setInterval(tick,1000);
    return()=>window.clearInterval(timer);
  },[otpExpiresAt]);

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
    setStatus(completed?"Selamat profil kamu sudah lengkap. Kamu dapat menggunakan seluruh fitur sesuai masa aktif.":"Data profil tersimpan. Verifikasi email dan WhatsApp untuk menyelesaikan profil.");
    window.dispatchEvent(new Event("lumaway-profile-updated"));
    await load();
  }

  async function uploadAvatar(file:File|null){if(!file)return;if(!file.type.startsWith("image/"))return setStatus("Avatar harus berupa gambar.");if(file.size>5*1024*1024)return setStatus("Avatar maksimal 5 MB.");setBusy(true);const ext=file.name.split(".").pop()?.toLowerCase()||"jpg";const path=`${userId}/avatar-${Date.now()}.${ext}`;const {error}=await supabase.storage.from("luma-avatars").upload(path,file,{upsert:true,contentType:file.type});if(error){setBusy(false);return setStatus(error.message)}const {data}=supabase.storage.from("luma-avatars").getPublicUrl(path);const {error:u}=await supabase.from("profiles").update({avatar_url:data.publicUrl,updated_at:new Date().toISOString()}).eq("id",userId);setBusy(false);if(u)return setStatus(u.message);setStatus("Foto profil diperbarui.");await load();}

  async function saveCommunityProfile(){
    const alias=socialAlias.trim();
    if(alias.length<3||alias.length>30)return setStatus("Nama Community harus 3-30 karakter.");
    setSocialBusy(true);
    const {error}=await supabase.rpc("luma_update_social_identity",{p_alias:alias,p_avatar_url:null});
    setSocialBusy(false);
    if(error)return setStatus(error.message);
    setStatus("Profil Community berhasil diperbarui.");
    window.dispatchEvent(new Event("lumaway-social-profile-updated"));
    await load();
  }

  async function uploadCommunityAvatar(file:File|null){
    if(!file)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type))return setStatus("Foto Community harus JPG, PNG, atau WEBP.");
    if(file.size>5*1024*1024)return setStatus("Foto Community maksimal 5 MB.");
    const alias=(socialAlias||profile?.social_alias||"LumaUser").trim();
    setSocialBusy(true);
    const ext=file.name.split(".").pop()?.toLowerCase()||"jpg";
    const path=`${userId}/community-${Date.now()}.${ext}`;
    const {error}=await supabase.storage.from("luma-avatars").upload(path,file,{upsert:true,contentType:file.type});
    if(error){setSocialBusy(false);return setStatus(error.message)}
    const {data}=supabase.storage.from("luma-avatars").getPublicUrl(path);
    const {error:updateError}=await supabase.rpc("luma_update_social_identity",{p_alias:alias,p_avatar_url:data.publicUrl});
    setSocialBusy(false);
    if(updateError)return setStatus(updateError.message);
    setStatus("Foto profil Community berhasil diperbarui.");
    window.dispatchEvent(new Event("lumaway-social-profile-updated"));
    await load();
  }

  async function changeEmail(){
    if(emailBusy)return;
    if(!newEmail.includes("@"))return setStatus("Masukkan email baru yang valid.");
    setEmailBusy(true);
    const {error}=await supabase.auth.updateUser({email:newEmail},{emailRedirectTo:window.location.origin+"/app.lumaway/profile"});
    setEmailBusy(false);
    if(error)return setStatus(error.message);
    setStatus("Link verifikasi email sudah dikirim. Email login berubah setelah verifikasi selesai.");
    setNewEmail("");
  }

  async function requestPhone(){
    if(phoneBusy)return;
    if(!newPhone.trim())return setStatus("Masukkan nomor WhatsApp dalam format 08... atau +62812...");
    setPhoneBusy(true);setStatus("Mengirim OTP melalui WhatsApp bot...");setOtp("");
    try{
      const r=await fetch("/api/profile/whatsapp-otp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,action:"request",phone:newPhone.trim()})});
      const d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.error||"Gagal mengirim OTP.");
      const expiresIn=Math.max(30,Number(d.expires_in||300));
      setPhonePending(true);setOtpExpiresAt(Date.now()+expiresIn*1000);setOtpRemaining(expiresIn);
      const provider=String(d.provider||"WhatsApp");
      setStatus("OTP 6 digit dikirim melalui "+provider+". Kode berlaku "+Math.ceil(expiresIn/60)+" menit.");
    }catch(e:any){setStatus(e?.message||"Gagal mengirim OTP WhatsApp.")}finally{setPhoneBusy(false)}
  }

  async function verifyPhone(){
    if(phoneBusy)return;
    if(otpRemaining<=0)return void requestPhone();
    if(!otp.trim()||!newPhone.trim())return;
    setPhoneBusy(true);setStatus("Memverifikasi OTP...");
    try{
      const r=await fetch("/api/profile/whatsapp-otp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,action:"verify",phone:newPhone.trim(),otp:otp.trim()})});
      const d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.error||"OTP gagal diverifikasi.");
      const {data:{user}}=await supabase.auth.getUser();
      const emailVerifiedAt=(user as any)?.email_confirmed_at||profile?.email_verified_at||null;
      const completed=Boolean(emailVerifiedAt&&String(form.full_name||"").trim()&&String(form.nickname||"").trim()&&String(form.education||"").trim()&&String(form.birth_date||"").trim()&&String(form.bio||"").trim());
      await supabase.from("profiles").update({email_verified_at:emailVerifiedAt,profile_completed:completed,updated_at:new Date().toISOString()}).eq("id",userId);
      setStatus(completed?"Nomor WhatsApp terverifikasi. Profil Anda sudah lengkap.":"Nomor WhatsApp berhasil diverifikasi. Lengkapi data profil untuk melanjutkan.");
      window.dispatchEvent(new Event("lumaway-profile-updated"));
      setPhonePending(false);setOtp("");setOtpExpiresAt(null);setNewPhone("");await load();
    }catch(e:any){setStatus(e?.message||"OTP gagal diverifikasi.")}finally{setPhoneBusy(false)}
  }

  async function confirmChannel(){const now=new Date().toISOString();const {error}=await supabase.from("profiles").update({whatsapp_channel_joined_at:now,updated_at:now}).eq("id",userId);if(error)return setStatus(error.message);setStatus("Status bergabung ke saluran WhatsApp disimpan.");await load();}

  return <section id="profile" className="legacy-page-anchor profile-page">
    <div className="eyebrow">ACCOUNT</div><h1>My Profile</h1>{!profile?.profile_completed&&<div className="profile-completion-notice"><strong>Lengkapi profil sebelum melanjutkan</strong><span>Isi data wajib dan verifikasi email serta WhatsApp. Foto profil tetap opsional.</span></div>}<p className="muted">Data pribadi Anda terpisah dari profil Community. Nama dan foto Community dapat Anda atur sendiri tanpa menampilkan email atau nomor WhatsApp.</p>
    {profile?.profile_completed&&<div className="profile-complete-success"><strong>Selamat profil kamu sudah lengkap.</strong><span>Kamu dapat menggunakan seluruh fitur Lumaway sesuai masa aktif akun.</span></div>}
    <div className="profile-layout">
      <div className="card profile-identity-card">
        <div className="profile-avatar-large">{profile?.avatar_url?<img src={profile.avatar_url} alt="Profile"/>:<span>{String(profile?.full_name||profile?.email||"U").slice(0,1).toUpperCase()}</span>}</div>
        <h2>{profile?.full_name||"LUMA User"}</h2><p>{form.position_title||"Tambahkan posisi / profesi"}</p>
        <label className="avatar-upload">Change photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>uploadAvatar(e.target.files?.[0]||null)}/></label>
        <div className="profile-contact"><span>Email</span><b>{profile?.email||"-"}</b><span>WhatsApp</span><b>{profile?.phone||"-"} {profile?.phone_verified_at&&<em>Verified</em>}</b><span>Community Name</span><b>{profile?.social_alias||"-"}</b></div>
      </div>
      <div>
        <div className="card"><div className="profile-card-head"><div><h3>Personal Information</h3>{profile?.profile_completed&&!editingProfile&&<span className="profile-complete-badge">Profil lengkap ✓</span>}</div>{profile?.profile_completed&&!editingProfile&&<button type="button" className="secondary" onClick={()=>{setEditingProfile(true);setStatus("")}}>Edit</button>}</div><div className="grid"><label>Nama Lengkap<input disabled={Boolean(profile?.profile_completed&&!editingProfile)} value={form.full_name||""} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><label>Nama Panggilan<input disabled={Boolean(profile?.profile_completed&&!editingProfile)} value={form.nickname||""} onChange={e=>setForm({...form,nickname:e.target.value})} placeholder="Nama yang dipakai Luma"/></label><label>Posisi / Profesi<input disabled={Boolean(profile?.profile_completed&&!editingProfile)} value={form.position_title||""} onChange={e=>setForm({...form,position_title:e.target.value})} placeholder="Contoh: Marketing Specialist"/></label><label>Pendidikan<input disabled={Boolean(profile?.profile_completed&&!editingProfile)} value={form.education||""} onChange={e=>setForm({...form,education:e.target.value})} placeholder="Contoh: S1 Marketing"/></label><label>Tanggal Lahir<input disabled={Boolean(profile?.profile_completed&&!editingProfile)} type="date" value={form.birth_date||""} onChange={e=>setForm({...form,birth_date:e.target.value})}/></label></div><label>Bio Singkat<textarea disabled={Boolean(profile?.profile_completed&&!editingProfile)} value={form.bio||""} onChange={e=>setForm({...form,bio:e.target.value})} placeholder="Ceritakan fokus pekerjaan, pengalaman, atau minat profesional Anda."/></label>{(!profile?.profile_completed||editingProfile)&&<div className="button-row"><button className="primary" disabled={busy} onClick={saveProfile}>{busy?"Saving...":profile?.profile_completed?"Save Change":"Save Profile"}</button>{profile?.profile_completed&&<button type="button" className="secondary" disabled={busy} onClick={()=>{setEditingProfile(false);setStatus("");void load()}}>Cancel</button>}</div>}</div>
        <div className="card community-profile-card"><div className="profile-card-head"><div><span className="eyebrow">LUMAWAY SOCIAL</span><h3>Community Profile</h3><p className="muted">Nama dan foto ini yang tampil pada feed Community. Data login dan kontak pribadi tetap tersembunyi.</p></div></div><div className="community-profile-editor"><div className="community-avatar-preview">{profile?.social_avatar_url?<img src={profile.social_avatar_url} alt="Community Profile"/>:<span>{String(profile?.social_alias||"L").slice(0,1).toUpperCase()}</span>}</div><div className="community-profile-fields"><label>Nama Community<input value={socialAlias} maxLength={30} onChange={e=>setSocialAlias(e.target.value)} placeholder="Nama yang tampil di Lumaway Social"/></label><div className="button-row"><label className="avatar-upload">Ganti foto Community<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void uploadCommunityAvatar(e.target.files?.[0]||null)}/></label><button type="button" className="primary" disabled={socialBusy} onClick={()=>void saveCommunityProfile()}>{socialBusy?"Saving...":"Simpan Community Profile"}</button></div><small>3-30 karakter. Jangan gunakan email, nomor telepon, atau link sebagai nama Community.</small></div></div></div>
        <div className="grid profile-security-grid">
          <div className="card"><h3>Change Email</h3><p className="muted">Email baru wajib diverifikasi melalui link keamanan sebelum menjadi email login aktif.</p><label>Email baru<input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="new@email.com"/></label><button type="button" className="secondary" disabled={emailBusy} onClick={()=>void changeEmail()}>{emailBusy?"Sending...":"Send Verification"}</button></div>
          <div className="card"><h3>Verify WhatsApp</h3><p className="muted">OTP dikirim melalui bot WhatsApp Lumaway. Nomor terverifikasi dipakai untuk keamanan akun dan komunikasi yang Anda setujui.</p><label>Nomor WhatsApp<input value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="08... atau +62812..." disabled={phoneBusy}/></label>{phonePending&&<label>OTP<input inputMode="numeric" maxLength={6} value={otp} disabled={phoneBusy||otpRemaining<=0} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder={otpRemaining>0?"6 digit OTP":"OTP kedaluwarsa"}/>{otpRemaining>0?<small className="otp-countdown">Berlaku {Math.floor(otpRemaining/60)}:{String(otpRemaining%60).padStart(2,"0")}</small>:<small className="otp-expired">OTP kedaluwarsa. Klik Verifikasi Ulang untuk meminta kode baru.</small>}</label>}<div className="button-row">{!phonePending?<button type="button" className="secondary" disabled={phoneBusy} onClick={()=>void requestPhone()}>{phoneBusy?"Sending...":"Send WhatsApp OTP"}</button>:otpRemaining<=0?<><button type="button" className="primary" disabled={phoneBusy} onClick={()=>void requestPhone()}>{phoneBusy?"Sending...":"Verifikasi Ulang"}</button><button type="button" className="secondary" disabled={phoneBusy} onClick={()=>{setPhonePending(false);setOtp("");setOtpExpiresAt(null)}}>Cancel</button></>:<><button type="button" className="primary" disabled={phoneBusy||otp.length!==6} onClick={()=>void verifyPhone()}>{phoneBusy?"Verifying...":"Verify OTP"}</button><button type="button" className="secondary" disabled={phoneBusy} onClick={()=>{setPhonePending(false);setOtp("");setOtpExpiresAt(null)}}>Cancel</button></>}</div></div>
        </div>
        <div className="card whatsapp-channel-card whatsapp-community-card"><div><span className="eyebrow">LUMAWAY COMMUNITY</span><h3>Grup WhatsApp Lumaway</h3><p className="muted">{profile?.phone_verified_at?"Nomor WhatsApp Anda sudah terverifikasi. Scan QR atau buka grup untuk bergabung ke komunitas Lumaway.":"Verifikasi nomor WhatsApp terlebih dahulu. Setelah berhasil, QR untuk bergabung ke komunitas akan muncul di sini."}</p></div>{profile?.phone_verified_at?<div className="whatsapp-community-join"><img src={`https://quickchart.io/qr?size=220&margin=1&text=${encodeURIComponent(channelUrl||LUMAWAY_COMMUNITY_URL)}`} alt="QR LUMAWAY Community"/><div className="button-row"><a className="button primary" href={channelUrl||LUMAWAY_COMMUNITY_URL} target="_blank" rel="noreferrer">Bergabung ke LUMAWAY Community</a>{!profile?.whatsapp_channel_joined_at&&<button className="secondary" onClick={confirmChannel}>Saya sudah bergabung</button>}{profile?.whatsapp_channel_joined_at&&<span className="status-pill s-paid">Joined ✓</span>}</div></div>:<span className="status-pill">Menunggu verifikasi WhatsApp</span>}</div>
      </div>
    </div>
    {status&&<div className={`flash ${/^(Selamat|Data profil tersimpan|Foto profil diperbarui|Profil Community berhasil diperbarui|Foto profil Community berhasil diperbarui|Link verifikasi email sudah dikirim|OTP 6 digit dikirim|Nomor WhatsApp terverifikasi|Nomor WhatsApp berhasil diverifikasi|Status bergabung)/i.test(status)?"success":"error"}`}>{status}</div>}
  </section>;
}
