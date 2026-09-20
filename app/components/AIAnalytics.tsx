"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { LumaLoadingMotion } from "./LumaMotionState";
import { createClient } from "../../lib/supabase-browser";

type Row = Record<string, any>;
const TYPES = [
  ["performance", "Performance Analysis", "KPI, efisiensi, kesehatan performa, kontribusi platform"],
  ["creator", "Creator Analysis", "Kontributor, konsentrasi, segmentasi dan peluang creator"],
  ["product", "Product Analysis", "SKU, produk, kontribusi GMV, volume dan product mix"],
  ["trend", "Trend Analysis", "Pergerakan periode, momentum dan arah performa"],
  ["anomaly", "Anomaly Detection", "Lonjakan, penurunan, outlier dan pola tidak biasa"],
  ["recommendation", "Recommendations", "Prioritas tindakan lintas performance, creator, product, trend dan anomaly"],
] as const;
const PAGE_SIZE = 10;

type MenuState = { runId: string; left: number; top: number } | null;

export default function AIAnalytics({ workspaceId }: { workspaceId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [type, setType] = useState("performance");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Siap menganalisis database workspace.");
  const [result, setResult] = useState<any>(null);
  const [runId, setRunId] = useState("");
  const [history, setHistory] = useState<Row[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [menu, setMenu] = useState<MenuState>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [docPreview, setDocPreview] = useState<Row | null>(null);
  const [docZoom, setDocZoom] = useState(0.72);
  const [generatingReport, setGeneratingReport] = useState("");
  const [taskAdded, setTaskAdded] = useState<Record<number, boolean>>({});
  const active = TYPES.find((x) => x[0] === type)!;

  useEffect(() => {
    void loadHistory();
  }, [workspaceId]);

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    document.addEventListener("click", close);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      document.removeEventListener("click", close);
    };
  }, []);

  async function loadHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: runs, error } = await supabase
      .from("ai_analysis_runs")
      .select("id,run_id,analysis_type,start_date,end_date,status,created_at,error_message")
      .eq("workspace_id", workspaceId)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(250);
    if (error) return setStatus("error, terjadi kesalahan.");

    const ids = (runs || []).map((x: any) => x.run_id).filter(Boolean);
    const [{ data: insights }, { data: reports }] = await Promise.all([
      ids.length
        ? supabase.from("ai_insights").select("run_id,insight_json,created_at").eq("workspace_id", workspaceId).in("run_id", ids)
        : Promise.resolve({ data: [] } as any),
      supabase
        .from("luma_pdf_reports")
        .select("id,run_id,title,page_count,previewed_at,downloaded_at,download_count,watermark_removed_at,created_at")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    const insightMap = Object.fromEntries((insights || []).map((x: any) => [x.run_id, x.insight_json]));
    const reportMap: Record<string, any> = {};
    for (const report of reports || []) if (report.run_id && !reportMap[report.run_id]) reportMap[report.run_id] = report;
    setHistory((runs || []).map((x: any) => ({ ...x, insight: insightMap[x.run_id] || null, report: reportMap[x.run_id] || null })));
  }

  async function buildContext() {
    const { data: kpi, error: kpiError } = await supabase.rpc("get_dashboard_kpi", {
      p_workspace_id: workspaceId, p_start_date: start || null, p_end_date: end || null, p_platform: null, p_creator_id: null,
    });
    if (kpiError) throw kpiError;
    const { data: ranking, error: rankingError } = await supabase.rpc("get_creator_ranking", {
      p_workspace_id: workspaceId, p_start_date: start || null, p_end_date: end || null, p_platform: null, p_creator_id: null,
      p_search: null, p_page: 1, p_page_size: 50,
    });
    if (rankingError) throw rankingError;

    let query = supabase
      .from("sales")
      .select("data_date,creator_name,username,platform,sku,product_name,category,qty,orders,gmv,commission,refund,clicks,buyers,live_gmv,video_gmv,showcase_gmv")
      .eq("workspace_id", workspaceId)
      .order("data_date", { ascending: true })
      .limit(10000);
    if (start) query = query.gte("data_date", start);
    if (end) query = query.lte("data_date", end);
    const { data: sales, error: salesError } = await query;
    if (salesError) throw salesError;

    const rows = sales || [];
    const monthly: Record<string, any> = {}, products: Record<string, any> = {}, platforms: Record<string, any> = {};
    for (const row of rows as any[]) {
      const month = row.data_date ? String(row.data_date).slice(0, 7) : "undated";
      monthly[month] ??= { gmv: 0, qty: 0, orders: 0, commission: 0, refund: 0, rows: 0 };
      for (const key of ["gmv", "qty", "orders", "commission", "refund"]) monthly[month][key] += Number(row[key] || 0);
      monthly[month].rows++;

      const productKey = row.sku || row.product_name;
      if (productKey) {
        products[productKey] ??= { sku: row.sku || null, product: row.product_name || null, category: row.category || null, gmv: 0, qty: 0, orders: 0, commission: 0, refund: 0 };
        for (const key of ["gmv", "qty", "orders", "commission", "refund"]) products[productKey][key] += Number(row[key] || 0);
      }
      const platform = row.platform || "Unknown";
      platforms[platform] ??= { gmv: 0, qty: 0, orders: 0, commission: 0, refund: 0 };
      for (const key of ["gmv", "qty", "orders", "commission", "refund"]) platforms[platform][key] += Number(row[key] || 0);
    }

    return {
      analysis_focus: active[2],
      period: { start: start || "ALL DATA", end: end || "ALL DATA" },
      kpi: kpi?.[0] || {},
      platforms,
      top_creators: (ranking || []).slice(0, 50).map((x: any) => ({ rank: x.rank, creator: x.creator_name || x.username, platform: x.platform, qty: x.qty, orders: x.orders, gmv: x.gmv, commission: x.commission })),
      top_products: Object.values(products).sort((a: any, b: any) => b.gmv - a.gmv).slice(0, 50),
      monthly_trend: Object.entries(monthly).map(([period, value]) => ({ period, ...(value as any) })),
      sampled_rows: rows.length,
    };
  }

  async function run() {
    setBusy(true); setResult(null); setTaskAdded({});
    try {
      if (start && end && start > end) { setStatus("Start Date tidak boleh melewati End Date."); return; }
      const context = await buildContext();
      const response = await fetch("/api/ai/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: workspaceId, analysis_type: type, start_date: start || null, end_date: end || null, context }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error();
      setResult(data.result); setRunId(data.run_id || ""); setStatus("Selesai. Output disimpan ke history."); await loadHistory();
    } catch { setStatus("error, terjadi kesalahan."); } finally { setBusy(false); }
  }

  async function addTask(text: string, index: number) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("creator_tasks").insert({ workspace_id: workspaceId, title: text.slice(0, 160), description: text, status: "backlog", priority: "normal", source: "ai_analysis", source_ref: runId || null, analysis_type: type, created_by: user?.id || null, sort_order: Date.now() });
    if (error) return setStatus("error, terjadi kesalahan.");
    setTaskAdded((value) => ({ ...value, [index]: true })); setStatus("Recommendation ditambahkan ke Kanban.");
  }

  async function generateDocument(targetRun = runId) {
    if (!targetRun) return;
    setGeneratingReport(targetRun);
    try {
      const response = await fetch("/api/ai/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: workspaceId, run_id: targetRun }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error();
      setStatus("Dokumen berhasil dibuat dan disimpan ke history."); await loadHistory();
    } catch { setStatus("error, terjadi kesalahan."); } finally { setGeneratingReport(""); }
  }

  function tokenUpdated() { window.dispatchEvent(new Event("luma-token-updated")); }

  async function previewReport(reportId: number) {
    try {
      const response = await fetch("/api/reports/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: workspaceId, report_id: reportId, action: "preview" }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error();
      setDocPreview(data.report); setDocZoom(0.72); setStatus("Preview dokumen dibuka.");
      if (data.charge?.charged) tokenUpdated();
      await loadHistory();
    } catch { setStatus("error, terjadi kesalahan."); }
  }

  async function removeWatermark() {
    if (!docPreview) return;
    try {
      const response = await fetch("/api/reports/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: workspaceId, report_id: docPreview.id, action: "remove_watermark" }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error();
      if (data.charge?.charged) tokenUpdated();
      setStatus("Watermark berhasil dihapus."); await previewReport(docPreview.id);
    } catch { setStatus("error, terjadi kesalahan."); }
  }

  async function downloadReport(reportId: number) {
    try {
      const response = await fetch("/api/reports/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: workspaceId, report_id: reportId, action: "download" }) });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.className = "report-download-link"; anchor.href = url; anchor.download = match?.[1] || `lumaway-report-${reportId}.pdf`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      tokenUpdated(); setStatus("PDF berhasil diunduh."); setMenu(null); await loadHistory();
    } catch { setStatus("error, terjadi kesalahan."); }
  }

  function openMenu(event: React.MouseEvent<HTMLButtonElement>, row: Row) {
    event.stopPropagation();
    if(menu?.runId===row.run_id){setMenu(null);return}
    const rect=event.currentTarget.getBoundingClientRect();
    const width=190;
    const estimatedHeight=row.report?138:58;
    const left=Math.max(10,Math.min(window.innerWidth-width-10,rect.right-width));
    const below=rect.bottom+8;
    const top=below+estimatedHeight<window.innerHeight?below:Math.max(10,rect.top-estimatedHeight-8);
    setMenu({runId:row.run_id,left,top});
  }

  const currentHistory = useMemo(() => history.find((x) => x.run_id === runId), [history, runId]);
  const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const page = Math.min(historyPage, totalPages);
  const pagedHistory = history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const menuRow = menu ? history.find((x) => x.run_id === menu.runId) : null;

  return <section id="ai-analytics" className="legacy-page-anchor ai-page ai-v2">
    <div className="ai-page-head"><div><div className="eyebrow">LUMA AFFILIATE INTELLIGENCE · AI ANALYTICS</div><h1>{active[1]}</h1><p className="muted">{active[2]}. Analisis mengacu pada database workspace dari file yang diupload dan dapat mengaitkan enam mode analisis.</p></div></div>
    <div className="ai-type-grid">{TYPES.map(([key, label, description]) => <button key={key} className={`ai-type-card ${type === key ? "active" : ""}`} onClick={() => { setType(key); setResult(null); setRunId(""); }}><strong>{label}</strong><span>{description}</span></button>)}</div>
    <div className="card ai-control-card"><div className="filters"><label>Start <span className="field-note">Opsional</span><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label><label>End <span className="field-note">Opsional</span><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label><button className="primary" onClick={run} disabled={busy}>{busy ? "Menganalisis..." : "✦ Analisis dengan AI"}</button><button className="secondary" onClick={() => { setStart(""); setEnd(""); }}>Reset Date</button></div><div className="ai-status">{status}</div></div>

    {(busy||generatingReport)&&<div className="ai-generation-loading"><LumaLoadingMotion compact label={generatingReport?"Menyusun dokumen AI":"Lumaway AI sedang menganalisis"} detail={generatingReport?"Menyiapkan struktur, insight, dan dokumen laporan.":"Menghubungkan data workspace, menghitung KPI, lalu menyusun insight."}/></div>}

    {result && <div className="ai-result-grid">
      <div className="card ai-summary-card"><div className="eyebrow">EXECUTIVE SUMMARY</div><p>{result.executive_summary}</p><div className="button-row"><button className="primary" disabled={generatingReport === runId} onClick={() => generateDocument()}>{generatingReport === runId ? "Generating..." : "Generate Dokumen"}</button>{currentHistory?.report && <><button className="secondary" onClick={() => previewReport(currentHistory.report.id)}>Preview Document · 5 token*</button><button className="secondary" onClick={() => downloadReport(currentHistory.report.id)}>Download PDF · 10 token</button></>}</div><small className="muted">*Preview pertama menggunakan 5 token. Preview berikutnya gratis.</small></div>
      {[["Key Findings", result.key_findings], ["Creator Findings", result.creator_findings], ["Product Findings", result.product_findings], ["Trend Findings", result.trend_findings], ["Anomalies", result.anomalies]].map(([title, items]: any) => <div className="card" key={title}><h3>{title}</h3><ul className="legacy-list">{(items || []).map((item: string, index: number) => <li key={index}>{item}</li>)}</ul></div>)}
      <div className="card ai-do-card"><h3>DO · Recommendations</h3><div className="recommendation-list">{(result.recommendations || []).map((item: string, index: number) => <div className="recommendation-row" key={index}><span>{item}</span><button className="secondary" disabled={taskAdded[index]} onClick={() => addTask(item, index)}>{taskAdded[index] ? "Added ✓" : "+ Kanban"}</button></div>)}</div></div>
      <div className="card"><h3>Confidence & Data Note</h3><p className="muted">{result.confidence_note}</p></div>
    </div>}

    <div className="card ai-history-card">
      <div className="section-head"><div><h3>Analysis & Document History</h3><p className="muted">Hasil analisis dan dokumen tersimpan per user. Maksimal 10 data per halaman.</p></div><button className="secondary" onClick={loadHistory}>Refresh</button></div>
      {history.length ? <><div className="ai-history-scroll"><table><thead><tr><th>Analysis</th><th>Period</th><th>Document</th><th>Created</th><th aria-label="Actions" /></tr></thead><tbody>{pagedHistory.map((row) => <tr key={row.run_id}><td><b>{TYPES.find((x) => x[0] === row.analysis_type)?.[1] || row.analysis_type}</b><br /><small>{row.run_id}</small></td><td>{row.start_date || "All data"} → {row.end_date || "All data"}</td><td>{row.report ? <><b>{row.report.page_count || 20} pages</b><br /><small>{row.report.download_count ? `${row.report.download_count} download` : "Ready"}</small></> : "-"}</td><td>{new Date(row.created_at).toLocaleString("id-ID")}</td><td className="history-action-cell"><button type="button" className={`history-action-trigger history-hamburger-trigger ${menu?.runId===row.run_id?"open":""}`} onClick={(event) => openMenu(event, row)} aria-label="Buka menu history" aria-haspopup="menu" aria-expanded={menu?.runId===row.run_id}><span className="burger-line"/><span className="burger-line"/><span className="burger-line"/></button></td></tr>)}</tbody></table></div>{totalPages > 1 && <div className="history-pagination"><button disabled={page <= 1} onClick={() => setHistoryPage((value) => Math.max(1, value - 1))}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2)).map((number) => <button key={number} className={number === page ? "active" : ""} onClick={() => setHistoryPage(number)}>{number}</button>)}<button disabled={page >= totalPages} onClick={() => setHistoryPage((value) => Math.min(totalPages, value + 1))}>›</button></div>}</> : <div className="empty-state"><strong>Belum ada history.</strong></div>}
    </div>

    {menu && menuRow && typeof document!=="undefined" && createPortal(<div className="ai-history-row-menu ai-history-popup-menu" role="menu" style={{left:menu.left,top:menu.top}} onClick={(event)=>event.stopPropagation()}><button type="button" role="menuitem" onClick={()=>{setDetail(menuRow);setMenu(null)}}>Detail Analysis</button>{menuRow.report&&<button type="button" role="menuitem" onClick={()=>{setMenu(null);void previewReport(menuRow.report.id)}}>Preview Document</button>}{menuRow.report&&<button type="button" role="menuitem" onClick={()=>{setMenu(null);void downloadReport(menuRow.report.id)}}>Download PDF</button>}{!menuRow.report&&<button type="button" role="menuitem" disabled={generatingReport===menuRow.run_id} onClick={()=>{const target=menuRow.run_id;setMenu(null);void generateDocument(target)}}>{generatingReport===menuRow.run_id?"Generating...":"Generate Document"}</button>}</div>,document.body)}

    {detail && <div className="kanban-modal-backdrop" onClick={() => setDetail(null)}><div className="analysis-detail-modal" onClick={(event) => event.stopPropagation()}><div className="report-modal-actions"><div><strong>{TYPES.find((x) => x[0] === detail.analysis_type)?.[1] || detail.analysis_type}</strong><small>{detail.run_id}</small></div><button onClick={() => setDetail(null)}>×</button></div><div className="analysis-detail-body"><div className="eyebrow">EXECUTIVE SUMMARY</div><p>{detail.insight?.executive_summary || "Tidak ada ringkasan."}</p>{[["Key Findings", detail.insight?.key_findings], ["Creator Findings", detail.insight?.creator_findings], ["Product Findings", detail.insight?.product_findings], ["Trend Findings", detail.insight?.trend_findings], ["Anomalies", detail.insight?.anomalies], ["Recommendations", detail.insight?.recommendations]].map(([title, items]: any) => <section key={title}><h3>{title}</h3><ul>{(items || []).map((item: string, index: number) => <li key={index}>{item}</li>)}</ul></section>)}</div></div></div>}

    {docPreview && <div className="kanban-modal-backdrop report-preview-backdrop" onClick={() => setDocPreview(null)}><div className="report-preview-modal" onClick={(event) => event.stopPropagation()}><div className="report-modal-actions"><div><strong>{docPreview.title}</strong><small>{docPreview.page_count || 20} halaman</small></div><div className="button-row"><button onClick={() => setDocZoom((value) => Math.max(0.45, value - 0.1))}>−</button><span>{Math.round(docZoom * 100)}%</span><button onClick={() => setDocZoom((value) => Math.min(1.3, value + 0.1))}>+</button>{!docPreview.watermark_removed_at && <button onClick={removeWatermark}>Remove Watermark · 25 token</button>}<button onClick={() => downloadReport(docPreview.id)}>Download PDF</button><button onClick={() => setDocPreview(null)}>×</button></div></div><div className="report-preview-scroll"><div className="report-pages" style={{ transform: `scale(${docZoom})`, transformOrigin: "top center" }}>{(docPreview.document_json?.pages || []).map((pageData: any, index: number) => <article className={`a4-report-page ${index === 0 ? "cover" : ""}`} key={pageData.page_number || index}>{!docPreview.watermark_removed_at && <div className="report-watermark">LUMAWAY</div>}<header><img src="/luma-mark.png" alt="Luma" /><b>LUMAWAY</b><span>{String(pageData.page_number || index + 1).padStart(2, "0")}</span></header><main><small>LUMA AFFILIATE INTELLIGENCE</small><h1>{pageData.title}</h1><p className="subtitle">{pageData.subtitle}</p>{(pageData.sections || []).map((section: any, sectionIndex: number) => <section key={sectionIndex}><h2>{section.heading}</h2><p>{section.body}</p></section>)}{!!pageData.bullets?.length && <ul>{pageData.bullets.map((item: string, itemIndex: number) => <li key={itemIndex}>{item}</li>)}</ul>}{pageData.callout && <aside>{pageData.callout}</aside>}</main><footer>© Lumaway · Light Up Your Potential.</footer></article>)}</div></div></div></div>}
  </section>;
}
