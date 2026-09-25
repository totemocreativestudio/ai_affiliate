import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";
import { openAIResponsesWithFailover } from "../../../../lib/openai-router";

export const runtime="nodejs";

const AI_SCHEMA={
  type:"object",additionalProperties:false,
  properties:{
    headline:{type:"string"},
    executive_summary:{type:"string"},
    client_takeaway:{type:"string"},
    business_impact:{type:"string"},
    performance_status:{type:"string",enum:["HIGH GROWTH","GROWING","STABLE","DECLINING","AT RISK","TOP PERFORMER","INFO"]},
    key_findings:{type:"array",items:{type:"string"}},
    creator_findings:{type:"array",items:{type:"string"}},
    product_findings:{type:"array",items:{type:"string"}},
    trend_findings:{type:"array",items:{type:"string"}},
    anomalies:{type:"array",items:{type:"string"}},
    opportunities:{type:"array",items:{type:"string"}},
    watchouts:{type:"array",items:{type:"string"}},
    recommendations:{type:"array",items:{type:"string"}},
    next_7_days:{type:"array",items:{type:"string"}},
    confidence_note:{type:"string"}
  },
  required:["headline","executive_summary","client_takeaway","business_impact","performance_status","key_findings","creator_findings","product_findings","trend_findings","anomalies","opportunities","watchouts","recommendations","next_7_days","confidence_note"]
};

const BASE_PROMPT=`Anda adalah Lumaway Insight Partner: gabungan account manager, business intelligence consultant, dan performance strategist. Anda menjelaskan hasil analisis kepada client Lumaway secara langsung, bukan menulis laporan akademik.

Gunakan HANYA database_context dan related_analysis yang diberikan. Angka database adalah sumber kebenaran. Jangan membuat angka, creator, SKU, sebab-akibat, benchmark, atau tren yang tidak ada datanya.

GAYA BAHASA:
- Bahasa Indonesia profesional tetapi hangat, natural, mudah dipahami owner/marketing team.
- Tulis seperti sedang menjelaskan insight ke client dalam meeting: "Gambaran besarnya...", "Yang menarik...", "Yang perlu dijaga...", bukan bahasa robot/skripsi.
- Hindari frasa berulang seperti "berdasarkan data menunjukkan bahwa" dan jargon berlebihan.
- Setiap poin harus menjawab minimal salah satu: jadi apa artinya, peluangnya apa, risikonya apa, atau tindakan berikutnya apa.
- Sebut angka yang relevan secara natural bila tersedia, tetapi jangan menumpuk angka.
- Jangan menutupi keterbatasan data; jelaskan dengan bahasa sederhana.
- Jangan mengulang insight yang sama di banyak section.

FORMAT NILAI UNTUK CLIENT:
- headline: satu kalimat pendek yang langsung menyampaikan kondisi paling penting.
- executive_summary: 2-4 kalimat sebagai briefing cepat.
- client_takeaway: apa yang seharusnya dipahami client setelah melihat data ini.
- business_impact: dampak praktis terhadap penjualan, creator, produk, atau keputusan marketing.
- opportunities: peluang nyata yang bisa dimanfaatkan.
- watchouts: hal yang perlu diawasi sebelum menjadi masalah.
- recommendations: tindakan konkret; sebisa mungkin format "Aksi — alasan".
- next_7_days: 3-5 langkah realistis yang bisa dilakukan dalam 7 hari.
- confidence_note: jelaskan kualitas/keterbatasan data secara singkat dan manusiawi.`;

const ANALYSIS_GUIDE:Record<string,string>={
  performance:`PERFORMA ANALISIS harus membaca seluruh data periode yang tersedia dan menjawab: "Bisnis sedang sehat atau tidak, bagian mana yang bergerak, dan apa yang perlu dilakukan sekarang?" Hubungkan GMV, order, qty, commission, refund, click, buyers, live/video, creator aktif, produk, platform, toko, serta tren bulanan. Soroti efisiensi, perubahan, dan bottleneck yang benar-benar terlihat. Berikan 2-4 keputusan yang bisa dibawa ke weekly meeting.`,
  creator:`CREATOR ANALISIS harus fokus pada seluruh data creator di periode terpilih. Bantu user memutuskan siapa yang perlu dipertahankan, dinaikkan, di-follow-up, diuji, atau tidak diprioritaskan. Bahas kontribusi GMV/order/qty/commission, konsentrasi kontribusi, platform/toko, serta peluang memperluas creator produktif. Jangan memberi label buruk tanpa data.`,
  product:`PRODUK ANALISIS harus fokus pada data Product Performance dan mengaitkannya dengan konteks creator pada periode yang sama. Jawab produk mana yang mendorong omzet, mana yang kuat di volume, mana yang belum maksimal, creator mana yang menjadi konteks performa periode, serta produk mana yang layak didorong ke lebih banyak creator. Gunakan SKU, produk, kategori, GMV, qty, order, click/refund bila tersedia. Jika sumber data belum memiliki atribusi creator-ke-produk secara langsung, katakan dengan jelas dan jangan mengarang relasinya.`,
  recommendation:`REKOMENDASI harus berfungsi seperti mini action plan untuk client. Gunakan seluruh konteks periode: performa, creator, produk, platform, toko, tren, refund, dan sinyal tidak wajar yang benar-benar tersedia. Prioritaskan 3-5 tindakan paling berdampak, jelaskan alasan, horizon 7/30 hari, dan apa yang perlu dimonitor setelah tindakan dijalankan.`
};

