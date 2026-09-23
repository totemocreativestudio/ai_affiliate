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
      .from("creators")
      .select("id,creator_code,name,username,platform,affiliate_id,phone,payment_type,ratecard,status")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending:true, nullsFirst:false })
      .limit(limit);

    if (q) {
      const safe = q.replace(/[,%()]/g, " ").trim();
      query = query.or(
        `name.ilike.%${safe}%,username.ilike.%${safe}%,creator_code.ilike.%${safe}%,affiliate_id.ilike.%${safe}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok:true, results:data || [] });
  } catch (error:any) {
    return NextResponse.json({ ok:false, error:error?.message || "Creator search failed." }, { status:400 });
  }
}
