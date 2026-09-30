"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

type Task={
  id:number;
  title:string;
  description:string|null;
  status:string|null;
  priority:string|null;
  due_date:string|null;
  sort_order:number|null;
  created_at:string|null;
};

type Props={workspaceId:string;userId?:string};
type TaskDraft={title:string;description:string;priority:string;due_date:string};

const COLUMNS=[
  ["backlog","Backlog"],
  ["progress","In Progress"],
  ["review","In Review"],
  ["done","Done"],
] as const;

const EMPTY_DRAFT:TaskDraft={title:"",description:"",priority:"normal",due_date:""};

function normalizePriority(value:string|null){
  const key=String(value||"normal").toLowerCase();
  return ["low","normal","high","urgent"].includes(key)?key:"normal";
}

function dueMeta(task:Task){
  if(!task.due_date)return{tone:"none",label:"Tanpa deadline"};
  const today=new Date();today.setHours(0,0,0,0);
  const due=new Date(task.due_date+"T00:00:00");
  const diff=Math.ceil((due.getTime()-today.getTime())/86400000);
  const dateLabel=due.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:due.getFullYear()!==today.getFullYear()?"numeric":undefined});
  if((task.status||"")==="done")return{tone:"done",label:dateLabel};
  if(diff<0)return{tone:"overdue",label:"Terlambat · "+dateLabel};
  if(diff===0)return{tone:"today",label:"Hari ini · "+dateLabel};
  if(diff<=3)return{tone:"soon",label:dateLabel};
  return{tone:"normal",label:dateLabel};
}

function CalendarIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2v4M18 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>;
}

function SearchIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
}

