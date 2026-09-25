import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";
import { openAIResponsesWithFailover } from "../../../../lib/openai-router";

export const runtime="nodejs";
const PAGE_SCHEMA={type:"object",additionalProperties:false,properties:{page_number:{type:"integer"},title:{type:"string"},subtitle:{type:"string"},sections:{type:"array",items:{type:"object",additionalProperties:false,properties:{heading:{type:"string"},body:{type:"string"}},required:["heading","body"]}},bullets:{type:"array",items:{type:"string"}},callout:{type:"string"}},required:["page_number","title","subtitle","sections","bullets","callout"]};
const SCHEMA={type:"object",additionalProperties:false,properties:{document_title:{type:"string"},executive_note:{type:"string"},pages:{type:"array",minItems:20,maxItems:20,items:PAGE_SCHEMA}},required:["document_title","executive_note","pages"]};
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
    const insightMap=Object.fromEntries((insights||[]).map((x:any)=>[x.run_id,x.insight_json]));const combined=chosen.map((x:any)=>({analysis_type:x.analysis_type,result:insightMap[x.run_id]||{}}));
    const {data:ref}=await ctx.admin.from("referral_profiles").select("referral_code").eq("user_id",ctx.user.id).maybeSingle();const appUrl=process.env.NEXT_PUBLIC_APP_URL||"https://lumaway.online";
    const pagePlan=[
      "Cover — Lumaway Affiliate Intelligence, judul report, periode, tanggal dibuat.",
      "Baca 2 Menit — headline, ringkasan kondisi, dan 3 hal yang paling penting untuk client.",
      "Apa yang Sedang Terjadi — narasi sederhana tentang kondisi bisnis/performa periode ini.",
      "KPI yang Perlu Dilihat — angka paling relevan beserta arti praktisnya, bukan tabel angka tanpa konteks.",
      "Yang Sudah Bekerja — area, platform, creator, atau produk yang menjadi kekuatan bila didukung data.",
      "Yang Menahan Performa — bottleneck, ketidakseimbangan, atau area yang belum maksimal.",
      "Creator yang Mendorong Hasil — kontribusi creator utama dan apa artinya untuk strategi.",
      "Peluang Creator — siapa/segmen apa yang layak di-scale, diuji, atau di-follow-up bila didukung data.",
      "Produk yang Mendorong Hasil — produk/SKU/kategori yang berkontribusi paling relevan.",
      "Peluang Produk — produk high-volume, high-revenue, atau yang layak didorong ke creator lain.",
      "Arah & Momentum — perubahan performa dan apa yang perlu diantisipasi.",
      "Platform & Mix — kontribusi platform dan keseimbangan channel yang terlihat.",
      "Early Warning — anomaly, refund, konsentrasi ekstrem, atau angka yang perlu diverifikasi.",
      "Dampak ke Bisnis — jelaskan kenapa temuan utama penting untuk omzet, efisiensi, atau keputusan marketing.",
      "Peluang yang Bisa Diambil — 3-5 peluang dengan alasan yang jelas.",
      "Prioritas Keputusan — apa yang harus didahulukan, ditunda, atau dipantau.",
      "Rencana 7 Hari — action plan realistis untuk minggu berikutnya.",
      "Rencana 30 Hari — eksperimen, scale-up, follow-up, dan monitoring.",
      "Apa yang Harus Dipantau Selanjutnya — KPI/data tambahan yang membuat analisis berikutnya lebih tajam.",
      `Lumaway Affiliate — ajak pembaca melanjutkan analisis di ${appUrl} menggunakan referral code ${ref?.referral_code||"LUMAWAY"}. Halaman promosi harus terpisah dari temuan data.`
    ];    const instructions=`Anda adalah Lumaway Client Insight Editor. Buat DOKUMEN TEPAT 20 HALAMAN A4 dari kumpulan hasil LUMA Affiliate Intelligence.

Report ini harus terasa seperti konsultan/account manager sedang menjelaskan kondisi bisnis kepada client: profesional, hangat, mudah dipahami, tidak kaku, dan setiap halaman punya nilai keputusan. Hindari bahasa akademik, template kosong, jargon berlebihan, dan pengulangan insight.

Gunakan hanya fakta/angka yang benar-benar ada pada combined_analysis. Jangan mengarang angka, sebab, SKU, creator, tren, benchmark, atau target. Bila data belum cukup, jelaskan dengan sederhana apa yang belum bisa disimpulkan dan data apa yang perlu ditambahkan.

Setiap halaman mengikuti PAGE PLAN, tetapi narasinya harus mengalir: kondisi → arti → dampak → peluang → tindakan. sections 1-3 per halaman, bullets 2-6 bila relevan, callout berisi satu takeaway yang mudah dibawa ke meeting.

Page 1 harus cover minimal. Page 20 adalah promosi Lumaway/referral dan tidak boleh dicampur dengan kesimpulan data. Pastikan page_number berurutan 1 sampai 20.`;
    const input={period:{start:primary.start_date||"All data",end:primary.end_date||"All data"},primary_analysis_type:primary.analysis_type,page_plan:pagePlan,combined_analysis:combined,referral_code:ref?.referral_code||null,registration_url:appUrl};
    const model=process.env.OPENAI_MODEL||process.env.AI_MODEL||"gpt-5.6-sol";const routed=await openAIResponsesWithFailover(ctx.admin,apiKey,{instructions,input:JSON.stringify(input),text:{format:{type:"json_schema",name:"lumaway_20_page_report",schema:SCHEMA,strict:true}},store:false},model);
    const raw=routed.raw;const text=outputText(raw);if(!text)throw new Error("AI report response kosong.");const document=JSON.parse(text);document.pages=(document.pages||[]).sort((a:any,b:any)=>a.page_number-b.page_number).slice(0,20);
    const fileName=`lumaway-ai-report-${primaryRunId.toLowerCase()}.html`;const usage=raw?.usage||{};await ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:ctx.user.id,provider:"openai",service:"ai_report",request_type:"generate_20_page_report",model:routed.model,input_tokens:Number(usage.input_tokens||0),output_tokens:Number(usage.output_tokens||0),total_tokens:Number(usage.total_tokens||0),cost_usd:routed.cost.cost_usd,cost_idr:routed.cost.cost_idr,status:"success",reference:primaryRunId,metadata:{fallback_used:routed.fallback_used}});
    const {data:report,error:reportError}=await ctx.admin.from("luma_pdf_reports").insert({workspace_id:workspaceId,user_id:ctx.user.id,title:document.document_title||`LUMAWAY AI Report ${primary.analysis_type}`,period_start:primary.start_date||null,period_end:primary.end_date||null,language:"id",tone:"black-white",tokens_used:0,file_name:fileName,run_id:primaryRunId,analysis_type:primary.analysis_type,content_json:{combined_run_ids:ids,executive_note:document.executive_note},document_json:document,status:"ready",page_count:20}).select("id,title,page_count,created_at").single();if(reportError)throw reportError;
    return NextResponse.json({ok:true,report,document,model:routed.model,fallback_used:routed.fallback_used,cost:routed.cost,combined_types:Object.keys(latestByType)});
  }catch(error:any){return NextResponse.json({ok:false,error:"error, terjadi kesalahan."},{status:400});}
}
