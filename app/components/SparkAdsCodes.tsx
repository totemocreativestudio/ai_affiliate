"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
type SparkRow={id:number;code:string;platform:string;content_url:string|null;description:string|null;valid_from:string|null;valid_until:string|null;status:string;created_at:string;created_by:string};
const SIZE=10;
export default function SparkAdsCodes({workspaceId,creatorId,platform}:{workspaceId:string;creatorId:number;platform:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [rows,setRows]=useState<SparkRow[]>([]);
 const [page,setPage]=useState(1),[total,setTotal]=useState(0),[code,setCode]=useState("");
 const [url,setUrl]=useState(""),[notes,setNotes]=useState(""),[until,setUntil]=useState("");
 const [status,setStatus]=useState(""),[busy,setBusy]=useState(false);
 async function reload(targetPage=page){
  const p=Math.max(1,targetPage), start=(p-1)*SIZE;
  const result=await supabase.from("luma_spark_ads_codes")
   .select("id,code,platform,content_url,description,valid_from,valid_until,status,created_at,created_by",{count:"exact"})
   .eq("workspace_id",workspaceId).eq("creator_id",creatorId)
   .order("created_at",{ascending:false}).range(start,start+SIZE-1);
  if(result.error)setStatus("Gagal memuat kode: "+result.error.message);
  else{setRows((result.data||[]) as SparkRow[]);setTotal(result.count||0);setPage(p)}
 }
 useEffect(()=>{setPage(1);setStatus("");void reload(1)},[workspaceId,creatorId]);
 async function save(){
  if(!code.trim())return setStatus("Kode otorisasi Spark Ads wajib diisi.");
  if(url.trim()&&!/^https:\/\//i.test(url.trim()))return setStatus("Tautan konten harus memakai https://.");
  setBusy(true);setStatus("");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setBusy(false);return setStatus("Silakan login kembali.")}
  const result=await supabase.from("luma_spark_ads_codes").insert({
   workspace_id:workspaceId,creator_id:creatorId,platform:platform||"TikTok",
   code:code.trim(),content_url:url.trim()||null,description:notes.trim()||null,
   valid_from:new Date().toISOString().slice(0,10),valid_until:until||null,
   created_by:user.id,status:"active"
  });
  if(result.error)setStatus(result.error.code==="23505"?"Kode Spark Ads tersebut sudah didaftarkan untuk workspace ini.":result.error.message);
  else{setCode("");setUrl("");setNotes("");setUntil("");setStatus("Kode berhasil didaftarkan dan dapat digunakan tim iklan.");await reload(1)}
  setBusy(false);
 }
 async function mark(row:SparkRow,next:"used"|"revoked"|"active"){
  setBusy(true);setStatus("");
  const result=await supabase.from("luma_spark_ads_codes")
   .update({status:next,updated_at:new Date().toISOString()})
   .eq("workspace_id",workspaceId).eq("creator_id",creatorId).eq("id",row.id);
  if(result.error)setStatus(result.error.message);else await reload();
  setBusy(false);
 }
 async function remove(row:SparkRow){
  if(!window.confirm("Hapus kode Spark Ads ini dari daftar tim?"))return;
  setBusy(true);
  const result=await supabase.from("luma_spark_ads_codes").delete()
   .eq("workspace_id",workspaceId).eq("creator_id",creatorId).eq("id",row.id);
  if(result.error)setStatus(result.error.message);
  else await reload(rows.length===1&&page>1?page-1:page);
  setBusy(false);
 }
 const pages=Math.max(1,Math.ceil(total/SIZE));
 return <section className="spark-codes-card card">
  <div className="section-head"><div><h3>Spark Ads Authorization Codes</h3><p className="muted">Input manual kode otorisasi dari creator. Digunakan tim iklan dan tersimpan khusus workspace ini. Kode tidak dipublikasikan ke Lumaway Social.</p></div><span className="spark-count">{total} kode</span></div>
  <div className="spark-code-fields"><label>Kode Ads<input value={code} onChange={e=>setCode(e.target.value)} placeholder="Tempel kode Spark Ads dari creator"/></label>
   <label>URL Video / Konten<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://www.tiktok.com/..."/></label>
   <label>Berlaku Hingga<input type="date" value={until} onChange={e=>setUntil(e.target.value)}/></label>
   <label>Catatan untuk Tim Ads<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Campaign, izin, durasi, produk"/></label>
   <button className="primary" disabled={busy||!code.trim()} onClick={()=>void save()}>+ Simpan Kode</button>
  </div>
  {status&&<p className="spark-code-status" role="status">{status}</p>}
  <div className="spark-code-scroll"><table><thead><tr>{["No.","Kode Otorisasi","Konten","Berlaku Hingga","Status","Tindakan"].map(s=><th key={s}>{s}</th>)}</tr></thead>
   <tbody>{rows.map((r,i)=><tr key={r.id}><td>{(page-1)*SIZE+i+1}</td><td><code>{r.code}</code><button className="spark-copy" onClick={()=>{void navigator.clipboard.writeText(r.code);setStatus("Kode disalin.")}}>Salin</button></td><td>{r.content_url?<a href={r.content_url} target="_blank" rel="noopener noreferrer">Buka video ↗</a>:"—"}<small>{r.description||""}</small></td><td>{r.valid_until||"Tidak dibatasi"}</td><td><span className={"spark-chip "+((r.valid_until&&r.valid_until<new Date().toISOString().slice(0,10))?"expired":r.status)}>{r.valid_until&&r.valid_until<new Date().toISOString().slice(0,10)?"Expired":r.status}</span></td><td><div className="spark-actions">{r.status==="active"&&<button disabled={busy} onClick={()=>void mark(r,"used")}>Sudah Dipakai</button>}{r.status!=="revoked"&&<button disabled={busy} onClick={()=>void mark(r,"revoked")}>Cabut</button>}{r.status!=="active"&&<button disabled={busy} onClick={()=>void mark(r,"active")}>Aktifkan</button>}<button disabled={busy} onClick={()=>void remove(r)}>Hapus</button></div></td></tr>)}
    {!rows.length&&<tr><td colSpan={6}>Belum ada kode otorisasi untuk creator ini.</td></tr>}</tbody>
  </table></div>
  <footer className="spark-pagination"><span>Menampilkan {rows.length?((page-1)*SIZE+1):0}–{Math.min(page*SIZE,total)} dari {total}</span><div><button disabled={busy||page<=1} onClick={()=>void reload(page-1)}>← Sebelumnya</button><span>Halaman {page} / {pages}</span><button disabled={busy||page>=pages} onClick={()=>void reload(page+1)}>Berikutnya →</button></div></footer>
 </section>;
}
