"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

const rp=(v:any)=>"Rp "+Math.round(Number(v||0)).toLocaleString("id-ID");
const no=(v:any)=>Math.round(Number(v||0)).toLocaleString("id-ID");
const month=()=>{const d=new Date(),y=d.getFullYear(),m=d.getMonth();return{start:new Date(y,m,1).toISOString().slice(0,10),end:new Date(y,m+1,0).toISOString().slice(0,10)}};

export function Host360Panel({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]),r=month();
 const emptyForm={name:"",username:"",platform:"TikTok",host_type:"inhouse",ratecard:"",phone:"",email:"",notes:""};
 const [hosts,setHosts]=useState<any[]>([]),[q,setQ]=useState(""),[selected,setSelected]=useState<any>(null),[detail,setDetail]=useState<any>(null),[open,setOpen]=useState(false);
 const [form,setForm]=useState(emptyForm),[editId,setEditId]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 async function loadHosts(){const x=await supabase.from("live_hosts").select("*").eq("workspace_id",workspaceId).eq("status","active").order("name");setHosts(x.data||[])}
 async function loadDetail(id:string){const x=await supabase.rpc("luma_live_host_360_v1",{p_workspace_id:workspaceId,p_host_id:id,p_start:r.start,p_end:r.end});setDetail(x.data||{})}
 useEffect(()=>{void loadHosts()},[workspaceId]);
 useEffect(()=>{if(selected?.id)void loadDetail(selected.id)},[selected?.id]);
 function openCreate(){setEditId("");setForm(emptyForm);setMsg("");setOpen(true)}
 function openEdit(host:any){setEditId(String(host.id));setForm({name:host.name||"",username:host.username||"",platform:host.platform||"TikTok",host_type:host.host_type||"inhouse",ratecard:String(host.ratecard??""),phone:host.phone||"",email:host.email||"",notes:host.notes||""});setMsg("");setOpen(true)}
 async function save(){
   const payload={workspace_id:workspaceId,name:form.name.trim(),username:form.username.trim()||null,platform:form.platform,host_type:form.host_type,ratecard:Number(form.ratecard||0),phone:form.phone||null,email:form.email||null,notes:form.notes||null,status:"active",updated_at:new Date().toISOString()};
   if(!payload.name){setMsg("Nama host wajib diisi.");return}
   setBusy(true);setMsg("");
   const x=editId
     ? await supabase.from("live_hosts").update(payload).eq("workspace_id",workspaceId).eq("id",editId).select("*").single()
     : await supabase.from("live_hosts").insert(payload).select("*").single();
   if(x.error){setMsg(x.error.message);setBusy(false);return}
   setOpen(false);setEditId("");setForm(emptyForm);await loadHosts();setSelected(x.data);setDetail(null);setBusy(false)
 }
 async function removeHost(host:any){
   if(!host?.id||busy)return;
   if(!window.confirm(`Hapus host "${host.name}"? Jika host sudah dipakai pada session/import, host akan dinonaktifkan agar histori tetap aman.`))return;
   setBusy(true);setMsg("");
   const [sessions,imports]=await Promise.all([
     supabase.from("live_sessions").select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).eq("host_id",host.id),
     supabase.from("live_imports").select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).eq("host_id",host.id)
   ]);
   if(sessions.error||imports.error){setMsg(sessions.error?.message||imports.error?.message||"Gagal memeriksa relasi host.");setBusy(false);return}
   const used=Number(sessions.count||0)+Number(imports.count||0)>0;
   const x=used
     ? await supabase.from("live_hosts").update({status:"inactive",updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",host.id)
     : await supabase.from("live_hosts").delete().eq("workspace_id",workspaceId).eq("id",host.id);
   if(x.error){setMsg(x.error.message);setBusy(false);return}
   setMsg(used?"Host sudah dipakai pada histori, jadi dinonaktifkan dan disembunyikan tanpa merusak data lama.":"Host berhasil dihapus permanen.");
   setSelected(null);setDetail(null);await loadHosts();setBusy(false)
 }
 const filtered=hosts.filter(h=>(h.name+" "+(h.username||"")).toLowerCase().includes(q.toLowerCase()));
 const t=detail?.totals||{},h=detail?.host||selected||{};
 return <div className="host360-wrap">
  <div className="host360-toolbar"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari nama atau username host..."/><button onClick={openCreate}>+ Tambah Host</button></div>{msg&&<div className="live-upload-msg">{msg}</div>}
  <div className="host360-grid">
   <aside>{filtered.length?filtered.map(host=><button key={host.id} className={selected?.id===host.id?"active":""} onClick={()=>setSelected(host)}><span className="host-avatar">{host.name.slice(0,1).toUpperCase()}</span><span><strong>{host.name}</strong><small>{host.username||host.platform} · {host.host_type}</small></span></button>):<div className="host-empty">Belum ada host.</div>}</aside>
   <main>{selected?<><div className="host360-hero"><div className="host-avatar big">{h.name?.slice(0,1).toUpperCase()}</div><div><span>HOST 360</span><h2>{h.name}</h2><p>{h.username||"-"} · {h.platform||"-"} · {h.host_type||"-"}</p></div><div className="host-rate"><small>Ratecard</small><b>{rp(h.ratecard)}</b><div className="host-master-actions"><button type="button" onClick={()=>openEdit(selected)}>Edit</button><button type="button" className="danger-lite" disabled={busy} onClick={()=>void removeHost(selected)}>Hapus</button></div></div></div>
    <div className="host-kpis">{[["GMV",rp(t.gmv)],["Orders",no(t.orders)],["Duration",no(t.duration_minutes)+" min"],["Revenue/Hour",rp(t.revenue_per_hour)],["Peak Viewer",no(t.peak_viewers)],["Avg Viewer",no(t.avg_viewers)]].map(([l,v])=><article key={l}><span>{l}</span><strong>{v}</strong></article>)}</div>
    <div className="host-signal"><article><span>BEST HOUR</span><h3>{detail?.best_hour?.hour_bucket!=null?String(detail.best_hour.hour_bucket).padStart(2,"0")+":00":"Belum terbaca"}</h3><p>{detail?.best_hour?.gmv?rp(detail.best_hour.gmv):"Butuh data beberapa sesi."}</p></article><article><span>BEST GIMMICK</span><h3>{detail?.best_gimmick?.gimmick||"Belum terbaca"}</h3><p>{detail?.best_gimmick?.gmv?rp(detail.best_gimmick.gmv):"Tambahkan gimmick pada sesi live."}</p></article></div>
    <section className="host-history"><header><span>SESSION HISTORY</span><h3>Riwayat live</h3></header>{(detail?.history||[]).length?(detail.history||[]).map((x:any)=><article key={x.id}><div><strong>{x.title}</strong><small>{x.session_date} · {x.platform} · {x.gimmick||"Tanpa gimmick"}</small></div><div><b>{rp(x.gmv)}</b><small>{no(x.orders)} orders · {no(x.duration_minutes)} min</small></div></article>):<div className="host-empty">Belum ada session untuk host ini.</div>}</section>
   </>:<div className="host-empty large">Pilih host untuk membuka Host 360.</div>}</main>
  </div>
  {open&&<div className="host-modal-bg" onClick={()=>!busy&&setOpen(false)}><div className="host-modal" onClick={e=>e.stopPropagation()}><header><div><span>HOST MASTER</span><h2>{editId?"Edit Host":"Tambah Host"}</h2></div><button disabled={busy} onClick={()=>setOpen(false)}>×</button></header><div className="host-form">
   <label>Nama<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Username<input value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></label>
   <label>Platform<select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})}><option>TikTok</option><option>Shopee</option><option>Instagram</option><option>Other</option></select></label>
   <label>Tipe<select value={form.host_type} onChange={e=>setForm({...form,host_type:e.target.value})}><option value="inhouse">Inhouse</option><option value="outhouse">Outhouse</option></select></label>
   <label>Ratecard<input inputMode="numeric" value={form.ratecard} onChange={e=>setForm({...form,ratecard:e.target.value})}/></label><label>Phone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
   <label>Email<input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Notes<input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
  </div>{msg&&<div className="live-upload-msg">{msg}</div>}<footer><button disabled={busy} onClick={()=>setOpen(false)}>Batal</button><button disabled={busy} onClick={()=>void save()}>{busy?"Menyimpan...":editId?"Simpan Perubahan":"Simpan Host"}</button></footer></div></div>}
 </div>
}

