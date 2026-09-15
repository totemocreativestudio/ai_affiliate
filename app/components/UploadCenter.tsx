"use client";

import { useMemo, useState } from "react";

declare global { interface Window { XLSX?: any; } }
type Props = { workspaceId: string };

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; } else if (ch === "," && !quoted) { row.push(cell); cell = ""; } else if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); if (row.some((x) => x !== "")) rows.push(row); row = []; cell = ""; } else cell += ch; }
  row.push(cell); if (row.some((x) => x !== "")) rows.push(row);
  const headers = (rows.shift() || []).map((x) => x.trim());
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h || `Column ${i + 1}`, r[i] ?? ""])));
}

async function loadXlsx() {
  if (window.XLSX) return window.XLSX;
  await new Promise<void>((resolve, reject) => { const s = document.createElement("script"); s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error("Gagal memuat parser XLSX.")); document.head.appendChild(s); });
  return window.XLSX;
}

async function fileHash(buffer: ArrayBuffer) { const hash = await crypto.subtle.digest("SHA-256", buffer); return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join(""); }

export default function UploadCenter({ workspaceId }: Props) {
  const [dataType, setDataType] = useState("performance");
  const [platform, setPlatform] = useState("TikTok");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<any>(null);
  const accept = useMemo(() => ".csv,.xlsx,.xls", []);

  async function parseFile(selected: File) {
    const buffer = await selected.arrayBuffer(); const ext = selected.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") return { rows: parseCsv(new TextDecoder("utf-8").decode(buffer)), buffer };
    const XLSX = await loadXlsx(); const wb = XLSX.read(buffer, { type: "array", cellDates: true }); const first = wb.Sheets[wb.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(first, { defval: "", raw: false }); return { rows, buffer };
  }

  async function submit() {
    if (!file) return setStatus("Pilih file terlebih dahulu.");
    if (startDate && endDate && startDate > endDate) return setStatus("Start Date tidak boleh melewati End Date.");
    setBusy(true); setResult(null);
    try {
      setStatus("Membaca file..."); const parsed = await parseFile(file); if (!parsed.rows.length) throw new Error("File tidak memiliki data.");
      const hash = await fileHash(parsed.buffer); const importId = `IMP-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`; const batchSize = 300; const totalBatches = Math.ceil(parsed.rows.length / batchSize); let last: any = null;
      const effectiveStart = startDate || "2000-01-01";
      const effectiveEnd = endDate || effectiveStart;
      for (let i = 0; i < totalBatches; i++) {
        setStatus(`Import batch ${i + 1}/${totalBatches} · ${parsed.rows.length.toLocaleString("id-ID")} row`);
        const rows = parsed.rows.slice(i * batchSize, (i + 1) * batchSize);
        const r = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: workspaceId, data_type: dataType, platform, start_date: effectiveStart, end_date: effectiveEnd, filename: file.name, file_hash: hash, force_reimport: force, import_id: importId, batch_index: i, total_batches: totalBatches, rows }) });
        last = await r.json(); if (!r.ok || !last.ok) throw new Error(last.error || "Import gagal.");
      }
      setResult(last); setStatus(`Import selesai · ${last?.import_id || importId}`);
    } catch (e: any) { setStatus(e?.message || "Import gagal."); } finally { setBusy(false); }
  }

  return <section id="upload" className="legacy-page-anchor">
    <div className="page-head"><div><div className="eyebrow">DATA & UPLOAD</div><h1>Upload Center</h1><p className="muted">Periode bersifat opsional. Tanggal kosong tampil netral dan untuk file tanpa tanggal digunakan baseline 01/01/2000 agar data tetap valid.</p></div></div>
    <div className="card">
      <div className="grid">
        <label>Jenis Data<select value={dataType} onChange={(e) => setDataType(e.target.value)}><option value="performance">Affiliate Performance</option><option value="sales">Sales / Transaction</option><option value="creators">Master Creator</option><option value="products">Master Product / SKU</option><option value="creator_samples">Creator Samples</option><option value="product_hpp">Product HPP</option></select></label>
        <label>Platform<select value={platform} onChange={(e) => setPlatform(e.target.value)}><option>TikTok</option><option>Shopee</option><option>Instagram</option><option>Other</option></select></label>
        <label>Start Date <span className="field-note">Opsional</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label>End Date <span className="field-note">Opsional</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
      </div>
      <label>File CSV/XLSX<input type="file" accept={accept} onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
      <label className="inline-check"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />Re-import file yang sama untuk mengganti hasil import sebelumnya</label>
      <div className="button-row"><button className="primary" onClick={submit} disabled={busy}>{busy ? "Processing..." : "Validate & Import"}</button></div>
      {status && <div className={`flash ${status.toLowerCase().includes("gagal") || status.toLowerCase().includes("wajib") ? "error" : "success"} upload-status`}>{status}</div>}
      {result?.stats && <div className="kpis import-kpis">{Object.entries(result.stats).map(([k, v]) => <div className="kpi" key={k}><small>{k}</small><b>{Number(v || 0).toLocaleString("id-ID")}</b></div>)}</div>}
    </div>
    <div className="card"><h3>Mapping yang digunakan</h3><ul className="legacy-list"><li><b>TikTok Performance:</b> Creator, GMV, LIVE GMV, Video GMV, Showcase GMV, Refund, Orders, Qty, Buyers, Commission.</li><li><b>Shopee Performance:</b> Affiliate, GMV, Qty, Orders, Clicks, Commission, Buyers.</li><li><b>Sales / Transaction:</b> tanggal, order/item/transaction ID, SKU, produk, Qty, Orders, GMV, Commission, Refund, Channel.</li><li>Jika file punya tanggal transaksi, tanggal file tetap diprioritaskan. Baseline 01/01/2000 hanya fallback untuk file tanpa tanggal.</li></ul></div>
  </section>;
}
