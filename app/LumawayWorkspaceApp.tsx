"use client";

import "./luma-production.css";
import "./luma-legacy-extra.css";
import "./luma-helpdesk.css";
import "./luma-fixes.css";
import "./luma-responsive.css";
import "./luma-subscription.css";
import "./luma-ux-polish.css";
import "./luma-final-fixes.css";
import "./lumaway-experience-v2.css";
import "./lumaway-premium-v4.css";
import "./lumaway-visual-system-v5.css";
import "./lumaway-auth-access-v6.css";
import "./lumaway-auth-v7.css";
import "./automation-rules.css";
import "./goal-forecast.css";
import "./scheduled-reports.css";
import "./tutorial-center.css";
import "./live-streaming.css";
import "./live-host-session.css";
import "./live-upload.css";
import "./live-campaign.css";
import "./live-analytics.css";
import "./affiliate360-search.css";
import "./live-data-health.css";
import "./spending-center.css";
import "./listing-followup-insights.css";
import "./listing-followup-queue.css";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase-browser";
import { APP_BASE, isAuthPath, navigateToSection, routeForSection, sectionFromPath } from "../lib/luma-navigation";
import ProductMaster from "./components/ProductMaster";
import Listings from "./components/Listings";
import Shipping from "./components/Shipping";
import SpendingCenter from "./components/SpendingCenter";
import CampaignTracker from "./components/CampaignTracker";
import DailyBriefCenter from "./components/DailyBriefCenter";
import AutomationRulesCenter from "./components/AutomationRulesCenter";
import GoalForecastCenter from "./components/GoalForecastCenter";
import ScheduledReportCenter from "./components/ScheduledReportCenter";
import LiveStreamingCenter from "./components/LiveStreamingCenter";
import Affiliate360Search from "./components/Affiliate360Search";
import CreatorSamples from "./components/CreatorSamples";
import RatecardMaster from "./components/RatecardMaster";
import UploadCenter from "./components/UploadCenter";
import DatabaseCenter from "./components/DatabaseCenter";
import DataHealthCenter from "./components/DataHealthCenter";
import CreatorIdentityCenter from "./components/CreatorIdentityCenter";
import AIAnalytics from "./components/AIAnalytics";
import LumaSidebar from "./components/LumaSidebar";
import LegacyDashboard from "./components/LegacyDashboard";
import RestoredLegacyModules from "./components/RestoredLegacyModules";
import NotificationCenter from "./components/NotificationCenter";
import GlobalCommandCenter from "./components/GlobalCommandCenter";
import ContentHub from "./components/ContentHub";
import SocialLumaway from "./components/SocialLumaway";
import LumaHelpdeskAgent from "./components/LumaHelpdeskAgent";
import UserTicketCenter from "./components/UserTicketCenter";
import DashboardReminder from "./components/DashboardReminder";
import PWAInstallButton from "./components/PWAInstallButton";
import MobileQuickNav from "./components/MobileQuickNav";
import SystemStatusGate from "./components/SystemStatusGate";
import {LumaErrorMotion} from "./components/LumaMotionState";
import TableSortEnhancer from "./components/TableSortEnhancer";
import LumawayExperienceLayer from "./components/LumawayExperienceLayer";
import BackgroundTaskCenter from "./components/BackgroundTaskCenter";
import LumawayAuthExperience from "./components/LumawayAuthExperience";

type Profile = { id: string; email: string | null; full_name: string | null; nickname: string | null; role: string; active: boolean; phone: string | null; phone_verified_at: string | null; email_verified_at: string | null; education: string | null; birth_date: string | null; bio: string | null; position_title: string | null; profile_completed: boolean; password_configured_at: string | null };
type Workspace = { id: string; name: string; slug: string; status: string };
type AuthMode = "signin" | "signup";
const REFERRAL_STORAGE_KEY="lumaway_referral_code";

function captureReferralCode(){
  if(typeof window==="undefined")return "";
  const params=new URLSearchParams(window.location.search);
  const incoming=String(params.get("ref")||"").trim().toUpperCase();
  if(incoming&&/^[A-Z0-9]{12}$/.test(incoming))window.localStorage.setItem(REFERRAL_STORAGE_KEY,incoming);
  return incoming||String(window.localStorage.getItem(REFERRAL_STORAGE_KEY)||"").trim().toUpperCase();
}

function verificationRedirectUrl(){
  if(typeof window==="undefined")return "https://app.lumaway.online/login?verified=1";
  const url=new URL(`${window.location.origin}${APP_BASE}/login`);
  url.searchParams.set("verified","1");
  const code=captureReferralCode();
  if(code&&/^[A-Z0-9]{12}$/.test(code))url.searchParams.set("ref",code);
  return url.toString();
}

