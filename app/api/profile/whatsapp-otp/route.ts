import { createHash, randomBytes, randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";
import { conviaSendTemplate, DEFAULT_CONVIA_BASE_URL } from "../../../../lib/convia";

export const runtime = "nodejs";

function normalizePhone(input: string) {
  let s = input.replace(/[^0-9+]/g, "");
  if (s.startsWith("08")) s = "+62" + s.slice(1);
  else if (s.startsWith("62")) s = "+" + s;
  else if (!s.startsWith("+")) s = "+" + s;
  return s;
}

const hash = (code: string, salt: string) =>
  createHash("sha256").update(`${code}:${salt}`).digest("hex");

async function settings(admin: any) {
  const keys = [
    "whatsapp_provider",
    "whatsapp_base_url",
    "whatsapp_device_id",
    "whatsapp_phone_number_id",
    "whatsapp_otp_template",
    "whatsapp_template_language",
    "whatsapp_graph_version",
    "convia_base_url",
    "convia_otp_template",
    "convia_phone_number_id",
  ];
  const { data } = await admin
    .from("luma_platform_settings")
    .select("setting_key,setting_value")
    .in("setting_key", keys);
  const saved = Object.fromEntries((data || []).map((x: any) => [x.setting_key, x.setting_value || ""]));
  return {
    provider: process.env.WHATSAPP_PROVIDER || saved.whatsapp_provider || "flowkirim",
    baseUrl: process.env.WHATSAPP_BASE_URL || saved.whatsapp_base_url || "https://scan.flowkirim.com",
    deviceId: process.env.WHATSAPP_DEVICE_ID || saved.whatsapp_device_id || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || saved.whatsapp_phone_number_id || "",
    template: process.env.WHATSAPP_OTP_TEMPLATE || saved.whatsapp_otp_template || "luma_otp",
    language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || saved.whatsapp_template_language || "id",
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || saved.whatsapp_graph_version || "v24.0",
    conviaBaseUrl: process.env.CONVIA_BASE_URL || saved.convia_base_url || DEFAULT_CONVIA_BASE_URL,
    conviaTemplate: process.env.CONVIA_OTP_TEMPLATE || saved.convia_otp_template || "luma_otp",
    conviaPhoneNumberId: process.env.CONVIA_WHATSAPP_PHONE_NUMBER_ID || saved.convia_phone_number_id || "",
  };
}

async function sendViaFlowKirim(token: string, cfg: any, phone: string, code: string) {
  if (!cfg.deviceId) throw new Error("FlowKirim Device ID belum dikonfigurasi owner.");
  const base = String(cfg.baseUrl || "https://scan.flowkirim.com").replace(/\/$/, "");
  const sessionRes = await fetch(`${base}/api/whatsapp/sessions/${encodeURIComponent(cfg.deviceId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const sessionRaw = await sessionRes.json().catch(() => ({}));
  const sessionId = sessionRaw?.data?.session_id;
  if (!sessionRes.ok || !sessionRaw?.success || !sessionId) {
    throw new Error(sessionRaw?.message || `Session FlowKirim tidak aktif (${sessionRes.status}).`);
  }

  const jid = `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
  const message = `Kode OTP Lumaway Anda: ${code}. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.`;
  const sendRes = await fetch(`${base}/api/whatsapp/messages/text`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ session_id: sessionId, to: jid, message }),
  });
  const sendRaw = await sendRes.json().catch(() => ({}));
  if (!sendRes.ok || !sendRaw?.success) {
    throw new Error(sendRaw?.message || `FlowKirim gagal mengirim OTP (${sendRes.status}).`);
  }
  return { reference: sendRaw?.data?.message_id || sendRaw?.data?.id || null, provider: "flowkirim", sessionId };
}

