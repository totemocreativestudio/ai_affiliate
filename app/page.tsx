"use client";

import "./luma-production.css";
import "./luma-legacy-extra.css";

import { useEffect, useState } from "react";
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
import LegacyPending from "./components/LegacyPending";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  active: boolean;
};

type Workspace = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export default function Home() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadSession();
  }, []);

  async function loadSession() {
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await loadLumaData(session.user.id);
    setLoading(false);
  }

  async function loadLumaData(userId: string) {
    setError("");
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,active")
      .eq("id", userId)
      .single();

    if (profileError) {
      setError(`Profile error: ${profileError.message}`);
      return;
    }
    setProfile(profileData);

    const { data: memberships, error: memberError } = await supabase
      .from("workspace_members")
      .select("workspace_id,membership_role,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (memberError || !memberships?.length) {
      setError(`Workspace membership error: ${memberError?.message || "No workspace"}`);
      return;
    }

    const preferred =
      typeof window !== "undefined"
        ? window.localStorage.getItem("luma_active_workspace")
        : null;
    const selected =
      memberships.find((x: any) => x.workspace_id === preferred) || memberships[0];

    const { data: workspaceData, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id,name,slug,status")
      .eq("id", selected.workspace_id)
      .single();

    if (workspaceError) {
      setError(`Workspace error: ${workspaceError.message}`);
      return;
    }

    setWorkspace(workspaceData);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("luma_active_workspace", workspaceData.id);
    }
  }

  async function loginWithGoogle() {
    setError("");
    setLoading(true);
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (googleError) {
      setError(googleError.message);
      setLoading(false);
    }
  }

  async function login() {
    setError("");
    setLoading(true);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }
    if (data.user) await loadLumaData(data.user.id);
    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setProfile(null);
    setWorkspace(null);
  }

  if (loading) {
    return (
      <main className="standalone-auth">
        <section className="auth-panel">
          <div className="auth-brand">
            <img src="/luma-mark.png" alt="Luma" />
            <div><strong>LUMA</strong><span>Light Up Your Potential.</span></div>
          </div>
          <h1>Loading Luma...</h1>
        </section>
      </main>
    );
  }

  if (!profile || !workspace) {
    return (
      <main className="standalone-auth">
        <section className="auth-panel">
          <div className="auth-brand">
            <img src="/luma-mark.png" alt="Luma" />
            <div><strong>LUMA</strong><span>Light Up Your Potential.</span></div>
          </div>
          <h1>Welcome to Luma</h1>
          <p className="muted">Affiliate Intelligence Workspace</p>

          <div style={{ marginTop: 30 }}>
            <button
              onClick={loginWithGoogle}
              style={{
                width: "100%",
                padding: 12,
                cursor: "pointer",
                background: "#fff",
                border: "1px solid #ccc",
                borderRadius: 8,
                fontWeight: 700,
                color: "#172033",
              }}
            >
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0", color: "#777" }}>
              <div style={{ height: 1, background: "#ddd", flex: 1 }} />
              <span>or</span>
              <div style={{ height: 1, background: "#ddd", flex: 1 }} />
            </div>

            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="full" onClick={login}>Login</button>
          </div>

          {error && <p className="auth-error">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <div className="luma-app">
      <LumaSidebar profile={profile} workspace={workspace} onLogout={logout} />

      <div className="app-shell">
        <header className="topbar">
          <div>
            <span className="topbar-kicker">LUMA WORKSPACE</span>
            <span className="topbar-title">Affiliate Intelligence</span>
          </div>
          <div className="topbar-right">
            <span className="connection-pill"><i></i>{workspace.name} · Active</span>
          </div>
        </header>

        <main className="content">
          <LegacyDashboard workspaceId={workspace.id} />

          <UploadCenter workspaceId={workspace.id} />
          <DatabaseCenter workspaceId={workspace.id} />
          <AIAnalytics workspaceId={workspace.id} />

          <section id="product-master" className="legacy-page-anchor">
            <div className="eyebrow">MASTER DATA</div>
            <ProductMaster workspaceId={workspace.id} />
          </section>

          <section id="listings" className="legacy-page-anchor">
            <Listings workspaceId={workspace.id} />
          </section>

          <section id="shipping" className="legacy-page-anchor">
            <Shipping workspaceId={workspace.id} />
          </section>

          <section id="creator-samples" className="legacy-page-anchor">
            <CreatorSamples workspaceId={workspace.id} />
          </section>

          <section id="ratecard" className="legacy-page-anchor">
            <RatecardMaster workspaceId={workspace.id} />
          </section>

          <LegacyPending isAdmin={profile.role === "admin"} />

          {error && <div className="flash error">{error}</div>}
        </main>
      </div>
    </div>
  );
}
