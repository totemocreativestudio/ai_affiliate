"use client";

import { useEffect, useState } from "react";

type Props = { workspaceId: string };
type Row = Record<string, any>;

function money(v: any) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));
}

export default function DatabaseCenter({ workspaceId }: Props) {
  const [start, setStart] = useState("2026-06-01");
  const [end, setEnd] = useState("2026-08-31");
  const [platform, setPlatform] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>({ imports: [], sales: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(targetPage = page) {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({
        workspace_id: workspaceId,
        start,
        end,
        page: String(targetPage),
        page_size: "50",
      });
      if (platform) q.set("platform", platform);
      const r = await fetch(`/api/database?${q.toString()}`);
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Gagal memuat database.");
      setData(d);
      setPage(targetPage);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat database.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    const refresh = () => void load(1);
    window.addEventListener("luma-data-changed", refresh);
    return () => window.removeEventListener("luma-data-changed", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const totalPages = Math.max(1, Math.ceil(Number(data.total || 0) / 50));

  return (
    <section id="database" className="legacy-page-anchor">
      <div className="page-head">
        <div><div className="eyebrow">DATABASE</div><h1>Database</h1><p className="muted">Upload history dan Latest Sales / Performance dari workspace aktif.</p></div>
      </div>
      <div className="card">
        <div className="section-head"><div><h3>Upload / Import History</h3><p className="muted">50 import terbaru.</p></div><button className="secondary" onClick={() => load(1)}>Refresh</button></div>
        <div className="scroll"><table><thead><tr><th>Import ID</th><th>File</th><th>Type</th><th>Platform</th><th>Period</th><th>Rows</th><th>Status</th><th>Imported</th></tr></thead><tbody>
          {(data.imports || []).map((x: Row) => <tr key={x.id || x.import_id}><td>{x.import_id}</td><td>{x.filename}</td><td>{x.data_type}</td><td>{x.platform}</td><td>{x.start_date || "-"} → {x.end_date || "-"}</td><td>{Number(x.rows_imported || 0).toLocaleString("id-ID")}</td><td>{x.status}</td><td>{x.imported_at || "-"}</td></tr>)}
          {!data.imports?.length && <tr><td colSpan={8}>Belum ada import.</td></tr>}
        </tbody></table></div>
      </div>
      <div className="card">
        <h3>Latest Sales / Performance</h3>
        <div className="filters"><label>Start<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label><label>End<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label><label>Platform<select value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">All</option><option>TikTok</option><option>Shopee</option><option>Instagram</option></select></label><button onClick={() => load(1)} disabled={loading}>{loading ? "Loading..." : "Apply"}</button></div>
        {error && <div className="flash error">{error}</div>}
        <div className="scroll"><table><thead><tr><th>Date</th><th>Creator</th><th>Platform</th><th>Channel</th><th>SKU</th><th>Product</th><th>Qty</th><th>Orders</th><th>GMV</th><th>Commission</th></tr></thead><tbody>
          {(data.sales || []).map((x: Row) => <tr key={x.id}><td>{x.data_date}</td><td>{x.creator_name || x.username || "-"}</td><td>{x.platform || "-"}</td><td>{x.channel || "-"}</td><td>{x.sku || "-"}</td><td>{x.product_name || "-"}</td><td>{Number(x.qty || 0).toLocaleString("id-ID")}</td><td>{Number(x.orders || 0).toLocaleString("id-ID")}</td><td>{money(x.gmv)}</td><td>{money(x.commission)}</td></tr>)}
          {!data.sales?.length && <tr><td colSpan={10}>Tidak ada data untuk filter ini.</td></tr>}
        </tbody></table></div>
        <div className="pager"><span className="pager-info">Page {page} / {totalPages} · {Number(data.total || 0).toLocaleString("id-ID")} row</span><div className="button-row"><button className="secondary" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>Previous</button><button className="secondary" disabled={page >= totalPages || loading} onClick={() => load(page + 1)}>Next</button></div></div>
      </div>
    </section>
  );
}
