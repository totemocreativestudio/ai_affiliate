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
  ["performance", "Performance Analysis"],
  ["creator", "Creator Analysis"],
  ["product", "Product Analysis"],
  ["trend", "Trend Analysis"],
  ["anomaly", "Anomaly Detection"],
  ["recommendation", "Recommendations"],
] as const;

const masterNav: Array<[string, IconName, string]> = [
  ["product-master", "product", "Product Master"],
  ["listings", "listing", "Listings"],
  ["shipping", "shipping", "Shipping"],
  ["creator-samples", "sample", "Creator Samples"],
  ["ratecard", "ratecard", "Ratecard Master"],
];

const ownerNav: Array<[string, IconName, string]> = [
  ["overview", "dashboard", "Command Center"],
  ["support", "support", "Support Desk"],
  ["finance", "finance", "Payments & Token"],
  ["referral", "referral", "Referral & Payout"],
  ["ai", "ai", "AI & API Usage"],
  ["broadcast", "broadcast", "Broadcast & Promo"],
  ["content", "content", "Blog & Tutorial"],
  ["social", "community", "Social Moderation"],
  ["system", "system", "System & Issues"],
];

const integrationNav: Array<[string, IconName, string]> = [
  ["owner-integration-google", "integration", "Google Cloud"],
  ["owner-integration-openai", "ai", "OpenAI"],
  ["owner-integration-xendit", "billing", "Xendit"],
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

  function go(event: React.MouseEvent<HTMLAnchorElement>, section: string) {
    event.preventDefault();
    if (accessLocked && !["dashboard", "billing", "profile"].includes(section)) {
      navigateToSection("billing");
      setActiveSection("billing");
      if (window.innerWidth <= 1024) setMobileOpen(false);
      return;
    }
    navigateToSection(section);
    setActiveSection(section);
    if (window.innerWidth <= 1024) setMobileOpen(false);
  }

  function openAi(type: string) {
    if (accessLocked) {
      navigateToSection("billing");
      setActiveSection("billing");
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
    const actualTab = tab === "referral" ? "finance" : tab;
    setOwnerTab(tab);
    navigateToSection("administration");
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("luma-owner-nav", { detail: { tab: actualTab, section } })), 50);
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
            <small>{isOwner ? "Owner Control" : "Light Up Your Potential."}</small>
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
            <div className="sidebar-label">OWNER CONTROL</div>
            <nav className="side-nav owner-nav" onClick={closeOnMobile}>
              {ownerNav.map(([tab, icon, label]) => (
                <button type="button" key={tab} className={ownerTab === tab ? "active" : ""} onClick={() => openOwner(tab, tab === "referral" ? "owner-referral-payout" : undefined)}>
                  <NavIcon name={icon} /><span className="nav-label">{label}</span>
                </button>
              ))}
              <details className="side-group" open>
                <summary><span><NavIcon name="integration" /><span className="nav-label">Integrations</span></span><LumaIcon name="chevron" className="chevron" /></summary>
                <div className="side-subnav owner-subnav">
                  {integrationNav.map(([section, icon, label]) => <button type="button" key={section} onClick={() => openOwner("integrations", section)}><LumaIcon name={icon} /><span>{label}</span></button>)}
                </div>
              </details>
            </nav>
          </>
        ) : (
          <>
            <div className="sidebar-label">WORKSPACE</div>
            <nav className="side-nav user-grouped-nav">
              <a className={activeSection === "dashboard" ? "active" : ""} href={routeForSection("dashboard")} onClick={(event) => go(event, "dashboard")}>
                <NavIcon name="dashboard" /><span className="nav-label">Dashboard</span>
              </a>

              <Group icon="data" label="Data & Sync" open>
                <a href={routeForSection("upload")} onClick={(e) => go(e, "upload")}><LumaIcon name="data" />Upload Center</a>
                <a href={routeForSection("excel-sync")} onClick={(e) => go(e, "excel-sync")}><LumaIcon name="listing" />Excel Sync</a>
                <a href={routeForSection("database")} onClick={(e) => go(e, "database")}><LumaIcon name="master" />Database</a>
              </Group>

              <Group icon="creator" label="Creator Management">
                <a href={routeForSection("agreements")} onClick={(e) => go(e, "agreements")}><LumaIcon name="content" />Agreement</a>
                <a href={routeForSection("affiliate-support")} onClick={(e) => go(e, "affiliate-support")}><LumaIcon name="support" />Affiliate Support</a>
              </Group>

              <details className="side-group" open>
                <summary className={activeSection === "ai-analytics" ? "active" : ""}>
                  <span><NavIcon name="ai" /><span className="nav-label">AI Analytics</span></span><LumaIcon name="chevron" className="chevron" />
                </summary>
                <div className="side-subnav">
                  {aiNav.map(([key, label]) => <button type="button" key={key} onClick={() => openAi(key)}><LumaIcon name="ai" /><span>{label}</span></button>)}
                </div>
              </details>

              <a href={routeForSection("promo-studio")} onClick={(e) => go(e, "promo-studio")}><NavIcon name="sparkles" /><span className="nav-label">AI Promo Studio</span></a>
              <a href={routeForSection("kanban")} onClick={(e) => go(e, "kanban")}><NavIcon name="kanban" /><span className="nav-label">Kanban</span></a>

              <Group icon="ticket" label="Tiket Bantuan">
                <a href={routeForSection("support-tickets")} onClick={(e) => go(e, "support-tickets")}><LumaIcon name="ticket" />Status & Riwayat Tiket</a>
              </Group>

              <Group icon="billing" label="Billing & Affiliate">
                <a href={routeForSection("billing")} onClick={(e) => go(e, "billing")}><LumaIcon name="billing" />Billing & Token</a>
                <a href={routeForSection("luma-affiliate")} onClick={(e) => go(e, "luma-affiliate")}><LumaIcon name="referral" />Luma Affiliate</a>
              </Group>

              <Group icon="content" label="Content & Community">
                <a href={routeForSection("content-hub")} onClick={(e) => go(e, "content-hub")}><LumaIcon name="content" />Insight & Blog</a>
                <a href={routeForSection("social-lumaway")} onClick={(e) => go(e, "social-lumaway")}><LumaIcon name="community" />Social Lumaway</a>
              </Group>

              <Group icon="master" label="Master Data">
                {masterNav.map(([section, icon, label]) => <a key={section} href={routeForSection(section)} onClick={(e) => go(e, section)}><LumaIcon name={icon} /><span>{label}</span></a>)}
              </Group>
            </nav>
          </>
        )}

        <div className="sidebar-bottom">
          {!isOwner && <PWAInstallButton />}
          <a href={routeForSection(isOwner ? "administration" : "profile")} className="user-chip sidebar-profile-link" onClick={(event) => go(event, isOwner ? "administration" : "profile")}>
            <div className="avatar">{(profile.full_name || profile.email || "U").slice(0, 1).toUpperCase()}</div>
            <div className="sidebar-user-copy"><strong>{profile.full_name || profile.email}</strong><small>{isOwner ? "Owner · Lumaway" : `My Profile · ${workspace.name}`}</small></div>
          </a>
          <button className="logout" onClick={onLogout}><LumaIcon name="logout" className="logout-icon" /><span className="nav-label">Logout</span></button>
        </div>
      </aside>
    </>
  );
}