export function SessionPlannerPanel({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [hosts,setHosts]=useState<any[]>([]),[sessions,setSessions]=useState<any[]>([]),[open,setOpen]=useState(false),[view,setView]=useState("board");
 const [form,setForm]=useState({title:"",host_id:"",platform:"TikTok",campaign_name:"",gimmick:"",session_date:new Date().toISOString().slice(0,10),start_time:"09:00",end_time:"11:00",target_gmv:"",target_orders:"",target_viewers:"",ads_budget:"",host_cost:"",studio_cost:"",production_cost:"",other_cost:""});
 async function load(){const [h,s]=await Promise.all([supabase.from("live_hosts").select("id,name,username,platform,host_type").eq("workspace_id",workspaceId).eq("status","active").order("name"),supabase.from("live_sessions").select("*,live_hosts(name,username)").eq("workspace_id",workspaceId).order("session_date",{ascending:true}).order("start_at",{ascending:true})]);setHosts(h.data||[]);setSessions(s.data||[])}
 useEffect(()=>{void load()},[workspaceId]);
 async function save(){
  const at=(d:string,t:string)=>new Date(d+"T"+t+":00+07:00").toISOString();
  const p:any={workspace_id:workspaceId,title:form.title.trim(),host_id:form.host_id||null,platform:form.platform,campaign_name:form.campaign_name||null,gimmick:form.gimmick||null,session_date:form.session_date,start_at:at(form.session_date,form.start_time),end_at:at(form.session_date,form.end_time),status:"scheduled",target_gmv:Number(form.target_gmv||0),target_orders:Number(form.target_orders||0),target_viewers:Number(form.target_viewers||0),ads_budget:Number(form.ads_budget||0),host_cost:Number(form.host_cost||0),studio_cost:Number(form.studio_cost||0),production_cost:Number(form.production_cost||0),other_cost:Number(form.other_cost||0)};
  if(!p.title)return;const x=await supabase.from("live_sessions").insert(p);if(!x.error){setOpen(false);await load()}
 }
 async function updateStatus(id:string,status:string){await supabase.from("live_sessions").update({status,updated_at:new Date().toISOString()}).eq("id",id).eq("workspace_id",workspaceId);await load()}
 const grouped=["planned","scheduled","ready","live","completed"].map(status=>({status,items:sessions.filter(s=>s.status===status)}));
 return <div className="session-planner">
  <div className="session-toolbar"><div><button className={view==="board"?"active":""} onClick={()=>setView("board")}>Board</button><button className={view==="timeline"?"active":""} onClick={()=>setView("timeline")}>Timeline</button></div><button onClick={()=>setOpen(true)}>+ Buat Session</button></div>
  {view==="board"?<div className="session-board">{grouped.map(col=><section key={col.status}><header><span>{col.status}</span><b>{col.items.length}</b></header>{col.items.map((s:any)=><article key={s.id}><div><strong>{s.title}</strong><small>{s.session_date} · {new Date(s.start_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</small></div><p>{s.live_hosts?.name||"Host belum dipilih"} · {s.platform}</p><div className="session-tags"><span>{s.gimmick||"No gimmick"}</span><span>Target {rp(s.target_gmv)}</span></div><select value={s.status} onChange={e=>void updateStatus(s.id,e.target.value)}>{["planned","scheduled","ready","live","completed","cancelled"].map(x=><option key={x}>{x}</option>)}</select></article>)}</section>)}</div>:<div className="session-timeline">{sessions.map((s:any)=><article key={s.id}><div className="time"><b>{new Date(s.start_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</b><small>{s.session_date}</small></div><div><strong>{s.title}</strong><span>{s.live_hosts?.name||"No host"} · {s.platform} · {s.gimmick||"No gimmick"}</span></div><em>{rp(s.target_gmv)}</em></article>)}{!sessions.length&&<div className="host-empty">Belum ada session.</div>}</div>}
  {open&&<div className="host-modal-bg" onClick={()=>setOpen(false)}><div className="host-modal wide" onClick={e=>e.stopPropagation()}><header><div><span>SESSION PLANNER</span><h2>Buat Live Session</h2></div><button onClick={()=>setOpen(false)}>×</button></header><div className="session-form">
   <label className="wide">Nama Session<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Contoh: Payday Night Session"/></label>
   <label>Host<select value={form.host_id} onChange={e=>setForm({...form,host_id:e.target.value})}><option value="">Pilih host</option>{hosts.map(h=><option value={h.id} key={h.id}>{h.name} {h.username?"("+h.username+")":""}</option>)}</select></label>
   <label>Platform<select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})}><option>TikTok</option><option>Shopee</option><option>Instagram</option></select></label>
   <label>Campaign<input value={form.campaign_name} onChange={e=>setForm({...form,campaign_name:e.target.value})}/></label>
   <label>Gimmick<select value={form.gimmick} onChange={e=>setForm({...form,gimmick:e.target.value})}><option value="">Pilih gimmick</option><option>Flash Sale</option><option>Voucher Drop</option><option>Bundling</option><option>Giveaway</option><option>Product Demo</option><option>Q&A</option><option>Limited Stock</option><option>Price Drop</option></select></label>
   <label>Tanggal<input type="date" value={form.session_date} onChange={e=>setForm({...form,session_date:e.target.value})}/></label><label>Mulai<input type="time" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})}/></label><label>Selesai<input type="time" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})}/></label>
   <label>Target GMV<input inputMode="numeric" value={form.target_gmv} onChange={e=>setForm({...form,target_gmv:e.target.value})}/></label><label>Target Orders<input inputMode="numeric" value={form.target_orders} onChange={e=>setForm({...form,target_orders:e.target.value})}/></label><label>Target Viewer<input inputMode="numeric" value={form.target_viewers} onChange={e=>setForm({...form,target_viewers:e.target.value})}/></label>
   <label>Ads Budget<input inputMode="numeric" value={form.ads_budget} onChange={e=>setForm({...form,ads_budget:e.target.value})}/></label><label>Host Cost<input inputMode="numeric" value={form.host_cost} onChange={e=>setForm({...form,host_cost:e.target.value})}/></label><label>Studio Cost<input inputMode="numeric" value={form.studio_cost} onChange={e=>setForm({...form,studio_cost:e.target.value})}/></label><label>Production Cost<input inputMode="numeric" value={form.production_cost} onChange={e=>setForm({...form,production_cost:e.target.value})}/></label><label>Other Cost<input inputMode="numeric" value={form.other_cost} onChange={e=>setForm({...form,other_cost:e.target.value})}/></label>
  </div><footer><button onClick={()=>setOpen(false)}>Batal</button><button onClick={()=>void save()}>Simpan Session</button></footer></div></div>}
 </div>
}
