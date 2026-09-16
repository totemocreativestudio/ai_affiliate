"use client";
import { useEffect,useMemo,useState } from "react";
import { createClient } from "../../lib/supabase-browser";
type Row=Record<string,any>;
const KEY="lumaway_dashboard_reminder_dismissed_at";const THIRTY=30*60*1000;
export default function DashboardReminder({workspaceId,userId,workspaceStatus}:{workspaceId:string;userId:string;workspaceStatus?:string}){
 const supabase=createClient();const [wallet,setWallet]=useState<Row|null>(null);const [pending,setPending]=useState<Row[]>([]);const [visible,setVisible]=useState(false);
 async function load(){const month=new Date().toISOString().slice(0,7);const [w,p]=await Promise.all([supabase.from("luma_token_wallets").select("*").eq("user_id",userId).eq("month",month).maybeSingle(),supabase.from("luma_topup_orders").select("id,order_code,status,expires_at").eq("workspace_id",workspaceId).eq("user_id",userId).in("status",["pending","processing"]).order("created_at",{ascending:false}).limit(5)]);setWallet(w.data||null);setPending((p.data||[]) as Row[])}
 useEffect(()=>{void load();const check=()=>{const last=Number(localStorage.getItem(KEY)||0);if(!last||Date.now()-last>=THIRTY)setVisible(true)};check();const t=window.setInterval(()=>{void load();check()},60000);return()=>window.clearInterval(t)},[workspaceId,userId]);
 const remaining=Math.max(0,Number(wallet?.monthly_limit??50)-Number(wallet?.used_tokens??0))+Math.max(0,Number(wallet?.bonus_tokens??0));
 const issues=useMemo(()=>{const a:string[]=[];if(remaining<=0)a.push("Token Anda habis. Isi ulang untuk melanjutkan fitur ber-token.");else if(remaining<=10)a.push(`Token tersisa ${remaining}. Pertimbangkan top up agar aktivitas tidak terhenti.`);if(pending.length)a.push(`${pending.length} pembayaran token masih menunggu penyelesaian.`);if(workspaceStatus&&workspaceStatus!=="active")a.push("Masa akses workspace memerlukan perpanjangan.");return a},[remaining,pending.length,workspaceStatus]);
 useEffect(()=>{if(!issues.length)setVisible(false)},[issues.length]);
 function close(){localStorage.setItem(KEY,String(Date.now()));setVisible(false)}
 if(!visible||!issues.length)return null;
 return <div className="dashboard-reminder"><button className="dashboard-reminder-close" onClick={close}>×</button><div><span className="dashboard-reminder-kicker">PENGINGAT AKUN</span><b>Perlu perhatian</b>{issues.map((x,i)=><p key={i}>{x}</p>)}<div className="dashboard-reminder-actions"><a href="#billing">Buka Billing & Token</a></div></div></div>
}
