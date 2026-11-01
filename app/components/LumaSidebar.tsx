"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { navigateToSection, routeForSection, sectionFromPath } from "../../lib/luma-navigation";
import LumaIcon, { type IconName } from "./LumaIcon";
import PWAInstallButton from "./PWAInstallButton";
const OwnerSidebarMenu = dynamic(() => import("./OwnerSidebarMenu"), { ssr: false });
const OwnerSidebarFooter = dynamic(() => import("./OwnerSidebarFooter"), { ssr: false });
const DataHealthCenter = dynamic(() => import("./DataHealthCenter"), { ssr: false });

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
  ["spending", "billing", "Spending"],
];

function NavIcon({ name }: { name: IconName }) {
  return <span className="nav-ico"><LumaIcon name={name} /></span>;
}

const STORAGE_KEY_GROUPS = "lumaway_sidebar_groups";
const DEFAULT_OPEN_GROUPS: Record<string, boolean> = {
  data: true,
  ai: true,
  affiliate: true,
  live: false,
  commerce: false,
  growth: false,
  support: false,
  content: false,
};

function readGroupStates(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_GROUPS) || "{}");
  } catch {
    return {};
  }
}

function writeGroupStates(states: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(states));
}

function Group({
  id,
  icon,
  label,
  children,
  defaultOpen = false,
}: {
  id: string;
  icon: IconName;
  label: string;
  children: any;
  defaultOpen?: boolean;
}) {
  const stored = readGroupStates();
  const [open, setOpen] = useState(() => stored[id] ?? defaultOpen);

  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev;
      const stored = readGroupStates();
      writeGroupStates({ ...stored, [id]: next });
      return next;
    });
  }, [id]);

  return (
    <details className="side-group" open={open}>
      <summary onClick={toggle}>
        <span><NavIcon name={icon} /><span className="nav-label">{label}</span></span>
        <LumaIcon name="chevron" className="chevron ds-chevron" />
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
  const [inlineOpen, setInlineOpen] = useState<Record<string, boolean>>({
    "data-health": false,
    "excel-sync": false,
  });

  useEffect(() => {
    document.documentElement.dataset.theme = "light";
    window.localStorage.removeItem("lumaway_theme");
    setCollapsed(window.localStorage.getItem("lumaway_sidebar_collapsed") === "1");
  }, []);

  useEffect(() => {
    const sync = () => {
      setActiveSection(isOwner ? "administration" : sectionFromPath(window.location.pathname) || "dashboard");
      if (isOwner) {
        const parts = window.location.pathname.split("/").filter(Boolean);
        const candidate = parts[0] === "administration" ? String(parts[1] || "overview") : "overview";
        setOwnerTab(candidate || "overview");
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

  const subActive = (section: string) => activeSection === section ? "active" : "";

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
    const path = `/administration/${tab}`;
    window.history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("lumaway-routechange", { detail: { section: "administration", path } }));
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("luma-owner-nav", { detail: { tab, section } })), 20);
    setMobileOpen(false);
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem("lumaway_sidebar_collapsed", next ? "1" : "0");
  }

  const closeOnMobile = () => { if (window.innerWidth <= 1024) setMobileOpen(false); };

  const toggleInline = useCallback((key: string) => {
    setInlineOpen(prev => {
      const next = { ...prev, [key]: !prev[key] };
      return next;
    });
  }, []);

  return (
    <>
      <button type="button" className="mobile-sidebar-trigger" aria-label="Buka menu Lumaway" onClick={() => setMobileOpen(true)}>
        <LumaIcon name="menu" />
      </button>
      {mobileOpen && <button type="button" className="mobile-sidebar-backdrop" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} />}

      {collapsed && <button type="button" className="sidebar-hidden-reopen" onClick={toggleCollapsed} aria-label="Buka sidebar" title="Buka sidebar"><LumaIcon name="menu" /></button>}
      <aside className={`sidebar ${isOwner ? "owner-sidebar" : ""} ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""} ${accessLocked && !isOwner ? "subscription-locked" : ""}`} id="sidebar">
        <div className="brand">
          <img src="/luma-mark.png" alt="Lumaway" className="brand-mark" width={36} height={36} />
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
            <OwnerSidebarMenu ownerTab={ownerTab} onOpenOwner={openOwner} onCloseMobile={closeOnMobile} />
          </>
        ) : (
          <>
            <div className="sidebar-label">WORKSPACE</div>
            <nav className="side-nav user-grouped-nav" aria-label="Navigasi workspace">
              <a className={activeSection === "dashboard" ? "active" : ""} href={routeForSection("dashboard")} onClick={(event) => go(event, "dashboard")}>
                <NavIcon name="dashboard" /><span className="nav-label">Dashboard</span>
              </a>

              <Group id="data" icon="data" label="Data & Intelligence" defaultOpen={true}>
                <a className={subActive("upload")} href={routeForSection("upload")} onClick={(e) => go(e, "upload")}><LumaIcon name="data" />Upload Center</a>
                <a className={subActive("database")} href={routeForSection("database")} onClick={(e) => go(e, "database")}><LumaIcon name="master" />Database</a>
                <a className={subActive("data-health")} href={routeForSection("data-health")} onClick={(e) => go(e, "data-health")}><LumaIcon name="performance" />Data Health</a>
                <a className={subActive("excel-sync")} href={routeForSection("excel-sync")} onClick={(e) => go(e, "excel-sync")}><LumaIcon name="listing" />Excel Sync</a>
                <a className={subActive("tutorial")} href={routeForSection("tutorial")} onClick={(e) => go(e, "tutorial")}><LumaIcon name="content" />Tutorial Upload</a>

                {/* Inline expand: Data Health */}
                {inlineOpen["data-health"] && (
                  <div className="ds-progressive-panel ds-expand" style={{ paddingLeft: "36px" }}>
                    <DataHealthCenter workspaceId={workspace.slug} />
                  </div>
                )}

                {/* Inline expand: Excel Sync */}
                {inlineOpen["excel-sync"] && (
                  <div className="ds-progressive-panel ds-expand" style={{ paddingLeft: "36px" }}>
                    <div className="excel-sync-inline p-3">
                      <div className="section-head mb-3">
                        <h4>Excel Sync</h4>
                        <p className="muted">Sinkronkan data dari file Excel</p>
                      </div>
                      <div className="card p-4">
                        <p className="muted mb-3">Fitur Excel Sync akan segera hadir. Saat ini gunakan Upload Center untuk impor data.</p>
                        <button className="primary" onClick={() => navigateToSection("upload")}>Buka Upload Center</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Inline expand triggers for Data Health & Excel Sync */}
                <button
                  type="button"
                  className="inline-expand-trigger ds-progressive-trigger"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleInline("data-health"); }}
                  aria-expanded={inlineOpen["data-health"]}
                  aria-controls="data-health-panel"
                  style={{ marginLeft: "auto", marginRight: "8px", padding: "4px 8px" }}
                >
                  <LumaIcon name="data" />
                  <LumaIcon name="chevron" className={`ds-chevron ${inlineOpen["data-health"] ? "rotated" : ""}`} />
                </button>
                <button
                  type="button"
                  className="inline-expand-trigger ds-progressive-trigger"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleInline("excel-sync"); }}
                  aria-expanded={inlineOpen["excel-sync"]}
                  aria-controls="excel-sync-panel"
                  style={{ marginLeft: "auto", marginRight: "8px", padding: "4px 8px" }}
                >
                  <LumaIcon name="master" />
                  <LumaIcon name="chevron" className={`ds-chevron ${inlineOpen["excel-sync"] ? "rotated" : ""}`} />
                </button>
              </Group>

              <details className="side-group" open>
                <summary className={activeSection === "ai-analytics" ? "active" : ""}>
                  <span><NavIcon name="performance" /><span className="nav-label">Insights & Analysis</span></span><LumaIcon name="chevron" className="chevron ds-chevron" />
                </summary>
                <div className="side-subnav">
                  {aiNav.map(([key, label]) => <button type="button" key={key} onClick={() => openAi(key)}><LumaIcon name={key === "recommendation" ? "recommendation" : "performance"} /><span>{label}</span></button>)}
                </div>
              </details>

              <Group id="affiliate" icon="creator" label="Affiliate & Creator" defaultOpen={true}>
                <a className={subActive("affiliate-360")} href={routeForSection("affiliate-360")} onClick={(e) => go(e, "affiliate-360")}><LumaIcon name="creator" /><span>Affiliate 360</span></a>
                {creatorOpsNav.map(([section, icon, label]) => <a className={subActive(section)} key={section} href={routeForSection(section)} onClick={(e) => go(e, section)}><LumaIcon name={icon} /><span>{label}</span></a>)}
              </Group>

              <Group id="live" icon="performance" label="Live Streaming" defaultOpen={false}>
                <a className={subActive("live-streaming")} href={routeForSection("live-streaming")} onClick={(e) => go(e, "live-streaming")}><LumaIcon name="performance" /><span>Live Streaming</span></a>
              </Group>

              <Group id="commerce" icon="product" label="Product & Commerce" defaultOpen={false}>
                {commerceNav.map(([section, icon, label]) => <a className={subActive(section)} key={section} href={routeForSection(section)} onClick={(e) => go(e, section)}><LumaIcon name={icon} /><span>{label}</span></a>)}
              </Group>

              <Group id="growth" icon="kanban" label="Growth & Workflow" defaultOpen={false}>
                <a className={subActive("daily-brief")} href={routeForSection("daily-brief")} onClick={(e) => go(e, "daily-brief")}><LumaIcon name="recommendation" />Daily Brief</a>
                <a className={subActive("automation-rules")} href={routeForSection("automation-rules")} onClick={(e) => go(e, "automation-rules")}><LumaIcon name="kanban" />Automation Rules</a>
                <a className={subActive("goal-forecast")} href={routeForSection("goal-forecast")} onClick={(e) => go(e, "goal-forecast")}><LumaIcon name="performance" />Goal & Forecast</a>
                <a className={subActive("scheduled-reports")} href={routeForSection("scheduled-reports")} onClick={(e) => go(e, "scheduled-reports")}><LumaIcon name="content" />Scheduled Report</a>
                <a className={subActive("campaign-tracker")} href={routeForSection("campaign-tracker")} onClick={(e) => go(e, "campaign-tracker")}><LumaIcon name="performance" />Campaign Tracker</a>
                <a className={subActive("promo-studio")} href={routeForSection("promo-studio")} onClick={(e) => go(e, "promo-studio")}><LumaIcon name="broadcast" />Promo Studio</a>
                <a className={subActive("kanban")} href={routeForSection("kanban")} onClick={(e) => go(e, "kanban")}><LumaIcon name="kanban" />Kanban</a>
              </Group>

              <Group id="support" icon="ticket" label="Support & Billing" defaultOpen={false}>
                <a className={subActive("support-tickets")} href={routeForSection("support-tickets")} onClick={(e) => go(e, "support-tickets")}><LumaIcon name="ticket" />Ticket Status & History</a>
                <a className={subActive("billing")} href={routeForSection("billing")} onClick={(e) => go(e, "billing")}><LumaIcon name="billing" />Billing & Token</a>
                <a className={subActive("luma-affiliate")} href={routeForSection("luma-affiliate")} onClick={(e) => go(e, "luma-affiliate")}><LumaIcon name="referral" />Luma Affiliate</a>
              </Group>

              <Group id="content" icon="content" label="Content & Community" defaultOpen={false}>
                <a className={subActive("content-hub")} href={routeForSection("content-hub")} onClick={(e) => go(e, "content-hub")}><LumaIcon name="content" />Insight & Blog</a>
                <a className={subActive("social-lumaway")} href={routeForSection("social-lumaway")} onClick={(e) => go(e, "social-lumaway")}><LumaIcon name="community" />Social Lumaway</a>
              </Group>
            </nav>
          </>
        )}

        {isOwner ? <OwnerSidebarFooter profile={profile} onOpenOwner={openOwner} onLogout={onLogout} /> : <div className="sidebar-bottom">
          <PWAInstallButton />
          <a href={routeForSection("profile")} className="user-chip sidebar-profile-link" onClick={(event) => go(event, "profile")}>
            <div className="avatar">{(profile.full_name || profile.email || "U").slice(0, 1).toUpperCase()}</div>
            <div className="sidebar-user-copy"><strong>{profile.full_name || profile.email}</strong><small>{`My Profile · ${workspace.name}`}</small></div>
          </a>
          <button className="logout" onClick={onLogout}><LumaIcon name="logout" className="logout-icon" /><span className="nav-label">Logout</span></button>
        </div>}
      </aside>
    </>
  );
}