"use client";

import LumaIcon from "./LumaIcon";

type Props = {
  profile: { email: string | null; full_name: string | null; role: string };
  workspace: { name: string; slug: string; status: string };
  membershipRole: string;
  activePage: string;
  theme: "light" | "dark";
  onNavigate: (page: string) => void;
  onToggleTheme: () => void;
  onLogout: () => void;
};

type Item = { id: string; icon: string; label: string };

const workspaceItems: Item[] = [
  { id: "dashboard", icon: "dashboard", label: "Dashboard" },
  { id: "upload", icon: "upload", label: "Upload Center" },
  { id: "excel-sync", icon: "sync", label: "Excel Sync" },
  { id: "database", icon: "database", label: "Database" },
  { id: "agreements", icon: "document", label: "Agreement" },
  { id: "affiliate-support", icon: "support", label: "Affiliate Support" },
  { id: "luma-affiliate", icon: "users", label: "Luma Affiliate" },
  { id: "promo-studio", icon: "sparkles", label: "Luma AI Studio" },
  { id: "tutorial", icon: "play", label: "Tutorial" },
  { id: "billing", icon: "wallet", label: "Billing & Token" },
  { id: "google-sheets", icon: "sheet", label: "Google Sheets" },
  { id: "ai-analytics", icon: "analytics", label: "AI Analytics" },
];

const masterItems: Item[] = [
  { id: "product-master", icon: "box", label: "Product Master" },
  { id: "listings", icon: "list", label: "Listings" },
  { id: "shipping", icon: "truck", label: "Shipping" },
  { id: "creator-samples", icon: "sample", label: "Creator Samples" },
  { id: "ratecard", icon: "money", label: "Ratecard Master" },
];

function NavButton({ item, activePage, onNavigate }: { item: Item; activePage: string; onNavigate: (id: string) => void }) {
  return (
    <button className={`side-nav-button ${activePage === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)} type="button">
      <LumaIcon name={item.icon} size={17} />
      <span>{item.label}</span>
    </button>
  );
}

export default function LumaSidebar({
  profile,
  workspace,
  membershipRole,
  activePage,
  theme,
  onNavigate,
  onToggleTheme,
  onLogout,
}: Props) {
  const roleLabel = membershipRole === "owner" ? "Owner" : membershipRole || "Owner";

  return (
    <aside className="sidebar" id="sidebar">
      <div className="brand">
        <img src="/luma-mark.png" alt="Luma" className="brand-mark" />
        <div><strong>LUMA</strong><span>Light Up Your Potential.</span></div>
      </div>

      <div className="sidebar-scroll">
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Workspace navigation">
          {workspaceItems.map((item) => <NavButton key={item.id} item={item} activePage={activePage} onNavigate={onNavigate} />)}
        </nav>

        <div className="sidebar-label sidebar-label-inner">MASTER DATA</div>
        <nav className="side-nav" aria-label="Master data navigation">
          {masterItems.map((item) => <NavButton key={item.id} item={item} activePage={activePage} onNavigate={onNavigate} />)}
        </nav>

        {profile.role === "admin" && (
          <>
            <div className="sidebar-label sidebar-label-inner">ADMINISTRATION</div>
            <nav className="side-nav">
              <NavButton item={{ id: "administration", icon: "settings", label: "Admin Console" }} activePage={activePage} onNavigate={onNavigate} />
            </nav>
          </>
        )}
      </div>

      <div className="sidebar-bottom">
        <button className={`account-button ${activePage === "account" ? "active" : ""}`} onClick={() => onNavigate("account")} type="button">
          <div className="avatar">{(profile.full_name || profile.email || "U").slice(0, 1).toUpperCase()}</div>
          <div className="account-copy">
            <strong>{profile.full_name || profile.email}</strong>
            <small>{roleLabel} · {workspace.name}</small>
          </div>
          <LumaIcon name="account" size={16} />
        </button>

        <div className="sidebar-actions">
          <button className="sidebar-icon-button" type="button" onClick={onToggleTheme} aria-label="Toggle theme" title={theme === "dark" ? "Light mode" : "Dark mode"}>
            <LumaIcon name={theme === "dark" ? "sun" : "moon"} size={17} />
          </button>
          <button className="logout" onClick={onLogout} type="button">Logout</button>
        </div>
      </div>
    </aside>
  );
}
