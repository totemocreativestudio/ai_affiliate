"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type NotificationRow={id:number;title:string;body:string;category:string;action_url:string|null;action_label:string|null;image_url:string|null;published_at:string|null;created_at:string};

export default function NotificationCenter({workspaceId,userId}:{workspaceId:string;userId:string}){
  const supabase=createClient();
  const [rows,setRows]=useState<NotificationRow[]>([]);
  const [readIds,setReadIds]=useState<Set<number>>(new Set());
  const [open,setOpen]=useState(false);
  const [toast,setToast]=useState<NotificationRow|null>(null);
  const firstLoad=useRef(true);

  async function load(){
    const {data,error}=await supabase.from("luma_notifications").select("id,title,body,category,action_url,action_label,image_url,published_at,created_at").order("published_at",{ascending:false}).limit(40);
    if(error)return;
    const list=(data||[]) as NotificationRow[];
    const ids=list.map(x=>x.id);
    let nextRead=new Set<number>();
    if(ids.length){
      const {data:r}=await supabase.from("luma_notification_reads").select("notification_id").eq("user_id",userId).in("notification_id",ids);
      nextRead=new Set((r||[]).map((x:any)=>Number(x.notification_id)));
    }
    if(!firstLoad.current){
      const fresh=list.find(x=>!nextRead.has(x.id)&&!rows.some(old=>old.id===x.id));
      if(fresh){setToast(fresh);setTimeout(()=>setToast(null),7000)}
    }
    firstLoad.current=false;
    setRows(list);setReadIds(nextRead);
  }

  useEffect(()=>{
    void load();
    const t=window.setInterval(()=>void load(),45000);
    const onVisible=()=>{if(document.visibilityState==="visible")void load()};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{window.clearInterval(t);document.removeEventListener("visibilitychange",onVisible)};
  },[workspaceId,userId]);

  const unread=useMemo(()=>rows.filter(x=>!readIds.has(x.id)).length,[rows,readIds]);

  async function markRead(row:NotificationRow,clicked=false){
    await supabase.from("luma_notification_reads").upsert({notification_id:row.id,user_id:userId,read_at:new Date().toISOString(),clicked_at:clicked?new Date().toISOString():null},{onConflict:"notification_id,user_id"});
    setReadIds(prev=>new Set(prev).add(row.id));
    if(clicked&&row.action_url){
      setOpen(false);
      if(row.action_url.startsWith("#"))window.location.hash=row.action_url.slice(1);
      else window.location.assign(row.action_url);
    }
  }

  async function markAll(){
    const unreadRows=rows.filter(x=>!readIds.has(x.id));
    if(!unreadRows.length)return;
    await supabase.from("luma_notification_reads").upsert(unreadRows.map(x=>({notification_id:x.id,user_id:userId,read_at:new Date().toISOString()})),{onConflict:"notification_id,user_id"});
    setReadIds(new Set(rows.map(x=>x.id)));
  }

  return <div className="notification-root">
    <button className="notification-bell" aria-label="Notifications" onClick={()=>setOpen(v=>!v)}><span>♢</span>{unread>0&&<b>{unread>99?"99+":unread}</b>}</button>
    {open&&<div className="notification-popover">
      <div className="notification-head"><div><strong>Notifications</strong><span>{unread} belum dibaca</span></div><button onClick={markAll}>Mark all read</button></div>
      <div className="notification-list">{rows.length?rows.map(row=><button key={row.id} className={`notification-item ${readIds.has(row.id)?"read":"unread"}`} onClick={()=>void markRead(row,true)}>
        {row.image_url&&<img src={row.image_url} alt=""/>}<div><span className={`notification-category n-${row.category}`}>{row.category}</span><strong>{row.title}</strong><p>{row.body}</p><small>{row.published_at?new Date(row.published_at).toLocaleString("id-ID"):""}{row.action_label?` · ${row.action_label}`:""}</small></div>
      </button>):<div className="empty-state"><strong>Belum ada notifikasi.</strong></div>}</div>
    </div>}
    {toast&&<button className="notification-toast" onClick={()=>void markRead(toast,true)}><span className={`notification-category n-${toast.category}`}>{toast.category}</span><strong>{toast.title}</strong><p>{toast.body}</p></button>}
  </div>;
}
