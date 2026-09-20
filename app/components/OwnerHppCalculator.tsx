"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {LumaLoadingMotion} from "./LumaMotionState";

type Row=Record<string,any>;
const money=(value:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(value||0));
const fields:Array<[string,string,string?]>= [
 ["monthly_price","Harga Langganan / User / Bulan"],
 ["monthly_users","Target Active User / Bulan"],
 ["promo_discount_pct","Promo / Discount %"],
 ["payment_fee_pct","Payment Gateway Fee %"],
 ["payment_fee_fixed","Payment Fee Tetap / Transaksi"],
 ["affiliate_commission_pct","Affiliate / Referral %"],
 ["tax_pct","Tax %"],
 ["target_margin_pct","Target Margin %"],
 ["ai_cost_per_user","OpenAI / AI Cost per User"],
 ["whatsapp_cost_per_user","WhatsApp / OTP per User"],
 ["storage_cost_per_user","Storage / Bandwidth per User"],
 ["support_cost_per_user","Support Cost per User"],
 ["monthly_infra_fixed","Infrastructure / VPS Bulanan"],
 ["monthly_software_fixed","Software / Tools Bulanan"],
 ["monthly_team_fixed","Team / Labor Bulanan"],
 ["monthly_marketing_fixed","Marketing Bulanan"],
 ["other_fixed","Fixed Cost Lain"]
];

function blank(){
 return {
  name:"Lumaway Pricing Scenario",
  sku:"PLAN-MONTHLY",
  product_name:"Lumaway Subscription",
  metrics:{
   monthly_price:0,monthly_users:100,promo_discount_pct:0,payment_fee_pct:0,payment_fee_fixed:0,
   affiliate_commission_pct:0,tax_pct:0,target_margin_pct:60,ai_cost_per_user:0,whatsapp_cost_per_user:0,
   storage_cost_per_user:0,support_cost_per_user:0,monthly_infra_fixed:0,monthly_software_fixed:0,
   monthly_team_fixed:0,monthly_marketing_fixed:0,other_fixed:0
  }
 };
}

