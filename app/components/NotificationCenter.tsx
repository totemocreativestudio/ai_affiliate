"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {navigateLumawayUrl} from "../../lib/luma-navigation";
import LumaIcon from "./LumaIcon";

type Priority="critical"|"action"|"info";
type NotificationRow={
 key:string;source:"broadcast"|"direct";id:number;title:string;body:string;category:string;
 action_url:string|null;action_label:string|null;image_url:string|null;published_at:string|null;created_at:string;read:boolean;priority:Priority;
};
type Prefs={toast_enabled:boolean;critical_toast_only:boolean;operational_enabled:boolean;marketing_enabled:boolean};
const DEFAULT_PREFS:Prefs={toast_enabled:true,critical_toast_only:false,operational_enabled:true,marketing_enabled:true};

const CATEGORY_LABELS:Record<string,string>={
 ai_generate:"AI",document_generated:"AI Document",document_preview:"AI Document",document_download:"AI Document",token_usage:"Token",token_topup:"Token",
 payment_pending:"Payment",payment_success:"Payment",payment_failed:"Payment",payment_expired:"Payment",payment_status:"Payment",upload_success:"Data Upload",
 referral_reward:"Referral",withdrawal_pending:"Payout",withdrawal_completed:"Payout",withdrawal_failed:"Payout",withdrawal_status:"Payout",
 ticket_created:"Support",ticket_status:"Support",ticket_reply:"Support",social_like:"Social",kanban_done:"Kanban",maintenance:"System",
 system_update:"System",promotion:"Promotion",education:"Education",info:"Information",creator_on_fire_daily:"Creator On Fire · Harian",
 creator_on_fire_weekly:"Creator On Fire · Mingguan",creator_on_fire_monthly:"Creator On Fire · Bulanan",campaign_due:"Campaign",
 campaign_overdue:"Campaign",task_due:"Task",shipping_delivered:"Shipping",listing_follow_up:"Listing",live_data_health:"Live Data Health"
};
const CRITICAL=new Set(["payment_failed","withdrawal_failed","maintenance","campaign_overdue"]);
const ACTION=new Set(["campaign_due","task_due","listing_follow_up","payment_pending","ticket_reply","payment_expired","withdrawal_pending","live_data_health","ticket_status"]);
const MARKETING=new Set(["promotion","education","referral_reward"]);
const categoryLabel=(category:string)=>CATEGORY_LABELS[category]||category.replaceAll("_"," ");
const priorityOf=(category:string):Priority=>CRITICAL.has(category)?"critical":ACTION.has(category)?"action":"info";
const priorityLabel=(p:Priority)=>p==="critical"?"Critical":p==="action"?"Action":"Info";
const isToday=(v:string|null)=>{if(!v)return false;const d=new Date(v),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate()};

