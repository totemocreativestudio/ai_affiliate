"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Settings = {
  google_cloud_project_id: string;
  google_oauth_client_id: string;
  google_oauth_consent_status: string;
  google_oauth_verification_status: string;
  google_support_email: string;
};

const initial: Settings = {
  google_cloud_project_id: "",
  google_oauth_client_id: "",
  google_oauth_consent_status: "testing",
  google_oauth_verification_status: "not_started",
  google_support_email: "",
};

export default function GoogleCloudIntegration() {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const callbackUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://YOUR-PROJECT.supabase.co";
    return `${base.replace(/\/$/, "")}/auth/v1/callback`;
  }, []);

  async function load() {
    setBusy(true);
    const keys = Object.keys(initial);
    const { data, error } = await supabase
      .from("luma_platform_settings")
      .select("setting_key,setting_value")
      .in("setting_key", keys);
    setBusy(false);
    if (error) return setStatus(error.message);
    const map = Object.fromEntries((data || []).map((x: any) => [x.setting_key, x.setting_value || ""]));
    setForm({
      google_cloud_project_id: map.google_cloud_project_id || "",
      google_oauth_client_id: map.google_oauth_client_id || "",
      google_oauth_consent_status: map.google_oauth_consent_status || "testing",
      google_oauth_verification_status: map.google_oauth_verification_status || "not_started",
      google_support_email: map.google_support_email || "",
    });
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    setBusy(true);
    setStatus("");
    const { data: { user } } = await supabase.auth.getUser();
    const rows = Object.entries(form).map(([setting_key, setting_value]) => ({
      setting_key,
      setting_value: String(setting_value || ""),
      updated_at: new Date().toISOString(),
      updated_by: user?.id || null,
    }));
    const { error } = await supabase.from("luma_platform_settings").upsert(rows, { onConflict: "setting_key" });
    setBusy(false);
    setStatus(error ? error.message : "Google Cloud metadata tersimpan. OAuth Client Secret tetap dikelola di Supabase Auth dan tidak disimpan di browser LUMA.");
  }

  const ready = form.google_oauth_consent_status === "production" && form.google_oauth_verification_status === "verified" && Boolean(form.google_oauth_client_id);

  return <section id="owner-integration-google" className="owner-integration-card">
    <div className="owner-integration-heading">
      <div className="owner-service-mark google">G</div>
      <div><span className="owner-kicker">IDENTITY & SHEETS</span><h3>Google Cloud / OAuth</h3><p>Monitoring konfigurasi Google Sign-In dan private Google Sheets per user.</p></div>
      <span className={`owner-status ${ready ? "ok" : "warn"}`}>{ready ? "Production Ready" : "Action Required"}</span>
    </div>
    <div className="owner-form-grid">
      <label>Google Cloud Project ID<input value={form.google_cloud_project_id} onChange={e=>setForm({...form,google_cloud_project_id:e.target.value})} placeholder="lumaway-production"/></label>
      <label>OAuth Client ID<input value={form.google_oauth_client_id} onChange={e=>setForm({...form,google_oauth_client_id:e.target.value})} placeholder="....apps.googleusercontent.com"/></label>
      <label>OAuth Consent<select value={form.google_oauth_consent_status} onChange={e=>setForm({...form,google_oauth_consent_status:e.target.value})}><option value="testing">Testing</option><option value="production">Production</option></select></label>
      <label>Verification<select value={form.google_oauth_verification_status} onChange={e=>setForm({...form,google_oauth_verification_status:e.target.value})}><option value="not_started">Not Started</option><option value="pending">Pending Verification</option><option value="verified">Verified</option></select></label>
      <label>Support Email<input type="email" value={form.google_support_email} onChange={e=>setForm({...form,google_support_email:e.target.value})} placeholder="support@lumaway.online"/></label>
      <label>Authorized Redirect URI<input value={callbackUrl} readOnly/></label>
    </div>
    <div className="owner-checklist">
      <span className={form.google_oauth_client_id ? "done" : ""}>OAuth Client ID</span>
      <span className={form.google_oauth_consent_status === "production" ? "done" : ""}>Consent Production</span>
      <span className={form.google_oauth_verification_status === "verified" ? "done" : ""}>Google Verification</span>
      <span>Sheets + Drive scopes</span>
    </div>
    <div className="button-row"><button className="primary" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save Google Cloud Status"}</button><button className="secondary" onClick={load} disabled={busy}>Refresh</button></div>
    {status && <div className="owner-inline-note">{status}</div>}
  </section>;
}
