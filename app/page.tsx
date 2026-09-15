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
type AuthMode = "signin" | "signup";

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
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authMessage, setAuthMessage] = useState("");
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
    setMembershipRole("owner");
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
    setError(""); setAuthMessage(""); setLoading(true);
    const { error: googleError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/` } });
    if (googleError) { setError(googleError.message); setLoading(false); }
  }

  async function login() {
    setError(""); setAuthMessage(""); setLoading(true);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) { setError(loginError.message); setLoading(false); return; }
    if (data.user) await loadLumaData(data.user.id);
    setLoading(false);
  }

  async function signup() {
    setError(""); setAuthMessage("");
    if (!email || password.length < 8) {
      setError("Gunakan email aktif dan password minimal 8 karakter.");
      return;
    }
    setLoading(true);
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }
    if (data.session && data.user) {
      await loadLumaData(data.user.id);
    } else {
      setAuthMessage("Akun berhasil dibuat. Cek email Anda untuk verifikasi, lalu masuk ke Luma.");
      setAuthMode("signin");
    }
    setLoading(false);
  }

  async function logout() { await supabase.auth.signOut(); setProfile(null); setWorkspace(null); setMembershipRole("owner"); }

  const roleLabel = useMemo(() => membershipRole === "owner" ? "Owner" : membershipRole || "Owner", [membershipRole]);

  if (loading) return <main className={`auth-shell auth-loading-screen theme-${theme}`}><div className="auth-loading-mark"><img src="/luma-mark.png" alt="Luma"/><span>Loading Luma</span></div></main>;

  if (!profile || !workspace) return <main className={`auth-shell theme-${theme}`}>
    <section className="auth-showcase">
      <div className="auth-orb auth-orb-one"/><div className="auth-orb auth-orb-two"/><div className="auth-grid-glow"/>
      <div className="auth-showcase-inner">
        <div className="auth-showcase-brand"><img src="/luma-mark.png" alt="Luma"/><div><strong>LUMA</strong><span>Light Up Your Potential.</span></div></div>
        <div className="auth-showcase-copy">
          <span className="auth-showcase-badge">AFFILIATE INTELLIGENCE WORKSPACE</span>
          <h1>Light up every<br/>affiliate decision.</h1>
          <p>Kelola data, pantau performa creator, dan ubah angka menjadi keputusan yang lebih cepat dengan satu workspace.</p>
          <div className="auth-benefit-grid">
            <div><span>01</span><strong>Upload & Organize</strong><small>Data performance tersusun per workspace.</small></div>
            <div><span>02</span><strong>Analyze & Compare</strong><small>Dashboard, ranking, periode dan platform.</small></div>
            <div><span>03</span><strong>Decide with AI</strong><small>Insight yang tetap berpijak pada data Anda.</small></div>
          </div>
        </div>
        <div className="auth-showcase-footer"><span className="auth-live-dot"/>Private workspace · Multi-account ready · Powered by Luma</div>
      </div>
    </section>

    <section className="auth-entry">
      <button className="auth-theme-toggle" type="button" onClick={toggleTheme} aria-label="Toggle theme"><LumaIcon name={theme === "dark" ? "sun" : "moon"} size={18}/></button>
      <div className="auth-entry-card">
        <div className="auth-mobile-brand"><img src="/luma-mark.png" alt="Luma"/><strong>LUMA</strong></div>
        <div className="auth-entry-head">
          <span className="auth-entry-kicker">WELCOME TO LUMA</span>
          <h2>{authMode === "signin" ? "Welcome back" : "Create your workspace"}</h2>
          <p>{authMode === "signin" ? "Sign in to continue to your affiliate intelligence workspace." : "Create your Lumaway account and start with your own private workspace."}</p>
        </div>

        <div className="auth-mode-tabs" role="tablist" aria-label="Authentication mode">
          <button type="button" className={authMode === "signin" ? "active" : ""} onClick={()=>{setAuthMode("signin");setError("");setAuthMessage("");}}>Sign in</button>
          <button type="button" className={authMode === "signup" ? "active" : ""} onClick={()=>{setAuthMode("signup");setError("");setAuthMessage("");}}>Sign up</button>
        </div>

        <button onClick={loginWithGoogle} className="google-login modern-google" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.39a4.61 4.61 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.97-4.33 2.97-7.38Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.39l-3.24-2.51c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.94A6 6 0 0 1 6.08 12c0-.67.12-1.32.32-1.94V7.47H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.53l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.78.5 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.47l3.34 2.59C7.19 7.7 9.4 5.94 12 5.94Z"/></svg>
          Continue with Google
        </button>

        <div className="auth-divider"><span/>or continue with email<span/></div>

        <div className="auth-form modern-auth-form">
          <label><span>Email address</span><input type="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={(e)=>setEmail(e.target.value)}/></label>
          <label><span>Password</span><div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete={authMode === "signin" ? "current-password" : "new-password"} placeholder={authMode === "signin" ? "Enter your password" : "Minimum 8 characters"} value={password} onChange={(e)=>setPassword(e.target.value)}/><button type="button" onClick={()=>setShowPassword((v)=>!v)}>{showPassword ? "Hide" : "Show"}</button></div></label>
          <button className="primary full auth-submit" onClick={authMode === "signin" ? login : signup} type="button">{authMode === "signin" ? "Sign in to Luma" : "Create Luma account"}</button>
        </div>

        {authMessage&&<p className="auth-success">{authMessage}</p>}
        {error&&<p className="auth-error">{error}</p>}
        <p className="auth-legal">By continuing, you agree to use Luma as a private workspace for your organization and keep your account credentials secure.</p>
      </div>
    </section>
  </main>;

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