export default function OwnerHppCalculator({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [form,setForm]=useState<any>(blank());
 const [rows,setRows]=useState<Row[]>([]);
 const [result,setResult]=useState<any>(null);
 const [insight,setInsight]=useState<any>(null);
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState("");

 async function load(){
  const {data}=await supabase.from("luma_hpp_scenarios").select("*").order("created_at",{ascending:false}).limit(50);
  setRows((data||[]) as Row[]);
 }
 useEffect(()=>{void load()},[]);

 async function calculate(){
  setBusy(true);setMsg("");
  try{
   const response=await fetch("/api/admin/hpp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,...form})});
   const data=await response.json();
   if(!response.ok||!data.ok)throw new Error(data.error||"Gagal menghitung pricing guardrail.");
   setResult(data.result);setInsight(data.insight);setMsg("Scenario pricing Lumaway tersimpan dan dianalisis.");await load();
  }catch(error:any){setMsg(error.message)}finally{setBusy(false)}
 }

 function edit(key:string,value:any){setForm({...form,metrics:{...form.metrics,[key]:value}})}
 function loadScenario(row:Row){setForm({name:row.name||"Lumaway Pricing Scenario",sku:row.sku||"",product_name:row.product_name||"Lumaway Subscription",metrics:{...blank().metrics,...(row.metrics||{})}});setResult(row.result||null);setInsight(row.ai_insight||null);setMsg("Scenario dimuat untuk dibandingkan atau dihitung ulang.");window.scrollTo({top:0,behavior:"smooth"})}

 return <div className="owner-section-stack">
  <section className="owner-panel hpp-calculator">
   <div className="owner-panel-head"><div><h3>AI Subscription Pricing & Cost Guardrail</h3><p>Simulator unit economics khusus operasional Lumaway untuk menentukan harga langganan yang masuk akal sebelum subscription, Xendit/DOKU, token AI, dan biaya layanan berjalan penuh.</p></div></div>
   <div className="pricing-guardrail-note"><strong>Fokus: bisnis SaaS Lumaway.</strong><span>Masukkan biaya aktual atau asumsi terkontrol untuk OpenAI, WhatsApp/OTP, storage, payment gateway, referral, infrastruktur, software, team, marketing, dan overhead. Kalkulator ini tidak menggunakan HPP produk ecommerce customer.</span></div>
   <div className="grid"><label>Scenario<input value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label><label>Plan Code<input value={form.sku} onChange={event=>setForm({...form,sku:event.target.value})}/></label><label>Plan Name<input value={form.product_name} onChange={event=>setForm({...form,product_name:event.target.value})}/></label></div>
   <div className="hpp-field-grid">{fields.map(([key,label])=><label key={key}>{label}<input type="number" step=".01" min="0" value={form.metrics[key]} onChange={event=>edit(key,event.target.value)}/></label>)}</div>
   <button className="primary" disabled={busy} onClick={()=>void calculate()}>{busy?"Analyzing...":"Hitung Harga Langganan + Analisis AI"}</button>
   {busy&&<LumaLoadingMotion compact label="Menghitung unit economics Lumaway" detail="Kalkulasi matematika dilakukan lebih dulu, lalu GPT-5.6 Sol menilai harga, promo, cost per user, target margin, dan risiko operasional SaaS."/>}

   {result&&<div className="hpp-result-grid pricing-result-grid">
    <div><span>Net Revenue / User</span><b>{money(result.net_revenue_per_user)}</b></div>
    <div><span>Total Cost / User</span><b>{money(result.total_cost_per_user)}</b></div>
    <div className={result.is_loss?"loss":"profit"}><span>Contribution / User</span><b>{money(result.contribution_margin_per_user)}</b></div>
    <div><span>Margin %</span><b>{Number(result.margin_pct||0).toFixed(2)}%</b></div>
    <div><span>Recommended Min. Price</span><b>{result.recommended_minimum_price==null?"N/A":money(result.recommended_minimum_price)}</b></div>
    <div><span>Monthly Revenue</span><b>{money(result.monthly_revenue)}</b></div>
    <div><span>Monthly Total Cost</span><b>{money(result.monthly_total_cost)}</b></div>
    <div className={Number(result.monthly_profit)<0?"loss":"profit"}><span>Monthly Profit / Loss</span><b>{money(result.monthly_profit)}</b></div>
    <div><span>Break-even Users</span><b>{result.break_even_users==null?"N/A":new Intl.NumberFormat("id-ID").format(result.break_even_users)}</b></div>
    <div><span>Target Margin</span><b>{Number(result.target_margin_pct||0).toFixed(2)}%</b></div>
   </div>}

   {insight&&<div className={`card hpp-ai-insight risk-${String(insight.risk_level||"").toLowerCase()}`}><h4>AI Pricing Risk · {insight.risk_level}</h4><p>{insight.summary}</p><ul>{(insight.recommendations||[]).map((item:string,index:number)=><li key={index}>{item}</li>)}</ul></div>}
   {msg&&<div className="owner-inline-note">{msg}</div>}
  </section>

  <section className="owner-panel">
   <div className="owner-panel-head"><div><h3>Saved Pricing Scenarios</h3><p>Gunakan beberapa scenario untuk membandingkan harga paket, jumlah user, target margin, dan asumsi biaya sebelum menentukan pricing final Lumaway.</p></div></div>
   <div className="owner-table-wrap"><table><thead><tr><th>Scenario</th><th>Plan</th><th>Price</th><th>Users</th><th>Margin</th><th>Monthly P/L</th><th>Risk</th><th>Date</th><th></th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.name}</td><td>{row.product_name||row.sku||"-"}</td><td>{money(row.result?.monthly_price)}</td><td>{Number(row.result?.monthly_users||0)}</td><td>{Number(row.result?.margin_pct||0).toFixed(2)}%</td><td>{money(row.result?.monthly_profit)}</td><td>{row.ai_insight?.risk_level||"-"}</td><td>{new Date(row.created_at).toLocaleString("id-ID")}</td><td><button onClick={()=>loadScenario(row)}>Load</button></td></tr>)}</tbody></table></div>
  </section>
 </div>;
}
