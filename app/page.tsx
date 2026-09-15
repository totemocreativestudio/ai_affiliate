"use client";

import "./luma-production.css";
import "./luma-legacy-extra.css";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase-browser";
import ProductMaster from "./components/ProductMaster";
import Listings from "./components/Listings";
import Shipping from "./components/Shipping";
import CreatorSamples from "./components/CreatorSamples";
import RatecardMaster from "./components/RatecardMaster";
import UploadCenter from "./components/UploadCenter";
import DatabaseCenter from "./components/DatabaseCenter";
import AIAnalytics from "./components/AIAnalytics";
import LumaSidebar from "./components/LumaSidebar";
import LegacyDashboard from "./components/LegacyDashboard";
import RestoredLegacyModules from "./components/RestoredLegacyModules";
import AccountPage from "./components/AccountPage";
import LumaIcon from "./components/LumaIcon";

type Profile = { id: string; email: string | null; full_name: string | null; role: string; active: boolean };
type Workspace = { id: string; name: string; slug: string; status: string };
type Theme = "light" | "dark";

const VALID_PAGES = [
  "dashboard", "upload", "excel-sync", "database", "agreements", "affiliate-support",
  "luma-affiliate", "promo-studio", "tutorial", "billing", "google-sheets", "ai-analytics",
  "product-master", "listings", "shipping", "creator-samples", "ratecard", "administration", "account",
];
const RESTORED_PAGES = ["excel-sync", "agreements", "affiliate-support", "luma-affiliate", "promo-studio", "tutorial", "billing", "google-sheets", "administration"];
const TITLES: Record<string, string> = {
  dashboard: "Dashboard", upload: "Upload Center", "excel-sync": "Excel Sync", database: "Database",
  agreements: "Agreement", "affiliate-support": "Affiliate Support", "luma-affiliate": "Luma Affiliate",
  "promo-studio": "Luma AI Studio", tutorial: "Tutorial", billing: "Billing & Token", "google-sheets": "Google Sheets",
  "ai-analytics": "AI Analytics", "product-master": "Product Master", listings: "Listings", shipping: "Shipping",
  "creator-samples": "Creator Samples", ratecard: "Ratecard Master", administration: "Admin Console", account: "Account & Workspace",
};

