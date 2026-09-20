"use client";

import "./luma-production.css";
import "./luma-legacy-extra.css";
import "./luma-helpdesk.css";
import "./luma-fixes.css";
import "./luma-responsive.css";
import "./luma-subscription.css";
import "./luma-ux-polish.css";
import "./luma-final-fixes.css";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase-browser";
import { APP_BASE, isAuthPath, navigateToSection, routeForSection, sectionFromPath } from "../lib/luma-navigation";
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
import NotificationCenter from "./components/NotificationCenter";
import ContentHub from "./components/ContentHub";
import SocialLumaway from "./components/SocialLumaway";
import LumaHelpdeskAgent from "./components/LumaHelpdeskAgent";
import UserTicketCenter from "./components/UserTicketCenter";
import DashboardReminder from "./components/DashboardReminder";
import PWAInstallButton from "./components/PWAInstallButton";
import MobileQuickNav from "./components/MobileQuickNav";

type Profile = { id: string; email: string | null; full_name: string | null; nickname: string | null; role: string; active: boolean; phone: string | null; phone_verified_at: string | null; email_verified_at: string | null; education: string | null; birth_date: string | null; bio: string | null; position_title: string | null; profile_completed: boolean };
type Workspace = { id: string; name: string; slug: string; status: string };
type AuthMode = "signin" | "signup";

function BrandLockup({ light = false }: { light?: boolean }) {
  return (
    <div className={`lumaway-lockup ${light ? "is-light" : ""}`}>
      <img src="/luma-mark.png" alt="" />
      <div>
        <strong>LUMAWAY<span>.</span></strong>
        <small>Light Up Your Potential.</small>
      </div>
    </div>
  );
}

function loadGoogleIdentity() {
  return new Promise<void>((resolve, reject) => {
    if ((window as any).google?.accounts?.id) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-lumaway-google]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.lumawayGoogle = "1";
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.head.appendChild(script);
  });
}

function cleanAuthErrorQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("error") && !url.searchParams.has("error_code") && !url.searchParams.has("error_description")) return;
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function profileComplete(profile: Profile) {
  return Boolean(profile.profile_completed && profile.full_name?.trim() && profile.nickname?.trim() && profile.phone_verified_at && profile.email_verified_at && profile.education?.trim() && profile.birth_date && profile.bio?.trim());
}

function activateCurrentRoute(isAdmin: boolean, accessLocked = false) {
  const fallback = isAdmin ? "administration" : "dashboard";
  let section = sectionFromPath(window.location.pathname) || fallback;
  if (isAdmin) section = "administration";
  if (!isAdmin && section === "administration") section = "dashboard";
  if (!isAdmin && accessLocked && !["dashboard","billing","profile"].includes(section)) section = "dashboard";

  const pages = Array.from(document.querySelectorAll<HTMLElement>(".content > .legacy-page-anchor"));
  let found = false;
  for (const page of pages) {
    const active = page.id === section;
    page.classList.toggle("route-active", active);
    if (active) found = true;
  }

  if (!found && section !== fallback) {
    navigateToSection(fallback, { replace: true });
    return false;
  }
  return found;
}

