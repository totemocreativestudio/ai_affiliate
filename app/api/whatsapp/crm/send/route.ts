import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../../lib/server-auth";
import { getServerSecret } from "../../../../../lib/server-secrets";
import { conviaSendMessage, DEFAULT_CONVIA_BASE_URL, normalizeConviaPhone } from "../../../../../lib/convia";

export const runtime = "nodejs";

const PURPOSES = new Set(["promotion", "verification", "information", "payment", "utility", "support"]);
const MESSAGE_TYPES = new Set(["text", "image", "document", "audio", "video", "template", "interactive"]);

async function getConviaSettings(admin: any) {
  const keys = ["convia_base_url", "convia_phone_number_id"];
  const { data } = await admin
    .from("luma_platform_settings")
    .select("setting_key,setting_value")
    .in("setting_key", keys);
  const saved = Object.fromEntries((data || []).map((row: any) => [row.setting_key, row.setting_value || ""]));
  return {
    baseUrl: process.env.CONVIA_BASE_URL || saved.convia_base_url || DEFAULT_CONVIA_BASE_URL,
    whatsappPhoneNumberId: process.env.CONVIA_WHATSAPP_PHONE_NUMBER_ID || saved.convia_phone_number_id || "",
  };
}

export async function POST(req: NextRequest) {
  let ctx: any = null;
  let workspaceId = "";
  let purpose = "information";
  try {
    const body = await req.json();
    workspaceId = String(body.workspace_id || "");
    purpose = String(body.purpose || "information").toLowerCase();
    ctx = await getServerContext(workspaceId);
    if (!ctx.canManage) {
      return NextResponse.json({ ok: false, error: "Workspace manager access required." }, { status: 403 });
    }
    if (!PURPOSES.has(purpose)) {
      return NextResponse.json({ ok: false, error: "Purpose CRM tidak valid." }, { status: 400 });
    }

    const phone = normalizeConviaPhone(String(body.phone_number || body.phone || ""));
    if (!/^\+[1-9][0-9]{8,14}$/.test(phone)) {
      return NextResponse.json({ ok: false, error: "Nomor WhatsApp harus menggunakan format E.164, contoh +62812..." }, { status: 400 });
    }

    const messageType = String(body.message_type || "text").toLowerCase();
    if (!MESSAGE_TYPES.has(messageType)) {
      return NextResponse.json({ ok: false, error: "Message type Convia tidak didukung." }, { status: 400 });
    }

    const apiKey = await getServerSecret(ctx.admin, "luma_convia_api_key");
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Convia belum dikonfigurasi oleh owner." }, { status: 503 });
    }
    const cfg = await getConviaSettings(ctx.admin);

    const payload: Record<string, unknown> = {
      channel: "whatsapp",
      message_type: messageType,
      phone_number: phone,
      auto_create_customer: body.auto_create_customer !== false,
    };

    if (cfg.whatsappPhoneNumberId) payload.whatsapp_phone_number_id = cfg.whatsappPhoneNumberId;
    if (body.customer_name) payload.customer_name = String(body.customer_name).slice(0, 160);

    if (messageType === "text") {
      const content = String(body.content || body.message || "").trim();
      if (!content) return NextResponse.json({ ok: false, error: "Content pesan wajib diisi." }, { status: 400 });
      if (content.length > 4096) return NextResponse.json({ ok: false, error: "Pesan WhatsApp maksimal 4096 karakter." }, { status: 400 });
      payload.content = content;
    } else if (["image", "document", "audio", "video"].includes(messageType)) {
      const mediaUrl = String(body.media_url || "").trim();
      if (!/^https:\/\//i.test(mediaUrl)) {
        return NextResponse.json({ ok: false, error: "media_url HTTPS wajib diisi untuk pesan media." }, { status: 400 });
      }
      payload.media_url = mediaUrl;
      if (body.caption) payload.caption = String(body.caption).slice(0, 4096);
      if (messageType === "document" && body.filename) payload.filename = String(body.filename).slice(0, 180);
    } else if (messageType === "template") {
      if (!body.template || typeof body.template !== "object") {
        return NextResponse.json({ ok: false, error: "Template payload wajib diisi." }, { status: 400 });
      }
      payload.template = body.template;
    } else if (messageType === "interactive") {
      if (!body.interactive || typeof body.interactive !== "object") {
        return NextResponse.json({ ok: false, error: "Interactive payload wajib diisi." }, { status: 400 });
      }
      payload.interactive = body.interactive;
    }

    const raw = await conviaSendMessage(apiKey, payload, cfg.baseUrl);
    const data = raw?.data || {};
    await ctx.admin.from("luma_api_usage_events").insert({
      workspace_id: workspaceId,
      user_id: ctx.user.id,
      provider: "convia",
      service: "whatsapp_crm",
      request_type: purpose,
      status: "success",
      reference: data?.message_id || null,
      metadata: {
        message_type: messageType,
        customer_id: data?.customer_id || null,
        status: data?.status || null,
        recipient_last4: phone.slice(-4),
      },
    });

    return NextResponse.json({
      ok: true,
      provider: "convia",
      purpose,
      message_id: data?.message_id || null,
      customer_id: data?.customer_id || null,
      status: data?.status || "sent",
    });
  } catch (error: any) {
    if (ctx) {
      try {
        await ctx.admin.from("luma_api_usage_events").insert({
          workspace_id: workspaceId || null,
          user_id: ctx.user.id,
          provider: "convia",
          service: "whatsapp_crm",
          request_type: purpose,
          status: "error",
          metadata: { error: error?.message || "unknown" },
        });
      } catch {}
    }
    return NextResponse.json({ ok: false, error: error?.message || "Convia CRM send failed." }, { status: 400 });
  }
}
