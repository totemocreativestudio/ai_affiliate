"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import Creator360Modal from "./Creator360Modal";
import DashboardActionCenter from "./DashboardActionCenter";
import {AreaTrendChart,DonutBreakdown,MiniDeltaBars,RankingBars} from "./LumawayDataViz";

type Props={workspaceId:string};
type Row=Record<string,any>;
type KPI={total_creators:number;total_sales_records:number;total_qty:number;total_orders:number;total_gmv:number;total_commission:number;total_products:number;total_cost_product:number;total_shipping:number;total_ads_spend:number;total_spend:number;roi:number;aov:number;avg_daily_creator_sales:number;referral_commission:number;total_live_streams:number;total_videos:number};
type RankRow={rank:number;creator_id:number;creator_code:string|null;creator_name:string|null;username:string|null;platform:string|null;qty:number;orders:number;gmv:number;commission:number;total_rows:number};
type ProductRankRow={rank:number;sku:string|null;product_name:string|null;platform:string|null;qty:number;orders:number;gmv:number;commission:number;clicks:number;buyers:number;new_buyers:number;refund:number;refund_qty:number;roi:number;total_rows:number};
type StoreRow={store_name:string;platform:string;total_affiliates:number;active_affiliates:number;inactive_affiliates:number;gmv:number;orders:number;qty:number;spend:number;roi:number};
type TrendRow={data_date:string;gmv:number;orders:number;qty:number;commission:number;refund:number;active_creators:number;live_streams:number;videos:number};
type PlatformMixRow={platform:string;gmv:number;orders:number;qty:number;commission:number;refund:number};
type TrendMetric="gmv"|"orders"|"qty"|"commission"|"refund"|"active_creators"|"live_streams"|"videos";
type PlatformMetric="gmv"|"orders"|"qty"|"commission"|"refund";
const zero:KPI={total_creators:0,total_sales_records:0,total_qty:0,total_orders:0,total_gmv:0,total_commission:0,total_products:0,total_cost_product:0,total_shipping:0,total_ads_spend:0,total_spend:0,roi:0,aov:0,avg_daily_creator_sales:0,referral_commission:0,total_live_streams:0,total_videos:0};
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const number=(v:any)=>new Intl.NumberFormat("id-ID").format(Number(v||0));
function previousRange(start:string,end:string){if(!start||!end)return {start:"",end:""};const s=new Date(`${start}T00:00:00`),e=new Date(`${end}T00:00:00`);const days=Math.round((e.getTime()-s.getTime())/86400000)+1;const pe=new Date(s);pe.setDate(pe.getDate()-1);const ps=new Date(pe);ps.setDate(ps.getDate()-days+1);return {start:ps.toISOString().slice(0,10),end:pe.toISOString().slice(0,10)}}
function delta(current:any,previous:any){const c=Number(current||0),p=Number(previous||0);if(!p)return c===0?0:null;return ((c-p)/Math.abs(p))*100}
function sortRows<T extends Record<string,any>>(rows:T[],key:string,asc:boolean){return [...rows].sort((a,b)=>{const av=a?.[key],bv=b?.[key];const an=Number(av),bn=Number(bv);if(av!==""&&bv!==""&&Number.isFinite(an)&&Number.isFinite(bn))return(an-bn)*(asc?1:-1);return String(av??"").localeCompare(String(bv??""),"id",{numeric:true,sensitivity:"base"})*(asc?1:-1)})}
type PeriodPreset=""|"7d"|"30d"|"month"|"custom";
function isoDate(date:Date){return date.toISOString().slice(0,10)}
function presetRange(kind:Exclude<PeriodPreset,""|"custom">,anchorIso:string){
 const anchor=new Date(`${anchorIso}T00:00:00Z`);
 if(kind==="7d"){const s=new Date(anchor);s.setUTCDate(s.getUTCDate()-6);return{start:isoDate(s),end:anchorIso}}
 if(kind==="30d"){const s=new Date(anchor);s.setUTCDate(s.getUTCDate()-29);return{start:isoDate(s),end:anchorIso}}
 const y=anchor.getUTCFullYear(),m=anchor.getUTCMonth();
 return{start:isoDate(new Date(Date.UTC(y,m,1))),end:isoDate(new Date(Date.UTC(y,m+1,0)))}
}