const n=(v:any)=>Number(v||0);
function extractOutputText(data:any){
  if(typeof data?.output_text==="string")return data.output_text;
  for(const item of data?.output||[])for(const content of item?.content||[])if(content?.type==="output_text"&&content?.text)return content.text;
  return "";
}

async function buildDatabaseContext(admin:any,workspaceId:string,start:string,end:string,analysisType:string){
  const {data,error}=await admin.rpc("luma_ai_period_context",{
    p_workspace_id:workspaceId,
    p_start_date:start||null,
    p_end_date:end||null,
    p_focus:analysisType
  });
  if(error)throw error;
  return data||{
    analysis_focus:analysisType,
    period:{start:start||"ALL DATA",end:end||"ALL DATA"},
    kpi:{},
    platforms:[],
    top_creators:[],
    top_products:[],
    monthly_trend:[],
    stores:[],
    data_quality:{affiliate_rows:0,product_rows:0,imports_in_period:0,sampling:false,complete_period_aggregation:true}
  };
}

export async function POST(req:NextRequest){
  const started=Date.now();
  let ctx:Awaited<ReturnType<typeof getServerContext>>|null=null;
  let workspaceId="";
  const runId=`AI-${randomUUID().replace(/-/g,"").slice(0,12).toUpperCase()}`;
  try{
    const body=await req.json();
    workspaceId=String(body.workspace_id||"");
    const analysisType=String(body.analysis_type||"recommendation");
    const allowedTypes=new Set(["recommendation","performance","product","creator"]);
    if(!allowedTypes.has(analysisType))return NextResponse.json({ok:false,error:"Jenis analisis tidak tersedia."},{status:400});
    const start=body.start_date?String(body.start_date):"";
    const end=body.end_date?String(body.end_date):"";
    if(!workspaceId)return NextResponse.json({ok:false,error:"Workspace tidak valid."},{status:400});
    if(start&&end&&start>end)return NextResponse.json({ok:false,error:"Start Date tidak boleh melewati End Date."},{status:400});

    ctx=await getServerContext(workspaceId);
    const requestedModel=process.env.OPENAI_ANALYTICS_MODEL||process.env.OPENAI_MODEL||process.env.AI_MODEL||"gpt-5.6-sol";

    await ctx.admin.from("ai_analysis_runs").insert({
      workspace_id:workspaceId,run_id:runId,analysis_type:analysisType,start_date:start||null,end_date:end||null,
      dataset_version:"supabase-production-pr46-full-period",input_hash:"",model:requestedModel,status:"Processing",
      created_at:new Date().toISOString(),created_by:ctx.user.id
    });

    const [apiKey,context]=await Promise.all([
      getServerSecret(ctx.admin,"luma_openai_api_key"),
      buildDatabaseContext(ctx.admin,workspaceId,start,end,analysisType)
    ]);
    if(!apiKey)throw new Error("OPENAI_NOT_CONFIGURED");

    let rq=ctx.admin.from("ai_analysis_runs")
      .select("run_id,analysis_type,start_date,end_date,created_at")
      .eq("workspace_id",workspaceId).eq("created_by",ctx.user.id).eq("status","Success")
      .order("created_at",{ascending:false}).limit(40);
    if(start)rq=rq.eq("start_date",start);else rq=rq.is("start_date",null);
    if(end)rq=rq.eq("end_date",end);else rq=rq.is("end_date",null);
    const {data:previousRuns}=await rq;
    const latest:Record<string,any>={};
    for(const x of previousRuns||[])if(["recommendation","performance","product","creator"].includes(String(x.analysis_type))&&!latest[x.analysis_type])latest[x.analysis_type]=x;
    const prevIds=Object.values(latest).map((x:any)=>x.run_id);
    const {data:prevInsights}=prevIds.length
      ? await ctx.admin.from("ai_insights").select("run_id,insight_json").eq("workspace_id",workspaceId).in("run_id",prevIds)
      : {data:[]} as any;
    const insightMap=Object.fromEntries((prevInsights||[]).map((x:any)=>[x.run_id,x.insight_json]));
    const relatedAnalysis=Object.values(latest).map((x:any)=>({analysis_type:x.analysis_type,run_id:x.run_id,result:insightMap[x.run_id]||{}}));

    const instructions=`${BASE_PROMPT}\n\n${ANALYSIS_GUIDE[analysisType]||ANALYSIS_GUIDE.performance}\n\nCross-analysis rule: gunakan related_analysis untuk menghubungkan konteks antar analisis, tetapi database_context selalu sumber utama. Maksimal 5 item per array. Jangan isi section hanya demi memenuhi template; bila tidak relevan, gunakan array kosong. Hasil akhir harus terasa seperti instant client briefing yang punya nilai keputusan, bukan sekadar rangkuman angka.`;
    const routed=await openAIResponsesWithFailover(ctx.admin,apiKey,{
      instructions,
      input:JSON.stringify({analysis_type:analysisType,database_context:context,related_analysis:relatedAnalysis}),
      text:{format:{type:"json_schema",name:"luma_ai_analysis",schema:AI_SCHEMA,strict:true}},
      max_output_tokens:3000,
      store:false
    },requestedModel,45000);

    const raw=routed.raw;
    const outputText=extractOutputText(raw);
    if(!outputText)throw new Error("EMPTY_AI_RESPONSE");
    const result=JSON.parse(outputText);
    const usage=raw?.usage||{};

    await Promise.all([
      ctx.admin.from("ai_analysis_runs").update({status:"Success",response_id:raw?.id||null,error_message:null,model:routed.model}).eq("workspace_id",workspaceId).eq("run_id",runId),
      ctx.admin.from("ai_insights").insert({workspace_id:workspaceId,run_id:runId,insight_json:result,created_at:new Date().toISOString()}),
      ctx.admin.from("ai_analysis_logs").insert({workspace_id:workspaceId,run_id:runId,event:"completed",details:{duration_ms:Date.now()-started,model:routed.model,requested_model:requestedModel,fallback_used:routed.fallback_used,analysis_type:analysisType,related_types:relatedAnalysis.map((x:any)=>x.analysis_type),usage,cost:routed.cost,context_quality:context.data_quality},created_at:new Date().toISOString()}),
      ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:ctx.user.id,provider:"openai",service:"responses",request_type:`analytics:${analysisType}`,model:routed.model,input_tokens:n(usage.input_tokens),output_tokens:n(usage.output_tokens),total_tokens:n(usage.total_tokens),cost_usd:routed.cost.cost_usd,cost_idr:routed.cost.cost_idr,status:"success",reference:runId,metadata:{response_id:raw?.id||null,duration_ms:Date.now()-started,requested_model:requestedModel,fallback_used:routed.fallback_used,fx:routed.fx}})
    ]);

    return NextResponse.json({ok:true,run_id:runId,model:routed.model,fallback_used:routed.fallback_used,cost:routed.cost,result});
  }catch(error:any){
    const rawMessage=String(error?.message||"AI analysis failed");
    if(ctx){
      try{
        await Promise.all([
          ctx.admin.from("ai_analysis_runs").update({status:"Error",error_message:rawMessage.slice(0,500)}).eq("workspace_id",workspaceId).eq("run_id",runId),
          ctx.admin.from("ai_analysis_logs").insert({workspace_id:workspaceId,run_id:runId,event:"error",details:{duration_ms:Date.now()-started,error:rawMessage},created_at:new Date().toISOString()}),
          ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:ctx.user.id,provider:"openai",service:"responses",request_type:"analytics",status:"error",reference:runId,metadata:{error:rawMessage,duration_ms:Date.now()-started}})
        ]);
      }catch{}
    }
    const notConfigured=rawMessage==="OPENAI_NOT_CONFIGURED";
    return NextResponse.json({
      ok:false,
      error:notConfigured?"AI Lumaway belum terhubung ke provider. Administrator sedang melakukan konfigurasi.":"AI sementara tidak dapat memproses analisis. Silakan coba kembali beberapa saat.",
      code:notConfigured?"AI_NOT_CONFIGURED":"AI_GENERATION_ERROR",
      run_id:runId
    },{status:notConfigured?503:502});
  }
}
