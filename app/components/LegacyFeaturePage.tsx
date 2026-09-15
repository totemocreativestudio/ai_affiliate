"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import LumaIcon from "./LumaIcon";

type Props = { feature: string; workspaceId: string; onNavigate: (page: string) => void };

type Config = { eyebrow: string; title: string; description: string; icon: string };

const config: Record<string, Config> = {
  "excel-sync": { eyebrow: "DATA & SYNC", title: "Excel Sync", description: "Sinkronisasi, template dan pengelolaan data massal tanpa mengubah data sampai proses disimpan.", icon: "sync" },
  agreements: { eyebrow: "AFFILIATE MANAGEMENT", title: "Agreement", description: "Kelola dokumen agreement creator per workspace dengan histori yang tetap terpisah antar customer.", icon: "document" },
  "affiliate-support": { eyebrow: "AFFILIATE MANAGEMENT", title: "Affiliate Support", description: "Pantau sample, shipping, creator task dan dukungan operasional affiliate dalam satu workspace.", icon: "support" },
  "luma-affiliate": { eyebrow: "LUMA AFFILIATE", title: "Luma Affiliate", description: "Program referral, profil affiliate Luma, event dan komisi workspace Anda.", icon: "users" },
  "promo-studio": { eyebrow: "LUMA AI", title: "Luma AI Studio", description: "Workspace kreatif untuk ide promo, struktur TOFU–MOFU–BOFU, AIDA, PAS dan histori generasi AI.", icon: "sparkles" },
  tutorial: { eyebrow: "LEARNING", title: "Tutorial", description: "Panduan penggunaan Lumaway dari upload data hingga membaca AI Analytics.", icon: "play" },
  billing: { eyebrow: "LUMA BILLING", title: "Billing & Token", description: "Saldo token, transaksi, top-up dan pemakaian AI dalam workspace Anda.", icon: "wallet" },
  "google-sheets": { eyebrow: "INTEGRATION", title: "Google Sheets", description: "Status sinkronisasi Google Sheets dan histori proses data workspace.", icon: "sheet" },
  administration: { eyebrow: "LUMA ADMINISTRATION", title: "Administration", description: "Kontrol platform untuk administrator Lumaway. Customer tidak mendapat akses lintas workspace.", icon: "settings" },
};

