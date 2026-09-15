"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Row=Record<string,any>;
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const fmt=(v:any)=>new Intl.NumberFormat("id-ID").format(Number(v||0));

export default function OwnerFinanceControl(){
  const supabase=useMemo(()=>createClient(),[]);
  const [orders,setOrders]=useState<Row[]>([]),[withdrawals,setWithdrawals]=useState<Row[]>([]),[packages,setPackages]=useState<Row[]>([]),[msg,setMsg]=useState("");
  async function load(){const [o,w,p]=await Promise.all([supabase.from("luma_topup_orders").select("*").order("created_at",{ascending:false}).limit(1000),supabase.from("referral_withdrawals").select("*").order("requested_at",{ascending:false}).limit(1000),supabase.from("luma_token_packages").select("*").order("sort_order",{ascending:true})]);setOrders((o.data||[]) as Row[]);setWithdrawals((w.data||[]) as Row[]);setPackages((p.data||[]) as Row[])}
  useEffect(()=>{void load()},[]);
  const revenue=orders.filter(x=>String(x.status).toLowerCase()==="paid").reduce((a,x)=>a+Number(x.amount||0),0);
  const pending=withdrawals.filter(x=>["pending","processing"].includes(String(x.status).toLowerCase()));
  async function savePackage(pkg:Row){const {error}=await supabase.from("luma_token_packages").update({label:pkg.label,tokens:Number(pkg.tokens),price:Number(pkg.price),status:pkg.status,updated_at:new Date().toISOString()}).eq("id",pkg.id);setMsg(error?error.message:"Token package updated.");if(!error)await load()}
  async function payout(id:number,status:string){const {error}=await supabase.from("referral_withdrawals").update({status,processed_at:["paid","failed","rejected"].includes(status)?new Date().toISOString():null}).eq("id",id);setMsg(error?error.message:`Withdrawal #${id} → ${status}`);if(!error)await load()}
  return <div className="owner-section-stack">
    <div className="owner-kpi-row"><Metric label="Captured Revenue" value={money(revenue)} sub={`${fmt(orders.length)} top-up orders`}/><Metric label="Pending Payment" value={fmt(orders.filter(x=>x.status==="pending").length)}/><Metric label="Payout Queue" value={fmt(pending.length)} sub={money(pending.reduce((a,x)=>a+Number(x.amount||0),0))}/><Metric label="Paid Payout" value={money(withdrawals.filter(x=>x.status==="paid").reduce((a,x)=>a+Number(x.amount||0),0))}/></div>
    {msg&&<div className="owner-inline-note">{msg}</div>}
    <section className="owner-panel"><div className="owner-panel-head"><div><h3>Token Packages</h3><p>Pricing yang muncul di Billing & Token user.</p></div></div><div className="owner-package-table">{packages.map((pkg,i)=><div className="owner-package-row" key={pkg.id}><input value={pkg.label||""} onChange={e=>setPackages(p=>p.map((x,j)=>j===i?{...x,label:e.target.value}:x))}/><input type="number" value={pkg.tokens||0} onChange={e=>setPackages(p=>p.map((x,j)=>j===i?{...x,tokens:e.target.value}:x))}/><input type="number" value={pkg.price||0} onChange={e=>setPackages(p=>p.map((x,j)=>j===i?{...x,price:e.target.value}:x))}/><select value={pkg.status||"draft"} onChange={e=>setPackages(p=>p.map((x,j)=>j===i?{...x,status:e.target.value}:x))}><option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option></select><button onClick={()=>savePackage(pkg)}>Save</button></div>)}</div></section>
    <Table title="Payment History" rows={orders} cols={["order_code","user_id","package_tokens","amount","payment_method","payment_provider","status","created_at"]}/>
    <section className="owner-panel"><div className="owner-panel-head"><div><h3>Referral Withdrawals</h3><p>Perubahan status diteruskan sebagai notifikasi personal ke user.</p></div></div><div className="owner-table-wrap"><table><thead><tr><th>ID</th><th>User</th><th>Amount</th><th>Channel</th><th>Account</th><th>Status</th><th>Action</th></tr></thead><tbody>{withdrawals.map(x=><tr key={x.id}><td>#{x.id}</td><td>{x.user_id}</td><td>{money(x.amount)}</td><td>{x.channel_code||x.payout_method}</td><td>{x.account_number}<small>{x.account_name}</small></td><td>{x.status}</td><td><div className="button-row"><button disabled={x.status!=="pending"} onClick={()=>payout(x.id,"processing")}>Process</button><button disabled={!["pending","processing"].includes(x.status)} onClick={()=>payout(x.id,"paid")}>Paid</button><button disabled={!["pending","processing"].includes(x.status)} onClick={()=>payout(x.id,"failed")}>Failed</button></div></td></tr>)}</tbody></table></div></section>
  </div>;
}
function Metric({label,value,sub}:{label:string;value:any;sub?:string}){return <div className="owner-metric"><span>{label}</span><b>{value}</b>{sub&&<small>{sub}</small>}</div>}
function Table({title,rows,cols}:{title:string;rows:Row[];cols:string[]}){return <section className="owner-panel"><div className="owner-panel-head"><div><h3>{title}</h3><p>{fmt(rows.length)} records</p></div></div><div className="owner-table-wrap"><table><thead><tr>{cols.map(c=><th key={c}>{c.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{cols.map(c=><td key={c}>{c==="amount"?money(r[c]):c==="created_at"&&r[c]?new Date(r[c]).toLocaleString("id-ID"):String(r[c]??"-")}</td>)}</tr>)}</tbody></table></div></section>}
