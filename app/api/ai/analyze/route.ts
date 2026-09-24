import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";
import { openAIResponsesWithFailover } from "../../../../lib/openai-router";

export const runtime="nodejs";

const AI_SCHEMA={
  type:"object",additionalProperties:false,
  properties:{
    executive_summary:{type:"string"},
    performance_status:{type:"string",enum:["HIGH GROWTH","GROWING","STABLE","DECLINING","AT RISK","TOP PERFORMER","INFO"]},
    key_findings:{type:"array",items:{type:"string"}},
    creator_findings:{type:"array",items:{type:"string"}},
    product_findings:{type:"array",items:{type:"string"}},
    trend_findings:{type:"array",items:{type:"string"}},
    anomalies:{type:"array",items:{type:"string"}},
    recommendations:{type:"array",items:{type:"string"}},
    confidence_note:{type:"string"}
  },
  required:["executive_summary","performance_status","key_findings","creator_findings","product_findings","trend_findings","anomalies","recommendations","confidence_note"]
};

const BASE_PROMPT=`Anda adalah Senior Business Intelligence Analyst untuk LUMA Affiliate Intelligence. Gunakan HANYA database_context dan related_analysis yang diberikan. Angka database adalah sumber kebenaran. Related analysis hanya konteks sekunder dan tidak boleh mengalahkan data mentah/agregat. Jangan menciptakan angka, creator, SKU, sebab-akibat, benchmark, atau tren. Jika data tidak cukup, katakan eksplisit. Bahasa Indonesia profesional, managerial, jelas, ringkas, dan actionable. Recommendations harus konkret dan dapat dijadikan task.`;

const ANALYSIS_GUIDE:Record<string,string>={
  performance:"Fokus PERFORMANCE ANALYSIS: kesehatan KPI keseluruhan, GMV, Qty, Orders, Commission, refund, efisiensi, dan kontribusi platform.",
  creator:"Fokus CREATOR ANALYSIS: konsentrasi kontribusi, top/middle/low contributor, ketergantungan, peluang retain/grow/reactivate/test.",
  product:"Fokus PRODUCT ANALYSIS: SKU/product, kategori marketplace, GMV, Qty, Orders, product mix, volume vs revenue. Jika SKU granular kosong, nyatakan keterbatasan dan jangan mengarang produk.",
  trend:"Fokus TREND ANALYSIS: perubahan antar bulan/periode, momentum, konsistensi, seasonality yang terlihat. Jangan menyebut tren jika hanya ada satu titik waktu.",
  anomaly:"Fokus ANOMALY DETECTION: outlier, perubahan ekstrem, ketidakseimbangan GMV-vs-orders-vs-qty, konsentrasi creator/platform/product, serta kemungkinan anomali data. Bedakan fakta, hipotesis, dan item yang harus diverifikasi.",
  recommendation:"Fokus RECOMMENDATIONS: kombinasikan seluruh analysis yang tersedia menjadi prioritas tindakan. Urutkan dampak dan urgensi. Setiap rekomendasi harus memiliki dasar temuan dan bisa langsung dijadikan Kanban task."
};

const n=(v:any)=>Number(v||0);
function extractOutputText(data:any){
  if(typeof data?.output_text==="string")return data.output_text;
  for(const item of data?.output||[])for(const content of item?.content||[])if(content?.type==="output_text"&&content?.text)return content.text;
  return "";
}

function aggregate(rows:any[],keyFn:(row:any)=>string|null){
  const map=new Map<string,any>();
  for(const row of rows){
    const key=keyFn(row);if(!key)continue;
    const item=map.get(key)||{
      sku:row.sku||null,product:row.product_name||null,category:row.category||null,
      creator:row.creator_name||row.username||null,username:row.username||null,platform:row.platform||null,
      gmv:0,qty:0,orders:0,commission:0,refund:0,clicks:0,rows:0
    };
    item.gmv+=n(row.gmv);item.qty+=n(row.qty);item.orders+=n(row.orders);item.commission+=n(row.commission);
    item.refund+=n(row.refund);item.clicks+=n(row.clicks);item.rows++;
    if(!item.category&&row.category)item.category=row.category;
    map.set(key,item);
  }
  return [...map.values()];
}