async function sendViaMeta(token: string, cfg: any, phone: string, code: string) {
  if (!cfg.phoneNumberId) throw new Error("WhatsApp Phone Number ID belum dikonfigurasi owner.");
  const payload = {
    messaging_product: "whatsapp",
    to: phone.replace(/^\+/, ""),
    type: "template",
    template: {
      name: cfg.template || "luma_otp",
      language: { code: cfg.language || "id" },
      components: [{ type: "body", parameters: [{ type: "text", text: code }] }],
    },
  };
  const r = await fetch(`https://graph.facebook.com/${cfg.graphVersion || "v24.0"}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const raw = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(raw?.error?.message || "WhatsApp gagal mengirim OTP.");
  return { reference: raw?.messages?.[0]?.id || null, provider: "meta", sessionId: null };
}

async function sendViaConvia(apiKey: string, cfg: any, phone: string, code: string) {
  const templateName = String(cfg.conviaTemplate || "luma_otp").trim();
  if (!templateName) throw new Error("Convia authentication template belum dikonfigurasi owner.");
  const raw = await conviaSendTemplate(
    apiKey,
    phone,
    {
      name: templateName,
      language: cfg.language || "id",
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: code }],
        },
      ],
    },
    {
      baseUrl: cfg.conviaBaseUrl || DEFAULT_CONVIA_BASE_URL,
      whatsappPhoneNumberId: cfg.conviaPhoneNumberId || undefined,
      autoCreateCustomer: true,
    }
  );
  return {
    reference: raw?.data?.message_id || null,
    provider: "convia",
    sessionId: null,
    customerId: raw?.data?.customer_id || null,
  };
}

export async function POST(req: NextRequest) {
  let ctx: any = null;
  let workspaceId = "";
  let action = "request";
  try {
    const body = await req.json();
    workspaceId = String(body.workspace_id || "");
    action = String(body.action || "request");
    const phone = normalizePhone(String(body.phone || ""));
    ctx = await getServerContext(workspaceId);

    if (!/^\+[1-9][0-9]{8,14}$/.test(phone)) {
      return NextResponse.json({ ok: false, error: "Nomor WhatsApp tidak valid. Gunakan format +62812..." }, { status: 400 });
    }

    if (action === "request") {
      const cfg = await settings(ctx.admin);
      const accessToken = cfg.provider === "convia"
        ? await getServerSecret(ctx.admin, "luma_convia_api_key")
        : await getServerSecret(ctx.admin, "luma_whatsapp_access_token");
      if (!accessToken) {
        return NextResponse.json({ ok: false, error: `${cfg.provider === "convia" ? "Convia" : "WhatsApp"} OTP belum dikonfigurasi oleh owner.` }, { status: 503 });
      }

      const code = String(randomInt(100000, 1000000));
      const salt = randomBytes(16).toString("hex");
      await ctx.admin
        .from("luma_otp_challenges")
        .delete()
        .eq("user_id", ctx.user.id)
        .eq("channel", "whatsapp")
        .is("used_at", null);
      const { error: dbError } = await ctx.admin.from("luma_otp_challenges").insert({
        user_id: ctx.user.id,
        channel: "whatsapp",
        target: phone,
        code_hash: hash(code, salt),
        salt,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      if (dbError) throw dbError;

      const sent = cfg.provider === "meta"
        ? await sendViaMeta(accessToken, cfg, phone, code)
        : cfg.provider === "convia"
          ? await sendViaConvia(accessToken, cfg, phone, code)
          : await sendViaFlowKirim(accessToken, cfg, phone, code);

      await ctx.admin.from("luma_api_usage_events").insert({
        workspace_id: workspaceId,
        user_id: ctx.user.id,
        provider: sent.provider,
        service: "whatsapp",
        request_type: "otp_send",
        status: "success",
        reference: sent.reference,
        metadata: {
          provider: sent.provider,
          template: sent.provider === "convia" ? cfg.conviaTemplate : cfg.template,
          session_id: sent.sessionId,
          customer_id: "customerId" in sent ? sent.customerId : null,
        },
      });
      return NextResponse.json({ ok: true, expires_in: 300, provider: sent.provider });
    }

    if (action === "verify") {
      const code = String(body.otp || "").trim();
      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json({ ok: false, error: "OTP harus 6 digit." }, { status: 400 });
      }
      const { data: challenge, error } = await ctx.admin
        .from("luma_otp_challenges")
        .select("*")
        .eq("user_id", ctx.user.id)
        .eq("channel", "whatsapp")
        .eq("target", phone)
        .is("used_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!challenge) return NextResponse.json({ ok: false, error: "OTP tidak ditemukan. Minta kode baru." }, { status: 400 });
      if (new Date(challenge.expires_at).getTime() < Date.now()) {
        return NextResponse.json({ ok: false, error: "OTP kedaluwarsa. Minta kode baru." }, { status: 400 });
      }
      if (Number(challenge.attempts) >= 5) {
        return NextResponse.json({ ok: false, error: "Terlalu banyak percobaan. Minta OTP baru." }, { status: 429 });
      }
      const valid = hash(code, String(challenge.salt || "")) === challenge.code_hash;
      await ctx.admin
        .from("luma_otp_challenges")
        .update({ attempts: Number(challenge.attempts || 0) + 1, used_at: valid ? new Date().toISOString() : null })
        .eq("id", challenge.id);
      if (!valid) return NextResponse.json({ ok: false, error: "OTP salah." }, { status: 400 });

      const { error: authError } = await ctx.admin.auth.admin.updateUserById(ctx.user.id, { phone });
      if (authError) throw authError;
      const now = new Date().toISOString();
      const { error: profileError } = await ctx.admin.from("profiles").update({
        phone,
        whatsapp: phone,
        phone_verified_at: now,
        whatsapp_opt_in: true,
        whatsapp_opt_in_at: now,
        updated_at: now,
      }).eq("id", ctx.user.id);
      if (profileError) throw profileError;
      return NextResponse.json({ ok: true, phone });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    if (ctx) {
      try {
        await ctx.admin.from("luma_api_usage_events").insert({
          workspace_id: workspaceId || null,
          user_id: ctx.user.id,
          provider: "whatsapp",
          service: "whatsapp",
          request_type: action,
          status: "error",
          metadata: { error: error?.message || "unknown" },
        });
      } catch {}
    }
    return NextResponse.json({ ok: false, error: error?.message || "WhatsApp OTP failed." }, { status: 400 });
  }
}
