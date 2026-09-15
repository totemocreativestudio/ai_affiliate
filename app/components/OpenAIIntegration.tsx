"use client";

import { useEffect, useState } from "react";

type Props = { workspaceId: string };

export default function OpenAIIntegration({ workspaceId }: Props) {
  const [configured, setConfigured] = useState(false);
  const [source, setSource] = useState("none");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Memeriksa integrasi OpenAI...");

  async function check() {
    setBusy(true);
    try {
      const r = await fetch(`/api/integrations/openai?workspace_id=${encodeURIComponent(workspaceId)}`);
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Gagal membaca status OpenAI.");
      setConfigured(Boolean(d.configured));
      setSource(d.source || "none");
      setStatus(d.configured ? "OpenAI API aktif dan siap digunakan oleh AI Analytics serta AI Promo Studio." : "OpenAI API belum dikonfigurasi.");
    } catch (e: any) {
      setStatus(e?.message || "Gagal membaca status OpenAI.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void check(); }, [workspaceId]);

  async function save() {
    if (!apiKey.trim()) return setStatus("Masukkan OpenAI API key terlebih dahulu.");
    setBusy(true);
    setStatus("Menyimpan API key secara aman...");
    try {
      const r = await fetch("/api/integrations/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, api_key: apiKey.trim() }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Gagal menyimpan OpenAI API key.");
      setApiKey("");
      setConfigured(true);
      setSource(d.source || "secure-vault");
      setStatus("OpenAI API berhasil terhubung. Key disimpan server-side dan tidak ditampilkan kembali ke browser.");
    } catch (e: any) {
      setStatus(e?.message || "Gagal menyimpan OpenAI API key.");
    } finally {
      setBusy(false);
    }
  }

  return <section id="openai-integration" className="legacy-page-anchor">
    <div className="eyebrow">ADMINISTRATION · AI INTEGRATION</div>
    <h1>OpenAI Integration</h1>
    <p className="muted">Satu API key platform digunakan server-side untuk AI Analytics dan AI Promo Studio. Key tidak disimpan di source code atau local storage.</p>
    <div className="card integration-status-card">
      <div className="section-head">
        <div><h3>Connection Status</h3><p className="muted">{status}</p></div>
        <span className={`integration-badge ${configured ? "connected" : "disconnected"}`}>{configured ? "Connected" : "Not Connected"}</span>
      </div>
      <div className="integration-meta"><span>Storage</span><strong>{source === "vercel" ? "Vercel Environment" : source === "secure-vault" ? "Supabase Vault" : "Not configured"}</strong></div>
    </div>
    <div className="card">
      <h3>{configured ? "Replace API Key" : "Connect OpenAI API"}</h3>
      <p className="muted">Paste key hanya di sini. Setelah disimpan, LUMA hanya menampilkan status koneksi, bukan isi key.</p>
      <div className="secret-input-row">
        <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="sk-..." autoComplete="off" />
        <button className="primary" disabled={busy || !apiKey.trim()} onClick={save}>{busy ? "Saving..." : configured ? "Replace Key" : "Connect API"}</button>
        <button className="secondary" disabled={busy} onClick={check}>Test Status</button>
      </div>
    </div>
  </section>;
}