export default function KanbanBoard({workspaceId,userId}:Props){
  const supabase=useMemo(()=>createClient(),[]);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [busy,setBusy]=useState(false);
  const [createOpen,setCreateOpen]=useState(false);
  const [editing,setEditing]=useState<Task|null>(null);
  const [draft,setDraft]=useState<TaskDraft>(EMPTY_DRAFT);
  const [msg,setMsg]=useState("");
  const [search,setSearch]=useState("");
  const [priorityFilter,setPriorityFilter]=useState("");
  const [dragOver,setDragOver]=useState<string|null>(null);

  async function load(){
    const {data,error}=await supabase
      .from("creator_tasks")
      .select("id,title,description,status,priority,due_date,sort_order,created_at")
      .eq("workspace_id",workspaceId)
      .order("sort_order",{ascending:true})
      .order("id",{ascending:true});
    if(error)setMsg(error.message);
    else setTasks((data||[]) as Task[]);
  }

  useEffect(()=>{void load()},[workspaceId]);
  useEffect(()=>{
    const onQuick=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.type==="task")openCreate()};
    const onSelect=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.type!=="task")return;setSearch(String(detail.title||""))};
    window.addEventListener("lumaway-quick-create",onQuick as EventListener);window.addEventListener("lumaway-global-select",onSelect as EventListener);
    return()=>{window.removeEventListener("lumaway-quick-create",onQuick as EventListener);window.removeEventListener("lumaway-global-select",onSelect as EventListener)};
  },[]);

  useEffect(()=>{
    if(!createOpen&&!editing)return;
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){
        setCreateOpen(false);
        setEditing(null);
      }
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[createOpen,editing]);

  function openCreate(){
    setDraft(EMPTY_DRAFT);
    setMsg("");
    setCreateOpen(true);
  }

  async function createTask(){
    if(!draft.title.trim())return setMsg("Title wajib diisi.");
    setBusy(true);setMsg("");
    const payload:any={
      workspace_id:workspaceId,
      title:draft.title.trim(),
      description:draft.description.trim()||null,
      status:"backlog",
      priority:normalizePriority(draft.priority),
      due_date:draft.due_date||null,
      source:"web",
      sort_order:Date.now(),
      assigned_to:null,
    };
    if(userId)payload.created_by=userId;
    else{
      const {data:{user}}=await supabase.auth.getUser();
      if(user?.id)payload.created_by=user.id;
    }
    const {error}=await supabase.from("creator_tasks").insert(payload);
    setBusy(false);
    if(error)return setMsg(error.message);
    setCreateOpen(false);setDraft(EMPTY_DRAFT);setMsg("Task berhasil ditambahkan.");
    await load();
  }

  async function moveTask(id:number,status:string){
    const previous=tasks;
    setTasks(current=>current.map(task=>task.id===id?{...task,status}:task));
    setDragOver(null);
    const {error}=await supabase.from("creator_tasks").update({
      status,
      sort_order:Date.now(),
      updated_at:new Date().toISOString(),
    }).eq("workspace_id",workspaceId).eq("id",id);
    if(error){
      setTasks(previous);
      setMsg(error.message);
    }
  }

  async function saveEdit(){
    if(!editing)return;
    if(!editing.title.trim())return setMsg("Title wajib diisi.");
    setBusy(true);setMsg("");
    const {error}=await supabase.from("creator_tasks").update({
      title:editing.title.trim(),
      description:editing.description?.trim()||null,
      priority:normalizePriority(editing.priority),
      due_date:editing.due_date||null,
      updated_at:new Date().toISOString(),
    }).eq("workspace_id",workspaceId).eq("id",editing.id);
    setBusy(false);
    if(error)return setMsg(error.message);
    setEditing(null);setMsg("Task berhasil diperbarui.");
    await load();
  }

  async function remove(id:number){
    if(!window.confirm("Hapus task ini?"))return;
    const {error}=await supabase.from("creator_tasks").delete().eq("workspace_id",workspaceId).eq("id",id);
    if(error)return setMsg(error.message);
    setTasks(current=>current.filter(task=>task.id!==id));
  }

  const visibleTasks=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return tasks.filter(task=>{
      if(priorityFilter&&normalizePriority(task.priority)!==priorityFilter)return false;
      if(!q)return true;
      return [task.title,task.description].filter(Boolean).some(value=>String(value).toLowerCase().includes(q));
    });
  },[tasks,search,priorityFilter]);

  const counts=useMemo(()=>Object.fromEntries(COLUMNS.map(([key])=>[
    key,
    visibleTasks.filter(task=>(task.status||"backlog")===key).length,
  ])),[visibleTasks]);

  const completed=tasks.filter(task=>(task.status||"backlog")==="done").length;

  function CreateModal(){
    return <div className="kanban-v5-modal-backdrop" onMouseDown={()=>!busy&&setCreateOpen(false)}>
      <section className="kanban-v5-modal" role="dialog" aria-modal="true" aria-labelledby="create-task-title" onMouseDown={event=>event.stopPropagation()}>
        <header>
          <div><span>NEW TASK</span><h2 id="create-task-title">Tambah Task</h2><p>Buat task baru tanpa assignment anggota.</p></div>
          <button type="button" aria-label="Tutup" onClick={()=>setCreateOpen(false)}>×</button>
        </header>
        <div className="kanban-v5-form">
          <label><span>Title</span><input autoFocus value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Contoh: Follow up creator terbaik"/></label>
          <label><span>Description</span><textarea rows={5} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Tambahkan konteks atau detail task..."/></label>
          <div className="kanban-v5-form-grid">
            <label><span>Priority</span><select value={draft.priority} onChange={e=>setDraft({...draft,priority:e.target.value})}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            <label><span>Due Date</span><input type="date" value={draft.due_date} onChange={e=>setDraft({...draft,due_date:e.target.value})}/></label>
          </div>
        </div>
        <footer><button className="secondary" type="button" disabled={busy} onClick={()=>setCreateOpen(false)}>Batal</button><button className="primary" type="button" disabled={busy} onClick={()=>void createTask()}>{busy?"Menyimpan...":"Tambah Task"}</button></footer>
      </section>
    </div>;
  }

  function EditModal(){
    if(!editing)return null;
    return <div className="kanban-v5-modal-backdrop" onMouseDown={()=>!busy&&setEditing(null)}>
      <section className="kanban-v5-modal" role="dialog" aria-modal="true" aria-labelledby="edit-task-title" onMouseDown={event=>event.stopPropagation()}>
        <header>
          <div><span>EDIT TASK</span><h2 id="edit-task-title">Edit Task</h2><p>Perbarui informasi utama task.</p></div>
          <button type="button" aria-label="Tutup" onClick={()=>setEditing(null)}>×</button>
        </header>
        <div className="kanban-v5-form">
          <label><span>Title</span><input autoFocus value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/></label>
          <label><span>Description</span><textarea rows={5} value={editing.description||""} onChange={e=>setEditing({...editing,description:e.target.value})}/></label>
          <div className="kanban-v5-form-grid">
            <label><span>Priority</span><select value={normalizePriority(editing.priority)} onChange={e=>setEditing({...editing,priority:e.target.value})}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            <label><span>Due Date</span><input type="date" value={editing.due_date||""} onChange={e=>setEditing({...editing,due_date:e.target.value})}/></label>
          </div>
        </div>
        <footer><button className="secondary" type="button" disabled={busy} onClick={()=>setEditing(null)}>Batal</button><button className="primary" type="button" disabled={busy} onClick={()=>void saveEdit()}>{busy?"Menyimpan...":"Simpan Perubahan"}</button></footer>
      </section>
    </div>;
  }

  return <section id="kanban" className="legacy-page-anchor kanban-page kanban-v5-page">
    <div className="kanban-v5-header">
      <div>
        <span className="kanban-v5-kicker">WORK MANAGEMENT</span>
        <h1>Task Board</h1>
        <p>Kelola pekerjaan dalam board visual. Geser task antar kolom untuk memperbarui status.</p>
      </div>
      <button className="primary kanban-v5-add" type="button" onClick={openCreate}>+ Tambah Task</button>
    </div>

    <div className="kanban-v5-summary">
      <span><b>{tasks.length}</b> Total Task</span>
      <span><b>{completed}</b> Selesai</span>
      <span><b>{Math.max(0,tasks.length-completed)}</b> Berjalan</span>
    </div>

    <div className="kanban-v5-toolbar">
      <label className="kanban-v5-search"><SearchIcon/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari title atau description..."/></label>
      <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}>
        <option value="">Semua Priority</option>
        <option value="low">Low</option>
        <option value="normal">Normal</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
      {(search||priorityFilter)&&<button className="kanban-v5-clear" type="button" onClick={()=>{setSearch("");setPriorityFilter("")}}>Reset Filter</button>}
    </div>

    {msg&&<div className="kanban-v5-message">{msg}</div>}

    <div className="kanban-v5-board">
      {COLUMNS.map(([key,label])=>{
        const columnTasks=visibleTasks.filter(task=>(task.status||"backlog")===key);
        return <section
          className={"kanban-v5-column "+(dragOver===key?"drag-over":"")}
          key={key}
          data-status={key}
          onDragOver={event=>{event.preventDefault();setDragOver(key)}}
          onDragLeave={event=>{if(event.currentTarget===event.target)setDragOver(null)}}
          onDrop={event=>{event.preventDefault();const id=Number(event.dataTransfer.getData("text/task-id"));if(id)void moveTask(id,key)}}
        >
          <header className="kanban-v5-column-head"><div><i/><strong>{label}</strong></div><span>{counts[key]||0}</span></header>
          <div className="kanban-v5-stack">
            {columnTasks.map(task=>{
              const priority=normalizePriority(task.priority);
              const due=dueMeta(task);
              return <article className="kanban-v5-task" draggable key={task.id} onDragStart={event=>{event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/task-id",String(task.id))}} onDragEnd={()=>setDragOver(null)}>
                <div className="kanban-v5-task-top">
                  <span className={"kanban-v5-priority p-"+priority}>{priority.charAt(0).toUpperCase()+priority.slice(1)}</span>
                  <div className="kanban-v5-task-actions">
                    <button type="button" onClick={()=>setEditing({...task})}>Edit</button>
                    <button type="button" className="danger" aria-label={"Hapus "+task.title} onClick={()=>void remove(task.id)}>×</button>
                  </div>
                </div>
                <h3>{task.title}</h3>
                {task.description&&<p>{task.description}</p>}
                <footer>
                  <span className={"kanban-v5-due due-"+due.tone}><CalendarIcon/>{due.label}</span>
                </footer>
              </article>;
            })}
            {!columnTasks.length&&<div className="kanban-v5-empty"><span>Belum ada task</span><small>Drag task ke sini atau tambah task baru.</small></div>}
          </div>
        </section>;
      })}
    </div>

    {createOpen&&<CreateModal/>}
    {editing&&<EditModal/>}
  </section>;
}