export default function LegacyDashboard({workspaceId}:Props){
 const supabase=createClient();const [start,setStart]=useState("");const [end,setEnd]=useState("");const [platform,setPlatform]=useState("");const [store,setStore]=useState("");const [storeOptions,setStoreOptions]=useState<Row[]>([]);
 const [kpi,setKpi]=useState<KPI>(zero);const [prev,setPrev]=useState<KPI|null>(null);const [trend,setTrend]=useState<TrendRow[]>([]);const [trendMetric,setTrendMetric]=useState<TrendMetric>("gmv");const [platformBreakdown,setPlatformBreakdown]=useState<PlatformMixRow[]>([]);const [platformMetric,setPlatformMetric]=useState<PlatformMetric>("gmv");const [rankSummary,setRankSummary]=useState({total:0,active:0});const [adsInput,setAdsInput]=useState("0");const [adsSaving,setAdsSaving]=useState(false);const [adsMessage,setAdsMessage]=useState("");const [ranking,setRanking]=useState<RankRow[]>([]);const [productRanking,setProductRanking]=useState<ProductRankRow[]>([]);const [stores,setStores]=useState<StoreRow[]>([]);const [page,setPage]=useState(1);const [total,setTotal]=useState(0);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [dataWarnings,setDataWarnings]=useState<string[]>([]);const [selectedCreator,setSelectedCreator]=useState<number|null>(null);const [rankSort,setRankSort]=useState({key:"rank",asc:true});const [productSort,setProductSort]=useState({key:"gmv",asc:false});const [productMetric,setProductMetric]=useState<keyof ProductRankRow>("gmv");const [storeSort,setStoreSort]=useState({key:"gmv",asc:false});const [periodPreset,setPeriodPreset]=useState<PeriodPreset>("");const [periodApplied,setPeriodApplied]=useState(false);
 function clearDashboardData(){setKpi(zero);setPrev(null);setTrend([]);setPlatformBreakdown([]);setRankSummary({total:0,active:0});setRanking([]);setProductRanking([]);setStores([]);setDataWarnings([]);setTotal(0);setPage(1)}
 async function loadStoreOptions(targetPlatform=platform){
  const {data,error:storeError}=await supabase.rpc("get_dashboard_store_options",{p_workspace_id:workspaceId,p_platform:targetPlatform||null});
  if(!storeError)setStoreOptions((data||[]) as Row[]);
 }
 async function load(targetPage=1,override?:{start:string;end:string;platform?:string;store?:string}){
  const filterStart=override?.start??start;
  const filterEnd=override?.end??end;
  const filterPlatform=override?.platform??platform;
  const filterStore=override?.store??store;
  if(!filterStart||!filterEnd){setPeriodApplied(false);clearDashboardData();setError("");return}
  setBusy(true);setError("");setDataWarnings([]);
  try{
   if(filterStart>filterEnd)throw new Error("Start Date tidak boleh melewati End Date.");
   const pr=previousRange(filterStart,filterEnd);
   const common={p_workspace_id:workspaceId,p_start_date:filterStart,p_end_date:filterEnd,p_platform:filterPlatform||null,p_store_name:filterStore||null};
   const calls:any[]=[
    supabase.rpc("get_dashboard_metrics_v5",common),
    supabase.rpc("get_creator_ranking_v2",{...common,p_creator_id:null,p_search:null,p_page:targetPage,p_page_size:50}),
    supabase.rpc("get_creator_ranking_summary_v2",common),
    supabase.rpc("get_product_ranking_v2",{...common,p_search:null,p_page:1,p_page_size:100}),
    supabase.rpc("get_store_dashboard_v2",common),
    supabase.rpc("get_dashboard_daily_trend_v2",common),
    supabase.rpc("get_dashboard_platform_mix_v2",common)
   ];
   if(pr.start)calls.push(supabase.rpc("get_dashboard_metrics_v5",{p_workspace_id:workspaceId,p_start_date:pr.start,p_end_date:pr.end,p_platform:filterPlatform||null,p_store_name:filterStore||null}));
   const res=await Promise.all(calls);
   if(res[0].error)throw res[0].error;

   const warnings:string[]=[];
   const currentKpi=(res[0].data?.[0]||zero) as KPI;
   setKpi(currentKpi);setAdsInput(String(Number(currentKpi.total_ads_spend||0)));

   if(res[1].error){setRanking([]);warnings.push("Ranking creator belum dapat dimuat.");}
   else setRanking((res[1].data||[]) as RankRow[]);

   if(res[2].error){
    const rr=(res[1].data||[]) as RankRow[];
    const inferredTotal=Number(rr[0]?.total_rows||rr.length||0);
    const inferredActive=rr.filter(x=>Number(x.gmv||0)>0||Number(x.orders||0)>0||Number(x.qty||0)>0||Number(x.commission||0)>0).length;
    setRankSummary({total:inferredTotal,active:inferredActive});setTotal(inferredTotal);
    warnings.push("Ringkasan creator menggunakan data ranking yang tersedia.");
   }else{
    const rs=res[2].data?.[0]||{};
    setRankSummary({total:Number(rs.total_creators||0),active:Number(rs.active_creators||0)});
    setTotal(Number(rs.total_creators||(res[1].data?.[0] as RankRow|undefined)?.total_rows||0));
   }

   if(res[3].error){setProductRanking([]);warnings.push("Product Ranking belum dapat dimuat.");}
   else setProductRanking((res[3].data||[]) as ProductRankRow[]);

   if(res[4].error){setStores([]);warnings.push("Store Intelligence belum dapat dimuat.");}
   else setStores((res[4].data||[]) as StoreRow[]);

   if(res[5].error){setTrend([]);warnings.push("Grafik tren belum dapat dimuat.");}
   else setTrend((res[5].data||[]) as TrendRow[]);

   if(res[6].error){setPlatformBreakdown([]);warnings.push("Kontribusi platform belum dapat dimuat.");}
   else setPlatformBreakdown((res[6].data||[]) as PlatformMixRow[]);

   if(pr.start&&res[7]&&!res[7].error)setPrev((res[7].data?.[0]||zero) as KPI);
   else setPrev(null);

   setDataWarnings(warnings);
   setPage(targetPage);setPeriodApplied(true);
   try{window.sessionStorage.setItem(`lumaway_dashboard_filter_${workspaceId}`,JSON.stringify({start:filterStart,end:filterEnd,platform:filterPlatform,preset:periodPreset||"custom"}))}catch{}
  }catch(e:any){
   setPeriodApplied(false);clearDashboardData();setError(e?.message||"Gagal memuat dashboard");
  }finally{setBusy(false)}
 }
 async function applyPreset(kind:Exclude<PeriodPreset,""|"custom">){setBusy(true);setError("");try{const {data,error:latestError}=await supabase.rpc("get_dashboard_latest_date_v2",{p_workspace_id:workspaceId,p_platform:platform||null,p_store_name:store||null});if(latestError)throw latestError;const anchor=String(data||"").slice(0,10);if(!anchor){setPeriodPreset(kind);setPeriodApplied(false);clearDashboardData();setError("Belum ada data untuk platform/toko yang dipilih.");return}const range=presetRange(kind,anchor);setStart(range.start);setEnd(range.end);setPeriodPreset(kind);await load(1,{...range,platform,store})}catch(e:any){setPeriodApplied(false);clearDashboardData();setError(e?.message||"Gagal menentukan periode dashboard")}finally{setBusy(false)}}
 function applyCustom(){if(!start||!end){setPeriodApplied(false);clearDashboardData();setError("Pilih Start Date dan End Date terlebih dahulu, atau gunakan filter 7 Hari / 30 Hari / 1 Bulan.");return}setPeriodPreset("custom");void load(1)}
 async function saveAdsSupport(){
  if(!start||!end){setAdsMessage("Pilih periode Start dan End terlebih dahulu.");return}
  const amount=Number(adsInput||0);
  if(!Number.isFinite(amount)||amount<0){setAdsMessage("Nominal Ads Spend Support tidak valid.");return}
  setAdsSaving(true);setAdsMessage("");
  const {error:adsError}=await supabase.rpc("set_affiliate_ads_support_v2",{p_workspace_id:workspaceId,p_start_date:start,p_end_date:end,p_platform:platform||null,p_store_name:store||null,p_amount:amount,p_notes:null});
  if(adsError){setAdsMessage(adsError.message);setAdsSaving(false);return}
  setAdsMessage(`Ads Spend Support tersimpan untuk ${store||"seluruh toko"} pada periode ini.`);
  await load(page);
  setAdsSaving(false);
 }
 function resetDashboard(){setStart("");setEnd("");setPlatform("");setStore("");setPeriodPreset("");setPeriodApplied(false);setError("");setAdsInput("0");setAdsMessage("");clearDashboardData();try{window.sessionStorage.removeItem(`lumaway_dashboard_filter_${workspaceId}`)}catch{}}
 useEffect(()=>{
  clearDashboardData();setError("");
  let saved:any=null;
  try{saved=JSON.parse(window.sessionStorage.getItem(`lumaway_dashboard_filter_${workspaceId}`)||"null")}catch{}
  if(saved?.start&&saved?.end){
    setStart(saved.start);setEnd(saved.end);setPlatform(saved.platform||"");setPeriodPreset(saved.preset||"custom");
    void loadStoreOptions(saved.platform||"");
    void load(1,{start:saved.start,end:saved.end,platform:saved.platform||"",store:""});
  }else{
    setStart("");setEnd("");setStore("");setPeriodPreset("");setPeriodApplied(false);void loadStoreOptions("");
  }
 },[workspaceId]);
 useEffect(()=>{setStore("");setPeriodApplied(false);clearDashboardData();void loadStoreOptions(platform)},[platform]);
 useEffect(()=>{const refresh=()=>{void loadStoreOptions(platform);if(periodApplied&&start&&end)void load(1)};window.addEventListener("lumaway-database-updated",refresh as EventListener);return()=>window.removeEventListener("lumaway-database-updated",refresh as EventListener)},[workspaceId,start,end,platform,store,periodApplied]);
  const pages=Math.max(1,Math.ceil(total/50));const sortedRanking=useMemo(()=>sortRows(ranking,rankSort.key,rankSort.asc),[ranking,rankSort]);const sortedProductRanking=useMemo(()=>sortRows(productRanking,productSort.key,productSort.asc),[productRanking,productSort]);const sortedStores=useMemo(()=>sortRows(stores,storeSort.key,storeSort.asc),[stores,storeSort]);const toggleRankSort=(key:string)=>setRankSort(v=>({key,asc:v.key===key?!v.asc:true}));const toggleStoreSort=(key:string)=>setStoreSort(v=>({key,asc:v.key===key?!v.asc:true}));
 const cards:[string,keyof KPI,"money"|"number"|"ratio"][]=[
  ["Creator Aktif","total_creators","number"],
  ["GMV","total_gmv","money"],
  ["Orders","total_orders","number"],
  ["Qty Paid","total_qty","number"],
  ["Total Produk","total_products","number"],
  ["Komisi Creator","total_commission","money"],
  ["Spend Budget","total_spend","money"],
  ["ROI","roi","ratio"],
  ["AOV Creator","aov","money"],
  ["Average Sales / Creator / Hari","avg_daily_creator_sales","money"],
  ["Total LIVE Streaming","total_live_streams","number"],
  ["Total Video","total_videos","number"],
  ["Komisi Referral","referral_commission","money"],
  ["Sales Records","total_sales_records","number"]
 ];
 const hasPreviousData=Boolean(prev&&Number(prev.total_sales_records||0)>0);
 const productMetricOptions=useMemo(()=>{
  const options:Array<{key:keyof ProductRankRow;label:string;kind:"money"|"number"|"ratio"}>=[
   {key:"gmv",label:"GMV",kind:"money"},
   {key:"qty",label:"Produk Terjual",kind:"number"},
   {key:"orders",label:"Pesanan Dibayar",kind:"number"},
   {key:"clicks",label:"Klik Produk",kind:"number"},
   {key:"buyers",label:"Pembeli",kind:"number"},
   {key:"refund",label:"Refund GMV",kind:"money"},
   {key:"roi",label:"ROI",kind:"ratio"}
  ];
  return options.filter((option,index)=>index<2||productRanking.some(row=>Number(row[option.key]||0)!==0));
 },[productRanking]);
 const productMetricConfig=productMetricOptions.find(item=>item.key===productMetric)||productMetricOptions[0];
 const productMetricTotal=useMemo(()=>productRanking.reduce((sum,row)=>sum+Math.max(0,Number(row[productMetric]||0)),0),[productRanking,productMetric]);
 const formatProductMetric=(value:any)=>productMetricConfig?.kind==="money"?money(value):productMetricConfig?.kind==="ratio"?`${Number(value||0).toFixed(2)}x`:number(value);
 const trendMetricOptions:Array<{key:TrendMetric;label:string;kind:"money"|"number"}>=[
  {key:"gmv",label:"GMV",kind:"money"},
  {key:"orders",label:"Orders",kind:"number"},
  {key:"qty",label:"Qty Paid",kind:"number"},
  {key:"commission",label:"Komisi Creator",kind:"money"},
  {key:"refund",label:"Refund GMV",kind:"money"},
  {key:"active_creators",label:"Creator Aktif",kind:"number"},
  {key:"live_streams",label:"LIVE",kind:"number"},
  {key:"videos",label:"Video",kind:"number"}
 ];
 const trendMetricConfig=trendMetricOptions.find(item=>item.key===trendMetric)||trendMetricOptions[0];
 const trendFormatter=(value:number)=>trendMetricConfig.kind==="money"?money(value):number(value);
 const trendChartData=useMemo(()=>trend.map(row=>({label:new Date(String(row.data_date)+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short"}),primary:Number(row[trendMetric]||0)})),[trend,trendMetric]);
 const topProductChart=useMemo(()=>[...productRanking].sort((a,b)=>Number(b.gmv||0)-Number(a.gmv||0)).slice(0,6).map(row=>({label:row.product_name||row.sku||"Produk",value:Number(row.gmv||0),meta:`${number(row.orders)} orders · ${row.platform||"-"}`})),[productRanking]);
 const topCreatorChart=useMemo(()=>[...ranking].sort((a,b)=>Number(b.gmv||0)-Number(a.gmv||0)).slice(0,6).map(row=>({label:row.creator_name||row.username||row.creator_code||"Creator",value:Number(row.gmv||0),meta:`${number(row.orders)} orders · ${row.platform||"-"}`})),[ranking]);
 const platformMetricOptions:Array<{key:PlatformMetric;label:string;kind:"money"|"number"}>=[
  {key:"gmv",label:"GMV",kind:"money"},
  {key:"orders",label:"Orders",kind:"number"},
  {key:"qty",label:"Qty Paid",kind:"number"},
  {key:"commission",label:"Komisi",kind:"money"},
  {key:"refund",label:"Refund GMV",kind:"money"}
 ];
 const platformMetricConfig=platformMetricOptions.find(item=>item.key===platformMetric)||platformMetricOptions[0];
 const platformFormatter=(value:number)=>platformMetricConfig.kind==="money"?money(value):number(value);
 const platformMix=useMemo(()=>platformBreakdown.map(row=>({label:row.platform||"Lainnya",value:Number(row[platformMetric]||0)})).filter(row=>row.value>0).sort((a,b)=>b.value-a.value),[platformBreakdown,platformMetric]);
 const summaryChanges = hasPreviousData&&prev ? [
  {label:"GMV",value:delta(kpi.total_gmv,prev.total_gmv),detail:money(kpi.total_gmv)},
  {label:"Orders",value:delta(kpi.total_orders,prev.total_orders),detail:number(kpi.total_orders)},
  {label:"ROI",value:delta(kpi.roi,prev.roi),detail:`${Number(kpi.roi||0).toFixed(2)}x`}
 ] : [];
 const gmvDelta=hasPreviousData&&prev?delta(kpi.total_gmv,prev.total_gmv):null;
 const orderDelta=hasPreviousData&&prev?delta(kpi.total_orders,prev.total_orders):null;
 const focusItems = hasPreviousData ? [
  {title:gmvDelta===null?"GMV baru pada periode ini":gmvDelta<0?"GMV perlu perhatian":"Pantau momentum GMV",detail:gmvDelta===null?"Periode sebelumnya belum memiliki baseline GMV.":`${Math.abs(gmvDelta).toFixed(1)}% dibanding periode sebelumnya`},
  {title:orderDelta===null?"Orders baru pada periode ini":orderDelta<0?"Periksa penurunan orders":"Review creator dengan kontribusi terbesar",detail:`${number(kpi.total_orders)} orders pada periode aktif`},
  {title:Number(kpi.roi||0)<1?"Efisiensi spend perlu dicek":"Pertahankan efisiensi spend",detail:`ROI saat ini ${Number(kpi.roi||0).toFixed(2)}x`}
 ] : [];
 return <section id="dashboard" className="legacy-page-anchor dashboard-page">
  <div className="eyebrow">LUMA AFFILIATE INTELLIGENCE</div><h1>Dashboard Affiliate Specialist & KOL</h1><p className="muted dashboard-intro">Lihat perubahan utama, KPI, ranking creator, produk, dan toko dalam satu alur. Pilih periode untuk mulai melihat apa yang berubah dan apa yang perlu diperhatikan.</p>
  <div className="dashboard-period-presets" role="group" aria-label="Quick period filter"><button className={periodPreset==="7d"?"active":""} onClick={()=>void applyPreset("7d")} disabled={busy}>7 Hari Terakhir</button><button className={periodPreset==="30d"?"active":""} onClick={()=>void applyPreset("30d")} disabled={busy}>30 Hari Terakhir</button><button className={periodPreset==="month"?"active":""} onClick={()=>void applyPreset("month")} disabled={busy}>1 Bulan</button></div>
  <div className="filters"><label>Start<input type="date" value={start} onChange={e=>{setStart(e.target.value);setPeriodPreset("custom");setPeriodApplied(false);clearDashboardData()}}/></label><label>End<input type="date" value={end} onChange={e=>{setEnd(e.target.value);setPeriodPreset("custom");setPeriodApplied(false);clearDashboardData()}}/></label><label>Platform<select value={platform} onChange={e=>{setPlatform(e.target.value);setPeriodApplied(false);clearDashboardData()}}><option value="">All</option><option>TikTok</option><option>Shopee</option><option>Instagram</option></select></label><label>Toko<select value={store} onChange={e=>{setStore(e.target.value);setPeriodApplied(false);clearDashboardData()}}><option value="">Semua Toko</option>{storeOptions.map((item:any)=><option key={`${item.platform||""}-${item.store_name}`} value={item.store_name}>{item.store_name}{item.platform?` · ${item.platform}`:""}</option>)}</select></label><button className="primary" onClick={applyCustom} disabled={busy}>{busy?"Menyiapkan...":"Terapkan"}</button><button className="secondary" onClick={resetDashboard}>Reset</button></div>
  {error&&<div className="flash error">{error}</div>}
  {dataWarnings.length>0&&<div className="dashboard-data-warning"><strong>Sebagian data sedang dipulihkan.</strong><span>{dataWarnings.join(" ")}</span></div>}
  {busy&&<div className="lw-dashboard-skeleton" aria-label="Menyiapkan data dashboard"><span className="lw-skeleton"/><span className="lw-skeleton"/><span className="lw-skeleton"/><span className="lw-skeleton"/></div>}
  <DashboardActionCenter workspaceId={workspaceId} />
  {!periodApplied?<div className="dashboard-period-empty"><strong>Pilih periode untuk menampilkan dashboard.</strong><span>Data tidak ditampilkan saat Start dan End masih kosong (dd/mm/tttt).</span></div>:<>
  {hasPreviousData&&prev&&<div className="lw-workspace-summary">
   <section className="lw-summary-card">
    <div className="lw-summary-head"><div><h2>Apa yang berubah?</h2><p>Ringkasan perubahan utama dibanding periode sebelumnya.</p></div><span className="lw-status-pill">Data terbaru</span></div>
    <div className="lw-changes">{summaryChanges.map(item=>{const v=item.value;return <div key={item.label} className={`lw-change ${v===null?"new":v>0?"up":v<0?"down":""}`}><small>{item.label}</small><b>{v===null?"Data baru":`${v>0?"↑":v<0?"↓":"→"} ${Math.abs(v).toFixed(1)}%`}</b><em>{item.detail}</em></div>})}</div>
   </section>
   <aside className="lw-focus-card"><h3>Fokus berikutnya</h3><p>Prioritas yang paling relevan dari periode aktif.</p><div className="lw-focus-list">{focusItems.map((item,index)=><div className="lw-focus-item" key={item.title}><span className="lw-focus-number">{index+1}</span><div><strong>{item.title}</strong><span>{item.detail}</span></div></div>)}</div></aside>
  </div>}
  <div className="dashboard-metric-head"><div><h2>Performance Metrics</h2><p>14 KPI utama affiliate performance, termasuk total LIVE dan total video.</p></div>{hasPreviousData?<span>Dibanding periode sebelumnya</span>:<span>Belum ada baseline periode sebelumnya</span>}</div>
  <div className="dashboard-kpi-grid">{cards.map(([label,key,kind])=><KpiCard key={String(key)} label={label} value={kpi[key]} previous={hasPreviousData?prev?.[key]:undefined} kind={kind}/>)}</div>
  <div className="cost-note">Spend Budget = HPP produk + ongkir + Ads Spend Support + komisi creator. Ads Spend Support diinput manual berdasarkan periode Start–End dan platform yang sedang dipilih.</div>
  <div className="lw-analytics-canvas">
   <section className="lw-chart-card lw-trend-card">
    <div className="lw-chart-head"><div><h3>Tren Performa</h3><p>Grafik harian mengikuti metrik dan periode yang Anda pilih.</p></div><span className="lw-chart-badge">{start} → {end}</span></div>
    <div className="lw-metric-tabs" role="tablist" aria-label="Pilih metrik tren performa">
      {trendMetricOptions.map(option=><button key={option.key} type="button" className={trendMetric===option.key?"active":""} onClick={()=>setTrendMetric(option.key)}>{option.label}</button>)}
    </div>
    <div className="lw-trend-summary"><span>Metrik aktif</span><strong>{trendMetricConfig.label}</strong><small>{trend.length} titik data harian</small></div>
    <AreaTrendChart data={trendChartData} primaryLabel={trendMetricConfig.label} primaryFormatter={trendFormatter}/>
   </section>
   <section className="lw-chart-card lw-platform-card">
    <div className="lw-chart-head"><div><h3>Kontribusi Platform</h3><p>Perbandingan kontribusi tiap platform berdasarkan metrik yang dipilih.</p></div><span className="lw-chart-badge">{platformMix.length} platform</span></div>
    <div className="lw-metric-tabs lw-platform-tabs" role="tablist" aria-label="Pilih metrik kontribusi platform">
      {platformMetricOptions.map(option=><button key={option.key} type="button" className={platformMetric===option.key?"active":""} onClick={()=>setPlatformMetric(option.key)}>{option.label}</button>)}
    </div>
    <DonutBreakdown data={platformMix} valueFormatter={platformFormatter} centerLabel={platformMetricConfig.label}/>
   </section>
  </div>
  <div className="lw-analytics-secondary">
   <section className="lw-chart-card"><div className="lw-chart-head"><div><h3>Produk Pendorong GMV</h3><p>Produk teratas berdasarkan GMV pada periode aktif.</p></div><span className="lw-chart-badge">Top 6</span></div><RankingBars data={topProductChart} valueFormatter={money} emptyText="Belum ada Product Performance untuk periode ini."/></section>
   <section className="lw-chart-card"><div className="lw-chart-head"><div><h3>Creator Pendorong GMV</h3><p>Creator teratas berdasarkan kontribusi GMV pada periode aktif.</p></div><span className="lw-chart-badge">Top 6</span></div><RankingBars data={topCreatorChart} valueFormatter={money} emptyText="Belum ada Creator Performance untuk periode ini."/></section>
  </div>
  <div className="grid dashboard-grid"><div className="card"><div className="section-head"><div><h3>Ranking Creator</h3><p className="muted">Ranking creator hanya berasal dari Affiliate Performance dan tidak bercampur dengan Product Performance.</p></div><span className="creator-count-badge"><b>{number(rankSummary.total)} creator</b><span><i/> {number(rankSummary.active)} aktif</span></span></div><div className="scroll"><table><thead><tr>{[["rank","Rank"],["creator_name","Creator"],["platform","Platform"],["qty","Qty"],["orders","Orders"],["gmv","GMV"],["commission","Commission"]].map(([key,label])=><th key={key}><button className="table-sort" onClick={()=>toggleRankSort(key)}>{label}<span>{rankSort.key===key?(rankSort.asc?"↑":"↓"):"↕"}</span></button></th>)}<th></th></tr></thead><tbody>{sortedRanking.map(x=><tr className="creator-rank-row" key={x.creator_id}><td>{x.rank}</td><td><button className="creator-link" onClick={()=>setSelectedCreator(x.creator_id)}><b>{(Number(x.gmv||0)>0||Number(x.orders||0)>0||Number(x.qty||0)>0||Number(x.commission||0)>0)&&<i className="creator-active-dot"/>}{x.creator_name||x.username||"-"}</b><small>{x.creator_code||""}</small></button></td><td>{x.platform||"-"}</td><td>{number(x.qty)}</td><td>{number(x.orders)}</td><td>{money(x.gmv)}</td><td>{money(x.commission)}</td><td><button className="secondary compact" onClick={()=>setSelectedCreator(x.creator_id)}>360°</button></td></tr>)}{!ranking.length&&<tr><td colSpan={8}>Tidak ada data.</td></tr>}</tbody></table></div><div className="pager"><span className="pager-info">Page {page}/{pages} · {number(total)} creator</span><div className="button-row"><button className="secondary" disabled={page<=1||busy} onClick={()=>load(page-1)}>Previous</button><button className="secondary" disabled={page>=pages||busy} onClick={()=>load(page+1)}>Next</button></div></div></div><div className="card"><h3>Cost Breakdown</h3><div className="dashboard-cost-list"><span><em>HPP Produk</em><b>{money(kpi.total_cost_product)}</b></span><span><em>Ongkir</em><b>{money(kpi.total_shipping)}</b></span><span><em>Ads Spend Support</em><b>{money(kpi.total_ads_spend)}</b></span><span><em>Komisi Creator</em><b>{money(kpi.total_commission)}</b></span><span className="total"><em>Total Spend</em><b>{money(kpi.total_spend)}</b></span></div><div className="ads-support-input"><label>Input Ads Spend Support<small>{start} → {end} · {platform||"All Platform"} · {store||"Semua Toko"}</small><input type="number" min="0" step="1" value={adsInput} onChange={e=>setAdsInput(e.target.value)} placeholder="Contoh: 5000000"/></label><button className="primary" type="button" disabled={adsSaving} onClick={()=>void saveAdsSupport()}>{adsSaving?"Menyimpan...":"Simpan Ads Spend"}</button>{adsMessage&&<p className="muted">{adsMessage}</p>}</div></div></div>
  <div className="card product-ranking-card product-ranking-v6">
   <div className="section-head"><div><h3>Peringkat Produk</h3><p className="muted">Metrik mengikuti data Product Performance yang benar-benar tersedia pada periode aktif.</p></div><span className="role-badge">{number(kpi.total_products)} produk</span></div>
   {productRanking.length?<><div className="product-ranking-tabs" role="tablist" aria-label="Pilih metrik peringkat produk">
    {productMetricOptions.map(option=><button key={String(option.key)} type="button" className={productMetric===option.key?"active":""} onClick={()=>{setProductMetric(option.key);setProductSort({key:String(option.key),asc:false})}}>{option.label}</button>)}
   </div>
   <div className="product-ranking-note">Urutan memakai <b>{productMetricConfig?.label||"GMV"}</b>. Metrik yang tidak tersedia di file import tidak ditampilkan sebagai tab agar tidak menghasilkan angka nol yang menyesatkan.</div>
   <div className="scroll product-ranking-scroll"><table className="product-ranking-table"><thead><tr><th>Peringkat</th><th>Informasi Produk</th><th>Platform</th><th>{productMetricConfig?.label||"GMV"}</th><th>Proporsi</th><th>Ringkasan</th></tr></thead><tbody>
    {sortedProductRanking.map((x,i)=>{const metricValue=Number(x[productMetric]||0);const share=productMetricTotal>0&&productMetric!=="roi"?metricValue/productMetricTotal*100:null;return <tr key={(x.sku||x.product_name||"product")+"-"+i}><td><span className="product-rank-number">{i+1}</span></td><td><div className="product-info-cell"><span className="product-thumb-fallback" aria-hidden="true">{String(x.product_name||x.sku||"P").slice(0,1).toUpperCase()}</span><div><b title={x.product_name||""}>{x.product_name||"Produk tanpa nama"}</b><small>ID Produk: {x.sku||"-"}</small></div></div></td><td><span className="platform-chip">{x.platform||"-"}</span></td><td><b>{formatProductMetric(metricValue)}</b></td><td>{share===null?"—":`${share.toFixed(2)}%`}</td><td><span className="product-summary-line">{number(x.qty)} terjual · {money(x.gmv)}</span></td></tr>})}
   </tbody></table></div></>:<div className="empty-state"><strong>Belum ada Product Performance untuk periode ini.</strong><span>Upload Product Performance Shopee/TikTok melalui Upload Center untuk menampilkan ranking produk.</span></div>}
  </div>
  <div className="card store-dashboard-card"><div className="section-head"><div><h3>Store Intelligence</h3><p className="muted">Daftar toko dibentuk otomatis dari data upload yang memiliki Store/Shop/Nama Toko.</p></div><span className="role-badge">{stores.length} stores</span></div>{stores.length?<div className="scroll"><table><thead><tr>{[["store_name","Store"],["platform","Platform"],["total_affiliates","Affiliate Total"],["active_affiliates","Active"],["inactive_affiliates","Inactive"],["gmv","GMV"],["orders","Orders"],["qty","Qty"],["spend","Spend"],["roi","ROI"]].map(([key,label])=><th key={key}><button className="table-sort" onClick={()=>toggleStoreSort(key)}>{label}<span>{storeSort.key===key?(storeSort.asc?"↑":"↓"):"↕"}</span></button></th>)}</tr></thead><tbody>{sortedStores.map((x,i)=><tr key={`${x.platform}-${x.store_name}-${i}`}><td><b>{x.store_name}</b></td><td>{x.platform}</td><td>{number(x.total_affiliates)}</td><td>{number(x.active_affiliates)}</td><td>{number(x.inactive_affiliates)}</td><td>{money(x.gmv)}</td><td>{number(x.orders)}</td><td>{number(x.qty)}</td><td>{money(x.spend)}</td><td><b>{Number(x.roi||0).toFixed(2)}x</b></td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Belum ada nama toko pada data upload.</strong><span>Upload file yang memiliki kolom Store Name, Shop Name, Nama Toko, Toko, Seller Name atau Store ID.</span></div>}</div>
  </>}
  {periodApplied&&selectedCreator&&<Creator360Modal workspaceId={workspaceId} creatorId={selectedCreator} startDate={start} endDate={end} onClose={()=>setSelectedCreator(null)}/>} 
 </section>
}

function KpiCard({label,value,previous,kind}:{label:string;value:any;previous:any;kind:"money"|"number"|"ratio"}){const hasComparison=previous!==undefined;const d=hasComparison?delta(value,previous):null;const rendered=kind==="money"?money(value):kind==="ratio"?`${Number(value||0).toFixed(2)}x`:number(value);return <div className="dashboard-kpi-card"><small>{label}</small><b>{rendered}</b>{hasComparison&&(d===null?<span className="kpi-delta baseline-missing">Data baru · tanpa baseline</span>:<><span className={`kpi-delta ${d>0?"up":d<0?"down":"flat"}`}>{d>0?"↑":d<0?"↓":"→"} {Math.abs(d).toFixed(1)}% <i>vs prev.</i></span><MiniDeltaBars current={Number(value||0)} previous={Number(previous||0)}/></>)}</div>}