export default function NotificationCenter({workspaceId,userId}:{workspaceId:string;userId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [rows,setRows]=useState<NotificationRow[]>([]),[open,setOpen]=useState(false),[toast,setToast]=useState<NotificationRow|null>(null),[toastSeconds,setToastSeconds]=useState<number|null>(null);
 const [categoryFilter,setCategoryFilter]=useState("all"),[priorityFilter,setPriorityFilter]=useState<"all"|Priority>("all"),[prefs,setPrefs]=useState<Prefs>(DEFAULT_PREFS),[prefsOpen,setPrefsOpen]=useState(false);
 const firstLoad=useRef(true),dismissedToastKeys=useRef<Set<string>>(new Set());

 async function load(){
  try{await supabase.rpc("luma_refresh_operational_notifications_v1",{p_workspace_id:workspaceId})}catch{}
  const [globalRes,directRes,prefRes,stateRes]=await Promise.all([
   supabase.from("luma_notifications").select("id,title,body,category,action_url,action_label,image_url,published_at,created_at").order("published_at",{ascending:false}).limit(50),
   supabase.from("user_notifications").select("id,title,message,kind,is_read,action_url,created_at").eq("user_id",userId).eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(80),
   supabase.rpc("luma_notification_preferences_v1",{p_workspace_id:workspaceId}),
   supabase.from("luma_user_notification_state").select("source_type,source_id,snoozed_until,archived_at").eq("workspace_id",workspaceId).eq("user_id",userId)
  ]);
  if(!prefRes.error&&prefRes.data)setPrefs({...DEFAULT_PREFS,...prefRes.data});
  const states=new Map<string,any>((stateRes.data||[]).map((x:any)=>[`${x.source_type}-${x.source_id}`,x]));
  const globals=(globalRes.data||[]) as any[],ids=globals.map(x=>x.id);let readIds=new Set<number>();
  if(ids.length){const r=await supabase.from("luma_notification_reads").select("notification_id").eq("user_id",userId).in("notification_id",ids);readIds=new Set((r.data||[]).map((x:any)=>Number(x.notification_id)))}
  const globalRows:NotificationRow[]=globals.map((x:any)=>({key:`broadcast-${x.id}`,source:"broadcast",id:Number(x.id),title:x.title||"Informasi Lumaway",body:x.body||"",category:x.category||"info",action_url:x.action_url||null,action_label:x.action_label||null,image_url:x.image_url||null,published_at:x.published_at||x.created_at,created_at:x.created_at,read:readIds.has(Number(x.id)),priority:priorityOf(x.category||"info")}));
  const directRows:NotificationRow[]=(directRes.data||[]).map((x:any)=>({key:`direct-${x.id}`,source:"direct",id:Number(x.id),title:x.title||"Informasi Lumaway",body:x.message||"",category:x.kind||"info",action_url:x.action_url||null,action_label:null,image_url:null,published_at:x.created_at,created_at:x.created_at,read:Boolean(x.is_read),priority:priorityOf(x.kind||"info")}));
  const now=Date.now();
  const list=[...globalRows,...directRows].filter(x=>{
   const st=states.get(`${x.source}-${x.id}`);
   if(st?.archived_at)return false;
   if(st?.snoozed_until&&new Date(st.snoozed_until).getTime()>now)return false;
   if(!prefs.marketing_enabled&&MARKETING.has(x.category))return false;
   if(!prefs.operational_enabled&&!MARKETING.has(x.category)&&x.priority!=="critical")return false;
   return true;
  }).sort((a,b)=>{const p={critical:3,action:2,info:1};return p[b.priority]-p[a.priority]||new Date(b.published_at||b.created_at).getTime()-new Date(a.published_at||a.created_at).getTime()}).slice(0,100);

  const unreadCandidate=list.find(x=>!x.read&&!dismissedToastKeys.current.has(x.key)&&(firstLoad.current||!rows.some(old=>old.key===x.key))&&(x.priority==="critical"||x.priority==="action"));
  const effectivePrefs={!prefRes.error&&prefRes.data?{...DEFAULT_PREFS,...prefRes.data}:prefs};
  if(unreadCandidate&&!toast&&effectivePrefs.toast_enabled&&(!effectivePrefs.critical_toast_only||unreadCandidate.priority==="critical")){setToast(unreadCandidate);setToastSeconds(unreadCandidate.priority==="critical"?8:5)}
  firstLoad.current=false;setRows(list);
 }

 useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),30000);const onVisible=()=>{if(document.visibilityState==="visible")void load()};document.addEventListener("visibilitychange",onVisible);return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible)}},[workspaceId,userId]);
 useEffect(()=>{if(!toast||toastSeconds===null)return;if(toastSeconds<=0){dismissedToastKeys.current.add(toast.key);setToast(null);setToastSeconds(null);return}const timer=window.setTimeout(()=>setToastSeconds(v=>v===null?null:Math.max(0,v-1)),1000);return()=>window.clearTimeout(timer)},[toast?.key,toastSeconds]);

 const unread=useMemo(()=>rows.filter(x=>!x.read).length,[rows]);
 const counts=useMemo(()=>({critical:rows.filter(x=>x.priority==="critical").length,action:rows.filter(x=>x.priority==="action").length,info:rows.filter(x=>x.priority==="info").length}),[rows]);
 const categoryOptions=useMemo(()=>["all",...Array.from(new Set(rows.map(x=>categoryLabel(x.category)))).sort((a,b)=>a.localeCompare(b,"id"))],[rows]);
 const visibleRows=useMemo(()=>rows.filter(x=>(priorityFilter==="all"||x.priority===priorityFilter)&&(categoryFilter==="all"||categoryLabel(x.category)===categoryFilter)),[rows,priorityFilter,categoryFilter]);
 const todayRows=visibleRows.filter(x=>isToday(x.published_at||x.created_at)),earlierRows=visibleRows.filter(x=>!isToday(x.published_at||x.created_at));

 async function markRead(row:NotificationRow,clicked=false){
  if(row.source==="broadcast")await supabase.from("luma_notification_reads").upsert({notification_id:row.id,user_id:userId,read_at:new Date().toISOString(),clicked_at:clicked?new Date().toISOString():null},{onConflict:"notification_id,user_id"});
  else await supabase.from("user_notifications").update({is_read:true}).eq("id",row.id).eq("user_id",userId);
  setRows(prev=>prev.map(x=>x.key===row.key?{...x,read:true}:x));dismissedToastKeys.current.add(row.key);
  if(toast?.key===row.key){setToast(null);setToastSeconds(null)}
  if(clicked&&row.action_url){setOpen(false);navigateLumawayUrl(row.action_url)}
 }
 async function markAll(){
  const b=rows.filter(x=>!x.read&&x.source==="broadcast"),d=rows.filter(x=>!x.read&&x.source==="direct");
  if(b.length)await supabase.from("luma_notification_reads").upsert(b.map(x=>({notification_id:x.id,user_id:userId,read_at:new Date().toISOString()})),{onConflict:"notification_id,user_id"});
  if(d.length)await supabase.from("user_notifications").update({is_read:true}).eq("user_id",userId).in("id",d.map(x=>x.id));
  setRows(prev=>prev.map(x=>({...x,read:true})));
 }
 async function setState(row:NotificationRow,kind:"snooze1h"|"tomorrow"|"archive"){
  const now=new Date(),payload:any={workspace_id:workspaceId,user_id:userId,source_type:row.source,source_id:row.id,updated_at:now.toISOString()};
  if(kind==="archive")payload.archived_at=now.toISOString();
  if(kind==="snooze1h")payload.snoozed_until=new Date(now.getTime()+3600000).toISOString();
  if(kind==="tomorrow"){const t=new Date(now);t.setDate(t.getDate()+1);t.setHours(8,0,0,0);payload.snoozed_until=t.toISOString()}
  await supabase.from("luma_user_notification_state").upsert(payload,{onConflict:"workspace_id,user_id,source_type,source_id"});
  setRows(prev=>prev.filter(x=>x.key!==row.key));if(toast?.key===row.key){setToast(null);setToastSeconds(null)}
 }
 async function savePrefs(next:Prefs){
  setPrefs(next);await supabase.from("luma_user_notification_preferences").upsert({workspace_id:workspaceId,user_id:userId,...next,updated_at:new Date().toISOString()},{onConflict:"workspace_id,user_id"});void load();
 }

 function NotificationList({list}:{list:NotificationRow[]}){return <>{list.map(row=><article key={row.key} className={"notification-item-v2 "+(row.read?"read":"unread")+" p-"+row.priority}>
   <button className="notification-main-v2" onClick={()=>void markRead(row,true)}>{row.image_url&&<img src={row.image_url} alt=""/>}<div><div className="notification-meta-v2"><span className={"notification-priority "+row.priority}>{priorityLabel(row.priority)}</span><span className={"notification-category n-"+row.category}>{categoryLabel(row.category)}</span></div><strong>{row.title}</strong><p>{row.body}</p><small>{new Date(row.published_at||row.created_at).toLocaleString("id-ID")}{row.action_label?" · "+row.action_label:""}</small></div></button>
   <div className="notification-actions-v2"><button onClick={()=>void markRead(row,true)}>Buka</button><button onClick={()=>void setState(row,"snooze1h")}>1j</button><button onClick={()=>void setState(row,"tomorrow")}>Besok</button><button onClick={()=>void setState(row,"archive")}>Arsip</button></div>
  </article>)}</>}

 return <div className="notification-root">
  <button className="notification-bell" aria-label="Notifications" title="Notifications" onClick={()=>setOpen(v=>!v)}><LumaIcon name="bell"/>{unread>0&&<b>{unread>99?"99+":unread}</b>}</button>
  {open&&<div className="notification-popover v2">
   <div className="notification-head"><div><strong>Notification Center</strong><span>{unread} belum dibaca</span></div><div><button onClick={()=>setPrefsOpen(v=>!v)}>Preferences</button><button onClick={()=>void markAll()}>Mark all read</button></div></div>
   <div className="notification-priority-tabs">{(["all","critical","action","info"] as const).map(p=><button key={p} className={priorityFilter===p?"active":""} onClick={()=>setPriorityFilter(p)}>{p==="all"?"Unread "+unread:priorityLabel(p)+" "+counts[p]}</button>)}</div>
   {categoryOptions.length>2&&<div className="notification-filters">{categoryOptions.map(option=><button key={option} className={categoryFilter===option?"active":""} onClick={()=>setCategoryFilter(option)}>{option==="all"?"Semua":option}</button>)}</div>}
   {prefsOpen&&<div className="notification-preferences"><label><input type="checkbox" checked={prefs.toast_enabled} onChange={e=>void savePrefs({...prefs,toast_enabled:e.target.checked})}/> Toast notification</label><label><input type="checkbox" checked={prefs.critical_toast_only} onChange={e=>void savePrefs({...prefs,critical_toast_only:e.target.checked})}/> Toast hanya Critical</label><label><input type="checkbox" checked={prefs.operational_enabled} onChange={e=>void savePrefs({...prefs,operational_enabled:e.target.checked})}/> Operational notification</label><label><input type="checkbox" checked={prefs.marketing_enabled} onChange={e=>void savePrefs({...prefs,marketing_enabled:e.target.checked})}/> Promo & education</label></div>}
   <div className="notification-list v2-list">{todayRows.length>0&&<><h4>Hari ini</h4><NotificationList list={todayRows}/></>}{earlierRows.length>0&&<><h4>Sebelumnya</h4><NotificationList list={earlierRows}/></>}{!visibleRows.length&&<div className="empty-state"><strong>Tidak ada notifikasi pada filter ini.</strong><span>Notifikasi yang di-snooze akan muncul kembali sesuai jadwal.</span></div>}</div>
  </div>}
  {toast&&<div className={"notification-toast v2 p-"+toast.priority} role="status" aria-live="polite"><button className="notification-toast-main" onClick={()=>void markRead(toast,true)}><span className={"notification-priority "+toast.priority}>{priorityLabel(toast.priority)}</span><strong>{toast.title}</strong><p>{toast.body}</p>{toastSeconds!==null&&<small>Tutup otomatis dalam {toastSeconds}s</small>}</button><button className="notification-toast-close" onClick={()=>{dismissedToastKeys.current.add(toast.key);setToast(null);setToastSeconds(null)}}>×</button></div>}
 </div>;
}
