"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import OwnerMonitoring360 from "./OwnerMonitoring360";
import OwnerFinanceControl from "./OwnerFinanceControl";
import OwnerPlatformHealth from "./OwnerPlatformHealth";
import OwnerTutorialControl from "./OwnerTutorialControl";
import AdminBroadcast from "./AdminBroadcast";
import AdminBlog from "./AdminBlog";
import AdminSocialModeration from "./AdminSocialModeration";
import OpenAIIntegration from "./OpenAIIntegration";
import XenditIntegration from "./XenditIntegration";
import WhatsAppIntegration from "./WhatsAppIntegration";
import GoogleCloudIntegration from "./GoogleCloudIntegration";

type Row=Record<string,any>;
const fmt=(v:any)=>new Intl.NumberFormat("id-ID").format(Number(v||0));
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
type NavEvent=CustomEvent<{tab?:string;section?:string}>;

export default function AdminDashboardV3({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [tab,setTab]=useState("overview");
  const [summary,setSummary]=useState<Row>({});
  const [busy,setBusy]=useState(false);

  async function load(){setBusy(true);const {data}=await supabase.rpc("get_owner_monitoring_summary");setSummary((data||{}) as Row);setBusy(false)}
  useEffect(()=>{void load()},[workspaceId]);
  useEffect(()=>{const handler=(event:Event)=>{const e=event as NavEvent;setTab(e.detail?.tab||"overview");if(e.detail?.section)setTimeout(()=>document.getElementById(e.detail!.section!)?.scrollIntoView({behavior:"smooth",block:"start"}),120)};window.addEventListener("luma-owner-nav",handler as EventListener);return()=>window.removeEventListener("luma-owner-nav",handler as EventListener)},[]);

  const tabs=[["overview","Command Center"],["finance","Payments & Token"],["ai","AI & API"],["broadcast","Broadcast"],["content","Blog & Tutorial"],["social","Social"],["integrations","Integrations"],["system","System"]];
  return <section id="administration" className="legacy-page-anchor owner-console">
    <header className="owner-console-header"><div><span className="owner-kicker">LUMAWAY OWNER CONTROL</span><h1>Business Control Center</h1><p>Monitoring seluruh platform Lumaway dari satu console: customer, creator, store, revenue, token, referral, AI/API, content, integration, storage dan system health.</p></div><div className="owner-header-actions"><span className="owner-live"><i/>Production</span><button className="secondary" disabled={busy} onClick={()=>load()}>{busy?"Refreshing...":"Refresh"}</button></div></header>
    <div className="owner-health-strip"><Metric label="Users" value={fmt(summary.users)} sub={`${fmt(summary.active_users)} active`}/><Metric label="Workspaces" value={fmt(summary.workspaces)} sub="customer databases"/><Metric label="Creators" value={fmt(summary.creators)} sub={`${fmt(summary.stores)} stores`}/><Metric label="GMV Monitored" value={money(summary.gmv)} sub={`${fmt(summary.orders)} orders`}/><Metric label="API Tokens" value={fmt(summary.api_total_tokens)} sub={`${fmt(summary.api_requests)} calls`}/><Metric label="Open Issues" value={fmt(summary.open_issues)} sub="production"/></div>
    <nav className="owner-tabbar">{tabs.map(([k,l])=><button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}>{l}</button>)}</nav>
    {tab==="overview"&&<OwnerMonitoring360/>}
    {tab==="finance"&&<OwnerFinanceControl/>}
    {tab==="ai"&&<OwnerPlatformHealth mode="api"/>}
    {tab==="broadcast"&&<AdminBroadcast workspaceId={workspaceId}/>} 
    {tab==="content"&&<div className="owner-section-stack"><AdminBlog workspaceId={workspaceId}/><OwnerTutorialControl workspaceId={workspaceId}/></div>} 
    {tab==="social"&&<AdminSocialModeration/>}
    {tab==="integrations"&&<div className="integrations-stack"><div className="owner-section-title"><div><span className="owner-kicker">PLATFORM CONNECTIONS</span><h2>Integrations</h2><p>Credential sensitif tetap server-side. Owner console hanya menampilkan konfigurasi dan status operasional.</p></div></div><GoogleCloudIntegration/><div id="owner-integration-openai"><OpenAIIntegration workspaceId={workspaceId}/></div><div id="owner-integration-xendit"><XenditIntegration workspaceId={workspaceId}/></div><div id="owner-integration-whatsapp"><WhatsAppIntegration workspaceId={workspaceId}/></div></div>}
    {tab==="system"&&<OwnerPlatformHealth mode="system"/>}
  </section>;
}
function Metric({label,value,sub}:{label:string;value:any;sub?:string}){return <div className="owner-metric"><span>{label}</span><b>{value}</b>{sub&&<small>{sub}</small>}</div>}
