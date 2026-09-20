"use client";
import {useEffect,useState} from "react";
import {LumaErrorMotion} from "./LumaMotionState";
type State={mode:string;status_code:number;title:string;message?:string;block_user_access:boolean};
export default function SystemStatusGate({workspaceId,isAdmin}:{workspaceId:string;isAdmin:boolean}){
 const [state,setState]=useState<State|null>(null);const [checking,setChecking]=useState(false);
 async function load(){setChecking(true);try{const r=await fetch(`/api/system/status?workspace_id=${encodeURIComponent(workspaceId)}`,{cache:"no-store"});const d=await r.json();if(r.ok&&d.ok)setState(d.state)}catch{}finally{setChecking(false)}}
 useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),20000);return()=>window.clearInterval(timer)},[workspaceId]);
 if(!state||state.mode==="normal")return null;
 if(state.block_user_access&&!isAdmin)return <div className="system-status-blocker"><LumaErrorMotion code={state.status_code||503} title={state.title} message={state.message||"Lumaway sedang dalam proses pemeliharaan."} detail={checking?"Memeriksa status layanan...":"Status diperbarui otomatis setiap 20 detik."} onRetry={()=>void load()}/></div>;
 return <div className={`system-status-banner mode-${state.mode}`}><b>{state.title}</b><span>{state.message}</span><button type="button" onClick={()=>void load()} disabled={checking}>{checking?"Checking...":"Refresh"}</button></div>;
}
