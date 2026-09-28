"use client";

import {useEffect,useState} from "react";
import OwnerMonitoring360 from "./OwnerMonitoring360";
import OwnerFinanceControl from "./OwnerFinanceControl";
import OwnerSubscriptionPromo from "./OwnerSubscriptionPromo";
import OwnerPlatformHealth from "./OwnerPlatformHealth";
import OwnerTutorialControl from "./OwnerTutorialControl";
import OwnerSupportDesk from "./OwnerSupportDesk";
import AdminBroadcast from "./AdminBroadcast";
import AdminBlog from "./AdminBlog";
import AdminSocialModeration from "./AdminSocialModeration";
import OpenAIIntegration from "./OpenAIIntegration";
import WhatsAppIntegration from "./WhatsAppIntegration";
import GoogleCloudIntegration from "./GoogleCloudIntegration";
import OwnerCommandCenterSummary from "./OwnerCommandCenterSummary";
import OwnerProviderAccounts from "./OwnerProviderAccounts";
import OwnerFinancialReports from "./OwnerFinancialReports";
import OwnerHppCalculator from "./OwnerHppCalculator";
import OwnerKnowledgeVault from "./OwnerKnowledgeVault";
import OwnerSystemControl from "./OwnerSystemControl";
import MayarIntegration from "./MayarIntegration";
import PaymentGatewayControl from "./PaymentGatewayControl";
import EmailIntegrationStatus from "./EmailIntegrationStatus";
import ResendIntegration from "./ResendIntegration";

type NavEvent=CustomEvent<{tab?:string;section?:string}>;

const OWNER_TABS=new Set([
  "overview","targets","monitoring","support","finance","referral","ai","providers",
  "hpp","broadcast","content","knowledge","social","integrations","financial","system"
]);

const OWNER_META:Record<string,{kicker:string;title:string;description:string}>={
  overview:{kicker:"LUMAWAY CONTROL CENTER",title:"Command Center",description:"Ringkasan eksekutif kondisi bisnis dan operasional Lumaway. Detail pengelolaan berada di halaman sidebar masing-masing."},
  targets:{kicker:"BUSINESS PLANNING",title:"Target & Forecast",description:"Kelola target revenue, forecast, actual verified revenue, dan pencapaian bulanan tanpa mencampurkannya ke Command Center."},
  monitoring:{kicker:"MONITORING",title:"Monitoring 360",description:"Pantau user, workspace, creator, store, aktivitas, dan pemakaian platform dari satu halaman monitoring."},
  support:{kicker:"CUSTOMER OPERATIONS",title:"Support Desk",description:"Kelola tiket, bantuan, dan kebutuhan operasional user Lumaway."},
  finance:{kicker:"BILLING CONTROL",title:"Payments & Subscription",description:"Kelola subscription plan, token package, payment history, masa aktif, dan promotion code."},
  referral:{kicker:"PARTNER PAYOUT",title:"Referral & Payout",description:"Kelola withdrawal referral dan proses payout secara terpisah dari billing user."},
  ai:{kicker:"AI OPERATIONS",title:"AI & API Usage",description:"Pantau pemakaian model, token, biaya API, serta kesehatan penggunaan AI."},
  providers:{kicker:"PROVIDER OPERATIONS",title:"Provider Accounts",description:"Pantau renewal, saldo, limit, dan status akun provider operasional Lumaway."},
  hpp:{kicker:"UNIT ECONOMICS",title:"Lumaway Pricing Guardrail",description:"Analisis biaya, margin, HPP, dan guardrail pricing produk digital Lumaway."},
  broadcast:{kicker:"COMMUNICATION",title:"Broadcast & Promo",description:"Kelola broadcast, promosi, dan komunikasi campaign kepada user."},
  content:{kicker:"CONTENT OPERATIONS",title:"Blog & Tutorial",description:"Kelola materi blog, insight, tutorial, dan edukasi user."},
  knowledge:{kicker:"KNOWLEDGE",title:"Knowledge Vault",description:"Kelola sumber pengetahuan internal yang digunakan Lumaway."},
  social:{kicker:"COMMUNITY OPERATIONS",title:"Social Moderation",description:"Moderasi konten dan aktivitas Lumaway Social."},
  integrations:{kicker:"PLATFORM CONNECTIONS",title:"Integrations",description:"Kelola koneksi Google Cloud, OpenAI, Resend, Mayar, WhatsApp, dan payment gateway secara terpisah."},
  financial:{kicker:"BUSINESS REPORTING",title:"Laporan Keuangan & Penjualan",description:"Laporan revenue, API cost, cashflow, margin, serta laba rugi Lumaway."},
  system:{kicker:"SYSTEM OPERATIONS",title:"System & Issues",description:"Kelola status platform, maintenance, issue, dan kontrol sistem global."},
};

