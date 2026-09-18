import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret, hasServerSecret } from "../../../../lib/server-secrets";
import { conviaGetVerificationPricing, DEFAULT_CONVIA_BASE_URL } from "../../../../lib/convia";

export const runtime = "nodejs";

const WHATSAPP_SECRET = "luma_whatsapp_access_token";
const CONVIA_SECRET = "luma_convia_api_key";
const KEYS = [
  "whatsapp_provider",
  "whatsapp_base_url",
  "whatsapp_device_id",
  "whatsapp_phone_number_id",
  "whatsapp_otp_template",
  "whatsapp_template_language",
  "whatsapp_graph_version",
  "whatsapp_channel_url",
  "convia_base_url",
  "convia_otp_template",
  "convia_phone_number_id",
];

async function getSettings(admin: any) {
  const { data } = await admin
    .from("luma_platform_settings")
    .select("setting_key,setting_value")
    .in("setting_key", KEYS);
  const saved = Object.fromEntries((data || []).map((x: any) => [x.setting_key, x.setting_value || ""]));
  return {
    whatsapp_provider: process.env.WHATSAPP_PROVIDER || saved.whatsapp_provider || "flowkirim",
    whatsapp_base_url: process.env.WHATSAPP_BASE_URL || process.env.FLOWKIRIM_BASE_URL || saved.whatsapp_base_url || "https://scan.flowkirim.com",
    whatsapp_device_id: process.env.WHATSAPP_DEVICE_ID || process.env.FLOWKIRIM_DEVICE_ID || saved.whatsapp_device_id || "",
    whatsapp_phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || saved.whatsapp_phone_number_id || "",
    whatsapp_otp_template: process.env.WHATSAPP_OTP_TEMPLATE || saved.whatsapp_otp_template || "luma_otp",
    whatsapp_template_language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || saved.whatsapp_template_language || "id",
    whatsapp_graph_version: process.env.WHATSAPP_GRAPH_VERSION || saved.whatsapp_graph_version || "v24.0",
    whatsapp_channel_url: process.env.WHATSAPP_CHANNEL_URL || saved.whatsapp_channel_url || "",
    convia_base_url: process.env.CONVIA_BASE_URL || saved.convia_base_url || DEFAULT_CONVIA_BASE_URL,
    convia_otp_template: process.env.CONVIA_OTP_TEMPLATE || saved.convia_otp_template || "luma_otp",
    convia_phone_number_id: process.env.CONVIA_WHATSAPP_PHONE_NUMBER_ID || saved.convia_phone_number_id || "",
  };
}

