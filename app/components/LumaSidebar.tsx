"use client";

type Props = {
  profile: { email: string | null; full_name: string | null; role: string };
  workspace: { name: string; slug: string; status: string };
  onLogout: () => void;
};

const nav = [
  ["#dashboard", "⌂", "Dashboard"],
  ["#upload", "⇧", "Upload Center"],
  ["#excel-sync", "⇄", "Excel Sync"],
  ["#database", "▤", "Database"],
  ["#agreements", "▧", "Agreement"],
  ["#affiliate-support", "♡", "Affiliate Support"],
  ["#luma-affiliate", "♙", "Luma Affiliate"],
  ["#promo-studio", "✦", "AI Promo Studio"],
  ["#tutorial", "▶", "Tutorial"],
  ["#billing", "▣", "Billing & Token"],
  ["#google-sheets", "▦", "Google Sheets"],
];

export default function LumaSidebar({ profile, workspace, onLogout }: Props) {
  return (
    <aside className="sidebar" id="sidebar">
      <div className="brand">
        <img src="/luma-mark.png" alt="Luma" className="brand-mark" />
        <div><strong>LUMA</strong><span>Light Up Your Potential.</span></div>
      </div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="side-nav">
        {nav.map(([href, icon, label], i) => (
          <a key={href} className={i === 0 ? "active" : ""} href={href}>
            <span className="nav-ico">{icon}</span><span>{label}</span>
            {label === "Google Sheets" && <span className="nav-dot" />}
          </a>
        ))}
        <details className="side-group" open>
          <summary><span><span className="nav-ico">✦</span>AI Analytics</span><span className="chevron">⌄</span></summary>
          <div className="side-subnav">
            <a href="#ai-analytics">Performance Analysis</a>
            <a href="#ai-analytics">Creator Analysis</a>
            <a href="#ai-analytics">Product Analysis</a>
            <a href="#ai-analytics">Trend Analysis</a>
            <a href="#ai-analytics">Anomaly Detection</a>
            <a href="#ai-analytics">Recommendations</a>
          </div>
        </details>
        <div className="sidebar-label sidebar-label-inner">MASTER DATA</div>
        <a href="#product-master"><span className="nav-ico">◫</span><span>Product Master</span></a>
        <a href="#listings"><span className="nav-ico">☷</span><span>Listings</span></a>
        <a href="#shipping"><span className="nav-ico">▱</span><span>Shipping</span></a>
        <a href="#creator-samples"><span className="nav-ico">◇</span><span>Creator Samples</span></a>
        <a href="#ratecard"><span className="nav-ico">Rp</span><span>Ratecard Master</span></a>
        {profile.role === "admin" && <><div className="sidebar-label sidebar-label-inner">ADMINISTRATION</div><a href="#administration"><span className="nav-ico">⚙</span><span>Admin Console</span></a></>}
      </nav>
      <div className="sidebar-bottom">
        <div className="user-chip"><div className="avatar">{(profile.full_name || profile.email || "U").slice(0,1).toUpperCase()}</div><div><strong>{profile.full_name || profile.email}</strong><small>{profile.role} · {workspace.name}</small></div></div>
        <button className="logout" onClick={onLogout}>Logout</button>
      </div>
    </aside>
  );
}
