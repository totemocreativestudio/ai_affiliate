import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { generateReportPdf } from "../../../../lib/simple-pdf";

export const runtime = "nodejs";

async function notify(
  admin: any,
  userId: string,
  workspaceId: string,
  title: string,
  message: string,
  kind: string,
) {
  await admin.from("user_notifications").insert({
    user_id: userId,
    workspace_id: workspaceId,
    title,
    message,
    kind,
    is_read: false,
    action_url: "#ai-analytics",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = String(body.workspace_id || "");
    const reportId = Number(body.report_id || 0);
    const action = String(body.action || "preview");
    const ctx = await getServerContext(workspaceId);

    const { data: report, error } = await ctx.admin
      .from("luma_pdf_reports")
      .select("*")
      .eq("id", reportId)
      .eq("workspace_id", workspaceId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!report) {
      return NextResponse.json({ ok: false, error: "error, terjadi kesalahan." }, { status: 404 });
    }

    if (action === "preview") {
      const { data: charge, error: chargeError } = await ctx.admin.rpc("luma_report_preview", {
        p_report_id: reportId,
        p_user_id: ctx.user.id,
        p_workspace_id: workspaceId,
      });
      if (chargeError) throw chargeError;

      const { data: fresh, error: freshError } = await ctx.admin
        .from("luma_pdf_reports")
        .select(
          "id,title,period_start,period_end,document_json,previewed_at,downloaded_at,download_count,watermark_removed_at,page_count,created_at",
        )
        .eq("id", reportId)
        .single();
      if (freshError) throw freshError;

      if (charge?.charged) {
        await notify(
          ctx.admin,
          ctx.user.id,
          workspaceId,
          "Preview dokumen dibuka",
          "Preview pertama menggunakan 5 token.",
          "document_preview",
        );
      }
      return NextResponse.json({ ok: true, report: fresh, charge });
    }

    if (action === "remove_watermark") {
      const { data: charge, error: chargeError } = await ctx.admin.rpc("luma_report_remove_watermark", {
        p_report_id: reportId,
        p_user_id: ctx.user.id,
        p_workspace_id: workspaceId,
      });
      if (chargeError) throw chargeError;
      return NextResponse.json({ ok: true, charge });
    }

    if (action === "download") {
      const { data: charge, error: chargeError } = await ctx.admin.rpc("luma_report_download", {
        p_report_id: reportId,
        p_user_id: ctx.user.id,
        p_workspace_id: workspaceId,
      });
      if (chargeError) throw chargeError;

      const { data: fresh, error: freshError } = await ctx.admin
        .from("luma_pdf_reports")
        .select("*")
        .eq("id", reportId)
        .single();
      if (freshError) throw freshError;

      const pdf = generateReportPdf(fresh);
      await notify(
        ctx.admin,
        ctx.user.id,
        workspaceId,
        "Dokumen PDF berhasil diunduh",
        "10 token digunakan untuk download dokumen PDF.",
        "document_download",
      );

      const base = String(fresh.file_name || `lumaway-report-${reportId}`)
        .replace(/\.html?$/i, "")
        .replace(/\.pdf$/i, "")
        .replace(/[^a-zA-Z0-9._-]/g, "-");
      const filename = `${base}.pdf`;

      return new Response(pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(pdf.length),
          "Cache-Control": "private, no-store",
          "X-Luma-Token-Cost": String(charge?.cost || 10),
        },
      });
    }

    return NextResponse.json({ ok: false, error: "error, terjadi kesalahan." }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "error, terjadi kesalahan." }, { status: 400 });
  }
}