export default function LegacyFeaturePage({ feature, workspaceId, onNavigate }: Props) {
  const supabase = createClient();
  const c = config[feature] || config.tutorial;
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Array<{ label: string; value: string }>>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => { void load(); }, [feature, workspaceId]);

  async function count(table: string) {
    const { count } = await supabase.from(table).select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId);
    return count || 0;
  }

  async function load() {
    setLoading(true); setRows([]); setMetrics([]); setNote("");
    try {
      if (feature === "agreements") {
        const total = await count("agreements");
        const { data } = await supabase.from("agreements").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(8);
        setMetrics([{ label: "Agreement", value: total.toLocaleString("id-ID") }, { label: "Workspace", value: "Isolated" }]);
        setRows(data || []);
      } else if (feature === "affiliate-support") {
        const [samples, shipping, tasks] = await Promise.all([count("creator_samples"), count("shipping"), count("creator_tasks")]);
        setMetrics([{ label: "Creator Samples", value: samples.toLocaleString("id-ID") }, { label: "Shipping", value: shipping.toLocaleString("id-ID") }, { label: "Creator Tasks", value: tasks.toLocaleString("id-ID") }]);
      } else if (feature === "luma-affiliate") {
        const [profiles, events] = await Promise.all([count("referral_profiles"), count("referral_events")]);
        setMetrics([{ label: "Referral Profile", value: profiles.toLocaleString("id-ID") }, { label: "Referral Events", value: events.toLocaleString("id-ID") }, { label: "Program", value: "Active" }]);
      } else if (feature === "promo-studio") {
        const total = await count("promo_generations");
        const { data } = await supabase.from("promo_generations").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(6);
        setMetrics([{ label: "Generation History", value: total.toLocaleString("id-ID") }, { label: "Framework", value: "TOFU · MOFU · BOFU" }]);
        setRows(data || []);
        setNote("AI Studio memakai data workspace yang sama. Generasi baru akan memakai token Lumaway dan histori tetap tersimpan per account.");
      } else if (feature === "billing") {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: wallet } = await supabase.from("luma_token_wallets").select("*").eq("workspace_id", workspaceId).eq("user_id", user?.id || "").maybeSingle();
        const { data: tx } = await supabase.from("luma_token_transactions").select("*").eq("workspace_id", workspaceId).eq("user_id", user?.id || "").order("created_at", { ascending: false }).limit(8);
        const monthly = Number(wallet?.monthly_tokens ?? wallet?.monthly_balance ?? 0);
        const bonus = Number(wallet?.bonus_tokens ?? wallet?.bonus_balance ?? 0);
        setMetrics([{ label: "Monthly Token", value: monthly.toLocaleString("id-ID") }, { label: "Bonus Token", value: bonus.toLocaleString("id-ID") }, { label: "Available", value: (monthly + bonus).toLocaleString("id-ID") }]);
        setRows(tx || []);
      } else if (feature === "google-sheets") {
        const total = await count("google_sheet_sync_history");
        const { data } = await supabase.from("google_sheet_sync_history").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(8);
        setMetrics([{ label: "Sync History", value: total.toLocaleString("id-ID") }, { label: "Credential", value: "Server-side" }]);
        setRows(data || []);
      } else if (feature === "excel-sync") {
        setMetrics([{ label: "Source", value: "Upload Center" }, { label: "Mode", value: "Workspace only" }, { label: "Safety", value: "No auto overwrite" }]);
        setNote("Gunakan Upload Center untuk import. Data hanya berubah setelah import, edit, delete, atau aksi filter yang Anda jalankan sendiri.");
      } else if (feature === "tutorial") {
        setMetrics([{ label: "Step 1", value: "Upload Data" }, { label: "Step 2", value: "Review Database" }, { label: "Step 3", value: "AI Analytics" }]);
      } else if (feature === "administration") {
        setMetrics([{ label: "Scope", value: "Platform Admin" }, { label: "Isolation", value: "Workspace RLS" }, { label: "Auth", value: "Supabase" }]);
      }
    } catch (e: any) {
      setNote(e?.message || "Data belum tersedia.");
    } finally { setLoading(false); }
  }

  const columns = useMemo(() => {
    if (!rows.length) return [] as string[];
    return Object.keys(rows[0]).filter((x) => !["workspace_id", "user_id", "id"].includes(x)).slice(0, 5);
  }, [rows]);

  return (
    <section className="feature-page">
      <div className="feature-header">
        <div>
          <div className="feature-icon"><LumaIcon name={c.icon} size={20} /></div>
          <div className="eyebrow">{c.eyebrow}</div>
          <h1>{c.title}</h1>
          <p className="muted">{c.description}</p>
        </div>
      </div>

      {loading ? <div className="card loading-card">Loading workspace data…</div> : (
        <>
          {metrics.length > 0 && <div className="summary-grid">{metrics.map((m) => <div className="summary-card" key={m.label}><span>{m.label}</span><strong>{m.value}</strong></div>)}</div>}
          {note && <div className="card feature-note">{note}</div>}

          {feature === "affiliate-support" && <div className="quick-action-grid"><button onClick={() => onNavigate("creator-samples")}><LumaIcon name="sample"/>Creator Samples</button><button onClick={() => onNavigate("shipping")}><LumaIcon name="truck"/>Shipping</button><button onClick={() => onNavigate("ratecard")}><LumaIcon name="money"/>Ratecard</button></div>}
          {feature === "promo-studio" && <div className="quick-action-grid"><button onClick={() => onNavigate("ai-analytics")}><LumaIcon name="analytics"/>Open AI Analytics</button><button onClick={() => onNavigate("billing")}><LumaIcon name="wallet"/>Check Token</button></div>}
          {feature === "excel-sync" && <div className="quick-action-grid"><button onClick={() => onNavigate("upload")}><LumaIcon name="upload"/>Open Upload Center</button><button onClick={() => onNavigate("database")}><LumaIcon name="database"/>Review Database</button></div>}

          {rows.length > 0 && <div className="card"><div className="card-head"><h3>Recent Activity</h3><span>{rows.length} row</span></div><div className="scroll"><table><thead><tr>{columns.map((c) => <th key={c}>{c.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{columns.map((c) => <td key={c}>{String(r[c] ?? "-").slice(0, 80)}</td>)}</tr>)}</tbody></table></div></div>}
        </>
      )}
    </section>
  );
}
