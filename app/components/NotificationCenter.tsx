"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import LumaHelpDesk from "./LumaHelpDesk";

type NotificationRow={key:string;source:"broadcast"|"direct";id:number;title:string;body:string;category:string;action_url:string|null;action_label:string|null;image_url:string|null;published_at:string|null;created_at:string;read:boolean};

type HelpProfile={full_name:string|null;role:string}|null;

export default function NotificationCenter({workspaceId,userId}:{workspaceId:string;userId:string}){
  const supabase=createClient(); const [rows,setRows]=useState<NotificationRow[]>([]); const [open,setOpen]=useState(false); const [toast,setToast]=useState<NotificationRow|null>(null); const [helpProfile,setHelpProfile]=useState<HelpProfile>(null); const firstLoad=useRef(true);

  async function load(){
    const [globalRes,directRes,profileRes]=await Promise.all([
      supabase.from("luma_notifications").select("id,title,body,category,action_url,action_label,image_url,published_at,created_at").order("published_at",{ascending:false}).limit(40),
      supabase.from("user_notifications").select("id,title,message,kind,is_read,action_url,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(40),
      supabase.from("profiles").select("full_name,role").eq("id",userId).maybeSingle(),
    ]);
    if(profileRes.data)setHelpProfile(profileRes.data as HelpProfile);
    const globals=(globalRes.data||[]) as any[]; const ids=globals.map(x=>x.id); let readIds=new Set<number>();
    if(ids.length){const {data:r}=await supabase.from("luma_notification_reads").select("notification_id").eq("user_id",userId).in("notification_id",ids);readIds=new Set((r||[]).map((x:any)=>Number(x.notification_id)))}
    const globalRows:NotificationRow[]=globals.map(x=>({key:`g-${x.id}`,source:"broadcast",id:x.id,title:x.title,body:x.body,category:x.category||"info",action_url:x.action_url||null,action_label:x.action_label||null,image_url:x.image_url||null,published_at:x.published_at||x.created_at,created_at:x.created_at,read:readIds.has(Number(x.id))}));
    const directRows:NotificationRow[]=(directRes.data||[]).map((x:any)=>({key:`d-${x.id}`,source:"direct",id:x.id,title:x.title,body:x.message,category:x.kind||"info",action_url:x.action_url||null,action_label:null,image_url:null,published_at:x.created_at,created_at:x.created_at,read:Boolean(x.is_read)}));
    const list=[...globalRows,...directRows].sort((a,b)=>new Date(b.published_at||b.created_at).getTime()-new Date(a.published_at||a.created_at).getTime()).slice(0,60);
    if(!firstLoad.current){const fresh=list.find(x=>!x.read&&!rows.some(old=>old.key===x.key));if(fresh){setToast(fresh);setTimeout(()=>setToast(null),7000)}}
    firstLoad.current=false;setRows(list);
  }

  useEffect(()=>{void load();const t=window.setInterval(()=>void load(),30000);const onVisible=()=>{if(document.visibilityState==="visible")void load()};document.addEventListener("visibilitychange",onVisible);return()=>{window.clearInterval(t);document.removeEventListener("visibilitychange",onVisible)}},[workspaceId,userId]);
  const unread=useMemo(()=>rows.filter(x=>!x.read).length,[rows]);

  async function markRead(row:NotificationRow,clicked=false){
    if(row.source==="broadcast")await supabase.from("luma_notification_reads").upsert({notification_id:row.id,user_id:userId,read_at:new Date().toISOString(),clicked_at:clicked?new Date().toISOString():null},{onConflict:"notification_id,user_id"});
    else await supabase.from("user_notifications").update({is_read:true}).eq("id",row.id).eq("user_id",userId);
    setRows(prev=>prev.map(x=>x.key===row.key?{...x,read:true}:x));
    if(clicked&&row.action_url){setOpen(false);if(row.action_url.startsWith("#"))window.location.hash=row.action_url.slice(1);else window.location.assign(row.action_url)}
  }

  async function markAll(){
    const broadcast=rows.filter(x=>!x.read&&x.source==="broadcast"),direct=rows.filter(x=>!x.read&&x.source==="direct");
    if(broadcast.length)await supabase.from("luma_notification_reads").upsert(broadcast.map(x=>({notification_id:x.id,user_id:userId,read_at:new Date().toISOString()})),{onConflict:"notification_id,user_id"});
    if(direct.length)await supabase.from("user_notifications").update({is_read:true}).eq("user_id",userId).in("id",direct.map(x=>x.id));
    setRows(prev=>prev.map(x=>({...x,read:true})));
  }

  return <>
    <div className="notification-root">
      <button className="notification-bell" aria-label="Notifications" onClick={()=>setOpen(v=>!v)}><span>♢</span>{unread>0&&<b>{unread>99?"99+":unread}</b>}</button>
      {open&&<div className="notification-popover"><div className="notification-head"><div><strong>Notifications</strong><span>{unread} belum dibaca</span></div><button onClick={markAll}>Mark all read</button></div><div className="notification-list">{rows.length?rows.map(row=><button key={row.key} className={`notification-item ${row.read?"read":"unread"}`} onClick={()=>void markRead(row,true)}>{row.image_url&&<img src={row.image_url} alt=""/>}<div><span className={`notification-category n-${row.category}`}>{row.category.replaceAll("_"," ")}</span><strong>{row.title}</strong><p>{row.body}</p><small>{row.published_at?new Date(row.published_at).toLocaleString("id-ID"):""}{row.action_label?` · ${row.action_label}`:""}</small></div></button>):<div className="empty-state"><strong>Belum ada notifikasi.</strong></div>}</div></div>}
      {toast&&<button className="notification-toast" onClick={()=>void markRead(toast,true)}><span className={`notification-category n-${toast.category}`}>{toast.category.replaceAll("_"," ")}</span><strong>{toast.title}</strong><p>{toast.body}</p></button>}
    </div>
    {helpProfile&&helpProfile.role!=="admin"&&<LumaHelpDesk workspaceId={workspaceId} userId={userId} userName={helpProfile.full_name}/>} 
  </>;
}
