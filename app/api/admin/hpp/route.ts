import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";
import {getServerSecret} from "../../../../lib/server-secrets";
import {openAIResponsesWithFailover} from "../../../../lib/openai-router";

export const runtime="nodejs";

function outputText(data:any){
 if(typeof data?.output_text==="string")return data.output_text;
 for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==="output_text"&&part?.text)return part.text;
 return "";
}

const schema={type:"object",additionalProperties:false,properties:{
 summary:{type:"string"},
 risk_level:{type:"string",enum:["LOW","MEDIUM","HIGH"]},
 findings:{type:"array",items:{type:"string"}},
 recommendations:{type:"array",items:{type:"string"}}
},required:["summary","risk_level","findings","recommendations"]};

export async function POST(req:NextRequest){
 try{
  const body=await req.json();
  const workspaceId=String(body.workspace_id||"");
  const ctx=await getServerContext(workspaceId);
  if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Control Center access required."},{status:403});

  const metrics=body.metrics||{};
  const n=(key:string)=>Math.max(0,Number(metrics[key]||0));
  const monthlyPrice=n("monthly_price");
  const users=Math.max(1,Math.round(n("monthly_users")||1));
  const discountRate=Math.min(100,n("promo_discount_pct"))/100;
  const paymentFeeRate=Math.min(100,n("payment_fee_pct"))/100;
  const affiliateRate=Math.min(100,n("affiliate_commission_pct"))/100;
  const taxRate=Math.min(100,n("tax_pct"))/100;
  const targetMarginRate=Math.min(95,n("target_margin_pct"))/100;

  const grossAfterDiscount=monthlyPrice*(1-discountRate);
  const paymentFee=grossAfterDiscount*paymentFeeRate+n("payment_fee_fixed");
  const affiliateCost=grossAfterDiscount*affiliateRate;
  const taxCost=grossAfterDiscount*taxRate;
  const nonPriceVariable=n("ai_cost_per_user")+n("whatsapp_cost_per_user")+n("storage_cost_per_user")+n("support_cost_per_user");
  const variableCostPerUser=nonPriceVariable+paymentFee+affiliateCost+taxCost;
  const fixedMonthly=n("monthly_infra_fixed")+n("monthly_team_fixed")+n("monthly_marketing_fixed")+n("monthly_software_fixed")+n("other_fixed");
  const fixedCostPerUser=fixedMonthly/users;
  const totalCostPerUser=variableCostPerUser+fixedCostPerUser;
  const contributionPerUser=grossAfterDiscount-totalCostPerUser;
  const marginPct=grossAfterDiscount>0?contributionPerUser/grossAfterDiscount*100:0;
  const monthlyRevenue=grossAfterDiscount*users;
  const monthlyTotalCost=variableCostPerUser*users+fixedMonthly;
  const monthlyProfit=monthlyRevenue-monthlyTotalCost;

  const priceLinkedRate=paymentFeeRate+affiliateRate+taxRate;
  const unitContributionBeforeFixed=grossAfterDiscount-(grossAfterDiscount*priceLinkedRate)-n("payment_fee_fixed")-nonPriceVariable;
  const breakEvenUsers=unitContributionBeforeFixed>0?Math.ceil(fixedMonthly/unitContributionBeforeFixed):null;
  const denominator=(1-discountRate)*(1-priceLinkedRate-targetMarginRate);
  const recommendedMinimumPrice=denominator>0?(nonPriceVariable+n("payment_fee_fixed")+fixedCostPerUser)/denominator:null;

  const result={
   monthly_price:monthlyPrice,
   monthly_users:users,
   net_revenue_per_user:grossAfterDiscount,
   variable_cost_per_user:variableCostPerUser,
   fixed_cost_monthly:fixedMonthly,
   fixed_cost_per_user:fixedCostPerUser,
   total_cost_per_user:totalCostPerUser,
   contribution_margin_per_user:contributionPerUser,
   margin_pct:marginPct,
   monthly_revenue:monthlyRevenue,
   monthly_total_cost:monthlyTotalCost,
   monthly_profit:monthlyProfit,
   break_even_users:breakEvenUsers,
   recommended_minimum_price:recommendedMinimumPrice,
   target_margin_pct:n("target_margin_pct"),
   promo_discount_amount:monthlyPrice*discountRate,
   payment_fee_per_user:paymentFee,
   affiliate_cost_per_user:affiliateCost,
   tax_per_user:taxCost,
   is_loss:monthlyProfit<0
  };

  const key=await getServerSecret(ctx.admin,"luma_openai_api_key");
  if(!key)return NextResponse.json({ok:false,error:"OpenAI integration belum dikonfigurasi."},{status:503});

  const routed=await openAIResponsesWithFailover(ctx.admin,key,{
   instructions:"Anda adalah SaaS pricing & unit economics analyst untuk Lumaway. Fokus hanya pada operasional Lumaway: harga langganan, jumlah user, usage OpenAI, WhatsApp/OTP, storage, support, payment gateway, affiliate/referral, pajak, infrastructure, software, tim, marketing, dan overhead. Gunakan hanya metrik input dan hasil kalkulasi. Jangan membahas HPP produk ecommerce fisik. Evaluasi apakah harga langganan dan promo menjaga target contribution margin, runway biaya, dan profit bulanan. Jika harga minimum rekomendasi tidak tersedia karena denominator tidak valid, jelaskan penyebabnya tanpa mengarang angka.",
   input:JSON.stringify({scenario:body.name,plan_code:body.sku,plan_name:body.product_name,metrics,result}),
   text:{format:{type:"json_schema",name:"lumaway_subscription_pricing_guardrail",schema,strict:true}},
   store:false
  },"gpt-5.6-sol");

  const insight=JSON.parse(outputText(routed.raw));
  const {data,error}=await ctx.admin.from("luma_hpp_scenarios").insert({
   name:String(body.name||"Lumaway Pricing Scenario"),
   sku:body.sku||null,
   product_name:body.product_name||null,
   metrics,
   result,
   ai_insight:insight,
   model:routed.model,
   created_by:ctx.user.id
  }).select("*").single();
  if(error)throw error;

  const usage=routed.raw?.usage||{};
  await ctx.admin.from("luma_api_usage_events").insert({
   workspace_id:workspaceId,user_id:ctx.user.id,provider:"openai",service:"hpp_analysis",request_type:"lumaway_subscription_pricing",
   model:routed.model,input_tokens:Number(usage.input_tokens||0),output_tokens:Number(usage.output_tokens||0),total_tokens:Number(usage.total_tokens||0),
   cost_usd:routed.cost.cost_usd,cost_idr:routed.cost.cost_idr,status:"success",reference:String(data.id),metadata:{fallback_used:routed.fallback_used}
  });

  return NextResponse.json({ok:true,scenario:data,result,insight,model:routed.model});
 }catch(error:any){
  return NextResponse.json({ok:false,error:error?.message||"Gagal menghitung pricing guardrail."},{status:400});
 }
}
