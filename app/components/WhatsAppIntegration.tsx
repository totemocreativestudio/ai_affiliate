"use client";

import { useEffect, useState } from "react";

type Provider = "flowkirim" | "meta";

type FormState = {
  provider: Provider;
  access_token: string;
  base_url: string;
  device_id: string;
  phone_number_id: string;
  otp_template: string;
  template_language: string;
  graph_version: string;
  channel_url: string;
};

const INITIAL: FormState = {
  provider: "flowkirim",
  access_token: "",
  base_url: "https://scan.flowkirim.com",
  device_id: "",
  phone_number_id: "",
  otp_template: "luma_otp",
  template_language: "id",
  graph_version: "v24.0",
  channel_url: "",
};

export default function WhatsAppIntegration({ workspaceId }: { workspaceId: string }) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [configured, setConfigured] = useState(false);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState("Memeriksa WhatsApp integration...");

  async function load() {
    setBusy(true);
    try {
      const r = await fetch(`/api/integrations/whatsapp?workspace_id=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Gagal membaca WhatsApp integration.");
      const s = d.settings || {};
      const provider: Provider = s.whatsapp_provider === "meta" ? "meta" : "flowkirim";
      setConfigured(Boolean(d.configured));
      setTokenConfigured(Boolean(d.token_configured));
      setForm((f) => ({
        ...f,
        provider,
        access_token: "",
        base_url: s.whatsapp_base_url || "https://scan.flowkirim.com",
        device_id: s.whatsapp_device_id || "",
        phone_number_id: s.whatsapp_phone_number_id || "",
        otp_template: s.whatsapp_otp_template || "luma_otp",
        template_language: s.whatsapp_template_language || "id",
        graph_version: s.whatsapp_graph_version || "v24.0",
        channel_url: s.whatsapp_channel_url || "",
      }));
      setStatus(
        d.configured
          ? `${provider === "flowkirim" ? "FlowKirim" : "Meta WhatsApp Cloud API"} siap digunakan untuk OTP.`
          : d.token_configured
            ? "Token tersimpan, tetapi konfigurasi provider belum lengkap."
            : "WhatsApp provider belum dikonfigurasi."
      );
    } catch (e: any) {
      setStatus(e?.message || "Gagal membaca integration.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, [workspaceId]);

  async function submit(action: "save" | "test") {
    action === "test" ? setTesting(true) : setBusy(true);
    try {
      const r = await fetch("/api/integrations/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, action, ...form }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Gagal menyimpan WhatsApp integration.");
      setConfigured(Boolean(d.configured));
      if (form.access_token) setTokenConfigured(true);
      setForm((f) => ({ ...f, access_token: "" }));
      setStatus(
        action === "test"
          ? `${form.provider === "flowkirim" ? "FlowKirim session" : "WhatsApp provider"} berhasil diverifikasi.`
          : "Integration disimpan. Token tetap server-side dan tidak ditampilkan kembali."
      );
    } catch (e: any) {
      setStatus(e?.message || "Gagal menyimpan integration.");
    } finally {
      setBusy(false);
      setTesting(false);
    }
  }

  const providerReady = form.provider === "flowkirim" ? Boolean(form.device_id.trim()) : Boolean(form.phone_number_id.trim());
  const canTest = providerReady && (tokenConfigured || Boolean(form.access_token.trim()));

  return <div className="owner-integration-card whatsapp-integration-card">
    <div className="owner-integration-heading">
      <div className="owner-service-mark">WA</div>
      <div>
        <h3>WhatsApp OTP</h3>
        <p>Provider dapat menggunakan FlowKirim session API atau Meta WhatsApp Cloud API. Credential tidak pernah ditampilkan kembali.</p>
      </div>
      <span className={`integration-badge ${configured ? "connected" : "disconnected"}`}>{configured ? "Connected" : "Not Connected"}</span>
    </div>

    <div className="owner-form-grid">
      <label>Provider
        <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as Provider })}>
          <option value="flowkirim">FlowKirim</option>
          <option value="meta">Meta WhatsApp Cloud API</option>
        </select>
      </label>
      <label>Access Token
        <input type="password" value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} placeholder={tokenConfigured ? "Tersimpan · kosongkan untuk mempertahankan token" : "Paste token lalu Save"} autoComplete="off" />
      </label>

      {form.provider === "flowkirim" ? <>
        <label>FlowKirim Base URL
          <input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://scan.flowkirim.com" />
        </label>
        <label>Device ID
          <input value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value })} placeholder="ID perangkat dari halaman Perangkat FlowKirim" />
        </label>
      </> : <>
        <label>Phone Number ID
          <input value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} />
        </label>
        <label>OTP Template Name
          <input value={form.otp_template} onChange={(e) => setForm({ ...form, otp_template: e.target.value })} />
        </label>
        <label>Template Language
          <input value={form.template_language} onChange={(e) => setForm({ ...form, template_language: e.target.value })} />
        </label>
        <label>Graph API Version
          <input value={form.graph_version} onChange={(e) => setForm({ ...form, graph_version: e.target.value })} />
        </label>
      </>}

      <label>WhatsApp Channel URL
        <input value={form.channel_url} onChange={(e) => setForm({ ...form, channel_url: e.target.value })} placeholder="Opsional · URL channel komunitas Lumaway" />
      </label>
    </div>

    <div className="owner-checklist">
      <span className={tokenConfigured ? "done" : ""}>Token {tokenConfigured ? "tersimpan" : "belum tersimpan"}</span>
      {form.provider === "flowkirim" && <span className={form.device_id ? "done" : ""}>Device ID {form.device_id ? "siap" : "dibutuhkan"}</span>}
      {form.provider === "meta" && <span className={form.phone_number_id ? "done" : ""}>Phone Number ID {form.phone_number_id ? "siap" : "dibutuhkan"}</span>}
      <span>OTP expiry 5 menit</span>
      <span>Maks. 5 percobaan</span>
    </div>

    <div className="button-row">
      <button className="primary" disabled={busy || (!tokenConfigured && !form.access_token.trim())} onClick={() => submit("save")}>{busy ? "Saving..." : "Save Integration"}</button>
      <button className="secondary" disabled={testing || !canTest} onClick={() => submit("test")}>{testing ? "Testing..." : "Test Connection"}</button>
    </div>
    <p className="muted">{status}</p>
  </div>;
}
