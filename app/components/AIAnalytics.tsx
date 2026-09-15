"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Props = { workspaceId: string };
const TYPES = [
  ["performance", "Performance Analysis"],
  ["creator", "Creator Analysis"],
  ["product", "Product Analysis"],
  ["trend", "Trend Analysis"],
  ["anomaly", "Anomaly Detection"],
  ["recommendation", "Recommendations"],
];

export default function AIAnalytics({ workspaceId }: Props) {
  const supabase = createClient();
  const [type, setType] = useState("performance");
  const [start, setStart] = useState("2026-06-01");
  const [end, setEnd] = useState("2026-08-31");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Siap menganalisis data workspace.");
  const [result, setResult] = useState<any>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      setStatus("Mengambil data agregat...");
      const { data: kpi, error: kpiError } = await supabase.rpc(
        "get_dashboard_kpi",
        {
          p_workspace_id: workspaceId,
          p_start_date: start,
          p_end_date: end,
          p_platform: null,
          p_creator_id: null,
        }
      );
      if (kpiError) throw kpiError;

      const { data: ranking, error: rankingError } = await supabase.rpc(
        "get_creator_ranking",
        {
          p_workspace_id: workspaceId,
          p_start_date: start,
          p_end_date: end,
          p_platform: null,
          p_creator_id: null,
          p_search: null,
          p_page: 1,
          p_page_size: 10,
        }
      );
      if (rankingError) throw rankingError;

      const context = {
        period: { start, end },
        kpi: kpi?.[0] || {},
        top_creators: (ranking || []).map((x: any) => ({
          rank: x.rank,
          creator: x.creator_name || x.username,
          platform: x.platform,
          qty: x.qty,
          orders: x.orders,
          gmv: x.gmv,
          commission: x.commission,
        })),
      };

      setStatus("Memproses analisis AI...");
      const r = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          analysis_type: type,
          start_date: start,
          end_date: end,
          context,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Analisis AI gagal.");
      setResult(d.result);
      setStatus(`Selesai · ${d.model || "AI"}`);
    } catch (e: any) {
      setStatus(e?.message || "Analisis AI gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="ai-analytics" className="legacy-page-anchor ai-page">
      <div className="ai-page-head">
        <div>
          <div className="eyebrow">LUMA AFFILIATE INTELLIGENCE · AI ANALYTICS</div>
          <h1>{TYPES.find((x) => x[0] === type)?.[1]}</h1>
          <p className="muted">Analisis read-only berbasis data agregat. AI tidak mengubah data operasional.</p>
        </div>
      </div>
      <div className="ai-type-grid">
        {TYPES.map(([key, label]) => (
          <button key={key} className={`ai-type-card ${type === key ? "active" : ""}`} onClick={() => setType(key)}>
            <strong>{label}</strong>
            <span>{key === "performance" ? "KPI dan performa" : key === "creator" ? "Kontributor creator" : key === "product" ? "Produk dan SKU" : key === "trend" ? "Pergerakan periode" : key === "anomaly" ? "Perubahan tidak biasa" : "Prioritas tindakan"}</span>
          </button>
        ))}
      </div>
      <div className="card ai-control-card">
        <div className="filters"><label>Start<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label><label>End<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label><button className="primary" onClick={run} disabled={busy}>{busy ? "Menganalisis..." : "✦ Analisis dengan AI"}</button></div>
        <div className="ai-status">{status}</div>
      </div>
      {result && (
        <div className="ai-result-grid">
          <div className="card ai-summary-card"><div className="eyebrow">EXECUTIVE SUMMARY</div><h3>{result.performance_status || "INFO"}</h3><p>{result.executive_summary}</p></div>
          {[["Key Findings", result.key_findings],["Creator Findings", result.creator_findings],["Product Findings", result.product_findings],["Trend Findings", result.trend_findings],["Anomalies", result.anomalies],["Recommendations", result.recommendations]].map(([title, items]: any) => <div className="card" key={title}><h3>{title}</h3><ul className="legacy-list">{(items || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>)}
          <div className="card"><h3>Confidence Note</h3><p className="muted">{result.confidence_note}</p></div>
        </div>
      )}
    </section>
  );
}
