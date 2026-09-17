"use client";

import { useEffect, useState } from "react";
import LumaIcon, { type IconName } from "./LumaIcon";
import PWAInstallButton from "./PWAInstallButton";

type Props = {
  profile: { email: string | null; full_name: string | null; role: string };
  workspace: { name: string; slug: string; status: string };
  onLogout: () => void;
};
type Theme = "light" | "dark";

const aiNav = [
  ["performance", "Performance Analysis"],
  ["creator", "Creator Analysis"],
  ["product", "Product Analysis"],
  ["trend", "Trend Analysis"],
  ["anomaly", "Anomaly Detection"],
  ["recommendation", "Recommendations"],
] as const;

const masterNav: Array<[string, IconName, string]> = [
  ["#product-master", "product", "Product Master"],
  ["#listings", "listing", "Listings"],
  ["#shipping", "shipping", "Shipping"],
  ["#creator-samples", "sample", "Creator Samples"],
  ["#ratecard", "ratecard", "Ratecard Master"],
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
  return (
    <span className="nav-ico">
      <LumaIcon name={name} />
    </span>
  );
}

function Group({ icon, label, children, open = false }: { icon: IconName; label: string; children: any; open?: boolean }) {
  return (
    <details className="side-group" open={open}>
      <summary>
        <span>
          <NavIcon name={icon} />
          <span className="nav-label">{label}</span>
        </span>
        <LumaIcon name="chevron" className="chevron" />
      </summary>
      <div className="side-subnav">{children}</div>
    </details>
  );
}

