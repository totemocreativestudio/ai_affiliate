import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret, hasServerSecret } from "../../../../lib/server-secrets";

export const runtime = "nodejs";

const SECRET_NAME = "luma_whatsapp_access_token";
const KEYS = [
  "whatsapp_provider",
  "whatsapp_base_url",
  "whatsapp_device_id",
  "whatsapp_phone_number_id",
  "whatsapp_otp_template",
  "whatsapp_template_language",
  "whatsapp_graph_version",
  "whatsapp_channel_url",
];

async function getSettings(admin: any) {
  const { data } = await admin
    .from("luma_platform_settings")
    .select("setting_key,setting_value")
    .in("setting_key", KEYS);
  const saved = Object.fromEntries((data || []).map((x: any) => [x.setting_key, x.setting_value || ""]));
  return {
    whatsapp_provider: process.env.WHATSAPP_PROVIDER || saved.whatsapp_provider || "flowkirim",
    whatsapp_base_url: process.env.WHATSAPP_BASE_URL || saved.whatsapp_base_url || "https://scan.flowkirim.com",
    whatsapp_device_id: process.env.WHATSAPP_DEVICE_ID || saved.whatsapp_device_id || "",
    whatsapp_phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || saved.whatsapp_phone_number_id || "",
    whatsapp_otp_template: process.env.WHATSAPP_OTP_TEMPLATE || saved.whatsapp_otp_template || "luma_otp",
    whatsapp_template_language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || saved.whatsapp_template_language || "id",
    whatsapp_graph_version: process.env.WHATSAPP_GRAPH_VERSION || saved.whatsapp_graph_version || "v24.0",
    whatsapp_channel_url: process.env.WHATSAPP_CHANNEL_URL || saved.whatsapp_channel_url || "",
  };
}

async function testFlowKirim(token: string, baseUrl: string, deviceId: string) {
  if (!deviceId) throw new Error("FlowKirim Device ID belum diisi.");
  const r = await fetch(`${baseUrl.replace(/\/$/, "")}/api/whatsapp/sessions/${encodeURIComponent(deviceId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const raw = await r.json().catch(() => ({}));
  if (!r.ok || !raw?.success || !raw?.data?.session_id) {
    throw new Error(raw?.message || `FlowKirim session tidak aktif (${r.status}).`);
  }
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId = new URL(req.url).searchParams.get("workspace_id") || "";
    const ctx = await getServerContext(workspaceId);
    const settings = await getSettings(ctx.admin);
    const tokenConfigured = await hasServerSecret(ctx.admin, SECRET_NAME);
    const providerReady = settings.whatsapp_provider === "flowkirim"
      ? Boolean(settings.whatsapp_device_id)
      : Boolean(settings.whatsapp_phone_number_id);
    return NextResponse.json({
      ok: true,
      configured: tokenConfigured && providerReady,
      token_configured: tokenConfigured,
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
    if (accessToken) {
      const { error } = await ctx.admin.rpc("luma_set_server_secret", {
        p_name: SECRET_NAME,
        p_secret: accessToken,
        p_description: "Lumaway WhatsApp provider access token",
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
    };

    for (const [setting_key, setting_value] of Object.entries(values)) {
      const { error } = await ctx.admin.from("luma_platform_settings").upsert(
        { setting_key, setting_value, updated_at: new Date().toISOString(), updated_by: ctx.user.id },
        { onConflict: "setting_key" }
      );
      if (error) throw error;
    }

    const token = accessToken || await getServerSecret(ctx.admin, SECRET_NAME);
    if (String(body.action || "") === "test") {
      if (!token) throw new Error("WhatsApp access token belum dikonfigurasi.");
      if (values.whatsapp_provider === "flowkirim") {
        await testFlowKirim(token, values.whatsapp_base_url, values.whatsapp_device_id);
      }
    }

    const ready = Boolean(token) && (values.whatsapp_provider === "flowkirim"
      ? Boolean(values.whatsapp_device_id)
      : Boolean(values.whatsapp_phone_number_id));

    return NextResponse.json({ ok: true, configured: ready, provider: values.whatsapp_provider });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unable to save WhatsApp integration." }, { status: 400 });
  }
}
