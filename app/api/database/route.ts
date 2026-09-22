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
    const productPage = Math.max(1, Number(searchParams.get("product_page") || 1));
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
        "id,data_type,data_date,end_date,creator_name,username,platform,channel,sku,product_name,qty,orders,gmv,commission,refund,refund_qty,clicks,buyers,new_buyers,live_count,video_count,roi,import_id",
        { count: "exact" }
      )
      .eq("workspace_id", workspaceId)
      .in("data_type", ["performance", "sales"])
      .order("data_date", { ascending: false })
      .order("gmv", { ascending: false, nullsFirst: false })
      .order("orders", { ascending: false, nullsFirst: false })
      .order("qty", { ascending: false, nullsFirst: false })
      .order("commission", { ascending: false, nullsFirst: false })
      .order("creator_name", { ascending: true, nullsFirst: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    let productQuery = admin
      .from("sales")
      .select(
        "id,data_type,data_date,end_date,platform,channel,sku,product_code,variant_name,product_name,qty,orders,gmv,commission,refund,refund_qty,clicks,buyers,new_buyers,live_count,video_count,roi,import_id",
        { count: "exact" }
      )
      .eq("workspace_id", workspaceId)
      .eq("data_type", "product_performance")
      .order("data_date", { ascending: false })
      .range((productPage - 1) * pageSize, productPage * pageSize - 1);

    if (start) {
      salesQuery = salesQuery.gte("data_date", start);
      productQuery = productQuery.gte("data_date", start);
    }
    if (end) {
      salesQuery = salesQuery.lte("data_date", end);
      productQuery = productQuery.lte("data_date", end);
    }
    if (platform) {
      salesQuery = salesQuery.eq("platform", platform);
      productQuery = productQuery.eq("platform", platform);
    }

    const summaryPromise = admin.rpc("get_database_affiliate_summary", {
      p_workspace_id: workspaceId,
      p_start_date: start || null,
      p_end_date: end || null,
      p_platform: platform || null,
    });

    const [salesResult, productResult, summaryResult] = await Promise.all([
      salesQuery,
      productQuery,
      summaryPromise,
    ]);
    if (salesResult.error) throw salesResult.error;
    if (productResult.error) throw productResult.error;
    if (summaryResult.error) throw summaryResult.error;

    return NextResponse.json({
      ok: true,
      imports: imports || [],
      sales: salesResult.data || [],
      total: salesResult.count || 0,
      affiliate_summary: summaryResult.data?.[0] || {
        total_rows: 0,
        active_rows: 0,
        zero_rows: 0,
        total_qty: 0,
        total_orders: 0,
        total_gmv: 0,
        total_commission: 0,
      },
      product_performance: productResult.data || [],
      product_total: productResult.count || 0,
      page,
      product_page: productPage,
      page_size: pageSize,
      default_sort: "date_desc_activity_desc",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Database request failed" },
      { status: 400 }
    );
  }
}