function tabFromLocation(){
  if(typeof window==="undefined")return "overview";
  const parts=window.location.pathname.split("/").filter(Boolean);
  const candidate=parts[0]==="administration"?String(parts[1]||"overview"):"overview";
  return OWNER_TABS.has(candidate)?candidate:"overview";
}

export default function AdminDashboardV3({workspaceId}:{workspaceId:string}){
  const [tab,setTab]=useState("overview");

  useEffect(()=>{
    const syncFromLocation=()=>setTab(tabFromLocation());
    const handler=(event:Event)=>{
      const e=event as NavEvent;
      const next=OWNER_TABS.has(String(e.detail?.tab||""))?String(e.detail?.tab):"overview";
      setTab(next);
      const path=`/administration/${next}`;
      if(window.location.pathname!==path){
        window.history.pushState(null,"",path);
        window.dispatchEvent(new CustomEvent("lumaway-routechange",{detail:{section:"administration",path}}));
      }
      if(e.detail?.section){
        window.setTimeout(()=>document.getElementById(e.detail!.section!)?.scrollIntoView({behavior:"smooth",block:"start"}),120);
      }else{
        window.scrollTo({top:0,behavior:"smooth"});
      }
    };
    syncFromLocation();
    window.addEventListener("popstate",syncFromLocation);
    window.addEventListener("luma-owner-nav",handler as EventListener);
    return()=>{
      window.removeEventListener("popstate",syncFromLocation);
      window.removeEventListener("luma-owner-nav",handler as EventListener);
    };
  },[]);

  const meta=OWNER_META[tab]||OWNER_META.overview;

  return <section id="administration" className="legacy-page-anchor owner-console">
    <header className="owner-console-header">
      <div>
        <span className="owner-kicker">{meta.kicker}</span>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>
      <div className="owner-header-actions"><span className="owner-live"><i/>Production</span></div>
    </header>

    {tab==="overview"&&<OwnerCommandCenterSummary workspaceId={workspaceId} mode="summary"/>}
    {tab==="targets"&&<OwnerCommandCenterSummary workspaceId={workspaceId} mode="targets"/>}
    {tab==="monitoring"&&<OwnerMonitoring360/>}
    {tab==="support"&&<OwnerSupportDesk workspaceId={workspaceId}/>}
    {tab==="finance"&&<div className="owner-section-stack"><OwnerSubscriptionPromo/><OwnerFinanceControl mode="finance"/></div>}
    {tab==="referral"&&<OwnerFinanceControl mode="referral"/>}
    {tab==="ai"&&<OwnerPlatformHealth mode="api"/>}
    {tab==="broadcast"&&<AdminBroadcast workspaceId={workspaceId}/>}
    {tab==="content"&&<div className="owner-section-stack"><AdminBlog workspaceId={workspaceId}/><OwnerTutorialControl workspaceId={workspaceId}/></div>}
    {tab==="social"&&<AdminSocialModeration/>}
    {tab==="financial"&&<OwnerFinancialReports workspaceId={workspaceId}/>}
    {tab==="hpp"&&<OwnerHppCalculator workspaceId={workspaceId}/>}
    {tab==="providers"&&<OwnerProviderAccounts/>}
    {tab==="knowledge"&&<OwnerKnowledgeVault/>}
    {tab==="integrations"&&<div className="integrations-stack">
      <PaymentGatewayControl workspaceId={workspaceId}/>
      <EmailIntegrationStatus workspaceId={workspaceId}/>
      <GoogleCloudIntegration/>
      <div id="owner-integration-openai"><OpenAIIntegration workspaceId={workspaceId}/></div>
      <ResendIntegration workspaceId={workspaceId}/>
      <div id="owner-integration-mayar"><MayarIntegration workspaceId={workspaceId}/></div>
      <div id="owner-integration-whatsapp"><WhatsAppIntegration workspaceId={workspaceId}/></div>
    </div>}
    {tab==="system"&&<div className="owner-section-stack"><OwnerSystemControl workspaceId={workspaceId}/><OwnerPlatformHealth mode="system"/></div>}
  </section>;
}
