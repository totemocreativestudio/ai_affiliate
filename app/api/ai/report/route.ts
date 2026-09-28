import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";

export const runtime="nodejs";

type AnyRow=Record<string,any>;

function cleanList(...values:any[]){
  const items=values.flatMap(value=>Array.isArray(value)?value:[]).map(value=>String(value||"").trim()).filter(Boolean);
  return [...new Set(items)].slice(0,8);
}

function text(value:any,fallback="Data tersedia pada visual periode ini."){
  const result=String(value||"").trim();
  return result||fallback;
}

function page(page_number:number,title:string,subtitle:string,visual_key:string,sections:any[],bullets:string[]=[],callout=""){
  return {page_number,title,subtitle,visual_key,sections,bullets,callout};
}

export async function POST(req:NextRequest){
  const started=Date.now();
  try{
    const body=await req.json();
    const workspaceId=String(body.workspace_id||"");
    const primaryRunId=String(body.run_id||"");
    if(!workspaceId||!primaryRunId)return NextResponse.json({ok:false,error:"Workspace atau run analysis tidak valid."},{status:400});

    const ctx=await getServerContext(workspaceId);
    const {data:primary,error:primaryError}=await ctx.admin
      .from("ai_analysis_runs")
      .select("*")
      .eq("workspace_id",workspaceId)
      .eq("run_id",primaryRunId)
      .eq("created_by",ctx.user.id)
      .maybeSingle();
    if(primaryError)throw primaryError;
    if(!primary)return NextResponse.json({ok:false,error:"Analysis run tidak ditemukan."},{status:404});

    let runQuery=ctx.admin
      .from("ai_analysis_runs")
      .select("run_id,analysis_type,start_date,end_date,created_at,status")
      .eq("workspace_id",workspaceId)
      .eq("created_by",ctx.user.id)
      .eq("status","Success")
      .order("created_at",{ascending:false})
      .limit(24);
    if(primary.start_date)runQuery=runQuery.eq("start_date",primary.start_date);else runQuery=runQuery.is("start_date",null);
    if(primary.end_date)runQuery=runQuery.eq("end_date",primary.end_date);else runQuery=runQuery.is("end_date",null);

    const [runsResult,contextResult,refResult]=await Promise.all([
      runQuery,
      ctx.admin.rpc("luma_ai_period_context",{
        p_workspace_id:workspaceId,
        p_start_date:primary.start_date||null,
        p_end_date:primary.end_date||null,
        p_focus:primary.analysis_type
      }),
      ctx.admin.from("referral_profiles").select("referral_code").eq("user_id",ctx.user.id).maybeSingle()
    ]);
    if(runsResult.error)throw runsResult.error;
    if(contextResult.error)throw contextResult.error;

    const latestByType:Record<string,AnyRow>={};
    for(const row of runsResult.data||[]){
      const analysisType=String(row.analysis_type||"");
      if(["recommendation","performance","product","creator"].includes(analysisType)&&!latestByType[analysisType])latestByType[analysisType]=row;
    }
    if(!latestByType[String(primary.analysis_type||"")])latestByType[String(primary.analysis_type||"")]=primary;
    const selectedRuns=Object.values(latestByType);
    const ids=selectedRuns.map(row=>String(row.run_id)).filter(Boolean);
    const {data:insights,error:insightError}=ids.length
      ? await ctx.admin.from("ai_insights").select("run_id,insight_json").eq("workspace_id",workspaceId).in("run_id",ids)
      : {data:[],error:null} as any;
    if(insightError)throw insightError;

    const insightMap=Object.fromEntries((insights||[]).map((row:any)=>[row.run_id,row.insight_json||{}]));
    const analysis:Record<string,AnyRow>={};
    for(const row of selectedRuns)analysis[String(row.analysis_type||"")]=insightMap[row.run_id]||{};

    const recommendation=analysis.recommendation||{};
    const performance=analysis.performance||analysis[String(primary.analysis_type||"")]||{};
    const creator=analysis.creator||{};
    const product=analysis.product||{};
    const databaseContext=contextResult.data||{};
    const visuals={
      kpi:databaseContext?.kpi||{},
      monthly_trend:(databaseContext?.monthly_trend||[]).slice(-18),
      top_creators:(databaseContext?.top_creators||[]).slice(0,12),
      top_products:(databaseContext?.top_products||[]).slice(0,12),
      platforms:(databaseContext?.platforms||[]).slice(0,10),
      stores:(databaseContext?.stores||[]).slice(0,12),
      source_images:[]
    };

    const periodStart=primary.start_date||"Semua data";
    const periodEnd=primary.end_date||"Semua data";
    const appUrl=process.env.NEXT_PUBLIC_APP_URL||"https://app.lumaway.online";
    const referralCode=refResult.data?.referral_code||"LUMAWAY";
    const executive=text(performance.executive_summary||recommendation.executive_summary,"Ringkasan dibuat dari seluruh agregasi data pada periode terpilih.");
    const headline=text(performance.headline||recommendation.headline,"Lumaway Performance Report");

    const pages=[
      page(1,headline,`Periode ${periodStart} – ${periodEnd}`,"none",[
        {heading:"Tentang laporan",body:"Laporan ini dirakit langsung dari hasil analisis Lumaway dan agregasi database workspace pada periode yang dipilih."},
        {heading:"Sumber data",body:"Grafik dan tabel menggunakan data Supabase workspace; angka tidak dibuat oleh template report."}
      ],[],text(performance.client_takeaway||recommendation.client_takeaway,"Light Up Your Potential.")),
      page(2,"Executive Brief","Kondisi utama dan KPI periode","kpi",[
        {heading:"Ringkasan",body:executive},
        {heading:"Dampak ke bisnis",body:text(performance.business_impact||recommendation.business_impact)}
      ],cleanList(performance.key_findings,recommendation.key_findings),text(performance.client_takeaway||recommendation.client_takeaway)),
      page(3,"Performa & Momentum","Perubahan GMV, order, qty, commission, refund, dan momentum","monthly_trend",[
        {heading:"Arah performa",body:text((performance.trend_findings||[]).join(" "))},
        {heading:"Yang perlu dibaca",body:"Visual periode menggunakan agregasi penuh dari database workspace. Perubahan pada chart tidak berasal dari sampling AI."}
      ],cleanList(performance.key_findings,performance.trend_findings),text(performance.performance_status||"INFO")),
      page(4,"Creator","Kontribusi creator dan peluang follow-up","top_creators",[
        {heading:"Creator insight",body:text(creator.executive_summary||creator.client_takeaway,"Kontribusi creator dirangkum dari data periode yang tersedia.")},
        {heading:"Dampak",body:text(creator.business_impact)}
      ],cleanList(creator.creator_findings,performance.creator_findings),text(creator.confidence_note)),
      page(5,"Produk","Produk/SKU pendorong omzet dan area evaluasi","top_products",[
        {heading:"Product insight",body:text(product.executive_summary||product.client_takeaway,"Performa produk dirangkum dari data product performance pada periode yang tersedia.")},
        {heading:"Dampak",body:text(product.business_impact)}
      ],cleanList(product.product_findings,performance.product_findings),text(product.confidence_note)),
      page(6,"Platform & Toko","Kontribusi channel dan store","platforms",[
        {heading:"Channel mix",body:"Gunakan visual kontribusi platform untuk membaca konsentrasi GMV/order dan menentukan area yang perlu dipertahankan atau diuji."},
        {heading:"Kualitas data",body:`Affiliate rows: ${Number(databaseContext?.data_quality?.affiliate_rows||0).toLocaleString("id-ID")} · Product rows: ${Number(databaseContext?.data_quality?.product_rows||0).toLocaleString("id-ID")}.`}
      ],cleanList(performance.key_findings),text(databaseContext?.data_quality?.complete_period_aggregation===false?"Periksa kelengkapan periode sebelum mengambil keputusan.":"Agregasi periode dihitung dari data workspace yang tersedia.")),
      page(7,"Peluang & Risiko","Opportunity, anomaly, dan hal yang perlu dijaga","stores",[
        {heading:"Peluang",body:text(cleanList(recommendation.opportunities,performance.opportunities).join(" "))},
        {heading:"Risiko / watchout",body:text(cleanList(recommendation.watchouts,performance.watchouts,performance.anomalies).join(" "))}
      ],cleanList(recommendation.opportunities,performance.opportunities,recommendation.watchouts,performance.anomalies),text(recommendation.confidence_note||performance.confidence_note)),
      page(8,"Rencana 7–30 Hari","Prioritas aksi dan monitoring","none",[
        {heading:"Prioritas aksi",body:"Gunakan daftar berikut sebagai backlog tindakan dan pindahkan item yang relevan ke Kanban agar progresnya dapat dipantau."},
        {heading:"Monitoring",body:"Bandingkan KPI setelah tindakan dijalankan pada periode berikutnya, terutama GMV, order, qty, creator contribution, product contribution, commission, dan refund."}
      ],cleanList(recommendation.next_7_days,recommendation.recommendations,performance.next_7_days,performance.recommendations),text(recommendation.client_takeaway||performance.client_takeaway)),
      page(9,"Lumaway Affiliate","Bagikan Lumaway ke network Anda","none",[
        {heading:"Referral",body:`Gunakan kode referral ${referralCode} untuk mengajak partner atau tim lain menggunakan Lumaway.`},
        {heading:"Akses",body:`Buka ${appUrl} untuk melanjutkan ke workspace Lumaway.`}
      ],[],"Lumaway · Light Up Your Potential.")
    ];

    const document={
      document_title:headline,
      executive_note:executive,
      pages,
      data_visuals:visuals,
      data_quality:databaseContext?.data_quality||{},
      generated_mode:"fast-data-assembly"
    };

    const fileName=`lumaway-ai-report-${primaryRunId.toLowerCase()}.html`;
    const reportPayload={
      workspace_id:workspaceId,
      user_id:ctx.user.id,
      title:document.document_title,
      period_start:primary.start_date||null,
      period_end:primary.end_date||null,
      language:"id",
      tone:"black-white",
      tokens_used:0,
      file_name:fileName,
      run_id:primaryRunId,
      analysis_type:primary.analysis_type,
      content_json:{combined_run_ids:ids,executive_note:document.executive_note,data_quality:databaseContext?.data_quality||{},generated_mode:"fast-data-assembly",generation_ms:Date.now()-started},
      document_json:document,
      status:"ready",
      page_count:pages.length
    };

    const {data:existing}=await ctx.admin.from("luma_pdf_reports").select("id").eq("workspace_id",workspaceId).eq("user_id",ctx.user.id).eq("run_id",primaryRunId).order("created_at",{ascending:false}).limit(1).maybeSingle();
    let report:any=null;
    if(existing?.id){
      const {data,error}=await ctx.admin.from("luma_pdf_reports").update({...reportPayload,updated_at:new Date().toISOString()}).eq("id",existing.id).select("id,title,page_count,created_at").single();
      if(error)throw error;
      report=data;
    }else{
      const {data,error}=await ctx.admin.from("luma_pdf_reports").insert(reportPayload).select("id,title,page_count,created_at").single();
      if(error)throw error;
      report=data;
    }

    return NextResponse.json({
      ok:true,
      report,
      document,
      combined_types:Object.keys(latestByType),
      generation_ms:Date.now()-started,
      generated_mode:"fast-data-assembly"
    });
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Dokumen belum dapat dibuat."},{status:400});
  }
}
