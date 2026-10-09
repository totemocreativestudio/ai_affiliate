"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

type Row=Record<string,any>;
type Props={workspaceId:string;program:Row;entries:Row[];onChanged:()=>void};
const money=(v:any)=>"Rp "+Number(v||0).toLocaleString("id-ID",{maximumFractionDigits:0});
const stat=(value:string)=>value==="pending"?"Menunggu Review":value==="approved"?"Disetujui":value==="paid"?"Tercatat Tersalurkan":value==="rejected"?"Ditolak":value==="expired"?"Kedaluwarsa":value;
function monthsBetween(a:string,b:string){
 const [year,month,day]=a.split("-").map(Number);
 let count=0;
 for(let i=0;i<24;i++){
   const targetYear=year+Math.floor((month-1+i)/12);
   const targetMonth=(month-1+i)%12;
   const lastDay=new Date(Date.UTC(targetYear,targetMonth+1,0)).getUTCDate();
   const date=new Date(Date.UTC(targetYear,targetMonth,Math.min(day,lastDay))).toISOString().slice(0,10);
   if(date<=b)count++;else break;
 }
 return Math.max(1,count);
}

export default function AffiliateRewardClaims({workspaceId,program,entries,onChanged}:Props){
 const supabase=useMemo(()=>createClient(),[]);
 const [claims,setClaims]=useState<Row[]>([]),[isManager,setIsManager]=useState(false),[loading,setLoading]=useState(true);
 const [creatorId,setCreatorId]=useState(""),[period,setPeriod]=useState(1),[busy,setBusy]=useState(false);
 const [msg,setMsg]=useState(""),[action,setAction]=useState<{id:string;mode:"approve"|"reject"|"fulfill"}|null>(null);
 const [note,setNote]=useState(""),[paymentReference,setPaymentReference]=useState("");
 const periods=Math.min(Number(program.claim_limit||1),monthsBetween(String(program.start_date),String(program.end_date)));
 const authorNames=new Map(entries.map(row=>[Number(row.creator_id),String(row.creator_name||"Creator")]));
 const qualifying=entries.filter(row=>row.creator_id);
 async function load(){
  setLoading(true);
  const [r,auth]=await Promise.all([
   supabase.from("luma_affiliate_reward_claims").select("id,creator_id,claim_no,period_start,period_end,achievement,tier_name,source_rows,bonus_amount,reward_type,status,approver_note,payment_reference,submitted_by,created_at,reviewed_at,fulfilled_at")
    .eq("workspace_id",workspaceId).eq("program_id",program.id).order("created_at",{ascending:false}),
   supabase.auth.getUser()
  ]);
  if(r.error)setMsg(r.error.message);else setClaims(r.data||[]);
  if(auth.data.user){
   const m=await supabase.from("workspace_members").select("membership_role")
    .eq("workspace_id",workspaceId).eq("user_id",auth.data.user.id).maybeSingle();
   setIsManager(["owner","admin"].includes(String(m.data?.membership_role||"")));
  }
  setLoading(false);
 }
 useEffect(()=>{void load()},[workspaceId,program.id]);
 async function submit(){
  if(!creatorId)return setMsg("Pilih creator dahulu.");
  if(!window.confirm("Ajukan klaim periode "+period+" untuk creator terpilih? Sistem akan menghitung ulang data sumber yang sudah valid."))return;
  setBusy(true);setMsg("");
  const r=await supabase.rpc("luma_affiliate_submit_claim_v2",{
   p_workspace_id:workspaceId,p_program_id:program.id,p_creator_id:Number(creatorId),p_period_no:period
  });
  if(r.error)setMsg(r.error.message);
  else{setMsg("Klaim dikirim untuk review, nilai "+money(r.data.bonus)+" dari "+r.data.source_rows+" baris valid. Tidak ada pembayaran otomatis.");await load();onChanged()}
  setBusy(false);
 }
 async function review(){
  if(!action)return;
  if(action.mode!=="fulfill"&&!note.trim())return setMsg("Isi alasan/catatan review.");
  if(action.mode==="fulfill"&&!paymentReference.trim())return setMsg("Masukkan nomor referensi pembayaran atau resi sebagai bukti penyaluran.");
  setBusy(true);setMsg("");
  const r=await supabase.rpc("luma_affiliate_review_claim_v2",{
   p_workspace_id:workspaceId,p_claim_id:action.id,p_action:action.mode,
   p_note:note.trim()||null,p_payment_reference:paymentReference.trim()||null
  });
  if(r.error)setMsg(r.error.message);
  else{setMsg("Status klaim diperbarui: "+stat(r.data.status)+". Pembayaran fisik/transfer tetap dilakukan di luar Lumaway.");setAction(null);setNote("");setPaymentReference("");await load();onChanged()}
  setBusy(false);
 }
 const totals=useMemo(()=>claims.reduce((a,c)=>{
  a.total+=1;if(c.status==="pending")a.pending+=Number(c.bonus_amount||0);
  if(c.status==="approved")a.approved+=Number(c.bonus_amount||0);
  if(c.status==="paid")a.fulfilled+=Number(c.bonus_amount||0);return a;
 },{total:0,pending:0,approved:0,fulfilled:0}),[claims]);
 return <section className="asp-claims">
  <header><div><span>REWARD CONTROL & APPROVAL</span><h4>Klaim, Approval, dan Penyaluran</h4><p>Klaim dihitung ulang dari laporan yang selesai direkonsiliasi. Program dibagi menjadi maksimal sejumlah tahap klaim yang ditetapkan (1× = keseluruhan periode program). Setiap tahap dinilai mandiri; pembayaran tidak diproses oleh Lumaway.</p></div></header>
  <div className="asp-claims-kpis"><article><small>Total klaim</small><b>{totals.total}</b></article><article><small>Menunggu review</small><b>{money(totals.pending)}</b></article><article><small>Disetujui</small><b>{money(totals.approved)}</b></article><article><small>Tercatat tersalurkan</small><b>{money(totals.fulfilled)}</b></article></div>
  {isManager?<div className="asp-claim-create"><div><b>Ajukan Klaim Reward</b><small>Hanya owner/admin workspace yang dapat meninjau dan menyetujui reward.</small></div>
   <select value={creatorId} onChange={e=>setCreatorId(e.target.value)} aria-label="Creator untuk klaim"><option value="">Pilih creator peserta</option>{qualifying.map(c=><option key={c.creator_id} value={c.creator_id}>{c.creator_name}</option>)}</select>
   <select value={period} onChange={e=>setPeriod(Number(e.target.value))} aria-label="Periode klaim">{Array.from({length:periods},(_,i)=><option key={i+1} value={i+1}>Tahap {i+1} dari {periods}</option>)}</select>
   <button className="asp-primary" disabled={busy||!creatorId} onClick={()=>void submit()}>Ajukan</button>
  </div>:<p className="asp-claim-access">Daftar klaim dapat dilihat oleh anggota workspace. Pengajuan dan approval hanya tersedia bagi owner/admin.</p>}
  {msg&&<p role="status" className="asp-message">{msg}</p>}
  {loading?<p className="asp-claim-access">Memuat riwayat klaim...</p>:<div className="asp-table-scroll"><table className="asp-claims-table"><thead><tr>{["Creator","Periode","Pencapaian","Tier","Reward","Status","Audit & Bukti","Tindakan"].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>
   {claims.map(c=><tr key={c.id}><td><b>{authorNames.get(Number(c.creator_id))||"Creator #"+c.creator_id}</b></td><td>{c.period_start} — {c.period_end}<small>Tahap {c.claim_no}</small></td><td>{Number(c.achievement||0).toLocaleString("id-ID")}<small>{c.source_rows} baris</small></td><td>{c.tier_name||"-"}</td><td>{money(c.bonus_amount)}<small>{c.reward_type}</small></td><td><span className={"asp-status "+c.status}>{stat(c.status)}</span></td><td>{c.approver_note||"—"}<small>{c.payment_reference?"Ref: "+c.payment_reference:""}</small></td><td>{isManager?<div className="asp-claim-buttons">
    {c.status==="pending"&&<><button onClick={()=>{setAction({id:c.id,mode:"approve"});setNote("");setPaymentReference("")}}>Setujui</button><button onClick={()=>{setAction({id:c.id,mode:"reject"});setNote("");setPaymentReference("")}}>Tolak</button></>}
    {c.status==="approved"&&<button onClick={()=>{setAction({id:c.id,mode:"fulfill"});setNote("");setPaymentReference("")}}>Catat Penyaluran</button>}
   </div>:"—"}</td></tr>)}
   {!claims.length&&<tr><td colSpan={8}>Belum ada klaim. Klaim akan muncul setelah periode selesai, target tercapai, dan laporan valid.</td></tr>}
  </tbody></table></div>}
  {action&&<div className="asp-claim-review" role="group" aria-label="Review klaim"><b>{action.mode==="approve"?"Persetujuan reward":action.mode==="reject"?"Alasan penolakan":"Catat penyaluran reward"}</b>
   {action.mode!=="fulfill"?<textarea rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Catatan approval / alasan penolakan (wajib)"/>:
    <input value={paymentReference} onChange={e=>setPaymentReference(e.target.value)} placeholder="Nomor transfer, resi, atau bukti penyaluran (wajib)"/>}
   <p>Ini hanya mencatat status internal; sistem tidak memindahkan dana atau mengirim barang.</p><div><button disabled={busy} onClick={()=>setAction(null)}>Batal</button><button disabled={busy} className="asp-primary" onClick={()=>void review()}>{busy?"Menyimpan...":"Konfirmasi"}</button></div>
  </div>}
 </section>;
}
