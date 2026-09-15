import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";

export const runtime = "nodejs";

const AI_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    executive_summary: { type: "string" },
    performance_status: { type: "string", enum: ["HIGH GROWTH","GROWING","STABLE","DECLINING","AT RISK","TOP PERFORMER","INFO"] },
    key_findings: { type: "array", items: { type: "string" } },
    creator_findings: { type: "array", items: { type: "string" } },
    product_findings: { type: "array", items: { type: "string" } },
    trend_findings: { type: "array", items: { type: "string" } },
    anomalies: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    confidence_note: { type: "string" },
  },
  required: ["executive_summary","performance_status","key_findings","creator_findings","product_findings","trend_findings","anomalies","recommendations","confidence_note"],
};

const BASE_PROMPT = `Anda adalah analis bisnis senior untuk Luma Affiliate Intelligence.
Gunakan HANYA dataset workspace yang diberikan. Angka database adalah sumber kebenaran.
Jangan membuat angka, sebab-akibat, atau tren yang tidak didukung data. Jika data tidak cukup,
katakan dengan eksplisit. Gunakan Bahasa Indonesia bisnis profesional, ringkas dan actionable.
Recommendations harus konkret, bisa dijadikan task, dan dapat ditelusuri ke temuan.`;

const ANALYSIS_GUIDE: Record<string,string> = {
  performance: `Fokus PERFORMANCE ANALYSIS: kesehatan KPI keseluruhan, GMV, Qty, Orders, Commission, efisiensi dan kontribusi platform. Bandingkan angka yang tersedia dan jelaskan gap atau kekuatan utama. Jangan mengalihkan fokus menjadi profil creator kecuali diperlukan untuk menjelaskan KPI.`,
  creator: `Fokus CREATOR ANALYSIS: konsentrasi kontribusi creator, top/middle/low contributor, ketergantungan pada creator tertentu, creator yang layak dipertahankan, diaktivasi ulang, atau diuji. Gunakan ranking creator sebagai sumber utama.`,
  product: `Fokus PRODUCT ANALYSIS: SKU/product, GMV, Qty, Orders, kontribusi dan product mix. Bedakan produk penggerak volume vs revenue. Jika SKU granular kosong, nyatakan keterbatasan dan jangan mengarang produk.`,
  trend: `Fokus TREND ANALYSIS: perubahan antar periode/bulan, momentum naik/turun, konsistensi dan seasonality yang benar-benar terlihat pada monthly_trend. Jangan menyebut tren bila hanya ada satu periode.`,
  anomaly: `Fokus ANOMALY DETECTION: cari perubahan ekstrem, outlier, ketidakseimbangan GMV-vs-Orders-vs-Qty, konsentrasi creator/platform, atau periode tidak wajar. Bedakan anomali data vs anomali bisnis dan rekomendasikan verifikasi.`,
  recommendation: `Fokus RECOMMENDATIONS: gabungkan temuan performance, creator, product, trend, dan anomaly menjadi prioritas tindakan. Urutkan rekomendasi berdasarkan dampak dan urgensi. Setiap recommendation harus bisa langsung dijadikan item Kanban.`,
};

function extractOutputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output || []) for (const content of item?.content || []) if (content?.type === "output_text" && content?.text) return content.text;
  return "";
}

export async function POST(req: NextRequest) {
  const started = Date.now(); let ctx: Awaited<ReturnType<typeof getServerContext>> | null = null;
  const runId = `AI-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  try {
    const body = await req.json();
    const workspaceId = String(body.workspace_id || "");
    const analysisType = String(body.analysis_type || "performance");
    const context = body.context || {};
    const start = body.start_date ? String(body.start_date) : "";
    const end = body.end_date ? String(body.end_date) : "";
    if (!workspaceId) return NextResponse.json({ok:false,error:"workspace_id required"},{status:400});
    ctx = await getServerContext(workspaceId);

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-5-mini";
    if (!apiKey) return NextResponse.json({ ok: false, error: "AI belum aktif: OPENAI_API_KEY belum tersedia di environment Vercel." }, { status: 503 });

    await ctx.admin.from("ai_analysis_runs").insert({ workspace_id: workspaceId, run_id: runId, analysis_type: analysisType, start_date: start || null, end_date: end || null, dataset_version: "supabase-production", input_hash: "", model, status: "Processing", created_at: new Date().toISOString(), created_by: ctx.user.id });

    const instructions = `${BASE_PROMPT}\n\n${ANALYSIS_GUIDE[analysisType] || ANALYSIS_GUIDE.performance}\n\nOutput recommendations sebagai kalimat tindakan yang singkat. Isi field yang bukan fokus hanya jika dataset benar-benar mendukungnya; jika tidak, gunakan array kosong.`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, instructions, input: JSON.stringify({ analysis_type: analysisType, context }), text: { format: { type: "json_schema", name: "luma_ai_analysis", schema: AI_SCHEMA, strict: true } }, store: false }),
    });
    const raw = await response.json();
    if (!response.ok) throw new Error(raw?.error?.message || `OpenAI request failed (${response.status})`);
    const outputText = extractOutputText(raw); if (!outputText) throw new Error("Respons AI kosong."); const result = JSON.parse(outputText);

    await ctx.admin.from("ai_analysis_runs").update({ status: "Success", response_id: raw?.id || null, error_message: null }).eq("workspace_id", workspaceId).eq("run_id", runId);
    await ctx.admin.from("ai_insights").insert({ workspace_id: workspaceId, run_id: runId, insight_json: result, created_at: new Date().toISOString() });
    await ctx.admin.from("ai_analysis_logs").insert({ workspace_id: workspaceId, run_id: runId, event: "completed", details: { duration_ms: Date.now() - started, model, analysis_type: analysisType }, created_at: new Date().toISOString() });
    return NextResponse.json({ ok: true, run_id: runId, model, result });
  } catch (error: any) {
    if (ctx) { try { await ctx.admin.from("ai_analysis_runs").update({ status: "Error", error_message: error?.message || "AI analysis failed" }).eq("run_id", runId); } catch {} }
    return NextResponse.json({ ok: false, error: error?.message || "AI analysis failed." }, { status: 400 });
  }
}
