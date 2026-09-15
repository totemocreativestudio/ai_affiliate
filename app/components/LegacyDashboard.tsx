"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import Creator360Modal from "./Creator360Modal";

type Props = { workspaceId: string };
type KPI = { total_creators:number; total_sales_records:number; total_qty:number; total_orders:number; total_gmv:number; total_commission:number };
type RankRow = { rank:number; creator_id:number; creator_code:string|null; creator_name:string|null; username:string|null; platform:string|null; qty:number; orders:number; gmv:number; commission:number; total_rows:number };
type StoreRow={store_name:string;platform:string;total_affiliates:number;active_affiliates:number;inactive_affiliates:number;gmv:number;orders:number;qty:number;spend:number;roi:number};
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const number=(v:any)=>new Intl.NumberFormat("id-ID").format(Number(v||0));

export default function LegacyDashboard({ workspaceId }: Props) {
  const supabase=createClient();
  const [start,setStart]=useState(""); const [end,setEnd]=useState(""); const [platform,setPlatform]=useState("");
  const [kpi,setKpi]=useState<KPI|null>(null); const [ranking,setRanking]=useState<RankRow[]>([]); const [stores,setStores]=useState<StoreRow[]>([]);
  const [page,setPage]=useState(1); const [total,setTotal]=useState(0); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [selectedCreator,setSelectedCreator]=useState<number|null>(null);

  async function load(targetPage=page){
    setBusy(true);setError("");
    try{
      if(start&&end&&start>end)throw new Error("Start Date tidak boleh melewati End Date.");
      const [{data:k,error:ke},{data:r,error:re},{data:s,error:se}]=await Promise.all([
        supabase.rpc("get_dashboard_kpi",{p_workspace_id:workspaceId,p_start_date:start||null,p_end_date:end||null,p_platform:platform||null,p_creator_id:null}),
        supabase.rpc("get_creator_ranking",{p_workspace_id:workspaceId,p_start_date:start||null,p_end_date:end||null,p_platform:platform||null,p_creator_id:null,p_search:null,p_page:targetPage,p_page_size:50}),
        supabase.rpc("get_store_dashboard",{p_workspace_id:workspaceId,p_start_date:start||null,p_end_date:end||null,p_platform:platform||null}),
      ]);
      if(ke)throw ke;if(re)throw re;if(se)throw se;
      setKpi(k?.[0]||{total_creators:0,total_sales_records:0,total_qty:0,total_orders:0,total_gmv:0,total_commission:0});
      const rows=(r||[]) as RankRow[];setRanking(rows);setTotal(rows.length?Number(rows[0].total_rows||0):0);setStores((s||[]) as StoreRow[]);setPage(targetPage);
    }catch(e:any){setError(e?.message||"Gagal memuat dashboard");}finally{setBusy(false);}
  }
  useEffect(()=>{void load(1)},[workspaceId]);
  const pages=Math.max(1,Math.ceil(total/50));

  return <section id="dashboard" className="legacy-page-anchor dashboard-page">
    <div className="eyebrow">LUMA AFFILIATE INTELLIGENCE</div><h1>Dashboard Affiliate Specialist & KOL</h1>
    <p className="muted dashboard-intro">Filter periode berlaku ke KPI, ranking creator, data toko, dan Customer 360. Klik creator untuk membuka detail lengkap.</p>
    <div className="filters"><label>Start <span className="field-note">Opsional</span><input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>End <span className="field-note">Opsional</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><label>Platform<select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="">All</option><option>TikTok</option><option>Shopee</option><option>Instagram</option></select></label><button onClick={()=>load(1)} disabled={busy}>{busy?"Loading...":"Apply"}</button><button className="secondary" onClick={()=>{setStart("");setEnd("");setPlatform("");setTimeout(()=>load(1),0)}}>Reset</button></div>
    {error&&<div className="flash error">{error}</div>}
    <div className="kpis"><div className="kpi"><small>Creator Aktif</small><b>{number(kpi?.total_creators)}</b></div><div className="kpi"><small>Sales Records</small><b>{number(kpi?.total_sales_records)}</b></div><div className="kpi"><small>Qty Paid</small><b>{number(kpi?.total_qty)}</b></div><div className="kpi"><small>Orders</small><b>{number(kpi?.total_orders)}</b></div><div className="kpi"><small>Total GMV</small><b>{money(kpi?.total_gmv)}</b></div><div className="kpi"><small>Komisi</small><b>{money(kpi?.total_commission)}</b></div></div>

    <div className="grid dashboard-grid"><div className="card"><div className="section-head"><div><h3>Ranking Creator</h3><p className="muted">Maksimal 50 row / halaman · klik creator untuk Customer 360.</p></div></div><div className="scroll"><table><thead><tr><th>Rank</th><th>Creator</th><th>Platform</th><th>Qty</th><th>Orders</th><th>GMV</th><th>Commission</th><th></th></tr></thead><tbody>{ranking.map(x=><tr className="creator-rank-row" key={x.creator_id} onDoubleClick={()=>setSelectedCreator(x.creator_id)}><td>{x.rank}</td><td><button className="creator-link" onClick={()=>setSelectedCreator(x.creator_id)}><b>{x.creator_name||x.username||"-"}</b><small>{x.creator_code||""}</small></button></td><td>{x.platform||"-"}</td><td>{number(x.qty)}</td><td>{number(x.orders)}</td><td>{money(x.gmv)}</td><td>{money(x.commission)}</td><td><button className="secondary compact" onClick={()=>setSelectedCreator(x.creator_id)}>360°</button></td></tr>)}{!ranking.length&&<tr><td colSpan={8}>Tidak ada data.</td></tr>}</tbody></table></div><div className="pager"><span className="pager-info">Page {page}/{pages} · {number(total)} creator</span><div className="button-row"><button className="secondary" disabled={page<=1||busy} onClick={()=>load(page-1)}>Previous</button><button className="secondary" disabled={page>=pages||busy} onClick={()=>load(page+1)}>Next</button></div></div></div>
      <div className="card"><h3>Ranking Produk</h3><div className="empty-state"><strong>SKU granular mengikuti file transaksi</strong><span>Ranking produk per creator tersedia di Customer 360 ketika SKU / Product Name tersedia pada data upload.</span></div></div></div>

    <div className="card store-dashboard-card"><div className="section-head"><div><h3>Store Intelligence</h3><p className="muted">Daftar toko terafiliasi dibentuk otomatis dari kolom Store/Shop/Nama Toko pada file upload.</p></div><span className="role-badge">{stores.length} stores</span></div>{stores.length?<div className="scroll"><table><thead><tr><th>Store</th><th>Platform</th><th>Affiliate Total</th><th>Active</th><th>Inactive</th><th>GMV</th><th>Orders</th><th>Qty</th><th>Spend</th><th>ROI</th></tr></thead><tbody>{stores.map((x,i)=><tr key={`${x.platform}-${x.store_name}-${i}`}><td><b>{x.store_name}</b></td><td>{x.platform}</td><td>{number(x.total_affiliates)}</td><td>{number(x.active_affiliates)}</td><td>{number(x.inactive_affiliates)}</td><td>{money(x.gmv)}</td><td>{number(x.orders)}</td><td>{number(x.qty)}</td><td>{money(x.spend)}</td><td><b>{Number(x.roi||0).toFixed(2)}x</b></td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Belum ada nama toko pada data upload.</strong><span>Upload file yang memiliki kolom Store Name, Shop Name, Nama Toko, Toko, Seller Name, atau Store ID agar daftar toko terbentuk otomatis.</span></div>}</div>

    <div className="grid"><div className="card"><h3>Platform</h3><p className="muted">Filter platform aktif: <b>{platform||"All"}</b>.</p></div><div className="card"><h3>Target & KPI Bulanan</h3><p className="muted">Tanggal kosong berarti seluruh data workspace. Target individual creator dapat diatur dari Customer 360.</p></div></div>
    {selectedCreator&&<Creator360Modal workspaceId={workspaceId} creatorId={selectedCreator} startDate={start} endDate={end} onClose={()=>setSelectedCreator(null)}/>} 
  </section>;
}