export default function LumaSidebar({ profile, workspace, onLogout }: Props) {
  const isOwner = profile.role === "admin";
  const [activeHash, setActiveHash] = useState(isOwner ? "#administration" : "#dashboard");
  const [ownerTab, setOwnerTab] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("lumaway_theme");
    const nextTheme: Theme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    setCollapsed(window.localStorage.getItem("lumaway_sidebar_collapsed") === "1");
  }, []);

  useEffect(() => {
    const sync = () => {
      if (isOwner && window.location.hash !== "#administration") {
        window.history.replaceState(null, "", "#administration");
      }
      setActiveHash(window.location.hash || (isOwner ? "#administration" : "#dashboard"));
      if (window.innerWidth <= 1024) setMobileOpen(false);
    };
    const openMobile = () => setMobileOpen(true);
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("lumaway-open-sidebar", openMobile);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("lumaway-open-sidebar", openMobile);
    };
  }, [isOwner]);

  function openAi(type: string) {
    if (window.location.hash !== "#ai-analytics") window.location.hash = "ai-analytics";
    const index = aiNav.findIndex(([key]) => key === type);
    window.setTimeout(() => document.querySelectorAll<HTMLButtonElement>(".ai-type-grid .ai-type-card")[index]?.click(), 80);
    setMobileOpen(false);
  }

  function openOwner(tab: string, section?: string) {
    const actualTab = tab === "referral" ? "finance" : tab;
    setOwnerTab(tab);
    if (window.location.hash !== "#administration") window.location.hash = "administration";
    window.setTimeout(
      () => window.dispatchEvent(new CustomEvent("luma-owner-nav", { detail: { tab: actualTab, section } })),
      50,
    );
    setMobileOpen(false);
  }

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("lumaway_theme", next);
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem("lumaway_sidebar_collapsed", next ? "1" : "0");
  }

  const closeOnMobile = () => {
    if (window.innerWidth <= 1024) setMobileOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="mobile-sidebar-trigger"
        aria-label="Buka menu Lumaway"
        onClick={() => setMobileOpen(true)}
      >
        <LumaIcon name="menu" />
      </button>
      {mobileOpen && (
        <button
          type="button"
          className="mobile-sidebar-backdrop"
          aria-label="Tutup menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`sidebar ${isOwner ? "owner-sidebar" : ""} ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
        id="sidebar"
      >
        <div className="brand">
          <img src="/luma-mark.png" alt="Lumaway" className="brand-mark" />
          <div className="brand-wordmark">
            <strong>
              LUMAWAY<span className="brand-dot">.</span>
            </strong>
            <small>{isOwner ? "Owner Control" : "Light Up Your Potential."}</small>
          </div>
        </div>

        <div className="sidebar-controls">
          <button type="button" className="theme-toggle" onClick={toggleTheme} title={theme === "dark" ? "Gunakan light mode" : "Gunakan night mode"}>
            <LumaIcon name="theme" />
            <span className="nav-label">{theme === "dark" ? "Light" : "Night"}</span>
          </button>
          <button type="button" className="sidebar-collapse" onClick={toggleCollapsed} title={collapsed ? "Expand sidebar" : "Minimize sidebar"}>
            <LumaIcon name="chevron" className={collapsed ? "collapse-icon right" : "collapse-icon left"} />
          </button>
          <button type="button" className="sidebar-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Tutup menu">
            <LumaIcon name="close" />
          </button>
        </div>

        {isOwner ? (
          <>
            <div className="sidebar-label">OWNER CONTROL</div>
            <nav className="side-nav owner-nav" onClick={closeOnMobile}>
              {ownerNav.map(([tab, icon, label]) => (
                <button
                  type="button"
                  key={tab}
                  className={ownerTab === tab ? "active" : ""}
                  onClick={() => openOwner(tab, tab === "referral" ? "owner-referral-payout" : undefined)}
                >
                  <NavIcon name={icon} />
                  <span className="nav-label">{label}</span>
                </button>
              ))}
              <details className="side-group" open>
                <summary>
                  <span>
                    <NavIcon name="integration" />
                    <span className="nav-label">Integrations</span>
                  </span>
                  <LumaIcon name="chevron" className="chevron" />
                </summary>
                <div className="side-subnav owner-subnav">
                  {integrationNav.map(([section, icon, label]) => (
                    <button type="button" key={section} onClick={() => openOwner("integrations", section)}>
                      <LumaIcon name={icon} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </details>
            </nav>
          </>
        ) : (
          <>
            <div className="sidebar-label">WORKSPACE</div>
            <nav className="side-nav user-grouped-nav" onClick={closeOnMobile}>
              <a className={activeHash === "#dashboard" ? "active" : ""} href="#dashboard">
                <NavIcon name="dashboard" />
                <span className="nav-label">Dashboard</span>
              </a>

              <Group icon="data" label="Data & Sync" open>
                <a href="#upload"><LumaIcon name="data" />Upload Center</a>
                <a href="#excel-sync"><LumaIcon name="listing" />Excel Sync</a>
                <a href="#database"><LumaIcon name="master" />Database</a>
              </Group>

              <Group icon="creator" label="Creator Management">
                <a href="#agreements"><LumaIcon name="content" />Agreement</a>
                <a href="#affiliate-support"><LumaIcon name="support" />Affiliate Support</a>
              </Group>

              <details className="side-group" open>
                <summary className={activeHash === "#ai-analytics" ? "active" : ""}>
                  <span>
                    <NavIcon name="ai" />
                    <span className="nav-label">AI Analytics</span>
                  </span>
                  <LumaIcon name="chevron" className="chevron" />
                </summary>
                <div className="side-subnav">
                  {aiNav.map(([key, label]) => (
                    <button type="button" key={key} onClick={() => openAi(key)}>
                      <LumaIcon name="ai" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </details>

              <a href="#promo-studio"><NavIcon name="sparkles" /><span className="nav-label">AI Promo Studio</span></a>
              <a href="#kanban"><NavIcon name="kanban" /><span className="nav-label">Kanban</span></a>

              <Group icon="ticket" label="Tiket Bantuan">
                <a href="#support-tickets"><LumaIcon name="ticket" />Status & Riwayat Tiket</a>
              </Group>

              <Group icon="billing" label="Billing & Affiliate">
                <a href="#billing"><LumaIcon name="billing" />Billing & Token</a>
                <a href="#luma-affiliate"><LumaIcon name="referral" />Luma Affiliate</a>
              </Group>

              <Group icon="content" label="Content & Community">
                <a href="#content-hub"><LumaIcon name="content" />Insight & Blog</a>
                <a href="#social-lumaway"><LumaIcon name="community" />Social Lumaway</a>
              </Group>

              <Group icon="master" label="Master Data">
                {masterNav.map(([href, icon, label]) => (
                  <a key={href} href={href}>
                    <LumaIcon name={icon} />
                    <span>{label}</span>
                  </a>
                ))}
              </Group>
            </nav>
          </>
        )}

        <div className="sidebar-bottom">
          {!isOwner && <PWAInstallButton />}
          <a href={isOwner ? "#administration" : "#profile"} className="user-chip sidebar-profile-link" onClick={closeOnMobile}>
            <div className="avatar">{(profile.full_name || profile.email || "U").slice(0, 1).toUpperCase()}</div>
            <div className="sidebar-user-copy">
              <strong>{profile.full_name || profile.email}</strong>
              <small>{isOwner ? "Owner · Lumaway" : `My Profile · ${workspace.name}`}</small>
            </div>
          </a>
          <button className="logout" onClick={onLogout}>
            <LumaIcon name="logout" className="logout-icon" />
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
