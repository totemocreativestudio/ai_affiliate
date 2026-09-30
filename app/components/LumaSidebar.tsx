"use client";

import { useEffect, useState } from "react";
import { navigateToSection, routeForSection, sectionFromPath } from "../../lib/luma-navigation";
import LumaIcon, { type IconName } from "./LumaIcon";
import PWAInstallButton from "./PWAInstallButton";

type Props = {
  profile: { email: string | null; full_name: string | null; role: string };
  workspace: { name: string; slug: string; status: string };
  onLogout: () => void;
  accessLocked?: boolean;
};

const aiNav = [
  ["recommendation", "Recommendations"],
  ["performance", "Performance Insights"],
  ["product", "Product Insights"],
  ["creator", "Creator Insights"],
] as const;

const creatorOpsNav: Array<[string, IconName, string]> = [
  ["agreements", "content", "Agreement"],
  ["affiliate-support", "support", "Affiliate Support"],
  ["creator-samples", "sample", "Creator Samples"],
  ["ratecard", "ratecard", "Ratecard Master"],
];

const commerceNav: Array<[string, IconName, string]> = [
  ["product-master", "product", "Product Master"],
  ["listings", "listing", "Listings"],
  ["shipping", "shipping", "Shipping"],
];

const ownerOverviewNav: Array<[string, IconName, string]> = [
  ["overview", "dashboard", "Command Center"],
  ["targets", "performance", "Target & Forecast"],
  ["monitoring", "data", "Monitoring 360"],
];
const ownerBusinessNav: Array<[string, IconName, string]> = [
  ["support", "support", "Support Desk"],
  ["finance", "billing", "Payments & Subscription"],
  ["referral", "referral", "Referral & Payout"],
];
const ownerIntelligenceNav: Array<[string, IconName, string]> = [
  ["ai", "performance", "AI & API Usage"],
  ["providers", "integration", "Provider Accounts"],
  ["hpp", "product", "Lumaway Pricing Guardrail"],
];
const ownerContentNav: Array<[string, IconName, string]> = [
  ["broadcast", "broadcast", "Broadcast & Promo"],
  ["content", "content", "Blog & Tutorial"],
  ["knowledge", "master", "Knowledge Vault"],
  ["social", "community", "Social Moderation"],
];
const ownerNav: Array<[string, IconName, string]> = [
  ...ownerOverviewNav,...ownerBusinessNav,...ownerIntelligenceNav,...ownerContentNav,
  ["system", "system", "System & Issues"],
];

const integrationNav: Array<[string, IconName, string]> = [
  ["owner-integration-google", "integration", "Google Cloud"],
  ["owner-integration-openai", "integration", "OpenAI"],
  ["owner-integration-resend", "content", "Resend Email"],
  ["owner-integration-whatsapp", "community", "WhatsApp CRM & OTP"],
];

function NavIcon({ name }: { name: IconName }) {
  return <span className="nav-ico"><LumaIcon name={name} /></span>;
}

function Group({ icon, label, children, open = false }: { icon: IconName; label: string; children: any; open?: boolean }) {
  return (
    <details className="side-group" open={open}>
      <summary>
        <span><NavIcon name={icon} /><span className="nav-label">{label}</span></span>
        <LumaIcon name="chevron" className="chevron" />
      </summary>
      <div className="side-subnav">{children}</div>
    </details>
  );
}

