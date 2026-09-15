import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";

export const runtime = "nodejs";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    landing_page: {
      type: "object",
      additionalProperties: false,
      properties: {
        headline: { type: "string" },
        subheadline: { type: "string" },
        problem: { type: "string" },
        solution: { type: "string" },
        benefits: { type: "array", items: { type: "string" } },
        how_it_works: { type: "array", items: { type: "string" } },
        proof: { type: "string" },
        cta: { type: "string" },
      },
      required: ["headline", "subheadline", "problem", "solution", "benefits", "how_it_works", "proof", "cta"],
    },
    reels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          hook: { type: "string" },
          body: { type: "string" },
          cta: { type: "string" },
          caption: { type: "string" },
        },
        required: ["hook", "body", "cta", "caption"],
      },
    },
  },
  required: ["landing_page", "reels"],
};

function outputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) return content.text;
    }
  }
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const workspaceId = String(b.workspace_id || "");
    const ctx = await getServerContext(workspaceId);
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY belum dikonfigurasi di Vercel." }, { status: 503 });
    if (!b.audience || !b.key_points) return NextResponse.json({ ok: false, error: "Target audiens dan poin utama wajib diisi." }, { status: 400 });

    const model = process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-5-mini";
    const prompt = {
      brand: "Luma",
      product_name: b.product_name || "Luma",
      title: b.title || "Materi Promosi Luma",
      audience: b.audience,
      tone: b.tone || "Profesional, modern, mudah dipahami",
      structure: b.structure || "TOFU - MOFU - BOFU",
      key_points: b.key_points,
      instruction: "Buat materi siap copy-paste. Full landing page dan tepat 3 versi mini untuk Reels/video. Hindari klaim yang tidak diberikan.",
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: "Anda adalah Luma AI Promo Studio. Gunakan hanya brief user, jangan membuat klaim atau fitur yang tidak diberikan.",
        input: JSON.stringify(prompt),
        text: { format: { type: "json_schema", name: "luma_promo", schema: SCHEMA, strict: true } },
        store: false,
      }),
    });

    const raw = await response.json();
    if (!response.ok) throw new Error(raw?.error?.message || `OpenAI request failed (${response.status})`);
    const text = outputText(raw);
    const result = JSON.parse(text);
    const now = new Date().toISOString();

    const { data, error } = await ctx.admin
      .from("promo_generations")
      .insert({
        workspace_id: workspaceId,
        user_id: ctx.user.id,
        title: prompt.title,
        product_name: prompt.product_name,
        audience: prompt.audience,
        tone: prompt.tone,
        key_points: prompt.key_points,
        landing_json: JSON.stringify(result.landing_page),
        reels_json: JSON.stringify(result.reels),
        created_at: now,
        updated_at: now,
        status: "saved",
      })
      .select("id")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, id: data.id, model, result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Promo generation failed" }, { status: 400 });
  }
}
