import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = String(searchParams.get("workspace_id") || "");
    const q = String(searchParams.get("q") || "").trim();
    const limit = Math.min(30, Math.max(5, Number(searchParams.get("limit") || 15)));
    if (!workspaceId) return NextResponse.json({ ok:false, error:"workspace_id required" }, { status:400 });
    const { admin } = await getServerContext(workspaceId);

    let query = admin
      .from("product_master")
      .select("id,sku,product_name,category,selling_price,cost_price,status")
      .eq("workspace_id", workspaceId)
      .order("sku", { ascending:true })
      .limit(limit);

    if (q) {
      const safe = q.replace(/[,%()]/g, " ").trim();
      query = query.or(`sku.ilike.%${safe}%,product_name.ilike.%${safe}%,category.ilike.%${safe}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok:true, results:data || [] });
  } catch (error:any) {
    return NextResponse.json({ ok:false, error:error?.message || "Product search failed." }, { status:400 });
  }
}
