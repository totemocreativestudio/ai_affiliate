"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Row=Record<string,any>;

export default function AdminBroadcast({workspaceId}:{workspaceId:string}){
  const supabase=createClient();
  const [form,setForm]=useState({category:"education",concept:"",goal:"",title:"",body:"",action_label:"Buka",action_url:"#content-hub",image_prompt:"",image_url:"",scope:"global"});
  const [busy,setBusy]=useState(false);const [status,setStatus]=useState("");const [history,setHistory]=useState<Row[]>([]);
  async function load(){const {data}=await supabase.from("luma_notifications").select("id,title,body,category,status,image_url,action_url,published_at,created_at").order("created_at",{ascending:false}).limit(50);setHistory((data||[]) as Row[])}
  useEffect(()=>{void load()},[workspaceId]);

  async function call(action:string,payload:any={}){setBusy(true);try{const r=await fetch("/api/admin/broadcast",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,action,...payload})});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Broadcast request failed");return d}catch(e:any){setStatus(e?.message||"Broadcast request failed");return null}finally{setBusy(false)}}
  async function generateCopy(){setStatus("AI menyusun materi broadcast...");const d=await call("generate_copy",{category:form.category,concept:form.concept,goal:form.goal,action_url:form.action_url});if(d){setForm(f=>({...f,...d.result}));setStatus("Copy siap direview. Anda tetap bisa edit sebelum publish.")}}
  async function generateImage(){setStatus("AI membuat gambar broadcast...");const d=await call("generate_image",{image_prompt:form.image_prompt});if(d){setForm(f=>({...f,image_url:d.image_url}));setStatus("Gambar broadcast siap.")}}
  async function publish(){if(!form.title||!form.body)return setStatus("Title dan body wajib diisi.");setStatus("Mempublikasikan ke user...");const d=await call("publish",form);if(d){setStatus(`Broadcast #${d.id} dipublikasikan.`);await load()}}

  return <div className="admin-broadcast-grid">
    <div className="card"><div className="section-head"><div><h3>AI Broadcast Composer</h3><p className="muted">Generate materi + visual, review, lalu broadcast ke seluruh user atau workspace aktif.</p></div></div>
      <div className="grid"><label>Jenis<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="promo">Promo</option><option value="education">Edukasi</option><option value="product">Product Update</option><option value="system">System</option><option value="blog">Blog</option><option value="info">Info</option></select></label><label>Audience<select value={form.scope} onChange={e=>setForm({...form,scope:e.target.value})}><option value="global">Semua user Lumaway</option><option value="workspace">Workspace aktif</option></select></label></div>
      <label>Konsep materi<textarea value={form.concept} onChange={e=>setForm({...form,concept:e.target.value})} placeholder="Contoh: promo token akhir bulan, edukasi membaca dashboard affiliate..."/></label>
      <label>Tujuan<textarea value={form.goal} onChange={e=>setForm({...form,goal:e.target.value})} placeholder="Apa tindakan atau pesan utama yang ingin dicapai?"/></label>
      <button className="secondary" disabled={busy||!form.concept.trim()} onClick={generateCopy}>✦ Generate Copy + Image Concept</button>
      <div className="grid"><label>Title<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>CTA Label<input value={form.action_label} onChange={e=>setForm({...form,action_label:e.target.value})}/></label></div>
      <label>Body<textarea value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label>
      <label>Action URL<input value={form.action_url} onChange={e=>setForm({...form,action_url:e.target.value})} placeholder="#billing atau /blog/slug"/></label>
      <label>Image Concept / Prompt<textarea value={form.image_prompt} onChange={e=>setForm({...form,image_prompt:e.target.value})}/></label>
      <div className="button-row"><button className="secondary" disabled={busy||!form.image_prompt.trim()} onClick={generateImage}>Generate Image</button><button className="primary" disabled={busy||!form.title||!form.body} onClick={publish}>Broadcast Now</button></div>
      {status&&<div className="flash success">{status}</div>}
    </div>
    <div className="card broadcast-preview-card"><h3>Preview</h3>{form.image_url?<img className="broadcast-preview-image" src={form.image_url} alt="Broadcast preview"/>:<div className="broadcast-image-placeholder">AI image preview</div>}<span className={`notification-category n-${form.category}`}>{form.category}</span><h2>{form.title||"Broadcast title"}</h2><p>{form.body||"Isi broadcast akan tampil di sini."}</p>{form.action_label&&<button className="primary">{form.action_label}</button>}</div>
    <div className="card admin-broadcast-history"><h3>Broadcast History</h3><div className="scroll"><table><thead><tr><th>Category</th><th>Title</th><th>Status</th><th>Published</th></tr></thead><tbody>{history.map(x=><tr key={x.id}><td>{x.category}</td><td>{x.title}</td><td>{x.status}</td><td>{x.published_at?new Date(x.published_at).toLocaleString("id-ID"):"-"}</td></tr>)}</tbody></table></div></div>
  </div>;
}
