import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";
import {getServerSecret} from "../../../../lib/server-secrets";
import {openAIResponsesWithFailover} from "../../../../lib/openai-router";
import {generateReportPdf} from "../../../../lib/simple-pdf";

export const runtime="nodejs";

const insightSchema={type:"object",additionalProperties:false,properties:{
 executive_summary:{type:"string"},
 key_findings:{type:"array",items:{type:"string"}},
 risks:{type:"array",items:{type:"string"}},
 recommendations:{type:"array",items:{type:"string"}},
 conclusion:{type:"string"}
},required:["executive_summary","key_findings","risks","recommendations","conclusion"]};

function outputText(data:any){
 if(typeof data?.output_text==="string")return data.output_text;
 for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==="output_text"&&part?.text)return part.text;
 return "";
}
const num=(value:any)=>Number(value||0);
const sum=(rows:any[],key:string)=>rows.reduce((total,row)=>total+num(row[key]),0);
const money=(value:any)=>Math.round(num(value)).toLocaleString("id-ID");

function reportTitle(type:string){
 return ({sales:"Laporan Penjualan Lumaway",api_cost:"Laporan Biaya API Lumaway",cashflow:"Laporan Cashflow Lumaway",margin:"Laporan Margin Lumaway",profit_loss:"Laporan Laba & Rugi Lumaway"} as Record<string,string>)[type]||"Laporan Keuangan Lumaway";
}

function documentJson(title:string,period:any,metrics:any,insight:any){
 const revenueReady=Boolean(metrics.revenue_ready);
 const salesText=revenueReady?`Rp ${money(metrics.sales)}`:"Belum terbentuk";
 const marginText=revenueReady?`${num(metrics.margin_pct).toFixed(2)}%`:"Belum tersedia";
 const profitText=revenueReady?`Rp ${money(metrics.profit_loss)}`:"Belum tersedia";
 return {document_title:title,pages:[
  {page_number:1,title,subtitle:`${period.start||"All data"} - ${period.end||"All data"}`,sections:[{heading:"Executive Summary",body:insight.executive_summary||""}],callout:`Revenue ${salesText} · P/L ${profitText}`},
  {page_number:2,title:"Financial Snapshot",subtitle:"Lumaway platform operations only",sections:[
   {heading:"Verified Revenue",body:revenueReady?`Pembayaran subscription + token yang berstatus paid: ${salesText}.`:"Belum ada transaksi subscription/token berstatus paid. Sales, margin, cashflow, dan P/L belum dibentuk agar tidak menampilkan angka semu."},
   {heading:"Direct Cost",body:revenueReady?`Biaya API + payment processing terverifikasi Rp ${money(metrics.direct_cost)}.`:"Direct cost belum dibentuk sampai revenue payment gateway tervalidasi."},
   {heading:"API & Operating Expense",body:`Biaya API tercatat Rp ${money(metrics.api_cost_idr)} dan expense ledger Rp ${money(metrics.expenses)}.`}
  ],bullets:[`Contribution margin ${marginText}`,`Payment fee Rp ${money(metrics.payment_fees)}`,`API usage USD ${num(metrics.api_cost_usd).toFixed(4)}`]},
  {page_number:3,title:"Key Findings",bullets:insight.key_findings||[]},
  {page_number:4,title:"Risk & Cost Control",bullets:insight.risks||[]},
  {page_number:5,title:"Recommended Actions",bullets:insight.recommendations||[],callout:insight.conclusion||""}
 ]};
}