async function testFlowKirim(token: string, baseUrl: string, deviceId: string, testPhone = "") {
  if (!deviceId) throw new Error("FlowKirim Device ID belum diisi. Ambil ID perangkat dari menu Perangkat/Devices di dashboard FlowKirim lalu simpan sebagai FLOWKIRIM_DEVICE_ID atau WHATSAPP_DEVICE_ID.");
  const base = baseUrl.replace(/\/$/, "");
  const r = await fetch(`${base}/api/whatsapp/sessions/${encodeURIComponent(deviceId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const raw = await r.json().catch(() => ({}));
  const sessionId = raw?.data?.session_id;
  if (!r.ok || !raw?.success || !sessionId) {
    throw new Error(raw?.message || `FlowKirim session tidak aktif (${r.status}).`);
  }
  const digits = String(testPhone || "").replace(/\D/g, "").replace(/^0/, "62");
  if (!digits) return { ok: true, session_id: sessionId, delivery_test: false };
  if (!/^62[0-9]{8,13}$/.test(digits)) throw new Error("Nomor test FlowKirim tidak valid. Gunakan 08... atau 628...");
  const send = await fetch(`${base}/api/whatsapp/messages/text`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ session_id: sessionId, to: digits, message: "Test koneksi Lumaway OTP berhasil. Pesan ini dikirim dari Admin Dashboard Lumaway." }),
    cache: "no-store",
  });
  const sendRaw = await send.json().catch(() => ({}));
  if (!send.ok || !sendRaw?.success) throw new Error(sendRaw?.message || `FlowKirim test message gagal (${send.status}).`);
  return { ok: true, session_id: sessionId, delivery_test: true, delivery_reference: sendRaw?.data?.message_id || sendRaw?.data?.id || null };
}

async function testMeta(token: string, graphVersion: string, phoneNumberId: string) {
  if (!phoneNumberId) throw new Error("Meta Phone Number ID belum diisi.");
  const r = await fetch(`https://graph.facebook.com/${graphVersion || "v24.0"}/${encodeURIComponent(phoneNumberId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const raw = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(raw?.error?.message || `Meta WhatsApp API tidak dapat diverifikasi (${r.status}).`);
  return { ok: true };
}

async function testConvia(token: string, baseUrl: string) {
  const raw = await conviaGetVerificationPricing(token, baseUrl || DEFAULT_CONVIA_BASE_URL);
  return {
    ok: true,
    unit_price: raw?.data?.unitPrice ?? null,
    currency: raw?.data?.currency ?? null,
    balance: raw?.data?.balance ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId = new URL(req.url).searchParams.get("workspace_id") || "";
    const ctx = await getServerContext(workspaceId);
    const settings = await getSettings(ctx.admin);
    const [whatsappTokenConfigured, conviaTokenConfigured] = await Promise.all([
      hasServerSecret(ctx.admin, WHATSAPP_SECRET),
      hasServerSecret(ctx.admin, CONVIA_SECRET),
    ]);

    const provider = settings.whatsapp_provider;
    const tokenConfigured = provider === "convia" ? conviaTokenConfigured : whatsappTokenConfigured;
    const providerReady = provider === "flowkirim"
      ? Boolean(settings.whatsapp_device_id)
      : provider === "meta"
        ? Boolean(settings.whatsapp_phone_number_id)
        : provider === "convia"
          ? Boolean(settings.convia_otp_template)
          : false;

    return NextResponse.json({
      ok: true,
      configured: tokenConfigured && providerReady,
      token_configured: tokenConfigured,
      whatsapp_token_configured: whatsappTokenConfigured,
      convia_token_configured: conviaTokenConfigured,
      settings,
      can_configure: ctx.platformAdmin,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unable to read WhatsApp integration." }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = String(body.workspace_id || "");
    const ctx = await getServerContext(workspaceId);
    if (!ctx.platformAdmin) {
      return NextResponse.json({ ok: false, error: "Hanya owner yang dapat mengubah WhatsApp integration." }, { status: 403 });
    }

    const accessToken = String(body.access_token || "").trim();
    const conviaApiKey = String(body.convia_api_key || "").trim();

    if (accessToken) {
      const { error } = await ctx.admin.rpc("luma_set_server_secret", {
        p_name: WHATSAPP_SECRET,
        p_secret: accessToken,
        p_description: "Lumaway FlowKirim / Meta WhatsApp provider token",
      });
      if (error) throw error;
    }
    if (conviaApiKey) {
      const { error } = await ctx.admin.rpc("luma_set_server_secret", {
        p_name: CONVIA_SECRET,
        p_secret: conviaApiKey,
        p_description: "Lumaway Convia WhatsApp CRM API key",
      });
      if (error) throw error;
    }

    const values: Record<string, string> = {
      whatsapp_provider: String(body.provider || "flowkirim"),
      whatsapp_base_url: String(body.base_url || "https://scan.flowkirim.com").replace(/\/$/, ""),
      whatsapp_device_id: String(body.device_id || ""),
      whatsapp_phone_number_id: String(body.phone_number_id || ""),
      whatsapp_otp_template: String(body.otp_template || "luma_otp"),
      whatsapp_template_language: String(body.template_language || "id"),
      whatsapp_graph_version: String(body.graph_version || "v24.0"),
      whatsapp_channel_url: String(body.channel_url || ""),
      convia_base_url: String(body.convia_base_url || DEFAULT_CONVIA_BASE_URL).replace(/\/$/, ""),
      convia_otp_template: String(body.convia_otp_template || "luma_otp"),
      convia_phone_number_id: String(body.convia_phone_number_id || ""),
    };

    for (const [setting_key, setting_value] of Object.entries(values)) {
      const { error } = await ctx.admin.from("luma_platform_settings").upsert(
        { setting_key, setting_value, updated_at: new Date().toISOString(), updated_by: ctx.user.id },
        { onConflict: "setting_key" }
      );
      if (error) throw error;
    }

    const whatsappToken = accessToken || await getServerSecret(ctx.admin, WHATSAPP_SECRET);
    const conviaToken = conviaApiKey || await getServerSecret(ctx.admin, CONVIA_SECRET);
    const provider = values.whatsapp_provider;
    let testResult: any = null;

    if (String(body.action || "") === "test") {
      if (provider === "flowkirim") {
        if (!whatsappToken) throw new Error("FlowKirim access token belum dikonfigurasi.");
        testResult = await testFlowKirim(whatsappToken, values.whatsapp_base_url, values.whatsapp_device_id, String(body.test_phone || ""));
      } else if (provider === "meta") {
        if (!whatsappToken) throw new Error("Meta WhatsApp access token belum dikonfigurasi.");
        testResult = await testMeta(whatsappToken, values.whatsapp_graph_version, values.whatsapp_phone_number_id);
      } else if (provider === "convia") {
        if (!conviaToken) throw new Error("Convia API key belum dikonfigurasi.");
        testResult = await testConvia(conviaToken, values.convia_base_url);
      } else {
        throw new Error("Provider WhatsApp tidak dikenal.");
      }
    }

    const activeToken = provider === "convia" ? conviaToken : whatsappToken;
    const providerReady = provider === "flowkirim"
      ? Boolean(values.whatsapp_device_id)
      : provider === "meta"
        ? Boolean(values.whatsapp_phone_number_id)
        : Boolean(values.convia_otp_template);

    return NextResponse.json({
      ok: true,
      configured: Boolean(activeToken) && providerReady,
      provider,
      test: testResult,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unable to save WhatsApp integration." }, { status: 400 });
  }
}
