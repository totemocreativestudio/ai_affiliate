"use client";

import { useEffect, useState } from "react";
type Props={profile:{email:string|null;full_name:string|null;role:string};workspace:{name:string;slug:string;status:string};onLogout:()=>void;};
const nav=[
  ["#dashboard","⌂","Dashboard"],["#upload","⇧","Upload Center"],["#excel-sync","⇄","Excel Sync"],["#database","▤","Database"],["#agreements","▧","Agreement"],["#affiliate-support","♡","Affiliate Support"],["#luma-affiliate","♙","Luma Affiliate"],["#promo-studio","✦","AI Promo Studio"],["#kanban","▥","Kanban"],["#tutorial","▶","Tutorial"],["#billing","▣","Billing & Token"],["#google-sheets-private","▦","Google Sheets"],["#profile","◉","My Profile"],
];
const aiNav=[["performance","Performance Analysis"],["creator","Creator Analysis"],["product","Product Analysis"],["trend","Trend Analysis"],["anomaly","Anomaly Detection"],["recommendation","Recommendations"]];
const masterNav=[["#product-master","◫","Product Master"],["#listings","☷","Listings"],["#shipping","▱","Shipping"],["#creator-samples","◇","Creator Samples"],["#ratecard","Rp","Ratecard Master"]];

export default function LumaSidebar({profile,workspace,onLogout}:Props){
 const [activeHash,setActiveHash]=useState("#dashboard");
 useEffect(()=>{const sync=()=>setActiveHash(window.location.hash||"#dashboard");sync();window.addEventListener("hashchange",sync);return()=>window.removeEventListener("hashchange",sync)},[]);
 function openAi(type:string){if(window.location.hash!=="#ai-analytics")window.location.hash="ai-analytics";setTimeout(()=>window.dispatchEvent(new CustomEvent("luma-ai-type",{detail:type})),0)}
 return <aside className="sidebar" id="sidebar"><div className="brand"><img src="/luma-mark.png" alt="Luma" className="brand-mark"/><div><strong>LUMA</strong><span>Light Up Your Potential.</span></div></div><div className="sidebar-label">WORKSPACE</div><nav className="side-nav">
   {nav.map(([href,icon,label])=><a key={href} className={activeHash===href?"active":""} href={href}><span className="nav-ico">{icon}</span><span>{label}</span>{label==="Google Sheets"&&<span className="nav-dot"/>}</a>)}
   <details className="side-group" open><summary className={activeHash==="#ai-analytics"?"active":""}><span><span className="nav-ico">✦</span>AI Analytics</span><span className="chevron">⌄</span></summary><div className="side-subnav">{aiNav.map(([key,label])=><button type="button" key={key} onClick={()=>openAi(key)}>{label}</button>)}</div></details>
   <div className="sidebar-label sidebar-label-inner">MASTER DATA</div>{masterNav.map(([href,icon,label])=><a key={href} className={activeHash===href?"active":""} href={href}><span className="nav-ico">{icon}</span><span>{label}</span></a>)}
   {profile.role==="admin"&&<><div className="sidebar-label sidebar-label-inner">LUMAWAY OWNER</div><a className={activeHash==="#administration"?"active":""} href="#administration"><span className="nav-ico">⚙</span><span>Owner Dashboard</span></a></>}
 </nav><div className="sidebar-bottom"><a href="#profile" className="user-chip sidebar-profile-link"><div className="avatar">{(profile.full_name||profile.email||"U").slice(0,1).toUpperCase()}</div><div><strong>{profile.full_name||profile.email}</strong><small>{workspace.name}</small></div></a><button className="logout" onClick={onLogout}>Logout</button></div></aside>;
}
