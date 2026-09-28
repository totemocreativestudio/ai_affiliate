"use client";

import { useEffect, useMemo, useState } from "react";

type TaskStatus="running"|"success"|"error";
type Task={id:string;title:string;detail?:string;progress?:number;status:TaskStatus;createdAt:number};

declare global {
  interface WindowEventMap {
    "lumaway-background-task": CustomEvent<Partial<Task>&{id:string;title?:string}>;
  }
}

export function emitLumawayTask(task:Partial<Task>&{id:string;title?:string}){
  if(typeof window==="undefined")return;
  window.dispatchEvent(new CustomEvent("lumaway-background-task",{detail:task}));
}

export default function BackgroundTaskCenter(){
  const [tasks,setTasks]=useState<Task[]>([]);
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    const onTask=(event:WindowEventMap["lumaway-background-task"])=>{
      const next=event.detail;
      setTasks(current=>{
        const found=current.find(item=>item.id===next.id);
        const base:Task=found||{id:next.id,title:next.title||"Proses Lumaway",status:"running",createdAt:Date.now()};
        const merged={...base,...next,title:next.title||base.title} as Task;
        return [merged,...current.filter(item=>item.id!==next.id)].slice(0,12);
      });
    };
    window.addEventListener("lumaway-background-task",onTask);
    return()=>window.removeEventListener("lumaway-background-task",onTask);
  },[]);

  const running=useMemo(()=>tasks.filter(item=>item.status==="running").length,[tasks]);
  if(!tasks.length)return null;

  return <div className="lw-task-center">
    <button type="button" className={`lw-task-trigger ${running?"has-running":""}`} onClick={()=>setOpen(v=>!v)} aria-label="Background tasks">
      <span className="lw-task-dot"/><b>{running||tasks.filter(x=>x.status==="error").length}</b><span>{running?`${running} proses`:"Aktivitas"}</span>
    </button>
    {open&&<div className="lw-task-popover">
      <div className="lw-task-head"><div><strong>Aktivitas</strong><span>{running?`${running} proses sedang berjalan`:"Proses terbaru Lumaway"}</span></div><button type="button" onClick={()=>setTasks(items=>items.filter(x=>x.status==="running"))}>Bersihkan</button></div>
      <div className="lw-task-list">
        {tasks.map(task=><div className={`lw-task-item status-${task.status}`} key={task.id}>
          <div className="lw-task-state">{task.status==="success"?"✓":task.status==="error"?"!":"•"}</div>
          <div><strong>{task.title}</strong>{task.detail&&<span>{task.detail}</span>}
            {task.status==="running"&&typeof task.progress==="number"&&<div className="lw-task-progress"><i style={{width:`${Math.max(3,Math.min(100,task.progress))}%`}}/></div>}
          </div>
          <small>{task.status==="running"?"Berjalan":task.status==="success"?"Selesai":"Perlu perhatian"}</small>
        </div>)}
      </div>
    </div>}
  </div>;
}