async function loadMetrics(ctx:any,start:string,end:string){
 let subQ=ctx.admin.from("luma_subscription_orders").select("amount,status,payment_provider,paid_at").eq("status","paid").not("paid_at","is",null);
 let topupQ=ctx.admin.from("luma_topup_orders").select("amount,status,payment_provider,paid_at").eq("status","paid").not("paid_at","is",null);
 let expQ=ctx.admin.from("luma_expense_records").select("amount,currency,expense_date,category,vendor,description");
 let usageQ=ctx.admin.from("luma_api_usage_events").select("provider,service,cost_usd,cost_idr,created_at,status").eq("status","success");
 if(start){
  subQ=subQ.gte("paid_at",start+"T00:00:00Z");topupQ=topupQ.gte("paid_at",start+"T00:00:00Z");
  expQ=expQ.gte("expense_date",start);usageQ=usageQ.gte("created_at",start+"T00:00:00Z");
 }
 if(end){
  subQ=subQ.lte("paid_at",end+"T23:59:59Z");topupQ=topupQ.lte("paid_at",end+"T23:59:59Z");
  expQ=expQ.lte("expense_date",end);usageQ=usageQ.lte("created_at",end+"T23:59:59Z");
 }
 const [subRes,topupRes,expRes,usageRes]=await Promise.all([subQ,topupQ,expQ,usageQ]);
 const error=subRes.error||topupRes.error||expRes.error||usageRes.error;if(error)throw error;
 const subscriptions=subRes.data||[],topups=topupRes.data||[],expenses=expRes.data||[],usage=usageRes.data||[];
 const subscriptionRevenue=sum(subscriptions,"amount"),topupRevenue=sum(topups,"amount"),sales=subscriptionRevenue+topupRevenue;
 const revenueRows=subscriptions.length+topups.length,revenueReady=revenueRows>0;
 const paymentUsage=usage.filter((row:any)=>String(row.service||"")==="payment_fee"||["xendit","doku"].includes(String(row.provider||"")));
 const nonPaymentUsage=usage.filter((row:any)=>!paymentUsage.includes(row));
 const paymentFees=sum(paymentUsage,"cost_idr"),apiCostIdr=sum(nonPaymentUsage,"cost_idr"),apiCostUsd=sum(nonPaymentUsage,"cost_usd");
 const expensesIdr=expenses.reduce((total:number,row:any)=>total+(String(row.currency||"IDR")==="IDR"?num(row.amount):0),0);
 const directCost=revenueReady?paymentFees+apiCostIdr:null;
 const contribution=revenueReady?sales-num(directCost):null;
 const marginPct=revenueReady&&sales>0?num(contribution)/sales*100:null;
 const profitLoss=revenueReady?num(contribution)-expensesIdr:null;
 return {
  metrics:{
   revenue_ready:revenueReady,
   sales:revenueReady?sales:null,
   subscription_revenue:revenueReady?subscriptionRevenue:null,
   topup_revenue:revenueReady?topupRevenue:null,
   paid_transactions:revenueRows,
   direct_cost:directCost,
   payment_fees:paymentFees,
   api_cost_idr:apiCostIdr,
   api_cost_usd:apiCostUsd,
   expenses:expensesIdr,
   contribution_margin:contribution,
   margin_pct:marginPct,
   cashflow:profitLoss,
   profit_loss:profitLoss
  },
  expenses,usage,
  source:{
   revenue:"luma_subscription_orders + luma_topup_orders (status=paid, paid_at verified)",
   direct_cost:"API usage + payment processing fees only after verified paid revenue exists",
   note:revenueReady?"Verified Lumaway payment revenue is available.":"No verified paid Lumaway transaction in this period. Xendit/DOKU revenue metrics remain unformed."
  }
 };
}

