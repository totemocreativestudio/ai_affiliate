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
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") || 50)));

    if (!workspaceId) return NextResponse.json({ ok:false, error:"workspace_id required" }, { status:400 });

    const { admin } = await getServerContext(workspaceId);

    const { data: imports, error: importsError } = await admin
      .from("imports")
      .select("id,import_id,filename,data_type,platform,start_date,end_date,rows_imported,status,imported_at,message")
      .eq("workspace_id", workspaceId)
      .order("imported_at", { ascending:false })
      .limit(50);
    if (importsError) throw importsError;

    async function latestDate(types:string[]) {
      let q=admin.from("sales")
        .select("data_date")
        .eq("workspace_id",workspaceId)
        .in("data_type",types)
        .not("data_date","is",null)
        .order("data_date",{ascending:false})
        .limit(1);
      if(platform) q=q.eq("platform",platform);
      const x=await q.maybeSingle();
      if(x.error) throw x.error;
      return String(x.data?.data_date||"");
    }

    let salesStart=start, salesEnd=end, productStart=start, productEnd=end;
    if(!start&&!end){
      const [latestAffiliate,latestProduct]=await Promise.all([
        latestDate(["performance","sales"]),
        latestDate(["product_performance"])
      ]);
      salesStart=latestAffiliate;salesEnd=latestAffiliate;
      productStart=latestProduct;productEnd=latestProduct;
    }

    let salesQuery = admin
      .from("sales")
      .select("id,data_type,data_date,end_date,creator_name,username,platform,channel,sku,product_name,qty,orders,gmv,commission,refund,refund_qty,clicks,buyers,new_buyers,live_count,video_count,roi,import_id")
      .eq("workspace_id",workspaceId)
      .in("data_type",["performance","sales"])
      .order("data_date",{ascending:false})
      .order("gmv",{ascending:false,nullsFirst:false})
      .order("orders",{ascending:false,nullsFirst:false})
      .order("qty",{ascending:false,nullsFirst:false})
      .order("commission",{ascending:false,nullsFirst:false})
      .order("creator_name",{ascending:true,nullsFirst:false})
      .range((page-1)*pageSize,page*pageSize-1);

    let productQuery = admin
      .from("sales")
      .select("id,data_type,data_date,end_date,platform,channel,sku,product_code,variant_name,product_name,qty,orders,gmv,commission,refund,refund_qty,clicks,buyers,new_buyers,live_count,video_count,roi,import_id",{count:"planned"})
      .eq("workspace_id",workspaceId)
      .eq("data_type","product_performance")
      .order("data_date",{ascending:false})
      .range((productPage-1)*pageSize,productPage*pageSize-1);

    if(salesStart) salesQuery=salesQuery.gte("data_date",salesStart);
    if(salesEnd) salesQuery=salesQuery.lte("data_date",salesEnd);
    if(productStart) productQuery=productQuery.gte("data_date",productStart);
    if(productEnd) productQuery=productQuery.lte("data_date",productEnd);
    if(platform){salesQuery=salesQuery.eq("platform",platform);productQuery=productQuery.eq("platform",platform)}

    const summaryPromise=admin.rpc("get_database_affiliate_summary",{
      p_workspace_id:workspaceId,
      p_start_date:salesStart||null,
      p_end_date:salesEnd||null,
      p_platform:platform||null
    });

    const [salesResult,productResult,summaryResult]=await Promise.all([salesQuery,productQuery,summaryPromise]);
    if(salesResult.error) throw salesResult.error;
    if(productResult.error) throw productResult.error;
    if(summaryResult.error) throw summaryResult.error;

    const affiliateSummary=summaryResult.data?.[0]||{
      total_rows:0,active_rows:0,zero_rows:0,total_qty:0,total_orders:0,total_gmv:0,total_commission:0
    };

    return NextResponse.json({
      ok:true,
      imports:imports||[],
      sales:salesResult.data||[],
      total:Number(affiliateSummary.total_rows||0),
      affiliate_summary:affiliateSummary,
      product_performance:productResult.data||[],
      product_total:productResult.count||0,
      page,product_page:productPage,page_size:pageSize,
      default_sort:"date_desc_activity_desc",
      effective_range:{
        affiliate:{start:salesStart||null,end:salesEnd||null},
        product:{start:productStart||null,end:productEnd||null},
        automatic:!start&&!end
      }
    });
  } catch (error:any) {
    const message=String(error?.message||"Database request failed");
    const timeout=/statement timeout|canceling statement/i.test(message);
    return NextResponse.json(
      {ok:false,error:timeout?"Query database terlalu berat dan dihentikan otomatis. Gunakan rentang tanggal yang lebih pendek atau coba lagi setelah optimasi selesai.":message},
      {status:timeout?503:400}
    );
  }
}
