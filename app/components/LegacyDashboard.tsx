"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Props = { workspaceId: string };
type KPI = { total_creators:number; total_sales_records:number; total_qty:number; total_orders:number; total_gmv:number; total_commission:number };
type RankRow = { rank:number; creator_id:number; creator_code:string|null; creator_name:string|null; username:string|null; platform:string|null; qty:number; orders:number; gmv:number; commission:number; total_rows:number };
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const number=(v:any)=>new Intl.NumberFormat("id-ID").format(Number(v||0));

export default function LegacyDashboard({ workspaceId }: Props) {
  const supabase=createClient();
  const [start,setStart]=useState("2026-06-01");
  const [end,setEnd]=useState("2026-08-31");
  const [platform,setPlatform]=useState("");
  const [kpi,setKpi]=useState<KPI|null>(null);
  const [ranking,setRanking]=useState<RankRow[]>([]);
  const [page,setPage]=useState(1);
  const [total,setTotal]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function load(targetPage=page){
    setBusy(true);setError("");
    try{
      const {data:k,error:ke}=await supabase.rpc("get_dashboard_kpi",{p_workspace_id:workspaceId,p_start_date:start,p_end_date:end,p_platform:platform||null,p_creator_id:null});
      if(ke)throw ke;
      setKpi(k?.[0]||{total_creators:0,total_sales_records:0,total_qty:0,total_orders:0,total_gmv:0,total_commission:0});
      const {data:r,error:re}=await supabase.rpc("get_creator_ranking",{p_workspace_id:workspaceId,p_start_date:start,p_end_date:end,p_platform:platform||null,p_creator_id:null,p_search:null,p_page:targetPage,p_page_size:50});
      if(re)throw re;
      const rows=(r||[]) as RankRow[];setRanking(rows);setTotal(rows.length?Number(rows[0].total_rows||0):0);setPage(targetPage);
    }catch(e:any){setError(e?.message||"Gagal memuat dashboard");}
    finally{setBusy(false);}
  }

  useEffect(()=>{
    void load(1);
    const refresh=()=>void load(1);
    window.addEventListener("luma-data-changed",refresh);
    return()=>window.removeEventListener("luma-data-changed",refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[workspaceId]);

  const pages=Math.max(1,Math.ceil(total/50));

  return <section id="dashboard" className="legacy-page-anchor dashboard-page">
    <div className="eyebrow">LUMA AFFILIATE INTELLIGENCE</div>
    <h1>Dashboard Affiliate Specialist & KOL</h1>
    <div className="filters"><label>Start<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>End<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><label>Platform<select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="">All</option><option>TikTok</option><option>Shopee</option><option>Instagram</option></select></label><button onClick={()=>load(1)} disabled={busy}>{busy?"Loading...":"Apply"}</button></div>
    {error&&<div className="flash error">{error}</div>}
    <div className="kpis"><div className="kpi"><small>Creator Aktif</small><b>{number(kpi?.total_creators)}</b></div><div className="kpi"><small>Sales Records</small><b>{number(kpi?.total_sales_records)}</b></div><div className="kpi"><small>Qty Paid</small><b>{number(kpi?.total_qty)}</b></div><div className="kpi"><small>Orders</small><b>{number(kpi?.total_orders)}</b></div><div className="kpi"><small>Total GMV</small><b>{money(kpi?.total_gmv)}</b></div><div className="kpi"><small>Komisi</small><b>{money(kpi?.total_commission)}</b></div></div>
    <div className="grid dashboard-grid"><div className="card"><div className="section-head"><div><h3>Ranking Creator</h3><p className="muted">Maksimal 50 row / halaman.</p></div></div><div className="scroll"><table><thead><tr><th>Rank</th><th>Creator</th><th>Platform</th><th>Qty</th><th>Orders</th><th>GMV</th><th>Commission</th></tr></thead><tbody>{ranking.map(x=><tr key={x.creator_id}><td>{x.rank}</td><td><b>{x.creator_name||x.username||"-"}</b><br/><small>{x.creator_code||""}</small></td><td>{x.platform||"-"}</td><td>{number(x.qty)}</td><td>{number(x.orders)}</td><td>{money(x.gmv)}</td><td>{money(x.commission)}</td></tr>)}{!ranking.length&&<tr><td colSpan={7}>Tidak ada data.</td></tr>}</tbody></table></div><div className="pager"><span className="pager-info">Page {page}/{pages} · {number(total)} creator</span><div className="button-row"><button className="secondary" disabled={page<=1||busy} onClick={()=>load(page-1)}>Previous</button><button className="secondary" disabled={page>=pages||busy} onClick={()=>load(page+1)}>Next</button></div></div></div><div className="card"><h3>Ranking Produk</h3><div className="empty-state"><strong>Menunggu data SKU granular</strong><span>Affiliate Performance TikTok/Shopee yang tidak memiliki SKU per row tidak dipaksakan menjadi ranking produk.</span></div></div></div>
    <div className="grid"><div className="card"><h3>Platform</h3><p className="muted">Filter platform aktif: <b>{platform||"All"}</b>.</p></div><div className="card"><h3>Target & KPI Bulanan</h3><p className="muted">Target workspace akan dikembalikan pada port target/KPI berikutnya.</p></div></div>
  </section>;
}