export async function POST(req:NextRequest){
 try{
  const body=await req.json();
  const workspaceId=String(body.workspace_id||"");
  const action=String(body.action||"generate");
  const type=String(body.report_type||"profit_loss");
  const start=String(body.start_date||"");
  const end=String(body.end_date||"");
  const ctx=await getServerContext(workspaceId);
  if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Control Center access required."},{status:403});

  if(action==="download"){
   const id=Number(body.id||0);
   const {data,error}=await ctx.admin.from("luma_financial_reports").select("*").eq("id",id).single();
   if(error||!data)return NextResponse.json({ok:false,error:"Report tidak ditemukan."},{status:404});
   const insight=data.insight_json||{};
   const doc=insight.document_json||documentJson(data.title,{start:data.period_start,end:data.period_end},data.input_json?.metrics||{},insight);
   const pdf=generateReportPdf({title:data.title,period_start:data.period_start,period_end:data.period_end,document_json:doc,watermark_removed_at:new Date().toISOString()});
   return new Response(pdf,{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="lumaway-${data.report_type}-${data.id}.pdf"`,"Cache-Control":"private, no-store"}});
  }

  const loaded=await loadMetrics(ctx,start,end);
  const {metrics,expenses,usage,source}=loaded;
  if(action==="preview")return NextResponse.json({ok:true,data_ready:Boolean(metrics.revenue_ready),metrics,source});

  const revenueDependent=type!=="api_cost";
  if(revenueDependent&&!metrics.revenue_ready){
   return NextResponse.json({
    ok:true,
    data_ready:false,
    metrics,
    source,
    insight:null,
    message:"Penjualan Lumaway belum terbentuk karena belum ada transaksi subscription/token berstatus paid. Direct Cost, Margin, Cashflow, dan Profit/Loss tidak dihitung sampai payment gateway menghasilkan transaksi terverifikasi."
   });
  }

  const key=await getServerSecret(ctx.admin,"luma_openai_api_key");
  if(!key)return NextResponse.json({ok:false,error:"OpenAI integration belum dikonfigurasi."},{status:503});
  const title=reportTitle(type);
  const routed=await openAIResponsesWithFailover(ctx.admin,key,{
   instructions:"Anda adalah analis keuangan internal Lumaway SaaS. Gunakan hanya angka input Lumaway. Revenue hanya berasal dari subscription/top-up berstatus paid. Jangan menganggap GMV customer workspace sebagai pendapatan Lumaway. Jika revenue belum tersedia, fokuskan analisis pada API/operating cost yang benar-benar tercatat. Jangan mengarang payment fee, revenue, margin, cashflow, atau profit/loss.",
   input:JSON.stringify({report_type:type,period:{start:start||null,end:end||null},metrics,source,expenses:expenses.slice(0,100),api_usage:usage.slice(0,100)}),
   text:{format:{type:"json_schema",name:"lumaway_financial_report",schema:insightSchema,strict:true}},
   store:false
  },"gpt-5.6-sol");
  const insight=JSON.parse(outputText(routed.raw));
  const doc=documentJson(title,{start,end},metrics,insight);
  const {data:created,error}=await ctx.admin.from("luma_financial_reports").insert({
   report_type:type,period_start:start||null,period_end:end||null,title,
   input_json:{metrics,source,expenses,api_usage:usage},
   insight_json:{...insight,document_json:doc,cost:routed.cost,fallback_used:routed.fallback_used},
   model:routed.model,created_by:ctx.user.id
  }).select("*").single();
  if(error)throw error;
  const usageMeta=routed.raw?.usage||{};
  await ctx.admin.from("luma_api_usage_events").insert({
   workspace_id:workspaceId,user_id:ctx.user.id,provider:"openai",service:"financial_report",request_type:type,model:routed.model,
   input_tokens:num(usageMeta.input_tokens),output_tokens:num(usageMeta.output_tokens),total_tokens:num(usageMeta.total_tokens),
   cost_usd:routed.cost.cost_usd,cost_idr:routed.cost.cost_idr,status:"success",reference:String(created.id),metadata:{fallback_used:routed.fallback_used}
  });
  return NextResponse.json({ok:true,data_ready:true,report:created,metrics,source,insight:{...insight,document_json:doc},model:routed.model});
 }catch(error:any){
  return NextResponse.json({ok:false,error:error?.message||"Gagal membuat laporan."},{status:400});
 }
}