async function buildDatabaseContext(admin:any,workspaceId:string,start:string,end:string,analysisType:string){
  const fields="data_type,data_date,end_date,creator_id,creator_name,username,platform,sku,product_code,product_name,category,qty,orders,gmv,commission,refund,clicks,buyers,new_buyers,live_count,video_count,sample_sent";
  const base=(types:string[],limit:number)=>{
    let q=admin.from("sales").select(fields).eq("workspace_id",workspaceId).in("data_type",types).order("data_date",{ascending:true,nullsFirst:false}).limit(limit);
    if(start)q=q.gte("data_date",start);
    if(end)q=q.lte("data_date",end);
    return q;
  };
  const [affiliateResult,productResult]=await Promise.all([
    base(["performance","sales"],8000),
    base(["product_performance"],5000)
  ]);
  if(affiliateResult.error)throw affiliateResult.error;
  if(productResult.error)throw productResult.error;

  const affiliateRows=(affiliateResult.data||[]) as any[];
  const productRows=(productResult.data||[]) as any[];
  const metricRows=affiliateRows.length?affiliateRows:productRows;
  const preferredProductRows=productRows.length?productRows:affiliateRows.filter(row=>row.sku||row.product_name);

  const kpi=metricRows.reduce((acc:any,row:any)=>{
    acc.gmv+=n(row.gmv);acc.qty+=n(row.qty);acc.orders+=n(row.orders);acc.commission+=n(row.commission);
    acc.refund+=n(row.refund);acc.clicks+=n(row.clicks);acc.buyers+=n(row.buyers);
    acc.live_count+=n(row.live_count);acc.video_count+=n(row.video_count);acc.sample_sent+=n(row.sample_sent);
    return acc;
  },{gmv:0,qty:0,orders:0,commission:0,refund:0,clicks:0,buyers:0,live_count:0,video_count:0,sample_sent:0});

  const creatorKeys=new Set(affiliateRows.map(row=>row.creator_id?String(row.creator_id):[row.platform,row.username||row.creator_name].filter(Boolean).join("|")).filter(Boolean));
  const productKeys=new Set(preferredProductRows.map(row=>row.sku||row.product_code||row.product_name).filter(Boolean));
  kpi.active_creators=creatorKeys.size;
  kpi.total_products=productKeys.size;
  kpi.roi=kpi.commission>0?kpi.gmv/kpi.commission:null;
  kpi.aov=kpi.orders>0?kpi.gmv/kpi.orders:null;

  const platforms=aggregate(metricRows,row=>row.platform||"Unknown")
    .sort((a,b)=>b.gmv-a.gmv)
    .slice(0,12)
    .map(({platform,gmv,qty,orders,commission,refund,clicks})=>({platform,gmv,qty,orders,commission,refund,clicks}));

  const topCreators=aggregate(affiliateRows,row=>{
    const name=row.username||row.creator_name;if(!name)return null;
    return `${String(row.platform||"Unknown").toLowerCase()}|${String(name).toLowerCase()}`;
  }).sort((a,b)=>b.gmv-a.gmv).slice(0,30)
    .map((x,index)=>({rank:index+1,creator:x.creator||x.username,username:x.username,platform:x.platform,gmv:x.gmv,qty:x.qty,orders:x.orders,commission:x.commission}));

  const topProducts=aggregate(preferredProductRows,row=>row.sku||row.product_code||row.product_name||null)
    .sort((a,b)=>b.gmv-a.gmv).slice(0,35)
    .map(x=>({sku:x.sku,product:x.product,category:x.category,gmv:x.gmv,qty:x.qty,orders:x.orders,commission:x.commission,refund:x.refund,clicks:x.clicks}));

  const monthlyMap=new Map<string,any>();
  for(const row of metricRows){
    const period=row.data_date?String(row.data_date).slice(0,7):"undated";
    const item=monthlyMap.get(period)||{period,gmv:0,qty:0,orders:0,commission:0,refund:0};
    item.gmv+=n(row.gmv);item.qty+=n(row.qty);item.orders+=n(row.orders);item.commission+=n(row.commission);item.refund+=n(row.refund);
    monthlyMap.set(period,item);
  }

  return {
    analysis_focus:analysisType,
    period:{start:start||"ALL DATA",end:end||"ALL DATA"},
    kpi,
    platforms,
    top_creators:topCreators,
    top_products:topProducts,
    monthly_trend:[...monthlyMap.values()],
    data_quality:{
      affiliate_rows_sampled:affiliateRows.length,
      product_rows_sampled:productRows.length,
      affiliate_limit_reached:affiliateRows.length>=8000,
      product_limit_reached:productRows.length>=5000
    }
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
    const analysisType=String(body.analysis_type||"performance");
    const start=body.start_date?String(body.start_date):"";
    const end=body.end_date?String(body.end_date):"";
    if(!workspaceId)return NextResponse.json({ok:false,error:"Workspace tidak valid."},{status:400});
    if(start&&end&&start>end)return NextResponse.json({ok:false,error:"Start Date tidak boleh melewati End Date."},{status:400});

    ctx=await getServerContext(workspaceId);
    const requestedModel=process.env.OPENAI_ANALYTICS_MODEL||process.env.OPENAI_MODEL||process.env.AI_MODEL||"gpt-5.6-sol";

    await ctx.admin.from("ai_analysis_runs").insert({
      workspace_id:workspaceId,run_id:runId,analysis_type:analysisType,start_date:start||null,end_date:end||null,
      dataset_version:"supabase-production-pr40",input_hash:"",model:requestedModel,status:"Processing",
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
    for(const x of previousRuns||[])if(!latest[x.analysis_type])latest[x.analysis_type]=x;
    const prevIds=Object.values(latest).map((x:any)=>x.run_id);
    const {data:prevInsights}=prevIds.length
      ? await ctx.admin.from("ai_insights").select("run_id,insight_json").eq("workspace_id",workspaceId).in("run_id",prevIds)
      : {data:[]} as any;
    const insightMap=Object.fromEntries((prevInsights||[]).map((x:any)=>[x.run_id,x.insight_json]));
    const relatedAnalysis=Object.values(latest).map((x:any)=>({analysis_type:x.analysis_type,run_id:x.run_id,result:insightMap[x.run_id]||{}}));

    const instructions=`${BASE_PROMPT}\n\n${ANALYSIS_GUIDE[analysisType]||ANALYSIS_GUIDE.performance}\n\nCross-analysis rule: gunakan related_analysis untuk hubungan antartipe analysis, tetapi database_context selalu menjadi sumber utama. Ringkas output agar cepat dibaca; maksimal 5 item per array temuan/rekomendasi.`;
    const routed=await openAIResponsesWithFailover(ctx.admin,apiKey,{
      instructions,
      input:JSON.stringify({analysis_type:analysisType,database_context:context,related_analysis:relatedAnalysis}),
      text:{format:{type:"json_schema",name:"luma_ai_analysis",schema:AI_SCHEMA,strict:true}},
      max_output_tokens:2200,
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
