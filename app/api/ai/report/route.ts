import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";
import { openAIResponsesWithFailover } from "../../../../lib/openai-router";

export const runtime="nodejs";
const VISUAL_KEYS=["none","kpi","monthly_trend","top_creators","top_products","platforms","stores"] as const;
const PAGE_SCHEMA={type:"object",additionalProperties:false,properties:{page_number:{type:"integer"},title:{type:"string"},subtitle:{type:"string"},visual_key:{type:"string",enum:VISUAL_KEYS},sections:{type:"array",items:{type:"object",additionalProperties:false,properties:{heading:{type:"string"},body:{type:"string"}},required:["heading","body"]}},bullets:{type:"array",items:{type:"string"}},callout:{type:"string"}},required:["page_number","title","subtitle","visual_key","sections","bullets","callout"]};
const SCHEMA={type:"object",additionalProperties:false,properties:{document_title:{type:"string"},executive_note:{type:"string"},pages:{type:"array",minItems:6,maxItems:12,items:PAGE_SCHEMA}},required:["document_title","executive_note","pages"]};
function outputText(data:any){if(typeof data?.output_text==="string")return data.output_text;for(const item of data?.output||[])for(const c of item?.content||[])if(c?.type==="output_text"&&c?.text)return c.text;return "";}

export async function POST(req:NextRequest){
  try{
    const b=await req.json();const workspaceId=String(b.workspace_id||"");const primaryRunId=String(b.run_id||"");
    const ctx=await getServerContext(workspaceId);const apiKey=await getServerSecret(ctx.admin,"luma_openai_api_key");if(!apiKey)return NextResponse.json({ok:false,error:"error, terjadi kesalahan."},{status:503});
    const {data:primary,error:primaryError}=await ctx.admin.from("ai_analysis_runs").select("*").eq("workspace_id",workspaceId).eq("run_id",primaryRunId).eq("created_by",ctx.user.id).maybeSingle();if(primaryError)throw primaryError;if(!primary)return NextResponse.json({ok:false,error:"error, terjadi kesalahan."},{status:404});
    let q=ctx.admin.from("ai_analysis_runs").select("run_id,analysis_type,start_date,end_date,created_at,status").eq("workspace_id",workspaceId).eq("created_by",ctx.user.id).eq("status","Success").order("created_at",{ascending:false}).limit(100);
    if(primary.start_date)q=q.eq("start_date",primary.start_date);else q=q.is("start_date",null);if(primary.end_date)q=q.eq("end_date",primary.end_date);else q=q.is("end_date",null);
    const {data:runs,error:runsError}=await q;if(runsError)throw runsError;const latestByType:Record<string,any>={};for(const r of runs||[])if(!latestByType[r.analysis_type])latestByType[r.analysis_type]=r;
    const chosen=Object.values(latestByType);const ids=chosen.map((x:any)=>x.run_id);const {data:insights,error:insError}=ids.length?await ctx.admin.from("ai_insights").select("run_id,insight_json").eq("workspace_id",workspaceId).in("run_id",ids):{data:[],error:null};if(insError)throw insError;
    const insightMap=Object.fromEntries((insights||[]).map((x:any)=>[x.run_id,x.insight_json]));const combined=chosen.filter((x:any)=>["recommendation","performance","product","creator"].includes(String(x.analysis_type))).map((x:any)=>({analysis_type:x.analysis_type,result:insightMap[x.run_id]||{}}));
    const {data:databaseContext,error:contextError}=await ctx.admin.rpc("luma_ai_period_context",{p_workspace_id:workspaceId,p_start_date:primary.start_date||null,p_end_date:primary.end_date||null,p_focus:primary.analysis_type});if(contextError)throw contextError;
    const visuals={kpi:databaseContext?.kpi||{},monthly_trend:(databaseContext?.monthly_trend||[]).slice(-12),top_creators:(databaseContext?.top_creators||[]).slice(0,10),top_products:(databaseContext?.top_products||[]).slice(0,10),platforms:(databaseContext?.platforms||[]).slice(0,10),stores:(databaseContext?.stores||[]).slice(0,10),source_images:[]};
    const {data:ref}=await ctx.admin.from("referral_profiles").select("referral_code").eq("user_id",ctx.user.id).maybeSingle();const appUrl=process.env.NEXT_PUBLIC_APP_URL||"https://lumaway.online";
    const pagePlan=[
      "Cover — judul report, periode, tanggal dibuat.",
      "Executive Brief — kondisi utama, KPI, dan 3 hal terpenting.",
      "Performa & Momentum — GMV/order/qty/commission/refund dan tren periode.",
      "Creator — top creator, konsentrasi kontribusi, peluang follow-up/scale.",
      "Produk — top produk/SKU, volume, GMV, refund/click bila tersedia.",
      "Platform & Toko — mix channel/store dan area yang paling berkontribusi.",
      "Peluang & Risiko — opportunity, anomaly, bottleneck, dan hal yang perlu dicek.",
      "Rencana 7–30 Hari — prioritas aksi, eksperimen, dan KPI monitoring.",
      `Lumaway Affiliate — halaman penutup/promo terpisah dari temuan data. Arahkan ke ${appUrl} dengan referral ${ref?.referral_code||"LUMAWAY"}.`
    ];
    const instructions=`Anda adalah Lumaway Client Insight Editor. Buat dokumen analisis A4 MINIMAL 6 HALAMAN dan maksimal 12 halaman. Jumlah halaman menyesuaikan kekayaan data; jangan menambah halaman kosong hanya untuk memenuhi jumlah.

Gunakan hanya angka dan fakta dari database_context serta combined_analysis. Jangan mengarang angka, creator, SKU, tren, benchmark, sebab, gambar, atau target.

Setiap halaman wajib punya visual_key. Pilih hanya visual yang relevan:
- kpi = ringkasan KPI faktual
- monthly_trend = grafik tren bulanan
- top_creators = tabel/bar top creator
- top_products = tabel/bar top produk
- platforms = kontribusi platform
- stores = kontribusi toko
- none = halaman naratif/cover/action plan

Visual akan dirender langsung dari database oleh sistem, jadi JANGAN menulis angka visual yang tidak ada. Gunakan visual_key untuk mendukung narasi, bukan dekorasi.

Struktur harus mengalir: kondisi → angka penting → creator/produk → peluang/risiko → keputusan → action plan. Bahasa Indonesia profesional, natural, seperti account manager menjelaskan ke client. Hindari pengulangan dan template kaku. Page 1 cover. Halaman terakhir promosi Lumaway/referral, terpisah dari kesimpulan data. Pastikan page_number berurutan mulai 1.`;
    const input={period:{start:primary.start_date||"All data",end:primary.end_date||"All data"},primary_analysis_type:primary.analysis_type,page_plan:pagePlan,database_context:databaseContext,combined_analysis:combined,referral_code:ref?.referral_code||null,registration_url:appUrl};
    const model=process.env.OPENAI_MODEL||process.env.AI_MODEL||"gpt-5.6-sol";const routed=await openAIResponsesWithFailover(ctx.admin,apiKey,{instructions,input:JSON.stringify(input),text:{format:{type:"json_schema",name:"lumaway_rich_report",schema:SCHEMA,strict:true}},store:false},model);
    const raw=routed.raw;const text=outputText(raw);if(!text)throw new Error("AI report response kosong.");const document=JSON.parse(text);document.pages=(document.pages||[]).sort((a:any,b:any)=>a.page_number-b.page_number).slice(0,12);document.data_visuals=visuals;document.data_quality=databaseContext?.data_quality||{};const pageCount=Math.max(6,document.pages.length);
    const fileName=`lumaway-ai-report-${primaryRunId.toLowerCase()}.html`;const usage=raw?.usage||{};await ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:ctx.user.id,provider:"openai",service:"ai_report",request_type:"generate_rich_report",model:routed.model,input_tokens:Number(usage.input_tokens||0),output_tokens:Number(usage.output_tokens||0),total_tokens:Number(usage.total_tokens||0),cost_usd:routed.cost.cost_usd,cost_idr:routed.cost.cost_idr,status:"success",reference:primaryRunId,metadata:{fallback_used:routed.fallback_used}});
    const {data:report,error:reportError}=await ctx.admin.from("luma_pdf_reports").insert({workspace_id:workspaceId,user_id:ctx.user.id,title:document.document_title||`LUMAWAY AI Report ${primary.analysis_type}`,period_start:primary.start_date||null,period_end:primary.end_date||null,language:"id",tone:"black-white",tokens_used:0,file_name:fileName,run_id:primaryRunId,analysis_type:primary.analysis_type,content_json:{combined_run_ids:ids,executive_note:document.executive_note,data_quality:databaseContext?.data_quality||{}},document_json:document,status:"ready",page_count:pageCount}).select("id,title,page_count,created_at").single();if(reportError)throw reportError;
    return NextResponse.json({ok:true,report,document,model:routed.model,fallback_used:routed.fallback_used,cost:routed.cost,combined_types:Object.keys(latestByType)});
  }catch(error:any){return NextResponse.json({ok:false,error:"error, terjadi kesalahan."},{status:400});}
}
