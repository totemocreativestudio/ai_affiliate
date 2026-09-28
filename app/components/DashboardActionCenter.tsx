"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import { navigateToSection } from "../../lib/luma-navigation";

type Task={id:number;title:string;status:string|null;priority:string|null;due_date:string|null;assigned_to:string|null;created_at:string|null};

function score(task:Task){
  const weights:Record<string,number>={urgent:40,high:30,normal:20,low:10};
  const priority=weights[String(task.priority||"normal")]||20;
  const due=task.due_date?new Date(task.due_date+"T23:59:59").getTime():Infinity;
  const days=Number.isFinite(due)?Math.ceil((due-Date.now())/86400000):99;
  return priority+(days<0?50:days===0?40:days<=3?30:days<=7?15:0);
}

function dueLabel(task:Task){
  if(!task.due_date)return "Tanpa deadline";
  const due=new Date(task.due_date+"T23:59:59").getTime();
  const days=Math.ceil((due-Date.now())/86400000);
  if(days<0)return "Terlambat "+Math.abs(days)+" hari";
  if(days===0)return "Jatuh tempo hari ini";
  if(days===1)return "Jatuh tempo besok";
  return days+" hari lagi";
}

export default function DashboardActionCenter({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [loading,setLoading]=useState(true);

  async function load(){
    setLoading(true);
    const {data}=await supabase.from("creator_tasks")
      .select("id,title,status,priority,due_date,assigned_to,created_at")
      .eq("workspace_id",workspaceId)
      .neq("status","done")
      .order("created_at",{ascending:false})
      .limit(80);
    setTasks((data||[]) as Task[]);
    setLoading(false);
  }

  useEffect(()=>{
    void load();
    const refresh=()=>void load();
    window.addEventListener("focus",refresh);
    window.addEventListener("lumaway-database-updated",refresh as EventListener);
    return()=>{window.removeEventListener("focus",refresh);window.removeEventListener("lumaway-database-updated",refresh as EventListener)};
  },[workspaceId]);

  const prioritized=useMemo(()=>[...tasks].sort((a,b)=>score(b)-score(a)).slice(0,5),[tasks]);
  const urgent=tasks.filter(task=>score(task)>=50).length;

  return <section className="lw-action-center">
    <div className="lw-action-head">
      <div><span className="eyebrow">ACTION CENTER</span><h2>{tasks.length?tasks.length+" pekerjaan belum selesai":"Semua pekerjaan sudah beres"}</h2><p>{tasks.length?"Prioritas diurutkan dari deadline dan tingkat urgensi.":"Belum ada task aktif yang perlu ditindaklanjuti."}</p></div>
      <button type="button" className="secondary" onClick={()=>navigateToSection("kanban")}>Buka Kanban</button>
    </div>
    {loading?<div className="lw-action-loading"><span className="lw-skeleton"/><span className="lw-skeleton"/><span className="lw-skeleton"/></div>:prioritized.length?<div className="lw-action-list">
      {prioritized.map((task,index)=><button type="button" key={task.id} className="lw-action-row" onClick={()=>navigateToSection("kanban")}>
        <span className="lw-action-rank">{index+1}</span>
        <span className="lw-action-copy"><strong>{task.title}</strong><small>{dueLabel(task)}{task.assigned_to?" · "+task.assigned_to:""}</small></span>
        <span className={"lw-action-priority p-"+(task.priority||"normal")}>{task.priority||"normal"}</span>
      </button>)}
    </div>:<div className="lw-action-empty"><strong>Tidak ada pekerjaan tertunda.</strong><span>Task baru dari Kanban atau rekomendasi akan muncul di sini.</span></div>}
    {!!tasks.length&&<div className="lw-action-foot"><span>{urgent?urgent+" item perlu perhatian lebih cepat":"Tidak ada deadline kritis saat ini"}</span><button type="button" onClick={()=>navigateToSection("kanban")}>Lihat semua →</button></div>}
  </section>;
}