export default function LumaSidebar({ profile, workspace, onLogout, accessLocked = false }: Props) {
  const isOwner = profile.role === "admin";
  const [activeSection, setActiveSection] = useState(isOwner ? "administration" : "dashboard");
  const [ownerTab, setOwnerTab] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = "light";
    window.localStorage.removeItem("lumaway_theme");
    setCollapsed(window.localStorage.getItem("lumaway_sidebar_collapsed") === "1");
  }, []);

  useEffect(() => {
    const sync = () => {
      setActiveSection(isOwner ? "administration" : sectionFromPath(window.location.pathname) || "dashboard");
      if(isOwner){
        const parts=window.location.pathname.split("/").filter(Boolean);
        const candidate=parts[0]==="administration"?String(parts[1]||"overview"):"overview";
        setOwnerTab(ownerNav.some(([key])=>key===candidate)||candidate==="integrations"||candidate==="financial"?candidate:"overview");
      }
      if (window.innerWidth <= 1024) setMobileOpen(false);
    };
    const openMobile = () => setMobileOpen(true);
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("lumaway-routechange", sync as EventListener);
    window.addEventListener("lumaway-open-sidebar", openMobile);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("lumaway-routechange", sync as EventListener);
      window.removeEventListener("lumaway-open-sidebar", openMobile);
    };
  }, [isOwner]);

  const subActive=(section:string)=>activeSection===section?"active":"";

  function go(event: React.MouseEvent<HTMLAnchorElement>, section: string) {
    event.preventDefault();
    if (accessLocked && !["dashboard", "billing", "profile"].includes(section)) {
      window.dispatchEvent(new CustomEvent("lumaway-access-locked", { detail: { requestedSection: section } }));
      if (window.innerWidth <= 1024) setMobileOpen(false);
      return;
    }
    navigateToSection(section);
    setActiveSection(section);
    if (window.innerWidth <= 1024) setMobileOpen(false);
  }

  function openAi(type: string) {
    if (accessLocked) {
      window.dispatchEvent(new CustomEvent("lumaway-access-locked", { detail: { requestedSection: "ai-analytics" } }));
      setMobileOpen(false);
      return;
    }
    navigateToSection("ai-analytics");
    setActiveSection("ai-analytics");
    const index = aiNav.findIndex(([key]) => key === type);
    window.setTimeout(() => document.querySelectorAll<HTMLButtonElement>(".ai-type-grid .ai-type-card")[index]?.click(), 80);
    setMobileOpen(false);
  }

  function openOwner(tab: string, section?: string) {
    setOwnerTab(tab);
    const path=`/administration/${tab}`;
    window.history.pushState(null,"",path);
    window.dispatchEvent(new CustomEvent("lumaway-routechange",{detail:{section:"administration",path}}));
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("luma-owner-nav", { detail: { tab, section } })), 20);
    setMobileOpen(false);
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem("lumaway_sidebar_collapsed", next ? "1" : "0");
  }

  const closeOnMobile = () => { if (window.innerWidth <= 1024) setMobileOpen(false); };

  return (
    <>
      <button type="button" className="mobile-sidebar-trigger" aria-label="Buka menu Lumaway" onClick={() => setMobileOpen(true)}>
        <LumaIcon name="menu" />
      </button>
      {mobileOpen && <button type="button" className="mobile-sidebar-backdrop" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} />}

      {collapsed && <button type="button" className="sidebar-hidden-reopen" onClick={toggleCollapsed} aria-label="Buka sidebar" title="Buka sidebar"><LumaIcon name="menu" /></button>}
      <aside className={`sidebar ${isOwner ? "owner-sidebar" : ""} ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""} ${accessLocked && !isOwner ? "subscription-locked" : ""}`} id="sidebar">
        <div className="brand">
          <img src="/luma-mark.png" alt="Lumaway" className="brand-mark" />
          <div className="brand-wordmark">
            <strong>LUMAWAY<span className="brand-dot">.</span></strong>
            <small>{isOwner ? "Control Center" : "Light Up Your Potential."}</small>
          </div>
        </div>

        <div className="sidebar-controls">
          <span className="sidebar-mode-label">Lumaway Workspace</span>
          <button type="button" className="sidebar-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Tutup menu"><LumaIcon name="close" /></button>
        </div>

        <button type="button" className="sidebar-edge-collapse" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"} title={collapsed ? "Expand sidebar" : "Minimize sidebar"}>
          <LumaIcon name="chevron" />
        </button>

        {isOwner ? (
          <>
            <div className="sidebar-label">CONTROL CENTER</div>
            <nav className="side-nav owner-nav" onClick={closeOnMobile}>
              <Group icon="dashboard" label="Overview" open>
                {ownerOverviewNav.map(([tab,icon,label])=><button type="button" key={tab} className={ownerTab===tab?"active":""} onClick={()=>openOwner(tab)}><LumaIcon name={icon}/><span>{label}</span></button>)}
              </Group>
              <Group icon="billing" label="Business Operations" open>
                {ownerBusinessNav.map(([tab,icon,label])=><button type="button" key={tab} className={ownerTab===tab?"active":""} onClick={()=>openOwner(tab,tab==="referral"?"owner-referral-payout":undefined)}><LumaIcon name={icon}/><span>{label}</span></button>)}
              </Group>
              <Group icon="performance" label="Intelligence & Cost">
                {ownerIntelligenceNav.map(([tab,icon,label])=><button type="button" key={tab} className={ownerTab===tab?"active":""} onClick={()=>openOwner(tab)}><LumaIcon name={icon}/><span>{label}</span></button>)}
              </Group>
              <Group icon="content" label="Content & Community">
                {ownerContentNav.map(([tab,icon,label])=><button type="button" key={tab} className={ownerTab===tab?"active":""} onClick={()=>openOwner(tab)}><LumaIcon name={icon}/><span>{label}</span></button>)}
              </Group>
              <details className="side-group owner-financial-group">
                <summary><span><NavIcon name="finance" /><span className="nav-label">Laporan Keuangan</span></span><LumaIcon name="chevron" className="chevron" /></summary>
                <div className="side-subnav owner-subnav">
                  {[["sales","Total Penjualan"],["api_cost","Total Usage API"],["cashflow","Cashflow"],["margin","Margin"],["profit_loss","Laba & Rugi"]].map(([key,label])=><button type="button" key={key} onClick={()=>{openOwner("financial");window.setTimeout(()=>window.dispatchEvent(new CustomEvent("luma-financial-report-type",{detail:{type:key}})),90)}}><LumaIcon name="finance" /><span>{label}</span></button>)}
                </div>
              </details>
              <details className="side-group">
                <summary><span><NavIcon name="integration" /><span className="nav-label">Integrations</span></span><LumaIcon name="chevron" className="chevron" /></summary>
                <div className="side-subnav owner-subnav">
                  {integrationNav.map(([section, icon, label]) => <button type="button" key={section} onClick={() => openOwner("integrations", section)}><LumaIcon name={icon} /><span>{label}</span></button>)}
                </div>
              </details>
              <button type="button" className={ownerTab==="system"?"active":""} onClick={()=>openOwner("system")}><NavIcon name="system"/><span className="nav-label">System & Issues</span></button>
            </nav>
          </>
        ) : (
          <>
            <div className="sidebar-label">WORKSPACE</div>
            <nav className="side-nav user-grouped-nav">
              <a className={activeSection === "dashboard" ? "active" : ""} href={routeForSection("dashboard")} onClick={(event) => go(event, "dashboard")}>
                <NavIcon name="dashboard" /><span className="nav-label">Dashboard</span>
              </a>

              <Group icon="data" label="Data & Intelligence" open>
                <a className={subActive("upload")} href={routeForSection("upload")} onClick={(e) => go(e, "upload")}><LumaIcon name="data" />Upload Center</a>
                <a className={subActive("database")} href={routeForSection("database")} onClick={(e) => go(e, "database")}><LumaIcon name="master" />Database</a>
                <a className={subActive("data-health")} href={routeForSection("data-health")} onClick={(e) => go(e, "data-health")}><LumaIcon name="performance" />Data Health</a>
                <a className={subActive("excel-sync")} href={routeForSection("excel-sync")} onClick={(e) => go(e, "excel-sync")}><LumaIcon name="listing" />Excel Sync</a>
                <a className={subActive("tutorial")} href={routeForSection("tutorial")} onClick={(e) => go(e, "tutorial")}><LumaIcon name="content" />Tutorial Upload</a>
              </Group>

              <details className="side-group" open>
                <summary className={activeSection === "ai-analytics" ? "active" : ""}>
                  <span><NavIcon name="performance" /><span className="nav-label">Insights & Analysis</span></span><LumaIcon name="chevron" className="chevron" />
                </summary>
                <div className="side-subnav">
                  {aiNav.map(([key, label]) => <button type="button" key={key} onClick={() => openAi(key)}><LumaIcon name={key==="recommendation"?"recommendation":"performance"} /><span>{label}</span></button>)}
                </div>
              </details>

              <Group icon="creator" label="Affiliate & Creator">
                {creatorOpsNav.map(([section,icon,label])=><a className={subActive(section)} key={section} href={routeForSection(section)} onClick={(e)=>go(e,section)}><LumaIcon name={icon}/><span>{label}</span></a>)}
              </Group>

              <Group icon="product" label="Product & Commerce">
                {commerceNav.map(([section,icon,label])=><a className={subActive(section)} key={section} href={routeForSection(section)} onClick={(e)=>go(e,section)}><LumaIcon name={icon}/><span>{label}</span></a>)}
              </Group>

              <Group icon="kanban" label="Growth & Workflow">
                <a className={subActive("daily-brief")} href={routeForSection("daily-brief")} onClick={(e) => go(e, "daily-brief")}><LumaIcon name="recommendation" />Daily Brief</a>
                <a className={subActive("automation-rules")} href={routeForSection("automation-rules")} onClick={(e) => go(e, "automation-rules")}><LumaIcon name="kanban" />Automation Rules</a>
                <a className={subActive("goal-forecast")} href={routeForSection("goal-forecast")} onClick={(e) => go(e, "goal-forecast")}><LumaIcon name="performance" />Goal & Forecast</a>
                <a className={subActive("scheduled-reports")} href={routeForSection("scheduled-reports")} onClick={(e) => go(e, "scheduled-reports")}><LumaIcon name="content" />Scheduled Report</a>
                <a className={subActive("campaign-tracker")} href={routeForSection("campaign-tracker")} onClick={(e) => go(e, "campaign-tracker")}><LumaIcon name="performance" />Campaign Tracker</a>
                <a className={subActive("promo-studio")} href={routeForSection("promo-studio")} onClick={(e) => go(e, "promo-studio")}><LumaIcon name="broadcast" />Promo Studio</a>
                <a className={subActive("kanban")} href={routeForSection("kanban")} onClick={(e) => go(e, "kanban")}><LumaIcon name="kanban" />Kanban</a>
              </Group>

              <Group icon="ticket" label="Support & Billing">
                <a className={subActive("support-tickets")} href={routeForSection("support-tickets")} onClick={(e) => go(e, "support-tickets")}><LumaIcon name="ticket" />Status & Riwayat Tiket</a>
                <a className={subActive("billing")} href={routeForSection("billing")} onClick={(e) => go(e, "billing")}><LumaIcon name="billing" />Billing & Token</a>
                <a className={subActive("luma-affiliate")} href={routeForSection("luma-affiliate")} onClick={(e) => go(e, "luma-affiliate")}><LumaIcon name="referral" />Luma Affiliate</a>
              </Group>

              <Group icon="content" label="Content & Community">
                <a className={subActive("content-hub")} href={routeForSection("content-hub")} onClick={(e) => go(e, "content-hub")}><LumaIcon name="content" />Insight & Blog</a>
                <a className={subActive("social-lumaway")} href={routeForSection("social-lumaway")} onClick={(e) => go(e, "social-lumaway")}><LumaIcon name="community" />Social Lumaway</a>
              </Group>
            </nav>
          </>
        )}

        <div className="sidebar-bottom">
          {!isOwner && <PWAInstallButton />}
          <a href={isOwner?"/administration/overview":routeForSection("profile")} className="user-chip sidebar-profile-link" onClick={(event)=>{if(isOwner){event.preventDefault();openOwner("overview")}else go(event,"profile")}}>
            <div className="avatar">{(profile.full_name || profile.email || "U").slice(0, 1).toUpperCase()}</div>
            <div className="sidebar-user-copy"><strong>{profile.full_name || profile.email}</strong><small>{isOwner ? "Owner · Lumaway" : `My Profile · ${workspace.name}`}</small></div>
          </a>
          <button className="logout" onClick={onLogout}><LumaIcon name="logout" className="logout-icon" /><span className="nav-label">Logout</span></button>
        </div>
      </aside>
    </>
  );
}
