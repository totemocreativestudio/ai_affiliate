import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";
import {getServerSecret} from "../../../../lib/server-secrets";
import {openAIResponsesWithFailover} from "../../../../lib/openai-router";
import {generateReportPdf} from "../../../../lib/simple-pdf";
export const runtime="nodejs";
const schema={type:"object",additionalProperties:false,properties:{executive_summary:{type:"string"},key_findings:{type:"array",items:{type:"string"}},risks:{type:"array",items:{type:"string"}},recommendations:{type:"array",items:{type:"string"}},conclusion:{type:"string"}},required:["executive_summary","key_findings","risks","recommendations","conclusion"]};
function outputText(data:any){if(typeof data?.output_text==="string")return data.output_text;for(const i of data?.output||[])for(const x of i?.content||[])if(x?.type==="output_text"&&x?.text)return x.text;return ""}
const num=(v:any)=>Number(v||0);
const sum=(rows:any[],key:string)=>rows.reduce((a,x)=>a+num(x[key]),0);
function documentJson(title:string,period:any,metrics:any,insight:any){
 return {document_title:title,pages:[
  {page_number:1,title,subtitle:`${period.start||"All data"} - ${period.end||"All data"}`,sections:[{heading:"Executive Summary",body:insight.executive_summary||""}],callout:`Revenue/GMV Rp ${Math.round(metrics.sales).toLocaleString("id-ID")} · Est. P/L Rp ${Math.round(metrics.profit_loss).toLocaleString("id-ID")}`},
  {page_number:2,title:"Financial Snapshot",subtitle:"Ringkasan metrik operasional",sections:[{heading:"Sales / GMV",body:`Total penjualan terpantau Rp ${Math.round(metrics.sales).toLocaleString("id-ID")}.`},{heading:"Direct & Operating Cost",body:`HPP Rp ${Math.round(metrics.hpp).toLocaleString("id-ID")}, ongkir Rp ${Math.round(metrics.shipping).toLocaleString("id-ID")}, ads Rp ${Math.round(metrics.ads).toLocaleString("id-ID")}, komisi Rp ${Math.round(metrics.commission).toLocaleString("id-ID")}.`},{heading:"API & Expenses",body:`API Rp ${Math.round(metrics.api_cost_idr).toLocaleString("id-ID")} dan pengeluaran tambahan Rp ${Math.round(metrics.expenses).toLocaleString("id-ID")}.`}],bullets:[`Margin kontribusi ${metrics.margin_pct.toFixed(2)}%`,`Cashflow estimasi Rp ${Math.round(metrics.cashflow).toLocaleString("id-ID")}`,`Laba/rugi estimasi Rp ${Math.round(metrics.profit_loss).toLocaleString("id-ID")}`]},
  {page_number:3,title:"Key Findings",bullets:insight.key_findings||[]},
  {page_number:4,title:"Risk & Cost Control",bullets:insight.risks||[]},
  {page_number:5,title:"Recommended Actions",bullets:insight.recommendations||[],callout:insight.conclusion||""},
 ]};
}
export async function POST(req:NextRequest){
 try{
  const b=await req.json();const workspaceId=String(b.workspace_id||"");const action=String(b.action||"generate");const ctx=await getServerContext(workspaceId);if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Owner access required."},{status:403});
  if(action==="download"){
   const id=Number(b.id||0);const {data,error}=await ctx.admin.from("luma_financial_reports").select("*").eq("id",id).single();if(error||!data)return NextResponse.json({ok:false,error:"Report tidak ditemukan."},{status:404});
   const insight=data.insight_json||{};const doc=insight.document_json||documentJson(data.title,{start:data.period_start,end:data.period_end},data.input_json?.metrics||{},insight);
   const pdf=generateReportPdf({title:data.title,period_start:data.period_start,period_end:data.period_end,document_json:doc,watermark_removed_at:new Date().toISOString()});
   return new Response(pdf,{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="lumaway-${data.report_type}-${data.id}.pdf"`,"Cache-Control":"private, no-store"}});
  }
  const type=String(b.report_type||"profit_loss");const start=String(b.start_date||"");const end=String(b.end_date||"");
  let salesQ=ctx.admin.from("sales").select("gmv,commission,cost_product,shipping_cost,ads_spend,data_date");if(start)salesQ=salesQ.gte("data_date",start);if(end)salesQ=salesQ.lte("data_date",end);
  let expQ=ctx.admin.from("luma_expense_records").select("amount,currency,expense_date,category,vendor,description");if(start)expQ=expQ.gte("expense_date",start);if(end)expQ=expQ.lte("expense_date",end);
  let apiQ=ctx.admin.from("luma_api_usage_events").select("provider,service,cost_usd,cost_idr,created_at,status").eq("status","success");if(start)apiQ=apiQ.gte("created_at",start+"T00:00:00Z");if(end)apiQ=apiQ.lte("created_at",end+"T23:59:59Z");
  const [{data:sales,error:sErr},{data:expenses,error:eErr},{data:api,error:aErr}]=await Promise.all([salesQ,expQ,apiQ]);if(sErr||eErr||aErr)throw sErr||eErr||aErr;
  const rows=sales||[],exp=expenses||[],usage=api||[];const gross=sum(rows,"gmv"),hpp=sum(rows,"cost_product"),shipping=sum(rows,"shipping_cost"),ads=sum(rows,"ads_spend"),commission=sum(rows,"commission"),other=exp.reduce((a:any,x:any)=>a+(String(x.currency||"IDR")==="IDR"?num(x.amount):0),0),apiIdr=sum(usage,"cost_idr"),apiUsd=sum(usage,"cost_usd");const direct=hpp+shipping+ads+commission;const contribution=gross-direct;const profit=contribution-other-apiIdr;const metrics={sales:gross,hpp,shipping,ads,commission,direct_cost:direct,contribution_margin:contribution,margin_pct:gross?contribution/gross*100:0,api_cost_idr:apiIdr,api_cost_usd:apiUsd,expenses:other,cashflow:profit,profit_loss:profit,rows:rows.length};
  const key=await getServerSecret(ctx.admin,"luma_openai_api_key");if(!key)return NextResponse.json({ok:false,error:"OpenAI integration belum dikonfigurasi."},{status:503});
  const title=({sales:"Laporan Penjualan",api_cost:"Laporan Biaya API",cashflow:"Laporan Cashflow",margin:"Laporan Margin",profit_loss:"Laporan Laba & Rugi"} as any)[type]||"Laporan Keuangan & Penjualan";
  const routed=await openAIResponsesWithFailover(ctx.admin,key,{instructions:"Anda adalah analis keuangan internal Lumaway. Gunakan hanya angka input. Jelaskan ringkas, managerial, tidak mengarang. Bedakan GMV dari cash revenue jika data payment tidak tersedia. Beri risiko dan tindakan cost-control.",input:JSON.stringify({report_type:type,period:{start:start||null,end:end||null},metrics,expenses:exp.slice(0,100),api_usage:usage.slice(0,100)}),text:{format:{type:"json_schema",name:"lumaway_financial_report",schema,strict:true}},store:false},"gpt-5.6-sol");
  const insight=JSON.parse(outputText(routed.raw));const doc=documentJson(title,{start,end},metrics,insight);const {data:created,error}=await ctx.admin.from("luma_financial_reports").insert({report_type:type,period_start:start||null,period_end:end||null,title,input_json:{metrics,expenses:exp,api_usage:usage},insight_json:{...insight,document_json:doc,cost:routed.cost,fallback_used:routed.fallback_used},model:routed.model,created_by:ctx.user.id}).select("*").single();if(error)throw error;
  const u=routed.raw?.usage||{};await ctx.admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:ctx.user.id,provider:"openai",service:"financial_report",request_type:type,model:routed.model,input_tokens:num(u.input_tokens),output_tokens:num(u.output_tokens),total_tokens:num(u.total_tokens),cost_usd:routed.cost.cost_usd,cost_idr:routed.cost.cost_idr,status:"success",reference:String(created.id),metadata:{fallback_used:routed.fallback_used}});
  return NextResponse.json({ok:true,report:created,metrics,insight:{...insight,document_json:doc},model:routed.model});
 }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Gagal membuat laporan."},{status:400})}
}