function pageFromLocation() {
  if (typeof window === "undefined") return "dashboard";
  const raw = window.location.hash.replace(/^#/, "");
  return VALID_PAGES.includes(raw) ? raw : "dashboard";
}

export default function Home() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [membershipRole, setMembershipRole] = useState("owner");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePage, setActivePage] = useState("dashboard");
  const [visited, setVisited] = useState<Set<string>>(() => new Set(["dashboard"]));
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("luma_theme");
    setTheme(storedTheme === "dark" ? "dark" : "light");
    const initial = pageFromLocation();
    setActivePage(initial);
    setVisited((prev) => new Set([...prev, initial]));
    const onPop = () => {
      const next = pageFromLocation();
      setActivePage(next);
      setVisited((prev) => new Set([...prev, next]));
      const scroller = document.querySelector(".content");
      if (scroller instanceof HTMLElement) scroller.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onPop);
    void loadSession();
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  async function loadSession() {
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await loadLumaData(session.user.id);
    setLoading(false);
  }

  async function loadLumaData(userId: string) {
    setError("");
    const { data: profileData, error: profileError } = await supabase.from("profiles").select("id,email,full_name,role,active").eq("id", userId).single();
    if (profileError) { setError(`Profile error: ${profileError.message}`); return; }
    setProfile(profileData);

    const { data: memberships, error: memberError } = await supabase.from("workspace_members").select("workspace_id,membership_role,created_at").eq("user_id", userId).order("created_at", { ascending: true });
    if (memberError || !memberships?.length) { setError(`Workspace membership error: ${memberError?.message || "No workspace"}`); return; }

    const preferred = window.localStorage.getItem("luma_active_workspace");
    const selected = memberships.find((x: any) => x.workspace_id === preferred) || memberships[0];
    const { data: workspaceData, error: workspaceError } = await supabase.from("workspaces").select("id,name,slug,status").eq("id", selected.workspace_id).single();
    if (workspaceError) { setError(`Workspace error: ${workspaceError.message}`); return; }
    setWorkspace(workspaceData);
    setMembershipRole(selected.membership_role || "owner");
    window.localStorage.setItem("luma_active_workspace", workspaceData.id);
  }

  function navigate(page: string) {
    const next = VALID_PAGES.includes(page) ? page : "dashboard";
    if (next !== activePage) window.history.pushState({ lumaPage: next }, "", `#${next}`);
    setActivePage(next);
    setVisited((prev) => new Set([...prev, next]));
    const scroller = document.querySelector(".content");
    if (scroller instanceof HTMLElement) scroller.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleTheme() {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      window.localStorage.setItem("luma_theme", next);
      return next;
    });
  }

  async function loginWithGoogle() {
    setError(""); setLoading(true);
    const { error: googleError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/` } });
    if (googleError) { setError(googleError.message); setLoading(false); }
  }

  async function login() {
    setError(""); setLoading(true);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) { setError(loginError.message); setLoading(false); return; }
    if (data.user) await loadLumaData(data.user.id);
    setLoading(false);
  }

  async function logout() { await supabase.auth.signOut(); setProfile(null); setWorkspace(null); setMembershipRole("owner"); }

  const roleLabel = useMemo(() => membershipRole === "owner" ? "Owner" : membershipRole || "Owner", [membershipRole]);

  if (loading) return <main className={`standalone-auth theme-${theme}`}><section className="auth-panel"><div className="auth-brand"><img src="/luma-mark.png" alt="Luma"/><div><strong>LUMA</strong><span>Light Up Your Potential.</span></div></div><h1>Loading Luma...</h1></section></main>;

  if (!profile || !workspace) return <main className={`standalone-auth theme-${theme}`}><section className="auth-panel"><div className="auth-brand"><img src="/luma-mark.png" alt="Luma"/><div><strong>LUMA</strong><span>Light Up Your Potential.</span></div></div><h1>Welcome to Luma</h1><p className="muted">Affiliate Intelligence Workspace</p><div className="auth-form"><button onClick={loginWithGoogle} className="google-login" type="button">Continue with Google</button><div className="auth-divider"><span/>or<span/></div><label><span>Email</span><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)}/></label><label><span>Password</span><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)}/></label><button className="primary full" onClick={login} type="button">Login</button></div>{error&&<p className="auth-error">{error}</p>}</section></main>;

  return <div className={`luma-app theme-${theme}`}>
    <LumaSidebar profile={profile} workspace={workspace} membershipRole={membershipRole} activePage={activePage} theme={theme} onNavigate={navigate} onToggleTheme={toggleTheme} onLogout={logout}/>
    <div className="app-shell">
      <header className="topbar"><div className="topbar-page-title"><span className="topbar-kicker">LUMA WORKSPACE</span><span className="topbar-title">{TITLES[activePage] || "Affiliate Intelligence"}</span></div><div className="topbar-right"><button className="topbar-theme" type="button" onClick={toggleTheme}><LumaIcon name={theme === "dark" ? "sun" : "moon"} size={17}/></button><button className="workspace-pill" type="button" onClick={()=>navigate("account")}><i/>{workspace.name}<span>{roleLabel}</span></button></div></header>
      <main className="content">
        {visited.has("dashboard")&&<div className="feature-panel" hidden={activePage!=="dashboard"}><LegacyDashboard workspaceId={workspace.id}/></div>}
        {visited.has("upload")&&<div className="feature-panel" hidden={activePage!=="upload"}><UploadCenter workspaceId={workspace.id}/></div>}
        {visited.has("database")&&<div className="feature-panel" hidden={activePage!=="database"}><DatabaseCenter workspaceId={workspace.id}/></div>}
        {visited.has("ai-analytics")&&<div className="feature-panel" hidden={activePage!=="ai-analytics"}><AIAnalytics workspaceId={workspace.id}/></div>}

        <div className={`feature-panel restored-module-router show-${activePage}`} hidden={!RESTORED_PAGES.includes(activePage)}><RestoredLegacyModules workspaceId={workspace.id} userId={profile.id} isAdmin={profile.role === "admin"}/></div>

        {visited.has("product-master")&&<div className="feature-panel" hidden={activePage!=="product-master"}><section className="feature-page native-feature-page"><div className="feature-header"><div><div className="eyebrow">MASTER DATA</div><h1>Product Master</h1><p className="muted">Kelola SKU dan master produk workspace Anda.</p></div></div><ProductMaster workspaceId={workspace.id}/></section></div>}
        {visited.has("listings")&&<div className="feature-panel" hidden={activePage!=="listings"}><section className="feature-page native-feature-page"><Listings workspaceId={workspace.id}/></section></div>}
        {visited.has("shipping")&&<div className="feature-panel" hidden={activePage!=="shipping"}><section className="feature-page native-feature-page"><Shipping workspaceId={workspace.id}/></section></div>}
        {visited.has("creator-samples")&&<div className="feature-panel" hidden={activePage!=="creator-samples"}><section className="feature-page native-feature-page"><CreatorSamples workspaceId={workspace.id}/></section></div>}
        {visited.has("ratecard")&&<div className="feature-panel" hidden={activePage!=="ratecard"}><section className="feature-page native-feature-page"><RatecardMaster workspaceId={workspace.id}/></section></div>}
        {visited.has("account")&&<div className="feature-panel" hidden={activePage!=="account"}><AccountPage profile={profile} workspace={workspace} membershipRole={membershipRole} theme={theme} onToggleTheme={toggleTheme}/></div>}
        {error&&<div className="flash error global-error">{error}</div>}
      </main>
    </div>
  </div>;
}
