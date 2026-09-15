"use client";

import LumaIcon from "./LumaIcon";

type Props = {
  profile: { email: string | null; full_name: string | null };
  workspace: { name: string; slug: string; status: string };
  membershipRole: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export default function AccountPage({ profile, workspace, membershipRole, theme, onToggleTheme }: Props) {
  const roleLabel = membershipRole === "owner" ? "Owner" : membershipRole || "Owner";
  return (
    <section className="feature-page account-page">
      <div className="feature-header">
        <div>
          <div className="eyebrow">ACCOUNT</div>
          <h1>Account & Workspace</h1>
          <p className="muted">Kelola identitas workspace dan preferensi tampilan Anda.</p>
        </div>
      </div>

      <div className="account-grid">
        <div className="card account-profile-card">
          <div className="account-hero-avatar">{(profile.full_name || profile.email || "U").slice(0,1).toUpperCase()}</div>
          <div>
            <h2>{profile.full_name || "Lumaway Member"}</h2>
            <p>{profile.email}</p>
            <span className="owner-badge">{roleLabel}</span>
          </div>
        </div>

        <div className="card account-detail-card">
          <div className="detail-row"><span>Workspace</span><strong>{workspace.name}</strong></div>
          <div className="detail-row"><span>Workspace ID</span><strong className="mono">{workspace.slug}</strong></div>
          <div className="detail-row"><span>Status</span><strong className="status-active">{workspace.status}</strong></div>
          <div className="detail-row"><span>Access</span><strong>{roleLabel}</strong></div>
        </div>

        <div className="card preference-card">
          <div className="preference-copy"><h3>Appearance</h3><p className="muted">Gunakan Light atau Dark mode. Pilihan tersimpan di perangkat ini.</p></div>
          <button className="theme-switch" onClick={onToggleTheme} type="button">
            <LumaIcon name={theme === "dark" ? "sun" : "moon"} size={18} />
            {theme === "dark" ? "Use Light Mode" : "Use Dark Mode"}
          </button>
        </div>
      </div>
    </section>
  );
}
