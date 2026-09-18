import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";

export const runtime = "nodejs";

function outputText(raw: any) {
  if (typeof raw?.output_text === "string") return raw.output_text;
  for (const item of raw?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && typeof part?.text === "string") return part.text;
    }
  }
  return "";
}

const whatsappSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "customer_name", "messages"],
        properties: {
          title: { type: "string" },
          customer_name: { type: "string" },
          messages: {
            type: "array",
            minItems: 5,
            maxItems: 10,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["from", "text"],
              properties: {
                from: { type: "string", enum: ["customer", "brand"] },
                text: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["username", "rating", "review", "persona"],
        properties: {
          username: { type: "string" },
          rating: { type: "integer", minimum: 1, maximum: 5 },
          review: { type: "string" },
          persona: { type: "string" },
        },
      },
    },
  },
} as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = String(body.workspace_id || "");
    const kind = String(body.kind || "");
    if (!workspaceId || !["whatsapp", "review"].includes(kind)) {
      return NextResponse.json({ ok: false, error: "error, terjadi kesalahan." }, { status: 400 });
    }

    const ctx = await getServerContext(workspaceId);
    if (ctx.platformAdmin) {
      return NextResponse.json({ ok: false, error: "error, terjadi kesalahan." }, { status: 403 });
    }

    const apiKey = await getServerSecret(ctx.admin, "luma_openai_api_key");
    if (!apiKey) return NextResponse.json({ ok: false, error: "error, terjadi kesalahan." }, { status: 503 });

    const subject = String(body.subject || "").trim().slice(0, 220);
    const audience = String(body.audience || "").trim().slice(0, 220);
    const tone = String(body.tone || "Natural, hangat, conversational").trim().slice(0, 180);
    const keyPoints = String(body.key_points || "").trim().slice(0, 1200);
    if (!subject) return NextResponse.json({ ok: false, error: "Isi produk atau topik terlebih dahulu." }, { status: 400 });

    const model = process.env.LUMA_GENERATOR_MODEL || process.env.OPENAI_MODEL || "gpt-5.4";
    const isWhatsapp = kind === "whatsapp";
    const schema = isWhatsapp ? whatsappSchema : reviewSchema;
    const instructions = isWhatsapp
      ? "Anda membuat 5 contoh percakapan WhatsApp-style untuk materi pemasaran Lumaway. Bahasa Indonesia harus sangat natural, manusiawi, tidak kaku, tidak berlebihan, tidak mengarang klaim faktual yang tidak diberikan, dan tidak boleh terlihat seperti chatbot. Variasikan ritme, panjang kalimat, pilihan kata dan respons. Gunakan percakapan brand-customer yang masuk akal."
      : "Anda membuat 5 contoh template ulasan pemasaran untuk Lumaway. Setiap ulasan harus terdengar manusiawi, natural, tidak berulang, tidak seperti bot, tidak membuat klaim faktual yang tidak diberikan, dan menggunakan gaya pengguna Indonesia yang berbeda-beda. Hindari hiperbola palsu.";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions,
        input: JSON.stringify({
          subject,
          audience: audience || "pengguna umum",
          tone,
          key_points: keyPoints,
          output_count: 5,
        }),
        text: {
          format: {
            type: "json_schema",
            name: isWhatsapp ? "lumaway_whatsapp_generator" : "lumaway_review_generator",
            schema,
            strict: true,
          },
        },
        store: false,
      }),
    });

    const raw = await response.json();
    if (!response.ok) throw new Error();
    const text = outputText(raw);
    const result = JSON.parse(text || "{}");
    const usage = raw?.usage || {};

    await ctx.admin.from("luma_api_usage_events").insert({
      workspace_id: workspaceId,
      user_id: ctx.user.id,
      provider: "openai",
      service: "luma_affiliate_generator",
      request_type: kind,
      model,
      input_tokens: Number(usage.input_tokens || 0),
      output_tokens: Number(usage.output_tokens || 0),
      total_tokens: Number(usage.total_tokens || 0),
      status: "success",
      metadata: { free_for_user: true, item_count: Array.isArray(result.items) ? result.items.length : 0 },
    });

    return NextResponse.json({ ok: true, kind, free: true, items: result.items || [] });
  } catch {
    return NextResponse.json({ ok: false, error: "error, terjadi kesalahan." }, { status: 400 });
  }
}