function authUrlWithReferral(path:string){
  const code=captureReferralCode();
  return code&&/^[A-Z0-9]{12}$/.test(code)?`${path}?ref=${encodeURIComponent(code)}`:path;
}

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

function cleanAuthErrorQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("error") && !url.searchParams.has("error_code") && !url.searchParams.has("error_description")) return;
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function profileComplete(profile: Profile) {
  return Boolean(profile.profile_completed && profile.password_configured_at && profile.full_name?.trim() && profile.nickname?.trim() && profile.phone_verified_at && profile.email_verified_at && profile.education?.trim() && profile.birth_date && profile.bio?.trim());
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

function LumawayWorkspaceSkeleton() {
  return <div className="luma-app lw-boot-shell" aria-label="Menyiapkan workspace Lumaway">
    <aside className="lw-boot-sidebar">
      <div className="lw-boot-brand"><img src="/luma-mark.png" alt="" /><div><b>LUMAWAY.</b><span>Light Up Your Potential.</span></div></div>
      <div className="lw-boot-nav">
        <i className="active"/><i/><i/><i/><i/><i/>
      </div>
      <div className="lw-boot-profile"><span/><div><i/><i/></div></div>
    </aside>
    <div className="lw-boot-main">
      <header className="lw-boot-topbar"><div><i/><b/></div><div className="lw-boot-top-actions"><i/><i/><i/></div></header>
      <main className="lw-boot-content">
        <div className="lw-boot-title"><span/><strong/></div>
        <div className="lw-boot-toolbar"><i/><i/><i/><i/></div>
        <div className="lw-boot-summary"><section><i/><b/><span/><span/></section><section><i/><b/><span/></section></div>
        <div className="lw-boot-kpis">{Array.from({length:8}).map((_,index)=><i key={index}/>)}</div>
        <div className="lw-boot-grid"><section><i/><i/><i/><i/><i/></section><section><i/><i/><i/></section></div>
      </main>
    </div>
  </div>;
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
    const initialParams=new URLSearchParams(window.location.search);
    if(initialParams.get("verified")==="1")setAuthMessage("Email berhasil diverifikasi. Silakan masuk ke Lumaway dengan email dan password Anda.");
    cleanAuthErrorQuery();
    captureReferralCode();

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

  async function loadSession() {
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadLumaData(session.user.id);
      } else {
        const currentParams=new URLSearchParams(window.location.search);
        const sessionRequestedMode=currentParams.get("auth");
        const requestedView=String(currentParams.get("view")||"");
        const authPath=sessionRequestedMode==="signup"||window.location.pathname.endsWith("/register")
          ? `${APP_BASE}/register`
          : `${APP_BASE}/login`;
        setAuthMode(authPath===`${APP_BASE}/register`?"signup":"signin");
        if(authPath===`${APP_BASE}/login`&&["forgot","whatsapp"].includes(requestedView)){
          const url=new URL(authUrlWithReferral(authPath),window.location.origin);
          url.searchParams.set("view",requestedView);
          window.history.replaceState(null,"",url.pathname+url.search);
        }else{
          window.history.replaceState(null,"",authUrlWithReferral(authPath));
        }
      }
    } catch {
      setError("Sesi tidak dapat dimuat. Silakan login kembali.");
      await supabase.auth.signOut().catch(() => undefined);
      setProfile(null);
      setWorkspace(null);
      window.history.replaceState(null, "", authUrlWithReferral(`${APP_BASE}/login`));
    } finally {
      setLoading(false);
    }
  }

  async function loadLumaData(userId: string) {
    setError("");
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,full_name,nickname,role,active,phone,phone_verified_at,email_verified_at,education,birth_date,bio,position_title,profile_completed,password_configured_at")
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

    const referralCode=captureReferralCode();
    if(referralCode&&/^[A-Z0-9]{12}$/.test(referralCode)){
      const {data:referralApplied,error:referralError}=await supabase.rpc("luma_apply_my_referral",{p_code:referralCode});
      if(!referralError&&referralApplied)window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
    }

    // Access state is resolved server-side from auth.uid(), so one user's billing
    // status can never lock another user's workspace. Admin access is never subscription-locked.
    const { data: accessRows, error: accessStateError } = await supabase.rpc("luma_my_access_state_v1");
    const accessState = Array.isArray(accessRows) ? accessRows[0] : accessRows;
    if (!accessStateError && accessState) {
      setAccessLocked(typedProfile.role !== "admin" && Boolean(accessState.locked));
      setSubscriptionEndsAt(accessState.effective_ends_at || null);
    } else {
      // Safe per-user fallback during a billing/RPC incident. Never derive lock state globally.
      const { data: subscriptionRows, error: subscriptionError } = await supabase
        .from("luma_user_subscriptions")
        .select("status,starts_at,ends_at")
        .eq("user_id", userId)
        .order("ends_at", { ascending: false })
        .limit(10);
      if (subscriptionError) {
        setAccessLocked(false);
        setSubscriptionEndsAt(null);
      } else {
        const now = Date.now();
        const activeSubscription = (subscriptionRows || []).find((item: any) =>
          ["active", "trialing"].includes(String(item.status || "").toLowerCase()) &&
          item.starts_at &&
          new Date(item.starts_at).getTime() <= now &&
          item.ends_at &&
          new Date(item.ends_at).getTime() > now
        );
        setAccessLocked(typedProfile.role !== "admin" && Boolean((subscriptionRows || []).length && !activeSubscription));
        setSubscriptionEndsAt(activeSubscription?.ends_at || (subscriptionRows || [])[0]?.ends_at || null);
      }
    }

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

  async function loginWithGoogle() {
    setError("");
    setAuthMessage("");
    setLoading(true);
    try {
      const next = "/dashboard";
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (oauthError || !data?.url) throw oauthError || new Error("OAuth URL unavailable");
      window.location.assign(data.url);
    } catch {
      setLoading(false);
      setError("Login Google belum dapat dimulai. Silakan coba lagi atau gunakan email dan password.");
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
    try {
      const response = await fetch("/api/auth/email-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", email: email.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) {
        const message = String(result?.error || "");
        setError(/terlalu banyak/i.test(message)
          ? message
          : "Email verifikasi belum dapat dikirim. Coba lagi beberapa saat.");
        return;
      }
      setNeedsEmailVerification(true);
      setAuthMessage("Jika akun tersedia, email verifikasi Lumaway telah dikirim dari marketing@lumaway.online. Cek Inbox, Spam, Promotions, atau Junk.");
    } catch {
      setError("Email verifikasi belum dapat dikirim. Coba lagi beberapa saat.");
    } finally {
      setLoading(false);
    }
  }

  async function signup() {
    if (!email || !password) return setError("Email dan password wajib diisi.");
    if (password.length < 8) return setError("Gunakan password minimal 8 karakter.");
    if (!termsAccepted) return setError("Konfirmasi persetujuan akses workspace terlebih dahulu.");
    setError(""); setAuthMessage(""); setNeedsEmailVerification(false); setLoading(true);
    try {
      const response = await fetch("/api/auth/email-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signup", email: email.trim(), password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) {
        setError(String(result?.error || "Akun belum dapat dibuat. Silakan coba lagi."));
        return;
      }
      setNeedsEmailVerification(true);
      setAuthMessage("Akun berhasil dibuat. Email verifikasi Lumaway dikirim dari marketing@lumaway.online. Cek Inbox, Spam, Promotions, atau Junk lalu konfirmasi sebelum login.");
      setAuthMode("signin"); setPassword(""); setTermsAccepted(false);
      window.history.replaceState(null, "", authUrlWithReferral(`${APP_BASE}/login`));
    } catch {
      setError("Akun belum dapat dibuat. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setProfile(null); setWorkspace(null); setPassword(""); setError("");
    window.history.replaceState(null, "", authUrlWithReferral(`${APP_BASE}/login`));
  }

  function switchAuthMode(mode: AuthMode) {
    setAuthMode(mode); setError(""); setAuthMessage(""); setNeedsEmailVerification(false);
    window.history.replaceState(null, "", authUrlWithReferral(mode === "signup" ? `${APP_BASE}/register` : `${APP_BASE}/login`));
  }

  if (loading || (profile && !workspace)) {
    return <LumawayWorkspaceSkeleton />;
  }

  if (!profile || !workspace) {
    return <LumawayAuthExperience onAuthenticated={loadLumaData} />;
  }

  const isAdmin = profile.role === "admin";
  return <div className="luma-app">
    <LumawayExperienceLayer />
    <TableSortEnhancer />
    <SystemStatusGate workspaceId={workspace.id} isAdmin={isAdmin} />
    <LumaSidebar profile={profile} workspace={workspace} onLogout={logout} accessLocked={accessLocked} />
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand-copy"><span className="topbar-kicker">{isAdmin ? "LUMAWAY OWNER" : "LUMAWAY WORKSPACE"}</span><span className="topbar-title">{isAdmin ? "Business Control Center" : "Affiliate Intelligence"}</span></div>
        {!isAdmin&&<GlobalCommandCenter workspaceId={workspace.id} accessLocked={accessLocked}/>}
        <div className="topbar-right"><PWAInstallButton compact /><BackgroundTaskCenter /><NotificationCenter workspaceId={workspace.id} userId={profile.id} /><span className="connection-pill"><i />{workspace.name} · Active</span></div>
      </header>
      <main className="content">
        {isAdmin ? <RestoredLegacyModules workspaceId={workspace.id} userId={profile.id} isAdmin /> : <>
          <LegacyDashboard workspaceId={workspace.id} />
          <UploadCenter workspaceId={workspace.id} />
          <DatabaseCenter workspaceId={workspace.id} />
          <DataHealthCenter workspaceId={workspace.id} />
          <CreatorIdentityCenter workspaceId={workspace.id} />
          <AIAnalytics workspaceId={workspace.id} />
          <ContentHub workspaceId={workspace.id} userId={profile.id} />
          <SocialLumaway workspaceId={workspace.id} userId={profile.id} />
          <RestoredLegacyModules workspaceId={workspace.id} userId={profile.id} isAdmin={false} />
          <UserTicketCenter workspaceId={workspace.id} />
          <section id="product-master" className="legacy-page-anchor"><div className="eyebrow">MASTER DATA</div><ProductMaster workspaceId={workspace.id} /></section>
          <section id="listings" className="legacy-page-anchor"><Listings workspaceId={workspace.id} /></section>
          <section id="shipping" className="legacy-page-anchor"><Shipping workspaceId={workspace.id} /></section>
          <SpendingCenter workspaceId={workspace.id} />
          <DailyBriefCenter workspaceId={workspace.id} />
          <AutomationRulesCenter workspaceId={workspace.id} />
          <GoalForecastCenter workspaceId={workspace.id} />
          <ScheduledReportCenter workspaceId={workspace.id} />
          <LiveStreamingCenter workspaceId={workspace.id} />
          <Affiliate360Search workspaceId={workspace.id} />
          <section id="campaign-tracker" className="legacy-page-anchor"><CampaignTracker workspaceId={workspace.id} /></section>
          <section id="creator-samples" className="legacy-page-anchor"><CreatorSamples workspaceId={workspace.id} /></section>
          <section id="ratecard" className="legacy-page-anchor"><RatecardMaster workspaceId={workspace.id} /></section>
        </>}
        {!isAdmin && accessLocked && <div className="subscription-lock-banner"><strong>Masa akses Lumaway telah berakhir.</strong><span>Data workspace Anda tetap aman dan tidak dihapus. Buka Billing untuk memperpanjang akses.</span>{subscriptionEndsAt&&<small>Berakhir: {new Date(subscriptionEndsAt).toLocaleString("id-ID")}</small>}<button onClick={()=>navigateToSection("billing")}>Buka Billing</button></div>}
        {error && <LumaErrorMotion compact code={/403|access denied|tidak.*akses/i.test(error)?403:/404|tidak ditemukan/i.test(error)?404:/503|unavailable|maintenance|tidak dapat dimuat/i.test(error)?503:500} message={error} onRetry={()=>void loadSession()}/>} 
      </main>
    </div>
    {!isAdmin && <><MobileQuickNav /><DashboardReminder workspaceId={workspace.id} userId={profile.id} workspaceStatus={workspace.status} /><LumaHelpdeskAgent workspaceId={workspace.id} userId={profile.id} fullName={profile.full_name} email={profile.email} /></>}
    {!isAdmin && lockPromptOpen && <div className="access-lock-backdrop" onClick={()=>setLockPromptOpen(false)}><section className="access-lock-modal" role="dialog" aria-modal="true" aria-label="Masa aktif Lumaway berakhir" onClick={e=>e.stopPropagation()}><button className="access-lock-close" type="button" onClick={()=>setLockPromptOpen(false)}>×</button><span className="access-lock-icon" aria-hidden="true">🔒</span><h2>Masa aktif Anda telah berakhir</h2><p>Data workspace Anda tetap aman dan tidak dihapus. Perpanjang langganan untuk membuka kembali fitur Lumaway.</p>{subscriptionEndsAt&&<small>Berakhir: {new Date(subscriptionEndsAt).toLocaleString("id-ID")}</small>}<button className="primary" type="button" onClick={()=>{setLockPromptOpen(false);navigateToSection("billing")}}>Perpanjang di Billing</button></section></div>}
  </div>;
}
