import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";

export const runtime = "nodejs";

const AI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    executive_summary: { type: "string" },
    performance_status: {
      type: "string",
      enum: [
        "HIGH GROWTH",
        "GROWING",
        "STABLE",
        "DECLINING",
        "AT RISK",
        "TOP PERFORMER",
        "INFO",
      ],
    },
    key_findings: { type: "array", items: { type: "string" } },
    creator_findings: { type: "array", items: { type: "string" } },
    product_findings: { type: "array", items: { type: "string" } },
    trend_findings: { type: "array", items: { type: "string" } },
    anomalies: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    confidence_note: { type: "string" },
  },
  required: [
    "executive_summary",
    "performance_status",
    "key_findings",
    "creator_findings",
    "product_findings",
    "trend_findings",
    "anomalies",
    "recommendations",
    "confidence_note",
  ],
};

const SYSTEM_PROMPT = `Anda adalah analis bisnis senior untuk Luma Affiliate Intelligence.
Gunakan HANYA data agregat yang diberikan. Angka backend adalah sumber kebenaran.
Jangan membuat angka baru, jangan mengarang sebab-akibat, dan jangan mengklaim tren
yang tidak didukung data. Tulis Bahasa Indonesia bisnis yang profesional, ringkas,
jelas, dan mudah dipahami manager. Gunakan istilah GMV, Qty Paid, Orders, Komisi,
Creator Aktif, Top Creator, Middle Creator, Low Creator. Jika data tidak cukup,
katakan "Data belum cukup untuk menyimpulkan..." dan jangan memaksakan analisis.
Setiap rekomendasi harus dapat ditelusuri ke temuan yang tersedia.`;

function extractOutputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) return content.text;
    }
  }
  return "";
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  let ctx: Awaited<ReturnType<typeof getServerContext>> | null = null;
  const runId = `AI-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  try {
    const body = await req.json();
    const workspaceId = String(body.workspace_id || "");
    const analysisType = String(body.analysis_type || "performance");
    const context = body.context || {};
    const start = String(body.start_date || "");
    const end = String(body.end_date || "");

    ctx = await getServerContext(workspaceId);

    const apiKey = process.env.OPENAI_API_KEY;
    const model =
      process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-5-mini";
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY belum dikonfigurasi di Vercel." },
        { status: 503 }
      );
    }

    await ctx.admin.from("ai_analysis_runs").insert({
      workspace_id: workspaceId,
      run_id: runId,
      analysis_type: analysisType,
      start_date: start || null,
      end_date: end || null,
      dataset_version: "supabase-production",
      input_hash: "",
      model,
      status: "Processing",
      created_at: new Date().toISOString(),
      created_by: ctx.user.id,
    });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: SYSTEM_PROMPT,
        input: JSON.stringify({ analysis_type: analysisType, context }),
        text: {
          format: {
            type: "json_schema",
            name: "luma_ai_analysis",
            schema: AI_SCHEMA,
            strict: true,
          },
        },
        store: false,
      }),
    });

    const raw = await response.json();
    if (!response.ok) {
      throw new Error(
        raw?.error?.message || `OpenAI request failed (${response.status})`
      );
    }

    const outputText = extractOutputText(raw);
    if (!outputText) throw new Error("Respons AI kosong.");
    const result = JSON.parse(outputText);

    await ctx.admin
      .from("ai_analysis_runs")
      .update({
        status: "Success",
        response_id: raw?.id || null,
        error_message: null,
      })
      .eq("workspace_id", workspaceId)
      .eq("run_id", runId);

    await ctx.admin.from("ai_insights").insert({
      workspace_id: workspaceId,
      run_id: runId,
      insight_json: JSON.stringify(result),
      created_at: new Date().toISOString(),
    });

    await ctx.admin.from("ai_analysis_logs").insert({
      workspace_id: workspaceId,
      run_id: runId,
      event: "completed",
      details: JSON.stringify({ duration_ms: Date.now() - started, model }),
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, run_id: runId, model, result });
  } catch (error: any) {
    if (ctx) {
      try {
        await ctx.admin
          .from("ai_analysis_runs")
          .update({
            status: "Error",
            error_message: error?.message || "AI analysis failed",
          })
          .eq("run_id", runId);
      } catch {}
    }
    return NextResponse.json(
      { ok: false, error: error?.message || "AI analysis failed." },
      { status: 400 }
    );
  }
}
