"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Task = {
  id:number; title:string; description:string|null; status:string|null; priority:string|null;
  due_date:string|null; assigned_to:string|null; sort_order:number|null; source:string|null;
  analysis_type:string|null; source_ref:string|null;
};

type Props={workspaceId:string;userId:string};
const COLUMNS=[
  ["backlog","Backlog"],["progress","In Progress"],["review","Review"],["done","Done"]
] as const;

export default function KanbanBoard({workspaceId,userId}:Props){
  const supabase=createClient();
  const [tasks,setTasks]=useState<Task[]>([]);
  const [busy,setBusy]=useState(false);
  const [editing,setEditing]=useState<Task|null>(null);
  const [form,setForm]=useState({title:"",description:"",priority:"normal",due_date:"",assigned_to:""});
  const [msg,setMsg]=useState("");

  async function load(){
    const {data,error}=await supabase.from("creator_tasks").select("id,title,description,status,priority,due_date,assigned_to,sort_order,source,analysis_type,source_ref").eq("workspace_id",workspaceId).order("sort_order",{ascending:true}).order("id",{ascending:true});
    if(error)setMsg(error.message); else setTasks((data||[]) as Task[]);
  }
  useEffect(()=>{void load()},[workspaceId]);

  async function createTask(){
    if(!form.title.trim())return setMsg("Judul task wajib diisi.");
    setBusy(true);
    const {error}=await supabase.from("creator_tasks").insert({workspace_id:workspaceId,title:form.title.trim(),description:form.description||null,status:"backlog",priority:form.priority,due_date:form.due_date||null,assigned_to:form.assigned_to||null,source:"web",created_by:userId,sort_order:Date.now()});
    setBusy(false); if(error)return setMsg(error.message); setForm({title:"",description:"",priority:"normal",due_date:"",assigned_to:""}); setMsg("Task ditambahkan."); await load();
  }

  async function moveTask(id:number,status:string){
    setTasks(x=>x.map(t=>t.id===id?{...t,status}:t));
    const {error}=await supabase.from("creator_tasks").update({status,sort_order:Date.now(),updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",id);
    if(error){setMsg(error.message);await load();}
  }

  async function saveEdit(){
    if(!editing)return;
    const {error}=await supabase.from("creator_tasks").update({title:editing.title,description:editing.description,priority:editing.priority,due_date:editing.due_date||null,assigned_to:editing.assigned_to||null,updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",editing.id);
    if(error)return setMsg(error.message); setEditing(null); setMsg("Task diperbarui."); await load();
  }

  async function remove(id:number){
    if(!window.confirm("Hapus task ini?"))return;
    const {error}=await supabase.from("creator_tasks").delete().eq("workspace_id",workspaceId).eq("id",id);
    if(error)return setMsg(error.message); setTasks(x=>x.filter(t=>t.id!==id));
  }

  const counts=useMemo(()=>Object.fromEntries(COLUMNS.map(([k])=>[k,tasks.filter(t=>(t.status||"backlog")===k).length])),[tasks]);

  return <section id="kanban" className="legacy-page-anchor">
    <div className="eyebrow">WORK MANAGEMENT</div><h1>Kanban</h1><p className="muted">Task dapat dibuat, diedit, dihapus, dan dipindahkan antar kolom. Rekomendasi AI yang dipilih juga masuk ke board ini.</p>
    <div className="card kanban-create"><div className="grid"><label>Task<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Contoh: Follow up top creator"/></label><label>Priority<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Due Date<input type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})}/></label><label>Assigned To<input value={form.assigned_to} onChange={e=>setForm({...form,assigned_to:e.target.value})} placeholder="Nama / email"/></label></div><label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><button className="primary" disabled={busy} onClick={createTask}>+ Add Task</button>{msg&&<p className="muted">{msg}</p>}</div>
    <div className="kanban-board">{COLUMNS.map(([key,label])=><div className="kanban-column" key={key} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=Number(e.dataTransfer.getData("text/task-id"));if(id)void moveTask(id,key)}}><div className="kanban-column-head"><strong>{label}</strong><span>{counts[key]||0}</span></div><div className="kanban-stack">{tasks.filter(t=>(t.status||"backlog")===key).map(t=><article className="kanban-task" draggable key={t.id} onDragStart={e=>e.dataTransfer.setData("text/task-id",String(t.id))}><div className="kanban-task-top"><span className={`task-priority p-${t.priority||"normal"}`}>{t.priority||"normal"}</span><div className="task-actions"><button onClick={()=>setEditing({...t})}>Edit</button><button onClick={()=>remove(t.id)}>×</button></div></div><h3>{t.title}</h3>{t.description&&<p>{t.description}</p>}<div className="task-meta">{t.due_date&&<span>Due {t.due_date}</span>}{t.analysis_type&&<span>AI · {t.analysis_type}</span>}{t.assigned_to&&<span>{t.assigned_to}</span>}</div></article>)}{!tasks.some(t=>(t.status||"backlog")===key)&&<div className="kanban-empty">Drop task here</div>}</div></div>)}</div>
    {editing&&<div className="kanban-modal-backdrop" onClick={()=>setEditing(null)}><div className="kanban-modal" onClick={e=>e.stopPropagation()}><h2>Edit Task</h2><label>Title<input value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/></label><label>Description<textarea value={editing.description||""} onChange={e=>setEditing({...editing,description:e.target.value})}/></label><div className="grid"><label>Priority<select value={editing.priority||"normal"} onChange={e=>setEditing({...editing,priority:e.target.value})}><option>low</option><option>normal</option><option>high</option><option>urgent</option></select></label><label>Due Date<input type="date" value={editing.due_date||""} onChange={e=>setEditing({...editing,due_date:e.target.value})}/></label></div><label>Assigned To<input value={editing.assigned_to||""} onChange={e=>setEditing({...editing,assigned_to:e.target.value})}/></label><div className="button-row"><button className="primary" onClick={saveEdit}>Save</button><button className="secondary" onClick={()=>setEditing(null)}>Cancel</button></div></div></div>}
  </section>;
}
