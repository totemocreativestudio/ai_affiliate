"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

type Row=Record<string,any>;
const rp=(v:any)=>v===null||v===undefined?"-":"Rp "+Math.round(Number(v||0)).toLocaleString("id-ID");
const pct=(v:any)=>v===null||v===undefined?"-":Number(v).toLocaleString("id-ID",{maximumFractionDigits:2})+"%";
const CATEGORIES=[["host_cost","Host Cost"],["studio_cost","Studio Cost"],["live_ads","Live Ads"],["production_cost","Production Cost"],["voucher_promo","Voucher / Promo"],["other","Other Cost"]] as const;

export default function LivePnLPanel({workspaceId,start,end}:{workspaceId:string;start:string;end:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [platform,setPlatform]=useState(""),[data,setData]=useState<Row>({}),[loading,setLoading]=useState(true),[msg,setMsg]=useState("");
 const [form,setForm]=useState({cost_date:end,platform:"",category:"host_cost",amount:"",note:""});
 const [busy,setBusy]=useState(false);

 async function load(){
  setLoading(true);
  const x=await supabase.rpc("luma_live_pnl_v1",{p_workspace_id:workspaceId,p_start:start,p_end:end,p_platform:platform||null});
  if(x.error){setMsg(x.error.message);setData({})}else{setData(x.data||{});setMsg("")}
  setLoading(false);
 }
 useEffect(()=>{setForm(f=>({...f,cost_date:end||f.cost_date}));void load()},[workspaceId,start,end,platform]);

 async function addCost(){
  const amount=Number(form.amount||0);if(!form.cost_date||!amount||amount<0)return setMsg("Tanggal dan nominal biaya wajib diisi.");
  setBusy(true);setMsg("");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setBusy(false);return}
  const x=await supabase.from("live_cost_entries").insert({workspace_id:workspaceId,cost_date:form.cost_date,platform:form.platform||null,category:form.category,amount,note:form.note||null,created_by:user.id});
  if(x.error)setMsg(x.error.message);else{setForm({...form,amount:"",note:""});setMsg("Biaya Live tersimpan.");await load();window.dispatchEvent(new CustomEvent("lumaway-live-updated"))}
  setBusy(false);
 }
 async function removeCost(id:number){
  const x=await supabase.from("live_cost_entries").delete().eq("workspace_id",workspaceId).eq("id",id);
  if(x.error)setMsg(x.error.message);else{await load();window.dispatchEvent(new CustomEvent("lumaway-live-updated"))}
 }

 const r=data.revenue||{},h=data.hpp||{},c=data.costs||{},p=data.pnl||{},entries=data.entries||[];
 const coverage=Number(h.coverage_pct||0);
 return <div className="live-pnl-panel">
  <header className="lpnl-head"><div><span>LIVE FINANCE ONLY</span><h2>Live P&L & Cost Allocation</h2><p>Revenue, HPP, dan biaya operasional di halaman ini hanya berasal dari domain Live Streaming.</p></div><select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="">Semua Platform</option><option value="Shopee">Shopee</option><option value="TikTok">TikTok</option></select></header>
  <div className="lpnl-domain-note"><b>Tidak mencampur Affiliate.</b> Affiliate commission, creator cost Affiliate, dan Affiliate Product Performance tidak digunakan pada perhitungan ini.</div>
  {msg&&<div className="live-upload-msg">{msg}</div>}
  {loading?<div className="live-loading">Menghitung Live P&L...</div>:<>
   <div className="lpnl-kpis">
    <article><span>Live Revenue</span><strong>{rp(r.total)}</strong><small>Shopee {rp(r.shopee)} · TikTok {rp(r.tiktok)}</small></article>
    <article><span>Known Live HPP</span><strong>{rp(h.known)}</strong><small>Coverage {pct(coverage)}</small></article>
    <article><span>Operational Cost</span><strong>{rp(c.total_cost)}</strong><small>Host, studio, ads, production, voucher, other</small></article>
    <article><span>Contribution Margin</span><strong>{rp(p.contribution_margin)}</strong><small>{pct(p.margin_pct)} dari Live Revenue</small></article>
   </div>

   {coverage<100&&Number(h.total_qty||0)>0&&<div className="lpnl-coverage-warning"><b>HPP belum lengkap.</b><span>Hanya {pct(coverage)} Qty Live yang memiliki HPP terpetakan. Contribution Margin saat ini adalah partial coverage, bukan full margin.</span></div>}

   <div className="lpnl-grid">
    <section className="lpnl-card"><header><div><span>P&L WATERFALL</span><h3>Contribution</h3></div></header><div className="lpnl-lines">
     <div><span>Live Revenue</span><b>{rp(r.total)}</b></div>
     <div><span>Known Live HPP</span><b>- {rp(h.known)}</b></div>
     <div className="subtotal"><span>Gross Contribution</span><b>{rp(p.gross_contribution_before_operational)}</b></div>
     <div><span>Host Cost</span><b>- {rp(c.host_cost)}</b></div><div><span>Studio Cost</span><b>- {rp(c.studio_cost)}</b></div><div><span>Live Ads</span><b>- {rp(c.live_ads)}</b></div><div><span>Production Cost</span><b>- {rp(c.production_cost)}</b></div><div><span>Voucher / Promo</span><b>- {rp(c.voucher_promo)}</b></div><div><span>Other</span><b>- {rp(c.other_cost)}</b></div>
     <div className="total"><span>Live Contribution Margin</span><b>{rp(p.contribution_margin)}</b></div>
    </div></section>

    <section className="lpnl-card"><header><div><span>COST ENTRY</span><h3>Tambah biaya Live</h3></div></header><div className="lpnl-form">
     <label>Tanggal<input type="date" value={form.cost_date} onChange={e=>setForm({...form,cost_date:e.target.value})}/></label>
     <label>Platform<select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})}><option value="">Shared / Semua</option><option>Shopee</option><option>TikTok</option></select></label>
     <label>Kategori<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{CATEGORIES.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
     <label>Nominal<input type="number" min="0" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0"/></label>
     <label className="wide">Catatan<input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Contoh: Host shift malam / ads payday"/></label>
     <button disabled={busy} onClick={()=>void addCost()}>{busy?"Menyimpan...":"Simpan Biaya"}</button>
    </div></section>
   </div>

   <section className="lpnl-card"><header><div><span>COST HISTORY</span><h3>Riwayat biaya Live</h3></div><small>{start} → {end}</small></header>
    <div className="lpnl-table"><table><thead><tr><th>Tanggal</th><th>Platform</th><th>Kategori</th><th>Catatan</th><th>Nominal</th><th></th></tr></thead><tbody>
     {entries.length?entries.map((x:Row)=><tr key={x.id}><td>{x.cost_date}</td><td>{x.platform||"Shared"}</td><td>{CATEGORIES.find(([k])=>k===x.category)?.[1]||x.category}</td><td>{x.note||"-"}</td><td>{rp(x.amount)}</td><td><button onClick={()=>void removeCost(Number(x.id))}>Hapus</button></td></tr>):<tr><td colSpan={6}>Belum ada biaya Live pada periode ini.</td></tr>}
    </tbody></table></div>
   </section>
  </>}
 </div>;
}
