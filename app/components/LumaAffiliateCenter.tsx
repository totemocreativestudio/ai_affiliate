"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import AffiliateContentGenerators from "./AffiliateContentGenerators";

type Row=Record<string,any>;
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const CHANNELS=[
  ["BANK","BCA","BCA"],["BANK","BNI","BNI"],["BANK","BRI","BRI"],["BANK","MANDIRI","Mandiri"],["BANK","PERMATA","Permata"],
  ["EWALLET","ID_DANA","DANA"],["EWALLET","ID_GOPAY","GoPay"],["EWALLET","ID_OVO","OVO"],["EWALLET","ID_SHOPEEPAY","ShopeePay"],
] as const;

export default function LumaAffiliateCenter({workspaceId,userId}:{workspaceId:string;userId:string}){
  const supabase=createClient();
  const [profile,setProfile]=useState<Row|null>(null);
  const [events,setEvents]=useState<Row[]>([]);
  const [withdrawals,setWithdrawals]=useState<Row[]>([]);
  const [status,setStatus]=useState("");
  const [amount,setAmount]=useState("");
  const [channel,setChannel]=useState("BCA");
  const [account,setAccount]=useState("");
  const [accountName,setAccountName]=useState("");
  const [busy,setBusy]=useState(false);
  const [origin,setOrigin]=useState("");

  async function load(){
    const [p,e,w]=await Promise.all([
      supabase.from("referral_profiles").select("*").eq("user_id",userId).maybeSingle(),
      supabase.from("referral_events").select("*").eq("referrer_user_id",userId).order("created_at",{ascending:false}).limit(200),
      supabase.from("referral_withdrawals").select("*").eq("user_id",userId).order("requested_at",{ascending:false}).limit(100),
    ]);
    if(p.error)setStatus(p.error.message); else setProfile(p.data as Row);
    setEvents((e.data||[]) as Row[]); setWithdrawals((w.data||[]) as Row[]);
  }
  useEffect(()=>{setOrigin(window.location.origin);void load()},[workspaceId,userId]);

  const referralUrl=profile?.referral_code&&origin?`${origin}/?ref=${profile.referral_code}`:"";
  const earned=useMemo(()=>events.filter(x=>["confirmed","paid"].includes(String(x.status).toLowerCase())).reduce((a,x)=>a+Number(x.commission_amount||0),0),[events]);
  const pending=useMemo(()=>events.filter(x=>String(x.status).toLowerCase()==="pending").reduce((a,x)=>a+Number(x.commission_amount||0),0),[events]);
  const reserved=useMemo(()=>withdrawals.filter(x=>["pending","processing","paid"].includes(String(x.status).toLowerCase())).reduce((a,x)=>a+Number(x.amount||0),0),[withdrawals]);
  const available=Math.max(0,earned-reserved);
  const chosen=CHANNELS.find(x=>x[1]===channel)||CHANNELS[0];

  async function copy(text:string){
    try{await navigator.clipboard.writeText(text);setStatus("Referral URL disalin.")}catch{setStatus("Tidak dapat menyalin otomatis. Silakan copy URL secara manual.")}
  }

  async function withdraw(){
    const numeric=Number(amount||0);
    if(!numeric||numeric<=0)return setStatus("Masukkan nominal withdraw.");
    if(numeric>available)return setStatus("Nominal melebihi saldo referral tersedia.");
    if(!account.trim())return setStatus("Nomor rekening / nomor e-wallet wajib diisi.");
    setBusy(true);setStatus("Membuat permintaan pencairan...");
    const {data,error}=await supabase.rpc("luma_request_referral_withdrawal",{
      p_workspace_id:workspaceId,p_amount:numeric,p_method:chosen[0],p_channel_code:chosen[1],p_account_number:account.trim(),p_account_name:accountName.trim()||null
    });
    setBusy(false);
    if(error)return setStatus(error.message);
    setStatus(`Permintaan withdraw #${data} dibuat. Status awal: pending review.`);setAmount("");setAccount("");setAccountName("");await load();
  }

  return <section id="luma-affiliate" className="legacy-page-anchor affiliate-center">
    <div className="eyebrow">LUMA AFFILIATE</div><h1>Luma Affiliate</h1><p className="muted">Kode referral unik 12 karakter. Komisi tercatat dari order LUMA yang berhasil dibayar oleh user hasil referral.</p>

    <div className="affiliate-summary-grid">
      <div className="card referral-link-card">
        <div className="section-head"><div><small>Referral Code</small><strong className="referral-code">{profile?.referral_code||"Belum tersedia"}</strong></div><span className="ref-percent">5%</span></div>
        <label>Referral URL<div className="copy-field"><input readOnly value={referralUrl}/><button className="secondary" disabled={!referralUrl} onClick={()=>copy(referralUrl)}>Copy URL</button></div></label>
        <p className="muted">Gunakan URL ini untuk promosi. User baru yang registrasi melalui URL akan terhubung ke kode referral Anda.</p>
      </div>
      <div className="affiliate-balance-card card">
        <span>Saldo dapat dicairkan</span><b>{money(available)}</b>
        <div className="affiliate-mini-stats"><div><small>Confirmed</small><strong>{money(earned)}</strong></div><div><small>Pending</small><strong>{money(pending)}</strong></div><div><small>Withdrawn / Reserved</small><strong>{money(reserved)}</strong></div></div>
      </div>
    </div>

    <div className="grid affiliate-main-grid">
      <div className="card"><h3>Withdraw Commission</h3><p className="muted">Pencairan dirancang melalui Xendit Payout. Permintaan masuk ke review admin sebelum diproses ke rekening/e-wallet tujuan.</p>
        <div className="grid"><label>Nominal<input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Rp"/></label><label>Tujuan<select value={channel} onChange={e=>setChannel(e.target.value)}>{CHANNELS.map(x=><option key={x[1]} value={x[1]}>{x[2]} · {x[0]==="BANK"?"Bank":"E-Wallet"}</option>)}</select></label><label>Nomor rekening / e-wallet<input value={account} onChange={e=>setAccount(e.target.value)} placeholder={chosen[0]==="BANK"?"Nomor rekening":"Nomor HP e-wallet"}/></label><label>Nama pemilik<input value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Sesuai akun tujuan"/></label></div>
        <button className="primary" disabled={busy||available<=0} onClick={withdraw}>{busy?"Processing...":"Ajukan Withdraw"}</button>
        <div className="withdraw-guide"><b>Alur pencairan</b><span>1. Pilih tujuan → 2. Ajukan nominal → 3. Admin melakukan review → 4. Payout diproses → 5. Status berubah menjadi paid.</span></div>
        {status&&<div className="flash success">{status}</div>}
      </div>
      <div className="card"><h3>Riwayat Withdraw</h3>{withdrawals.length?<div className="scroll"><table><thead><tr><th>ID</th><th>Amount</th><th>Channel</th><th>Status</th><th>Requested</th></tr></thead><tbody>{withdrawals.map(x=><tr key={x.id}><td>#{x.id}</td><td>{money(x.amount)}</td><td>{x.channel_code}</td><td><span className={`status-pill s-${String(x.status).toLowerCase()}`}>{x.status}</span></td><td>{x.requested_at?new Date(x.requested_at).toLocaleString("id-ID"):"-"}</td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Belum ada withdraw.</strong><span>Saldo confirmed akan tersedia untuk diajukan.</span></div>}</div>
    </div>

    <AffiliateContentGenerators workspaceId={workspaceId}/>

    <div className="card"><div className="section-head"><div><h3>Riwayat Penjualan Referral</h3><p className="muted">Order, nilai transaksi, komisi 5%, dan status pencairan.</p></div></div>{events.length?<div className="scroll"><table><thead><tr><th>Order</th><th>Sale</th><th>Rate</th><th>Commission</th><th>Status</th><th>Date</th></tr></thead><tbody>{events.map(x=><tr key={x.id}><td>{x.reference||"-"}</td><td>{money(x.base_amount)}</td><td>{Number(x.commission_rate||.05)*100}%</td><td><b>{money(x.commission_amount)}</b></td><td><span className={`status-pill s-${String(x.status).toLowerCase()}`}>{x.status}</span></td><td>{x.created_at?new Date(x.created_at).toLocaleString("id-ID"):"-"}</td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Belum ada penjualan referral.</strong><span>Riwayat akan muncul setelah user referral melakukan pembayaran berhasil.</span></div>}</div>
  </section>;
}
