"use client";

import LumaIcon,{type IconName} from "./LumaIcon";

const ownerOverviewNav:Array<[string,IconName,string]>=[
 ["overview","dashboard","Command Center"],
 ["targets","performance","Target & Forecast"],
 ["monitoring","data","Monitoring 360"],
];
const ownerBusinessNav:Array<[string,IconName,string]>=[
 ["support","support","Support Desk"],
 ["finance","billing","Payments & Subscription"],
 ["referral","referral","Referral & Payout"],
];
const ownerIntelligenceNav:Array<[string,IconName,string]>=[
 ["ai","performance","AI & API Usage"],
 ["providers","integration","Provider Accounts"],
 ["hpp","product","Lumaway Pricing Guardrail"],
];
const ownerContentNav:Array<[string,IconName,string]>=[
 ["broadcast","broadcast","Broadcast & Promo"],
 ["content","content","Blog & Tutorial"],
 ["knowledge","master","Knowledge Vault"],
 ["social","community","Social Moderation"],
];
const integrationNav:Array<[string,IconName,string]>=[
 ["owner-integration-google","integration","Google Cloud"],
 ["owner-integration-openai","integration","OpenAI"],
 ["owner-integration-resend","content","Resend Email"],
 ["owner-integration-whatsapp","community","WhatsApp CRM & OTP"],
];

function NavIcon({name}:{name:IconName}){return <span className="nav-ico"><LumaIcon name={name}/></span>}
function Group({icon,label,children,open=false}:{icon:IconName;label:string;children:any;open?:boolean}){
 return <details className="side-group" open={open}><summary><span><NavIcon name={icon}/><span className="nav-label">{label}</span></span><LumaIcon name="chevron" className="chevron"/></summary><div className="side-subnav">{children}</div></details>
}

export default function OwnerSidebarMenu({ownerTab,onOpenOwner,onCloseMobile}:{ownerTab:string;onOpenOwner:(tab:string,section?:string)=>void;onCloseMobile:()=>void}){
 return <nav className="side-nav owner-nav" aria-label="Navigasi admin" onClick={onCloseMobile}>
  <Group icon="dashboard" label="Overview" open>
   {ownerOverviewNav.map(([tab,icon,label])=><button type="button" key={tab} className={ownerTab===tab?"active":""} onClick={()=>onOpenOwner(tab)}><LumaIcon name={icon}/><span>{label}</span></button>)}
  </Group>
  <Group icon="billing" label="Business Operations" open>
   {ownerBusinessNav.map(([tab,icon,label])=><button type="button" key={tab} className={ownerTab===tab?"active":""} onClick={()=>onOpenOwner(tab,tab==="referral"?"owner-referral-payout":undefined)}><LumaIcon name={icon}/><span>{label}</span></button>)}
  </Group>
  <Group icon="performance" label="Intelligence & Cost">
   {ownerIntelligenceNav.map(([tab,icon,label])=><button type="button" key={tab} className={ownerTab===tab?"active":""} onClick={()=>onOpenOwner(tab)}><LumaIcon name={icon}/><span>{label}</span></button>)}
  </Group>
  <Group icon="content" label="Content & Community">
   {ownerContentNav.map(([tab,icon,label])=><button type="button" key={tab} className={ownerTab===tab?"active":""} onClick={()=>onOpenOwner(tab)}><LumaIcon name={icon}/><span>{label}</span></button>)}
  </Group>
  <details className="side-group owner-financial-group">
   <summary><span><NavIcon name="finance"/><span className="nav-label">Laporan Keuangan</span></span><LumaIcon name="chevron" className="chevron"/></summary>
   <div className="side-subnav owner-subnav">
    {[["sales","Total Penjualan"],["api_cost","Total Usage API"],["cashflow","Cashflow"],["margin","Margin"],["profit_loss","Laba & Rugi"]].map(([key,label])=><button type="button" key={key} onClick={()=>{onOpenOwner("financial");window.setTimeout(()=>window.dispatchEvent(new CustomEvent("luma-financial-report-type",{detail:{type:key}})),90)}}><LumaIcon name="finance"/><span>{label}</span></button>)}
   </div>
  </details>
  <details className="side-group">
   <summary><span><NavIcon name="integration"/><span className="nav-label">Integrations</span></span><LumaIcon name="chevron" className="chevron"/></summary>
   <div className="side-subnav owner-subnav">
    {integrationNav.map(([section,icon,label])=><button type="button" key={section} onClick={()=>onOpenOwner("integrations",section)}><LumaIcon name={icon}/><span>{label}</span></button>)}
   </div>
  </details>
  <button type="button" className={ownerTab==="system"?"active":""} onClick={()=>onOpenOwner("system")}><NavIcon name="system"/><span className="nav-label">System & Issues</span></button>
 </nav>
}
