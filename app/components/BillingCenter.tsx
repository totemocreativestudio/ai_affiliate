"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Row=Record<string,any>;
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const fmt=(v:any)=>new Intl.NumberFormat("id-ID").format(Number(v||0));

export default function BillingCenter({workspaceId,userId}:{workspaceId:string;userId:string}){
  const supabase=createClient();
  const [wallet,setWallet]=useState<Row|null>(null);
  const [orders,setOrders]=useState<Row[]>([]);
  const [transactions,setTransactions]=useState<Row[]>([]);
  const [packages,setPackages]=useState<Row[]>([]);
  const [gateway,setGateway]=useState<any>(null);
  const [status,setStatus]=useState("");
  const [busyId,setBusyId]=useState<number|null>(null);

  async function load(){
    const month=new Date().toISOString().slice(0,7);
    const [w,o,t,p,g]=await Promise.all([
      supabase.from("luma_token_wallets").select("*").eq("workspace_id",workspaceId).eq("user_id",userId).eq("month",month).maybeSingle(),
      supabase.from("luma_topup_orders").select("*").eq("workspace_id",workspaceId).eq("user_id",userId).order("created_at",{ascending:false}).limit(50),
      supabase.from("luma_token_transactions").select("*").eq("workspace_id",workspaceId).eq("user_id",userId).order("created_at",{ascending:false}).limit(100),
      supabase.from("luma_token_packages").select("*").order("sort_order",{ascending:true}),
      fetch(`/api/integrations/xendit?workspace_id=${encodeURIComponent(workspaceId)}`).then(r=>r.json()).catch(()=>null),
    ]);
    setWallet((w.data||null) as Row|null);setOrders((o.data||[]) as Row[]);setTransactions((t.data||[]) as Row[]);setPackages((p.data||[]) as Row[]);setGateway(g);
  }
  useEffect(()=>{void load()},[workspaceId,userId]);

  const monthlyRemaining=Math.max(0,Number(wallet?.monthly_limit??50)-Number(wallet?.used_tokens??0));
  const bonus=Math.max(0,Number(wallet?.bonus_tokens??0));
  const available=monthlyRemaining+bonus;
  const used=Number(wallet?.used_tokens??0);
  const usagePct=Math.min(100,Math.round((used/Math.max(1,Number(wallet?.monthly_limit??50)))*100));

  async function checkout(pkg:Row){
    if(pkg.status!=="active"||Number(pkg.price)<=0)return setStatus("Paket ini belum diaktifkan atau harga belum ditetapkan oleh admin.");
    setBusyId(pkg.id);setStatus("Membuat secure checkout...");
    try{
      const r=await fetch("/api/payments/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,package_id:pkg.id})});
      const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Gagal membuat checkout.");
      setStatus(`Checkout ${d.order_code} dibuat. Mengalihkan ke payment gateway...`);
      await load();
      if(d.payment_url)window.location.href=d.payment_url;
    }catch(e:any){setStatus(e?.message||"Checkout gagal.")}finally{setBusyId(null)}
  }

  const activeOrders=useMemo(()=>orders.filter(x=>["pending","processing"].includes(String(x.status).toLowerCase())),[orders]);

  return <section id="billing" className="legacy-page-anchor billing-v2">
    <div className="eyebrow">LUMA BILLING</div><div className="billing-title-row"><div><h1>Billing & Token</h1><p className="muted">Kelola quota AI, top up, metode pembayaran, dan riwayat penggunaan token dari satu halaman.</p></div><span className={`integration-badge ${gateway?.configured?"connected":"disconnected"}`}>{gateway?.configured?"Payment Ready":"Payment Setup Needed"}</span></div>

    <div className="billing-kpi-grid">
      <div className="billing-wallet-card"><span>Available Balance</span><b>{fmt(available)}</b><small>token tersedia</small><div className="token-progress"><i style={{width:`${usagePct}%`}}/></div><em>{fmt(used)} dari {fmt(wallet?.monthly_limit??50)} quota bulanan terpakai</em></div>
      <div className="billing-stat-card"><span>Monthly Remaining</span><b>{fmt(monthlyRemaining)}</b><small>reset setiap bulan</small></div>
      <div className="billing-stat-card"><span>Top Up / Bonus</span><b>{fmt(bonus)}</b><small>tidak mengurangi quota bulanan</small></div>
      <div className="billing-stat-card"><span>Pending Payment</span><b>{fmt(activeOrders.length)}</b><small>checkout belum selesai</small></div>
    </div>

    <div className="card payment-method-card"><div className="section-head"><div><h3>Payment Methods</h3><p className="muted">Checkout diarahkan ke secure hosted payment page. Metode yang tampil bergantung pada channel yang sudah diaktifkan di akun merchant.</p></div></div><div className="payment-methods"><span>QRIS</span><span>Virtual Account</span><span>GoPay</span><span>DANA</span><span>OVO</span><span>ShopeePay</span><span>Bank Transfer</span></div>{!gateway?.configured&&<div className="flash error">Payment gateway Xendit belum dikonfigurasi oleh owner LUMA. Paket tetap terlihat, tetapi checkout belum dapat diproses.</div>}</div>

    <div className="card"><div className="section-head"><div><h3>Top Up Token</h3><p className="muted">Pilih paket. Payment gateway memverifikasi pembayaran sebelum token ditambahkan otomatis.</p></div></div>
      <div className="token-package-grid">{packages.map(pkg=><article className={`token-package ${pkg.status!=="active"?"draft":""}`} key={pkg.id}><span>{pkg.label}</span><b>{fmt(pkg.tokens)} <small>token</small></b><strong>{Number(pkg.price)>0?money(pkg.price):"Harga belum ditetapkan"}</strong><button className="primary" disabled={busyId===pkg.id||pkg.status!=="active"||Number(pkg.price)<=0||!gateway?.configured} onClick={()=>checkout(pkg)}>{busyId===pkg.id?"Preparing...":"Bayar & Top Up"}</button>{pkg.status!=="active"&&<em>Menunggu aktivasi admin</em>}</article>)}</div>
      {status&&<div className={`flash ${status.toLowerCase().includes("gagal")||status.toLowerCase().includes("belum")?"error":"success"}`}>{status}</div>}
    </div>

    <div className="grid billing-history-grid">
      <div className="card"><h3>Riwayat Pembayaran</h3>{orders.length?<div className="scroll"><table><thead><tr><th>Order</th><th>Token</th><th>Amount</th><th>Status</th><th>Method</th><th>Date</th></tr></thead><tbody>{orders.map(x=><tr key={x.id}><td>{x.order_code}</td><td>{fmt(x.package_tokens)}</td><td>{money(x.amount)}</td><td><span className={`status-pill s-${String(x.status).toLowerCase()}`}>{x.status}</span></td><td>{x.payment_method||x.payment_provider||"-"}</td><td>{x.created_at?new Date(x.created_at).toLocaleString("id-ID"):"-"}</td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Belum ada pembayaran.</strong></div>}</div>
      <div className="card"><h3>Riwayat Token</h3>{transactions.length?<div className="scroll"><table><thead><tr><th>Type</th><th>Token</th><th>Reference</th><th>Description</th><th>Date</th></tr></thead><tbody>{transactions.map(x=><tr key={x.id}><td>{x.transaction_type}</td><td className={Number(x.amount)<0?"token-negative":"token-positive"}>{Number(x.amount)>0?"+":""}{fmt(x.amount)}</td><td>{x.reference||"-"}</td><td>{x.description||"-"}</td><td>{x.created_at?new Date(x.created_at).toLocaleString("id-ID"):"-"}</td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Belum ada penggunaan token.</strong></div>}</div>
    </div>
  </section>;
}
