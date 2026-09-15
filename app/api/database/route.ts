import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../lib/server-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspace_id") || "";
    const start = searchParams.get("start") || "";
    const end = searchParams.get("end") || "";
    const platform = searchParams.get("platform") || "";
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(
      100,
      Math.max(10, Number(searchParams.get("page_size") || 50))
    );

    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "workspace_id required" },
        { status: 400 }
      );
    }

    const { admin } = await getServerContext(workspaceId);

    const { data: imports, error: importsError } = await admin
      .from("imports")
      .select(
        "id,import_id,filename,data_type,platform,start_date,end_date,rows_imported,status,imported_at,message"
      )
      .eq("workspace_id", workspaceId)
      .order("imported_at", { ascending: false })
      .limit(50);

    if (importsError) throw importsError;

    let salesQuery = admin
      .from("sales")
      .select(
        "id,data_date,end_date,creator_name,username,platform,channel,sku,product_name,qty,orders,gmv,commission,refund,import_id",
        { count: "exact" }
      )
      .eq("workspace_id", workspaceId)
      .order("data_date", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (start) salesQuery = salesQuery.gte("data_date", start);
    if (end) salesQuery = salesQuery.lte("data_date", end);
    if (platform) salesQuery = salesQuery.eq("platform", platform);

    const { data: sales, count, error: salesError } = await salesQuery;
    if (salesError) throw salesError;

    return NextResponse.json({
      ok: true,
      imports: imports || [],
      sales: sales || [],
      total: count || 0,
      page,
      page_size: pageSize,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Database request failed" },
      { status: 400 }
    );
  }
}
