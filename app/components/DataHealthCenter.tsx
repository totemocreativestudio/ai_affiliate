"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {navigateToSection} from "../../lib/luma-navigation";

type Issue={
  key:string;
  severity:"critical"|"warning"|"info"|string;
  count:number;
  title:string;
  description:string;
  section:string;
  action_label:string;
};

type HealthPayload={
  status:"healthy"|"attention"|"critical"|string;
  critical_categories:number;
  warning_categories:number;
  latest_successful_import_at:string|null;
  summary:{creators:number;products:number;affiliate_rows:number;product_rows:number};
  metrics:Record<string,number>;
  issues:Issue[];
  recent_imports:Array<Record<string,any>>;
};

function fmt(value:any){return Number(value||0).toLocaleString("id-ID")}
function dateTime(value:string|null){return value?new Date(value).toLocaleString("id-ID"):"Belum ada"}
function parseMessage(value:any){
  if(!value)return null;
  try{return typeof value==="string"?JSON.parse(value):value}catch{return null}
}

export default function DataHealthCenter({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [data,setData]=useState<HealthPayload|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState<"all"|"critical"|"warning">("all");
  const now=new Date();const defaultStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);const defaultEnd=now.toISOString().slice(0,10);
  const [reconStart,setReconStart]=useState(defaultStart),[reconEnd,setReconEnd]=useState(defaultEnd),[recon,setRecon]=useState<any>(null),[reconLoading,setReconLoading]=useState(false);

  async function load(){
    setLoading(true);setError("");
    const {data:payload,error:rpcError}=await supabase.rpc("luma_data_health_v1",{p_workspace_id:workspaceId});
    if(rpcError){setError(rpcError.message);setData(null)}
    else setData((payload||null) as HealthPayload|null);
    setLoading(false);
  }

  useEffect(()=>{void load()},[workspaceId]);
  async function loadReconciliation(){
    if(!reconStart||!reconEnd)return;
    setReconLoading(true);
    const {data:payload,error:rpcError}=await supabase.rpc("luma_data_reconciliation_v1",{p_workspace_id:workspaceId,p_start_date:reconStart,p_end_date:reconEnd,p_platform:null,p_store_name:null});
    if(rpcError)setError(rpcError.message);else setRecon(payload||null);
    setReconLoading(false);
  }
  useEffect(()=>{void loadReconciliation()},[workspaceId]);
  useEffect(()=>{
    const refresh=()=>void load();
    window.addEventListener("lumaway-database-updated",refresh as EventListener);
    return()=>window.removeEventListener("lumaway-database-updated",refresh as EventListener);
  },[workspaceId]);

  const issues=useMemo(()=>{
    const source=data?.issues||[];
    return filter==="all"?source:source.filter(item=>item.severity===filter);
  },[data,filter]);

  const issueRows=useMemo(()=>[
    ["Creator tanpa identitas",data?.metrics?.creator_missing_identity||0,"listings"],
    ["Creator terindikasi duplikat",data?.metrics?.creator_duplicates||0,"creator-identity"],
    ["Produk tanpa nama",data?.metrics?.product_missing_name||0,"product-master"],
    ["Produk tanpa HPP",data?.metrics?.product_missing_hpp||0,"product-master"],
    ["Produk tanpa gambar",data?.metrics?.product_missing_image||0,"product-master"],
    ["Performance tanpa creator",data?.metrics?.performance_missing_creator||0,"database"],
    ["Performance seluruh metrik nol",data?.metrics?.performance_zero_metric||0,"database"],
    ["Product Performance belum terpetakan",data?.metrics?.product_performance_unmapped||0,"product-master"],
    ["Import gagal / tertahan",data?.metrics?.failed_imports||0,"database"],
    ["Import sukses 0 row",data?.metrics?.zero_row_imports||0,"database"],
    ["Listing perlu follow up",data?.metrics?.stale_listings||0,"listings"],
    ["Sample belum terhubung penuh",data?.metrics?.unlinked_samples||0,"creator-samples"],
    ["Shipping aktif tanpa resi",data?.metrics?.shipping_missing_tracking||0,"shipping"],
  ] as const,[data]);

  const totalDetected=issueRows.reduce((sum,row)=>sum+Number(row[1]||0),0);
  const statusLabel=data?.status==="critical"?"Perlu tindakan":data?.status==="attention"?"Perlu perhatian":"Data siap digunakan";

  return <section id="data-health" className="legacy-page-anchor data-health-page">
    <header className="data-health-head">
      <div><span>DATA & INTELLIGENCE</span><h1>Data Health Center</h1><p>Pusat pemeriksaan kualitas data Lumaway. Temukan mapping yang terputus, data kosong, duplikasi, dan import bermasalah sebelum memengaruhi dashboard.</p></div>
      <div className={"data-health-state state-"+(data?.status||"loading")}><i/><span>{loading?"Memeriksa data...":statusLabel}</span><b>{loading?"—":fmt(totalDetected)+" temuan"}</b></div>
    </header>

    {error&&<div className="flash error">{error}</div>}

    <div className="data-health-kpis">
      <article><span>Master Creator</span><b>{loading?"—":fmt(data?.summary?.creators)}</b><small>workspace aktif</small></article>
      <article><span>Product Master</span><b>{loading?"—":fmt(data?.summary?.products)}</b><small>SKU induk</small></article>
      <article><span>Affiliate Performance</span><b>{loading?"—":fmt(data?.summary?.affiliate_rows)}</b><small>row tersimpan</small></article>
      <article><span>Product Performance</span><b>{loading?"—":fmt(data?.summary?.product_rows)}</b><small>row tersimpan</small></article>
      <article><span>Kategori Kritis</span><b>{loading?"—":fmt(data?.critical_categories)}</b><small>butuh tindakan</small></article>
      <article><span>Import Sukses Terakhir</span><b className="data-health-date">{loading?"—":dateTime(data?.latest_successful_import_at||null)}</b><small>sinkronisasi database</small></article>
    </div>

    <section className="data-health-panel">
      <div className="data-health-panel-head">
        <div><h2>Temuan yang perlu diperiksa</h2><p>Prioritas ditentukan dari dampaknya terhadap dashboard, ranking, Customer 360, Product Master, dan workflow.</p></div>
        <div className="data-health-filter">
          {(["all","critical","warning"] as const).map(key=><button type="button" key={key} className={filter===key?"active":""} onClick={()=>setFilter(key)}>{key==="all"?"Semua":key==="critical"?"Kritis":"Perhatian"}</button>)}
          <button type="button" onClick={()=>void load()} disabled={loading}>Refresh</button>
        </div>
      </div>

      {loading?<div className="data-health-loading">{Array.from({length:5}).map((_,i)=><i key={i}/>)}</div>:issues.length?<div className="data-health-issues">
        {issues.map(issue=><article key={issue.key} className={"health-issue severity-"+issue.severity}>
          <div className="health-issue-marker"><i/></div>
          <div className="health-issue-copy"><div><strong>{issue.title}</strong><span>{fmt(issue.count)} data</span></div><p>{issue.description}</p></div>
          <button type="button" onClick={()=>navigateToSection(issue.key==="creator_duplicates"?"creator-identity":issue.section)}>{issue.action_label} <span>→</span></button>
        </article>)}
      </div>:<div className="data-health-clear"><div>✓</div><strong>Tidak ada masalah utama yang terdeteksi.</strong><span>Data utama workspace siap digunakan oleh dashboard dan modul operasional.</span></div>}
    </section>

    <div className="data-health-grid">
      <section className="data-health-panel">
        <div className="data-health-panel-head"><div><h2>Coverage & kelengkapan</h2><p>Indikator ini tidak menghapus data. Gunakan untuk menentukan data mana yang perlu dilengkapi.</p></div></div>
        <div className="data-health-matrix">
          {issueRows.map(([label,value,section])=><button type="button" key={label} onClick={()=>navigateToSection(section)}>
            <span>{label}</span><b>{fmt(value)}</b><i className={Number(value)>0?"has-issue":"is-clear"}>{Number(value)>0?"Periksa":"OK"}</i>
          </button>)}
        </div>
      </section>

      <section className="data-health-panel">
        <div className="data-health-panel-head"><div><h2>Import terbaru</h2><p>Audit cepat parser, mapping, duplicate, skipped row, dan hasil import.</p></div><button type="button" onClick={()=>navigateToSection("database")}>Import History</button></div>
        <div className="health-import-list">
          {(data?.recent_imports||[]).map((row:any)=>{
            const meta=parseMessage(row.message)||{};
            const bad=String(row.status||"").toLowerCase()!=="success"&&String(row.status||"").toLowerCase()!=="superseded";
            return <article key={row.import_id||row.filename}>
              <span className={"health-import-status "+(bad?"bad":"ok")}>{row.status||"-"}</span>
              <div><strong>{row.filename||row.import_id}</strong><small>{row.data_type||"-"} · {row.platform||"-"} · {dateTime(row.imported_at||null)}</small></div>
              <div className="health-import-stats"><span>{fmt(row.rows_imported)} row</span>{Number(meta.skipped||0)>0&&<span>{fmt(meta.skipped)} skipped</span>}{Number(meta.duplicates||0)>0&&<span>{fmt(meta.duplicates)} duplicate</span>}</div>
            </article>
          })}
          {!loading&&!data?.recent_imports?.length&&<div className="data-health-clear compact"><strong>Belum ada import.</strong><span>Upload file pertama melalui Upload Center.</span></div>}
        </div>
      </section>
    </div>

    <section className="data-health-panel data-reconciliation-panel">
      <div className="data-health-panel-head">
        <div><span className="eyebrow">PRODUCTION RECONCILIATION</span><h2>Dashboard vs Spending vs Source Data</h2><p>Gunakan periode yang sama untuk memastikan HPP, Sample HPP, Ongkir, dan Total Spending konsisten.</p></div>
        <div className="data-recon-filters"><input type="date" value={reconStart} onChange={e=>setReconStart(e.target.value)}/><span>→</span><input type="date" value={reconEnd} onChange={e=>setReconEnd(e.target.value)}/><button type="button" onClick={()=>void loadReconciliation()} disabled={reconLoading}>{reconLoading?"Checking...":"Run Check"}</button></div>
      </div>
      {reconLoading?<div className="live-loading">Menjalankan reconciliation...</div>:recon?<><div className="data-recon-summary">
        <article><span>Sales HPP</span><b>{new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(recon.canonical?.sales_hpp||0))}</b></article>
        <article><span>Sample HPP</span><b>{new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(recon.canonical?.sample_hpp||0))}</b></article>
        <article><span>Total Shipping</span><b>{new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(recon.canonical?.total_shipping||0))}</b></article>
        <article><span>Total Spending</span><b>{new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(recon.canonical?.total_spending||0))}</b></article>
      </div><div className="data-recon-checks">{(recon.checks||[]).map((x:any)=><article key={x.key} className={"state-"+String(x.status||"").toLowerCase()}><div><strong>{x.label}</strong><small>{x.expected!=null&&x.actual!=null?("Expected "+Number(x.expected).toLocaleString("id-ID")+" · Actual "+Number(x.actual).toLocaleString("id-ID")):x.actual!=null?("Temuan "+Number(x.actual).toLocaleString("id-ID")):""}</small></div><b>{x.status}</b></article>)}</div></>:<div className="data-health-clear compact"><strong>Belum menjalankan reconciliation.</strong><span>Pilih periode lalu jalankan pemeriksaan.</span></div>}
    </section>

    <section className="data-health-panel data-health-guidance">
      <div><span>RECOMMENDED FLOW</span><h2>Sebelum import besar</h2><p>Gunakan alur baru Upload Center: <b>Upload → Mapping → Preview → Import</b>. Mapping yang sudah dikonfirmasi disimpan per workspace sehingga format file yang sama berikutnya tidak perlu diatur dari awal.</p></div>
      <button type="button" onClick={()=>navigateToSection("upload")}>Buka Upload Center</button>
    </section>
  </section>;
}
