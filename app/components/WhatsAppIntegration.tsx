"use client";

import { useEffect, useState } from "react";

type Provider = "flowkirim" | "meta" | "convia";

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
  convia_api_key: string;
  convia_base_url: string;
  convia_otp_template: string;
  convia_phone_number_id: string;
  failover_enabled: boolean;
  provider_order: string;
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
  convia_api_key: "",
  convia_base_url: "https://api.convia.id/api/v1/public",
  convia_otp_template: "luma_otp",
  convia_phone_number_id: "",
  failover_enabled: true,
  provider_order: "flowkirim,convia,meta",
};

const providerLabel = (provider: Provider) =>
  provider === "flowkirim" ? "FlowKirim" : provider === "convia" ? "Convia" : "Meta WhatsApp Cloud API";

export default function WhatsAppIntegration({ workspaceId }: { workspaceId: string }) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [configured, setConfigured] = useState(false);
  const [whatsappTokenConfigured, setWhatsappTokenConfigured] = useState(false);
  const [conviaTokenConfigured, setConviaTokenConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [status, setStatus] = useState("Memeriksa WhatsApp integration...");

  async function load() {
    setBusy(true);
    try {
      const r = await fetch(`/api/integrations/whatsapp?workspace_id=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Gagal membaca WhatsApp integration.");
      const s = d.settings || {};
      const provider: Provider = s.whatsapp_provider === "meta" ? "meta" : s.whatsapp_provider === "convia" ? "convia" : "flowkirim";
      setConfigured(Boolean(d.configured));
      setWhatsappTokenConfigured(Boolean(d.whatsapp_token_configured));
      setConviaTokenConfigured(Boolean(d.convia_token_configured));
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
        convia_api_key: "",
        convia_base_url: s.convia_base_url || "https://api.convia.id/api/v1/public",
        convia_otp_template: s.convia_otp_template || "luma_otp",
        convia_phone_number_id: s.convia_phone_number_id || "",
        failover_enabled: String(s.whatsapp_failover_enabled || "true") !== "false",
        provider_order: s.whatsapp_provider_order || "flowkirim,convia,meta",
      }));
      setStatus(
        d.configured
          ? `${providerLabel(provider)} siap digunakan.`
          : d.token_configured
            ? "Credential tersimpan, tetapi konfigurasi provider belum lengkap."
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
        body: JSON.stringify({ workspace_id: workspaceId, action, test_phone: action === "test" ? testPhone.trim() : "", failover_enabled: form.failover_enabled, provider_order: form.provider_order, ...form }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Gagal menyimpan WhatsApp integration.");
      setConfigured(Boolean(d.configured));
      if (form.access_token) setWhatsappTokenConfigured(true);
      if (form.convia_api_key) setConviaTokenConfigured(true);
      setForm((f) => ({ ...f, access_token: "", convia_api_key: "" }));
      if (action === "test" && form.provider === "convia" && d.test) {
        const price = d.test.unit_price != null ? ` · verify ${d.test.currency || "IDR"} ${d.test.unit_price}` : "";
        const balance = d.test.balance != null ? ` · balance ${d.test.balance}` : "";
        setStatus(`Convia berhasil diverifikasi${price}${balance}.`);
      } else if (action === "test" && form.provider === "flowkirim" && d.test?.delivery_test) {
        setStatus(`FlowKirim session aktif dan test message berhasil dikirim${d.test.delivery_reference ? ` · ref ${d.test.delivery_reference}` : ""}.`);
      } else {
        setStatus(action === "test" ? `${providerLabel(form.provider)} berhasil diverifikasi.` : "Integration disimpan. Credential tetap server-side dan tidak ditampilkan kembali.");
      }
    } catch (e: any) {
      setStatus(e?.message || "Gagal menyimpan integration.");
    } finally {
      setBusy(false);
      setTesting(false);
    }
  }

  const activeTokenConfigured = form.provider === "convia" ? conviaTokenConfigured : whatsappTokenConfigured;
  const activeNewToken = form.provider === "convia" ? Boolean(form.convia_api_key.trim()) : Boolean(form.access_token.trim());
  const providerReady = form.provider === "flowkirim"
    ? Boolean(form.device_id.trim())
    : form.provider === "meta"
      ? Boolean(form.phone_number_id.trim())
      : Boolean(form.convia_otp_template.trim());
  const canTest = providerReady && (activeTokenConfigured || activeNewToken);

  return <div className="owner-integration-card whatsapp-integration-card">
    <div className="owner-integration-heading">
      <div className="owner-service-mark">WA</div>
      <div>
        <h3>WhatsApp CRM & OTP</h3>
        <p>FlowKirim, Convia, atau Meta dapat dipilih sebagai provider OTP. Convia juga tersedia untuk CRM: promosi, informasi, pembayaran, utility template, media, dan customer messaging.</p>
      </div>
      <span className={`integration-badge ${configured ? "connected" : "disconnected"}`}>{configured ? "Connected" : "Not Connected"}</span>
    </div>

    <div className="owner-form-grid">
      <label>Provider OTP
        <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as Provider })}>
          <option value="flowkirim">FlowKirim</option>
          <option value="convia">Convia</option>
          <option value="meta">Meta WhatsApp Cloud API</option>
        </select>
      </label>

      {form.provider === "convia" ? <>
        <label>Convia API Key
          <input type="password" value={form.convia_api_key} onChange={(e) => setForm({ ...form, convia_api_key: e.target.value })} placeholder={conviaTokenConfigured ? "Tersimpan · kosongkan untuk mempertahankan key" : "Paste Convia API key lalu Save"} autoComplete="off" />
        </label>
        <label>Convia Base URL
          <input value={form.convia_base_url} onChange={(e) => setForm({ ...form, convia_base_url: e.target.value })} placeholder="https://api.convia.id/api/v1/public" />
        </label>
        <label>OTP Authentication Template
          <input value={form.convia_otp_template} onChange={(e) => setForm({ ...form, convia_otp_template: e.target.value })} placeholder="luma_otp" />
        </label>
        <label>Convia WhatsApp Phone Number ID
          <input value={form.convia_phone_number_id} onChange={(e) => setForm({ ...form, convia_phone_number_id: e.target.value })} placeholder="Opsional untuk akun multi-number" />
        </label>
      </> : <>
        <label>Access Token
          <input type="password" value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} placeholder={whatsappTokenConfigured ? "Tersimpan · kosongkan untuk mempertahankan token" : "Paste token lalu Save"} autoComplete="off" />
        </label>

        {form.provider === "flowkirim" ? <>
          <label>FlowKirim Base URL
            <input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://scan.flowkirim.com" />
          </label>
          <label>Device ID
            <input value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value })} placeholder="ID perangkat dari halaman Perangkat FlowKirim" />
          </label>
          <label>Nomor Test Delivery
            <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="08... · opsional saat Test Connection" />
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
      </>}

      <label>Automatic Failover
        <select value={form.failover_enabled?"on":"off"} onChange={(e)=>setForm({...form,failover_enabled:e.target.value==="on"})}><option value="on">ON · switch provider saat gagal</option><option value="off">OFF · provider utama saja</option></select>
      </label>
      <label>Provider Order
        <input value={form.provider_order} onChange={(e)=>setForm({...form,provider_order:e.target.value})} placeholder="flowkirim,convia,meta" />
      </label>
      <label>WhatsApp Channel URL
        <input value={form.channel_url} onChange={(e) => setForm({ ...form, channel_url: e.target.value })} placeholder="Opsional · URL channel komunitas Lumaway" />
      </label>
    </div>

    <div className="owner-checklist">
      <span className={activeTokenConfigured ? "done" : ""}>Credential {activeTokenConfigured ? "tersimpan" : "belum tersimpan"}</span>
      {form.provider === "flowkirim" && <span className={form.device_id ? "done" : ""}>Device ID {form.device_id ? "siap" : "dibutuhkan"}</span>}
      {form.provider === "meta" && <span className={form.phone_number_id ? "done" : ""}>Phone Number ID {form.phone_number_id ? "siap" : "dibutuhkan"}</span>}
      {form.provider === "convia" && <span className={form.convia_otp_template ? "done" : ""}>Authentication template {form.convia_otp_template ? "siap" : "dibutuhkan"}</span>}
      {form.provider === "convia" && <span>CRM API aktif untuk text, media, template & transactional messaging</span>}
      <span className={form.failover_enabled?"done":""}>Auto failover {form.failover_enabled?"aktif":"nonaktif"} · {form.provider_order}</span>
            <span>OTP expiry 5 menit</span>
      <span>Maks. 5 percobaan</span>
    </div>

    <div className="button-row">
      <button className="primary" disabled={busy || (!activeTokenConfigured && !activeNewToken)} onClick={() => submit("save")}>{busy ? "Saving..." : "Save Integration"}</button>
      <button className="secondary" disabled={testing || !canTest} onClick={() => submit("test")}>{testing ? "Testing..." : "Test Connection"}</button>
    </div>
    <p className="muted">{status}</p>
  </div>;
}