export default function LumawayWorkspaceApp() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [accessLocked, setAccessLocked] = useState(false);
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null);
  const [lockPromptOpen, setLockPromptOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    cleanAuthErrorQuery();

    const initialAuthMode = new URLSearchParams(window.location.search).get("auth");
    if (initialAuthMode === "signup" || window.location.pathname === `${APP_BASE}/register`) setAuthMode("signup");

    const legacyHash = window.location.hash.replace(/^#/, "");
    if (legacyHash) {
      window.history.replaceState(null, "", routeForSection(legacyHash));
    }

    document.documentElement.dataset.theme = "light";
    window.localStorage.removeItem("lumaway_theme");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    void loadSession();
  }, []);

  useEffect(() => {
    if (!profile || !workspace) return;
    const isAdmin = profile.role === "admin";
    const restore = () => {
      window.requestAnimationFrame(() => window.setTimeout(() => activateCurrentRoute(isAdmin, accessLocked), 30));
    };
    const navigate = () => {
      restore();
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };
    restore();
    window.addEventListener("pageshow", restore);
    window.addEventListener("popstate", navigate);
    window.addEventListener("lumaway-routechange", navigate as EventListener);
    return () => {
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("popstate", navigate);
      window.removeEventListener("lumaway-routechange", navigate as EventListener);
    };
  }, [profile, workspace, accessLocked]);

  useEffect(() => {
    if (!profile) return;
    const refreshProfile = () => void loadLumaData(profile.id);
    const showLockPrompt = () => setLockPromptOpen(true);
    window.addEventListener("lumaway-profile-updated", refreshProfile);
    window.addEventListener("lumaway-access-locked", showLockPrompt);
    return () => {
      window.removeEventListener("lumaway-profile-updated", refreshProfile);
      window.removeEventListener("lumaway-access-locked", showLockPrompt);
    };
  }, [profile?.id]);

  useEffect(() => {
    if (loading || profile || workspace) return;
    let cancelled = false;
    async function mountGoogle() {
      const host = document.getElementById("lumaway-google-button");
      if (!host) return;
      try {
        const cfg = await fetch("/api/auth/google-config", { cache: "no-store" }).then((response) => response.json());
        if (!cfg?.ok || !cfg.client_id) throw new Error();
        await loadGoogleIdentity();
        if (cancelled) return;
        const google = (window as any).google;
        google.accounts.id.initialize({
          client_id: cfg.client_id,
          callback: async (response: any) => {
            setError("");
            setAuthMessage("");
            setLoading(true);
            try {
              const { data, error: idError } = await supabase.auth.signInWithIdToken({
                provider: "google",
                token: String(response?.credential || ""),
              });
              if (idError || !data.user) throw idError || new Error();
              await loadLumaData(data.user.id);
            } catch {
              setError("error, terjadi kesalahan.");
            } finally {
              setLoading(false);
            }
          },
        });
        host.innerHTML = "";
        google.accounts.id.renderButton(host, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.max(260, Math.min(420, host.clientWidth || 420)),
        });
      } catch {
        host.innerHTML = '<span class="google-auth-unavailable">Google Sign-In sementara tidak tersedia.</span>';
      }
    }
    void mountGoogle();
    return () => { cancelled = true; };
  }, [loading, profile, workspace, authMode, supabase]);

  async function loadSession() {
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadLumaData(session.user.id);
      } else {
        const sessionRequestedMode = new URLSearchParams(window.location.search).get("auth");
        const authPath = sessionRequestedMode === "signup" || window.location.pathname === `${APP_BASE}/register`
          ? `${APP_BASE}/register`
          : `${APP_BASE}/login`;
        setAuthMode(authPath === `${APP_BASE}/register` ? "signup" : "signin");
        window.history.replaceState(null, "", authPath);
      }
    } catch {
      setError("Sesi tidak dapat dimuat. Silakan login kembali.");
      await supabase.auth.signOut().catch(() => undefined);
      setProfile(null);
      setWorkspace(null);
      window.history.replaceState(null, "", `${APP_BASE}/login`);
    } finally {
      setLoading(false);
    }
  }

  async function loadLumaData(userId: string) {
    setError("");
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,full_name,nickname,role,active,phone,phone_verified_at,email_verified_at,education,birth_date,bio,position_title,profile_completed")
      .eq("id", userId)
      .single();
    if (profileError || !profileData) {
      setError("Profile Lumaway tidak dapat dimuat.");
      return;
    }

    const { data: memberships, error: memberError } = await supabase
      .from("workspace_members")
      .select("workspace_id,membership_role,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (memberError || !memberships?.length) {
      setError("Workspace Lumaway belum tersedia untuk akun ini.");
      return;
    }

    const preferred = window.localStorage.getItem("luma_active_workspace");
    const selected = memberships.find((item: any) => item.workspace_id === preferred) || memberships[0];
    const { data: workspaceData, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id,name,slug,status")
      .eq("id", selected.workspace_id)
      .single();
    if (workspaceError || !workspaceData) {
      setError("Workspace Lumaway tidak dapat dimuat.");
      return;
    }

    const typedProfile = profileData as Profile;
    setProfile(typedProfile);
    setWorkspace(workspaceData as Workspace);
    window.localStorage.setItem("luma_active_workspace", workspaceData.id);

    const { data: subscriptionRows } = await supabase
      .from("luma_user_subscriptions")
      .select("status,starts_at,ends_at")
      .eq("user_id", userId)
      .order("ends_at", { ascending: false })
      .limit(10);
    const now = Date.now();
    const activeSubscription = (subscriptionRows || []).find((item: any) =>
      ["active", "trialing"].includes(String(item.status || "").toLowerCase()) &&
      item.ends_at &&
      new Date(item.ends_at).getTime() > now
    );
    setAccessLocked(Boolean((subscriptionRows || []).length && !activeSubscription));
    setSubscriptionEndsAt(activeSubscription?.ends_at || (subscriptionRows || [])[0]?.ends_at || null);

    const currentSection = sectionFromPath(window.location.pathname);
    const needsProfile = typedProfile.role !== "admin" && !profileComplete(typedProfile);
    const target = profileData.role === "admin"
      ? "administration"
      : needsProfile
        ? "profile"
        : !currentSection || isAuthPath(window.location.pathname) || currentSection === "administration"
          ? "dashboard"
          : currentSection;
    navigateToSection(target, { replace: true });
    if (needsProfile) {
      window.history.replaceState(null, "", `${APP_BASE}/profile?complete=true`);
      window.dispatchEvent(new Event("lumaway-routechange"));
    }
  }

  async function login() {
    if (!email || !password) return setError("Email dan password wajib diisi.");
    setError(""); setAuthMessage(""); setNeedsEmailVerification(false); setLoading(true);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      const message = String(loginError.message || "").toLowerCase();
      const unverified = message.includes("email not confirmed") || message.includes("email_not_confirmed") || message.includes("not confirmed");
      setNeedsEmailVerification(unverified);
      setError(unverified
        ? "Email akun ini belum diverifikasi. Buka email verifikasi Lumaway atau kirim ulang link verifikasi."
        : "Email atau password tidak sesuai.");
      setLoading(false);
      return;
    }
    setNeedsEmailVerification(false);
    if (data.user) await loadLumaData(data.user.id);
    setLoading(false);
  }

  async function resendVerification() {
    if (!email.trim()) return setError("Masukkan email akun terlebih dahulu.");
    setError(""); setAuthMessage(""); setLoading(true);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}${routeForSection("dashboard")}` },
    });
    setLoading(false);
    if (resendError) {
      const message = String(resendError.message || "").toLowerCase();
      setError(message.includes("rate") ? "Terlalu banyak permintaan verifikasi. Tunggu sebentar lalu coba lagi." : "Email verifikasi belum dapat dikirim. Coba lagi beberapa saat.");
      return;
    }
    setNeedsEmailVerification(true);
    setAuthMessage("Email verifikasi dikirim ulang. Cek Inbox, Spam, Promotions, atau Junk lalu buka link verifikasi sebelum login.");
  }

  async function signup() {
    if (!email || !password) return setError("Email dan password wajib diisi.");
    if (password.length < 8) return setError("Gunakan password minimal 8 karakter.");
    if (!termsAccepted) return setError("Konfirmasi persetujuan akses workspace terlebih dahulu.");
    setError(""); setAuthMessage(""); setNeedsEmailVerification(false); setLoading(true);
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}${routeForSection("dashboard")}` },
    });
    if (signupError) {
      const message = String(signupError.message || "").toLowerCase();
      setError(message.includes("already") || message.includes("registered")
        ? "Email ini sudah terdaftar. Silakan Sign in atau kirim ulang email verifikasi."
        : "Akun belum dapat dibuat. Silakan coba lagi.");
      setNeedsEmailVerification(message.includes("already") || message.includes("registered"));
      setLoading(false);
      return;
    }
    if (data.session) await supabase.auth.signOut();
    setNeedsEmailVerification(true);
    setAuthMessage("Akun berhasil dibuat. Link verifikasi sudah diminta. Cek Inbox, Spam, Promotions, atau Junk, lalu verifikasi email sebelum login.");
    setAuthMode("signin"); setPassword(""); setTermsAccepted(false); setLoading(false);
    window.history.replaceState(null, "", `${APP_BASE}/login`);
  }

  async function logout() {
    await supabase.auth.signOut();
    setProfile(null); setWorkspace(null); setPassword(""); setError("");
    window.history.replaceState(null, "", `${APP_BASE}/login`);
  }

  function switchAuthMode(mode: AuthMode) {
    setAuthMode(mode); setError(""); setAuthMessage(""); setNeedsEmailVerification(false);
    window.history.replaceState(null, "", mode === "signup" ? `${APP_BASE}/register` : `${APP_BASE}/login`);
  }

  if (loading || (profile && !workspace)) {
    return <main className="auth-loading-screen lumaway-loading-screen"><BrandLockup /><div className="lumaway-loading-orbit"><i /><i /><i /></div><strong>Menyiapkan workspace Anda</strong><span>Memuat dashboard Lumaway...</span></main>;
  }

  if (!profile || !workspace) {
    return <main className="standalone-auth"><section className="auth-shell">
      <aside className="auth-showcase"><BrandLockup light /><div className="auth-story"><span className="auth-kicker">AFFILIATE INTELLIGENCE WORKSPACE</span><h1>Turn affiliate data into clear decisions.</h1><p>Monitor creator performance, campaign support, product movement, and AI insights from one focused workspace.</p><div className="auth-insight-card"><div className="auth-insight-head"><span>Workspace intelligence</span><i>Live</i></div><div className="auth-spark-bars" aria-hidden="true"><span style={{ height: "34%" }} /><span style={{ height: "48%" }} /><span style={{ height: "42%" }} /><span style={{ height: "68%" }} /><span style={{ height: "58%" }} /><span style={{ height: "82%" }} /><span style={{ height: "72%" }} /><span style={{ height: "94%" }} /></div><div className="auth-insight-footer"><span>Creator performance</span><b>+24.8%</b></div></div></div></aside>
      <section className="auth-form-pane"><div className="auth-form-wrap"><div className="auth-mode-switch"><button type="button" className={authMode === "signin" ? "active" : ""} onClick={() => switchAuthMode("signin")}>Sign in</button><button type="button" className={authMode === "signup" ? "active" : ""} onClick={() => switchAuthMode("signup")}>Create account</button></div><div className="auth-heading"><span className="auth-kicker dark">LUMAWAY WORKSPACE</span><h2>{authMode === "signin" ? "Welcome back" : "Create your Lumaway account"}</h2><p>{authMode === "signin" ? "Sign in to continue to Affiliate Intelligence." : "Your workspace is provisioned automatically after sign-up."}</p></div><div id="lumaway-google-button" className="google-gsi-host"><span>Memuat Google Sign-In...</span></div><div className="auth-divider"><span>or continue with email</span></div><div className="auth-fields"><label><span>Email address</span><input type="email" value={email} autoComplete="email" placeholder="name@company.com" onChange={(e) => setEmail(e.target.value)} /></label><label><span>Password</span><div className="password-field"><input type={showPassword ? "text" : "password"} value={password} autoComplete={authMode === "signin" ? "current-password" : "new-password"} placeholder="Minimum 8 characters" onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && authMode === "signin") void login(); }} /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div></label></div>{authMode === "signup" && <label className="auth-consent"><input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} /><span>I agree to the Lumaway workspace terms and privacy flow.</span></label>}{error && <div className="auth-alert error"><span>!</span><p>{error}</p></div>}{authMessage && <div className="auth-alert success"><span>✓</span><p>{authMessage}</p></div>}{authMode === "signin" && needsEmailVerification && <button type="button" className="auth-resend-button" disabled={loading} onClick={() => void resendVerification()}>Kirim ulang email verifikasi</button>}<button type="button" className="auth-primary-button" onClick={() => authMode === "signin" ? void login() : void signup()}>{authMode === "signin" ? "Sign in to Lumaway" : "Create account"}<span>→</span></button></div></section>
    </section></main>;
  }

  const isAdmin = profile.role === "admin";
  return <div className="luma-app">
    <LumaSidebar profile={profile} workspace={workspace} onLogout={logout} accessLocked={accessLocked} />
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand-copy"><span className="topbar-kicker">{isAdmin ? "LUMAWAY OWNER" : "LUMAWAY WORKSPACE"}</span><span className="topbar-title">{isAdmin ? "Business Control Center" : "Affiliate Intelligence"}</span></div>
        <div className="topbar-right"><PWAInstallButton compact /><NotificationCenter workspaceId={workspace.id} userId={profile.id} /><span className="connection-pill"><i />{workspace.name} · Active</span></div>
      </header>
      <main className="content">
        {isAdmin ? <RestoredLegacyModules workspaceId={workspace.id} userId={profile.id} isAdmin /> : <>
          <LegacyDashboard workspaceId={workspace.id} />
          <UploadCenter workspaceId={workspace.id} />
          <DatabaseCenter workspaceId={workspace.id} />
          <AIAnalytics workspaceId={workspace.id} />
          <ContentHub workspaceId={workspace.id} userId={profile.id} />
          <SocialLumaway workspaceId={workspace.id} userId={profile.id} />
          <RestoredLegacyModules workspaceId={workspace.id} userId={profile.id} isAdmin={false} />
          <UserTicketCenter workspaceId={workspace.id} />
          <section id="product-master" className="legacy-page-anchor"><div className="eyebrow">MASTER DATA</div><ProductMaster workspaceId={workspace.id} /></section>
          <section id="listings" className="legacy-page-anchor"><Listings workspaceId={workspace.id} /></section>
          <section id="shipping" className="legacy-page-anchor"><Shipping workspaceId={workspace.id} /></section>
          <section id="creator-samples" className="legacy-page-anchor"><CreatorSamples workspaceId={workspace.id} /></section>
          <section id="ratecard" className="legacy-page-anchor"><RatecardMaster workspaceId={workspace.id} /></section>
        </>}
        {!isAdmin && accessLocked && <div className="subscription-lock-banner"><strong>Masa akses Lumaway telah berakhir.</strong><span>Data workspace Anda tetap aman dan tidak dihapus. Buka Billing untuk memperpanjang akses.</span>{subscriptionEndsAt&&<small>Berakhir: {new Date(subscriptionEndsAt).toLocaleString("id-ID")}</small>}<button onClick={()=>navigateToSection("billing")}>Buka Billing</button></div>}
        {error && <div className="flash error">{error}</div>}
      </main>
    </div>
    {!isAdmin && <><MobileQuickNav /><DashboardReminder workspaceId={workspace.id} userId={profile.id} workspaceStatus={workspace.status} /><LumaHelpdeskAgent workspaceId={workspace.id} userId={profile.id} fullName={profile.full_name} email={profile.email} /></>}
    {!isAdmin && lockPromptOpen && <div className="access-lock-backdrop" onClick={()=>setLockPromptOpen(false)}><section className="access-lock-modal" role="dialog" aria-modal="true" aria-label="Masa aktif Lumaway berakhir" onClick={e=>e.stopPropagation()}><button className="access-lock-close" type="button" onClick={()=>setLockPromptOpen(false)}>×</button><span className="access-lock-icon" aria-hidden="true">🔒</span><h2>Masa aktif Anda telah berakhir</h2><p>Data workspace Anda tetap aman dan tidak dihapus. Perpanjang langganan untuk membuka kembali fitur Lumaway.</p>{subscriptionEndsAt&&<small>Berakhir: {new Date(subscriptionEndsAt).toLocaleString("id-ID")}</small>}<button className="primary" type="button" onClick={()=>{setLockPromptOpen(false);navigateToSection("billing")}}>Perpanjang di Billing</button></section></div>}
  </div>;
}
