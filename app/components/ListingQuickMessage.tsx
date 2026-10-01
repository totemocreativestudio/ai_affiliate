"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
type Row=Record<string,any>;

const CHANNELS=["WhatsApp","DM Instagram","DM TikTok","Email","Lainnya"];
const STAGES=["","Reach Out","Follow Up","Negotiation","Sample Sent","Content In Progress","Uploaded","Live"];

function renderTemplate(body:string,ctx:Row){
 const vars:Record<string,string>={
  creator_name:String(ctx.creator_name||"Creator"),
  creator_username:String(ctx.creator_username||""),
  product_name:String(ctx.product_name||""),
  sku:String(ctx.sku||""),
  next_action:String(ctx.next_action||""),
  follow_up_date:ctx.next_follow_up_at?new Date(ctx.next_follow_up_at).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"}):"",
  pic_name:String(ctx.pic_name||"")
 };
 return body.replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>vars[key]??"");
}

export default function ListingQuickMessage({workspaceId,listing,creatorUsername,picName}:{workspaceId:string;listing:Row;creatorUsername?:string|null;picName?:string|null}){
 const supabase=useMemo(()=>createClient(),[]);
 const [templates,setTemplates]=useState<Row[]>([]),[channel,setChannel]=useState(listing.follow_up_channel||"WhatsApp"),[stage,setStage]=useState(listing.stage||"Follow Up"),[selectedId,setSelectedId]=useState(""),[editing,setEditing]=useState(false),[form,setForm]=useState({name:"",channel:"WhatsApp",stage:"",body:""}),[msg,setMsg]=useState("");
 async function load(){
  const x=await supabase.from("luma_followup_message_templates").select("*").eq("workspace_id",workspaceId).eq("active",true).order("name");
  setTemplates(x.data||[]);
 }
 useEffect(()=>{void load()},[workspaceId]);
 useEffect(()=>{setChannel(listing.follow_up_channel||"WhatsApp");setStage(listing.stage||"Follow Up");setSelectedId("")},[listing.id]);
 const filtered=templates.filter(x=>(!channel||x.channel===channel)&&(!x.stage||x.stage===stage));
 const selected=templates.find(x=>String(x.id)===selectedId)||filtered[0]||null;
 const preview=selected?renderTemplate(selected.body,{...listing,creator_username:creatorUsername,pic_name:picName}):"";
 async function copy(){
  if(!preview)return;
  await navigator.clipboard.writeText(preview);setMsg("Pesan disalin.");
  setTimeout(()=>setMsg(""),1800);
 }
 async function save(){
  if(!form.name.trim()||!form.body.trim())return setMsg("Nama dan isi template wajib diisi.");
  const {data:{user}}=await supabase.auth.getUser();
  const x=await supabase.from("luma_followup_message_templates").insert({workspace_id:workspaceId,name:form.name.trim(),channel:form.channel,stage:form.stage||null,body:form.body,created_by:user?.id||null});
  if(x.error)return setMsg(x.error.message);
  setEditing(false);setForm({name:"",channel:channel||"WhatsApp",stage:stage||"",body:""});setMsg("Template tersimpan.");await load();
 }
 return <section className="listing-quick-message">
  <header><div><span>QUICK MESSAGE</span><h4>Follow-Up Message</h4><p>Pilih template, cek preview, lalu copy. Lumaway tidak mengirim pesan otomatis.</p></div><button onClick={()=>{setEditing(true);setForm({name:"",channel:channel||"WhatsApp",stage:stage||"",body:""})}}>+ Template</button></header>
  <div className="lqm-controls"><select value={channel} onChange={e=>{setChannel(e.target.value);setSelectedId("")}}>{CHANNELS.map(x=><option key={x}>{x}</option>)}</select><select value={stage} onChange={e=>{setStage(e.target.value);setSelectedId("")}}>{STAGES.filter(Boolean).map(x=><option key={x}>{x}</option>)}</select><select value={selectedId||String(selected?.id||"")} onChange={e=>setSelectedId(e.target.value)}><option value="">Pilih template</option>{filtered.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
  {selected?<><div className="lqm-preview"><span>PREVIEW</span><p>{preview}</p></div><div className="lqm-actions"><small>{selected.name} · {selected.channel}{selected.stage?" · "+selected.stage:""}</small><button onClick={()=>void copy()}>Copy Message</button></div></>:<div className="lqm-empty">Belum ada template untuk channel/stage ini.</div>}
  {msg&&<div className="lqm-msg">{msg}</div>}
  {editing&&<div className="lqm-modal"><div><header><h4>Tambah Template</h4><button onClick={()=>setEditing(false)}>×</button></header><label>Nama<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Contoh: Follow Up Sample"/></label><label>Channel<select value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})}>{CHANNELS.map(x=><option key={x}>{x}</option>)}</select></label><label>Stage<select value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>{STAGES.map(x=><option key={x||"all"} value={x}>{x||"Semua Stage"}</option>)}</select></label><label>Isi Pesan<textarea rows={7} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder={"Halo {{creator_name}}, follow up untuk {{product_name}}..."}/><small>Variables: creator_name, creator_username, product_name, sku, next_action, follow_up_date, pic_name</small></label><footer><button onClick={()=>setEditing(false)}>Batal</button><button className="primary" onClick={()=>void save()}>Simpan Template</button></footer></div></div>}
 </section>
}
