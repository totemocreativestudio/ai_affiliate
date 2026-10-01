"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const num=(v:any)=>Number(v||0).toLocaleString("id-ID");
const monthRange=()=>{const d=new Date(),y=d.getFullYear(),m=d.getMonth();return{start:new Date(y,m,1).toISOString().slice(0,10),end:new Date(y,m+1,0).toISOString().slice(0,10)}};

export default function SpendingCenter({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]),r=monthRange();
 const [start,setStart]=useState(r.start),[end,setEnd]=useState(r.end),[platform,setPlatform]=useState(""),[store,setStore]=useState("");
 const [stores,setStores]=useState<string[]>([]),[data,setData]=useState<any>({}),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){
  if(!start||!end)return;
  setLoading(true);setError("");
  const [x,s]=await Promise.all([
    supabase.rpc("luma_spending_center_v2",{p_workspace_id:workspaceId,p_start_date:start,p_end_date:end,p_platform:platform||null,p_store_name:store||null}),
    supabase.from("shipping").select("store_name").eq("workspace_id",workspaceId).not("store_name","is",null).limit(1500)
  ]);
  if(x.error){setError(x.error.message);setData({})}else setData(x.data||{});
  if(!s.error)setStores([...new Set((s.data||[]).map((v:any)=>String(v.store_name||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id")) as string[]);
  setLoading(false);
 }
 useEffect(()=>{void load()},[workspaceId,start,end,platform,store]);

 const b=data.breakdown||{},daily=data.daily||[],rows=data.shipping_rows||[];
 const parts=[
  ["HPP Penjualan",b.sales_hpp],
  ["HPP Sample Creator",b.sample_hpp],
  ["Komisi Creator",b.creator_commission],
  ["Ads Spend Support",b.ads_spend],
  ["Ongkir Affiliate",b.affiliate_shipping],
  ["Ongkir Operations",b.operations_shipping],
  ["Asuransi Operations",b.operations_insurance],
 ];
 const total=Number(b.total_spending||0),max=Math.max(...parts.map(x=>Number(x[1]||0)),1);
 const dailyMax=Math.max(...daily.map((x:any)=>Number(x.affiliate_cost||0)+Number(x.operations_shipping||0)),1);

 return <section id="spending" className="legacy-page-anchor spending-center">
  <header className="spending-head"><div><span>OPERATIONS & COST</span><h1>Spending Center</h1><p>Rekonsiliasi pengeluaran dari Affiliate, Ads, dan Operations Shipping dalam satu tampilan.</p></div><div className="spending-filters"><input type="date" value={start} onChange={e=>setStart(e.target.value)}/><span>→</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/><select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="">All Platform</option><option>TikTok</option><option>Shopee</option><option>Instagram</option><option>YouTube</option><option>Other</option></select><select value={store} onChange={e=>setStore(e.target.value)}><option value="">Semua Toko</option>{stores.map(x=><option key={x}>{x}</option>)}</select></div></header>
  {error&&<div className="shipping-v2-alert">{error}</div>}
  {loading?<div className="live-loading">Menghitung spending...</div>:<>
   <div className="spending-summary">
    <article className="primary"><span>Total Spending</span><strong>{money(total)}</strong><small>HPP sales + sample + Komisi + Ads + seluruh ongkir yang relevan</small></article>
    <article><span>Operations Shipping Spend</span><strong>{money(Number(b.operations_shipping||0)+Number(b.operations_insurance||0))}</strong><small>{num(data.shipment_rows)} shipment non-cancelled</small></article>
    <article><span>Affiliate Cost</span><strong>{money(Number(b.hpp||0)+Number(b.creator_commission||0)+Number(b.affiliate_shipping||0))}</strong><small>HPP sales + sample + komisi + affiliate shipping</small></article>
    <article><span>Ads Support</span><strong>{money(b.ads_spend)}</strong><small>Sesuai periode / platform / store aktif</small></article>
   </div>

   <div className="spending-grid">
    <section className="spending-card"><header><span>COST BREAKDOWN</span><h3>Sumber pengeluaran</h3></header><div className="spending-bars">{parts.map(([label,value])=>{const n=Number(value||0);return <div key={String(label)}><div><span>{label}</span><b>{money(n)}</b></div><div className="spending-track"><i style={{width:(n/max*100)+"%"}}/></div><small>{total?((n/total)*100).toFixed(1):"0.0"}% dari total</small></div>})}</div></section>
    <section className="spending-card"><header><span>DAILY TREND</span><h3>Affiliate vs Operations</h3></header><div className="spending-daily">{daily.map((x:any)=><div key={x.data_date} title={x.data_date+" · "+money(Number(x.affiliate_cost||0)+Number(x.operations_shipping||0))}><div><i style={{height:(Number(x.affiliate_cost||0)/dailyMax*100)+"%"}}/><b style={{height:(Number(x.operations_shipping||0)/dailyMax*100)+"%"}}/></div><span>{String(x.data_date).slice(8)}</span></div>)}</div><div className="spending-legend"><span><i/>Affiliate Cost</span><span><b/>Operations Shipping</span></div></section>
   </div>

   <section className="spending-card"><header><div><span>OPERATIONS SHIPPING</span><h3>Detail pengeluaran ongkir</h3></div><small>COD tidak dihitung sebagai spending</small></header><div className="spending-table"><table><thead><tr><th>Tanggal</th><th>Reference</th><th>Creator</th><th>Platform</th><th>Store</th><th>Kurir</th><th>Status</th><th>Shipping</th><th>Insurance</th><th>Total</th></tr></thead><tbody>{rows.map((x:any)=><tr key={x.id}><td>{x.data_date||"-"}</td><td><b>{x.reference_no||("LUMA-"+x.id)}</b></td><td>{x.creator_name||"-"}</td><td>{x.platform||"-"}</td><td>{x.store_name||"-"}</td><td>{[x.courier,x.service].filter(Boolean).join(" · ")||"-"}</td><td>{x.status||"-"}</td><td>{money(x.shipping_cost)}</td><td>{money(x.insurance_amount)}</td><td><b>{money(x.spending)}</b></td></tr>)}{!rows.length&&<tr><td colSpan={10}>Belum ada Operations Shipping pada filter ini.</td></tr>}</tbody></table></div></section>
  </>}
 </section>
}
