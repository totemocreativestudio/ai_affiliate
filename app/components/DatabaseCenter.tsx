"use client";

import { useEffect, useMemo, useState } from "react";

type Props = { workspaceId: string };
type Row = Record<string, any>;
function money(v: any) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(v || 0)); }
function sortRows(rows:Row[],key:string,asc:boolean){return [...rows].sort((a,b)=>{const av=a?.[key],bv=b?.[key];const an=Number(av),bn=Number(bv);if(av!==""&&bv!==""&&Number.isFinite(an)&&Number.isFinite(bn))return (an-bn)*(asc?1:-1);return String(av??"").localeCompare(String(bv??""),"id",{numeric:true,sensitivity:"base"})*(asc?1:-1)})}

export default function DatabaseCenter({ workspaceId }: Props) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [platform, setPlatform] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>({ imports: [], sales: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importSort,setImportSort]=useState({key:"imported_at",asc:false});
  const [salesSort,setSalesSort]=useState({key:"data_date",asc:false});
  const [deleteTarget,setDeleteTarget]=useState<Row|null>(null);
  const [verifyCode,setVerifyCode]=useState("");
  const [verifyInput,setVerifyInput]=useState("");
  const [deleteBusy,setDeleteBusy]=useState(false);
  const [deleteStep,setDeleteStep]=useState<"confirm"|"verify">("confirm");

  async function load(targetPage = page) {
    setLoading(true); setError("");
    try {
      const q = new URLSearchParams({ workspace_id: workspaceId, page: String(targetPage), page_size: "50" });
      if (start) q.set("start", start); if (end) q.set("end", end); if (platform) q.set("platform", platform);
      const r = await fetch(`/api/database?${q.toString()}`); const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Gagal memuat database."); setData(d); setPage(targetPage);
    } catch (e: any) { setError(e?.message || "Gagal memuat database."); } finally { setLoading(false); }
  }

  useEffect(() => { load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [workspaceId]);
  useEffect(()=>{const refresh=()=>void load(1);window.addEventListener("lumaway-database-updated",refresh as EventListener);return()=>window.removeEventListener("lumaway-database-updated",refresh as EventListener)},[workspaceId]);
  const totalPages = Math.max(1, Math.ceil(Number(data.total || 0) / 50));
  const sortedImports=useMemo(()=>sortRows(data.imports||[],importSort.key,importSort.asc),[data.imports,importSort]);
  const sortedSales=useMemo(()=>sortRows(data.sales||[],salesSort.key,salesSort.asc),[data.sales,salesSort]);
  const toggleImportSort=(key:string)=>setImportSort(v=>({key,asc:v.key===key?!v.asc:true}));
  const toggleSalesSort=(key:string)=>setSalesSort(v=>({key,asc:v.key===key?!v.asc:true}));

  function requestDelete(row:Row){
    setDeleteTarget(row);
    setDeleteStep("confirm");
    setVerifyCode("");
    setVerifyInput("");
    setError("");
  }
  function beginDeleteVerification(){
    setVerifyCode(String(Math.floor(100+Math.random()*900)));
    setVerifyInput("");
    setDeleteStep("verify");
  }
  async function confirmDelete(){
    if(!deleteTarget)return;
    if(verifyInput!==verifyCode){setError("Kode persetujuan tidak sesuai.");return}
    setDeleteBusy(true);setError("");
    try{
      const r=await fetch("/api/database/import",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,import_id:deleteTarget.import_id})});
      const d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.error||"Gagal menghapus import.");
      setDeleteTarget(null);setDeleteStep("confirm");setVerifyInput("");setVerifyCode("");
      await load(1);
      window.dispatchEvent(new CustomEvent("lumaway-database-updated",{detail:{deleted_import_id:d.import_id}}));
    }catch(e:any){setError(e?.message||"Gagal menghapus import.")}finally{setDeleteBusy(false)}
  }

  return <section id="database" className="legacy-page-anchor">
    <div className="page-head"><div><div className="eyebrow">DATABASE</div><h1>Database</h1><p className="muted">Upload history dan Latest Sales / Performance dari workspace aktif.</p></div></div>
    <div className="card"><div className="section-head"><div><h3>Upload / Import History</h3><p className="muted">50 import terbaru.</p></div><button className="secondary" onClick={() => load(1)}>Refresh</button></div><div className="scroll"><table><thead><tr>{[["import_id","Import ID"],["filename","File"],["data_type","Type"],["platform","Platform"],["start_date","Period"],["rows_imported","Rows"],["status","Status"],["imported_at","Imported"]].map(([key,label])=><th key={key}><button className="table-sort" onClick={()=>toggleImportSort(key)}>{label}<span>{importSort.key===key?(importSort.asc?"↑":"↓"):"↕"}</span></button></th>)}<th>Action</th></tr></thead><tbody>
      {sortedImports.map((x: Row) => <tr key={x.id || x.import_id}><td>{x.import_id}</td><td>{x.filename}</td><td>{x.data_type}</td><td>{x.platform}</td><td>{x.start_date || "-"} → {x.end_date || "-"}</td><td>{Number(x.rows_imported || 0).toLocaleString("id-ID")}</td><td>{x.status}</td><td>{x.imported_at || "-"}</td><td><button className="danger-lite" onClick={()=>requestDelete(x)}>Hapus</button></td></tr>)}
      {!data.imports?.length && <tr><td colSpan={9}>Belum ada import.</td></tr>}
    </tbody></table></div></div>
    <div className="card"><h3>Latest Sales / Performance</h3><div className="filters"><label>Start <span className="field-note">Opsional</span><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label><label>End <span className="field-note">Opsional</span><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label><label>Platform<select value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">All</option><option>TikTok</option><option>Shopee</option><option>Instagram</option></select></label><button onClick={() => load(1)} disabled={loading}>{loading ? "Loading..." : "Apply"}</button><button className="secondary" onClick={() => { setStart(""); setEnd(""); setPlatform(""); setTimeout(() => load(1), 0); }}>Reset</button></div>
      {error && <div className="flash error">{error}</div>}
      <div className="scroll"><table><thead><tr>{[["data_date","Date"],["creator_name","Creator"],["platform","Platform"],["channel","Channel"],["sku","SKU"],["product_name","Product"],["qty","Qty"],["orders","Orders"],["gmv","GMV"],["commission","Commission"]].map(([key,label])=><th key={key}><button className="table-sort" onClick={()=>toggleSalesSort(key)}>{label}<span>{salesSort.key===key?(salesSort.asc?"↑":"↓"):"↕"}</span></button></th>)}</tr></thead><tbody>
        {sortedSales.map((x: Row) => <tr key={x.id}><td>{x.data_date || "-"}</td><td>{x.creator_name || x.username || "-"}</td><td>{x.platform || "-"}</td><td>{x.channel || "-"}</td><td>{x.sku || "-"}</td><td>{x.product_name || "-"}</td><td>{Number(x.qty || 0).toLocaleString("id-ID")}</td><td>{Number(x.orders || 0).toLocaleString("id-ID")}</td><td>{money(x.gmv)}</td><td>{money(x.commission)}</td></tr>)}
        {!data.sales?.length && <tr><td colSpan={10}>Tidak ada data untuk filter ini.</td></tr>}
      </tbody></table></div>
      <div className="pager"><span className="pager-info">Page {page} / {totalPages} · {Number(data.total || 0).toLocaleString("id-ID")} row</span><div className="button-row"><button className="secondary" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>Previous</button><button className="secondary" disabled={page >= totalPages || loading} onClick={() => load(page + 1)}>Next</button></div></div>
    </div>
    {deleteTarget&&<div className="confirm-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!deleteBusy)setDeleteTarget(null)}}>
      <div className="confirm-card">
        {deleteStep==="confirm"?<>
          <h3>Hapus data import?</h3>
          <p>Anda yakin untuk hapus <b>{deleteTarget.filename}</b>?</p>
          <div className="confirm-warning">Data database yang berasal dari import ini akan ikut dihapus. Tindakan ini tidak dapat dibatalkan.</div>
          <div className="button-row"><button className="secondary" disabled={deleteBusy} onClick={()=>setDeleteTarget(null)}>TIDAK</button><button className="danger" disabled={deleteBusy} onClick={beginDeleteVerification}>YA</button></div>
        </>:<>
          <h3>Verifikasi persetujuan</h3>
          <p>Masukkan kode 3 angka berikut untuk menyetujui penghapusan <b>{deleteTarget.filename}</b>.</p>
          <label>Kode persetujuan <strong className="verify-code">{verifyCode}</strong>
            <input inputMode="numeric" maxLength={3} autoFocus value={verifyInput} onChange={e=>setVerifyInput(e.target.value.replace(/\D/g,"").slice(0,3))} placeholder="Masukkan 3 angka"/>
          </label>
          <div className="button-row"><button className="secondary" disabled={deleteBusy} onClick={()=>setDeleteStep("confirm")}>KEMBALI</button><button className="danger" disabled={deleteBusy||verifyInput!==verifyCode} onClick={()=>void confirmDelete()}>{deleteBusy?"Menghapus...":"HAPUS"}</button></div>
        </>}
      </div>
    </div>}
  </section>;
}
