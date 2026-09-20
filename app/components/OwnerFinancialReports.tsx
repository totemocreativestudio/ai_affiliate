"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {LumaLoadingMotion} from "./LumaMotionState";

type Row=Record<string,any>;
const money=(value:any,currency="IDR")=>new Intl.NumberFormat("id-ID",{style:"currency",currency,maximumFractionDigits:currency==="USD"?4:0}).format(Number(value||0));
const blankExpense=()=>({expense_date:new Date().toISOString().slice(0,10),category:"operational",vendor:"",description:"",amount:"",currency:"IDR",recurring:false,notes:""});

export default function OwnerFinancialReports({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [start,setStart]=useState("");
 const [end,setEnd]=useState("");
 const [type,setType]=useState("profit_loss");
 const [reports,setReports]=useState<Row[]>([]);
 const [expenses,setExpenses]=useState<Row[]>([]);
 const [expense,setExpense]=useState(blankExpense());
 const [editingExpenseId,setEditingExpenseId]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const [previewBusy,setPreviewBusy]=useState(false);
 const [msg,setMsg]=useState("");
 const [latest,setLatest]=useState<any>(null);

 async function load(){
  const [reportsRes,expensesRes]=await Promise.all([
   supabase.from("luma_financial_reports").select("*").order("created_at",{ascending:false}).limit(50),
   supabase.from("luma_expense_records").select("*").order("expense_date",{ascending:false}).limit(300)
  ]);
  setReports((reportsRes.data||[]) as Row[]);
  setExpenses((expensesRes.data||[]) as Row[]);
 }

 async function preview(){
  setPreviewBusy(true);
  try{
   const response=await fetch("/api/admin/financial-report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,action:"preview",report_type:type,start_date:start,end_date:end})});
   const data=await response.json();
   if(response.ok&&data.ok)setLatest(data);
  }finally{setPreviewBusy(false)}
 }

 useEffect(()=>{
  void load();
  const handler=(event:Event)=>{
   const next=String((event as CustomEvent).detail?.type||"");
   if(["sales","api_cost","cashflow","margin","profit_loss"].includes(next))setType(next);
  };
  window.addEventListener("luma-financial-report-type",handler as EventListener);
  return()=>window.removeEventListener("luma-financial-report-type",handler as EventListener);
 },[]);

 useEffect(()=>{const id=window.setTimeout(()=>void preview(),180);return()=>window.clearTimeout(id)},[workspaceId,start,end]);

 async function saveExpense(){
  if(!expense.description||!expense.amount)return setMsg("Deskripsi dan amount wajib diisi.");
  const {data:{user}}=await supabase.auth.getUser();
  const payload={...expense,amount:Number(expense.amount),updated_at:new Date().toISOString()};
  let error:any=null;
  if(editingExpenseId)({error}=await supabase.from("luma_expense_records").update(payload).eq("id",editingExpenseId));
  else({error}=await supabase.from("luma_expense_records").insert({...payload,created_by:user?.id||null}));
  setMsg(error?error.message:editingExpenseId?"Pengeluaran berhasil diperbarui.":"Pengeluaran tersimpan.");
  if(!error){setEditingExpenseId(null);setExpense(blankExpense());await load();await preview()}
 }

 function editExpense(row:Row){
  setEditingExpenseId(Number(row.id));
  setExpense({expense_date:String(row.expense_date||new Date().toISOString().slice(0,10)),category:String(row.category||"operational"),vendor:String(row.vendor||""),description:String(row.description||""),amount:String(row.amount??""),currency:String(row.currency||"IDR"),recurring:Boolean(row.recurring),notes:String(row.notes||"")});
  setMsg(`Edit pengeluaran #${row.id} aktif.`);
 }
 function cancelExpenseEdit(){setEditingExpenseId(null);setExpense(blankExpense());setMsg("")}
 async function removeExpense(id:number){
  const {error}=await supabase.from("luma_expense_records").delete().eq("id",id);
  setMsg(error?error.message:"Pengeluaran dihapus.");
  if(!error){if(editingExpenseId===id)cancelExpenseEdit();await load();await preview()}
 }

 async function generate(){
  setBusy(true);setMsg(type==="api_cost"?"Menyusun laporan usage API Lumaway...":"Memeriksa revenue Lumaway yang sudah terverifikasi...");
  try{
   const response=await fetch("/api/admin/financial-report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,action:"generate",report_type:type,start_date:start,end_date:end})});
   const data=await response.json();
   if(!response.ok||!data.ok)throw new Error(data.error||"Gagal membuat report");
   setLatest(data);
   if(data.data_ready===false){setMsg(data.message||"Revenue Lumaway belum tersedia.");return}
   setMsg("Laporan selesai dan tersimpan.");await load();
  }catch(error:any){setMsg(error.message)}finally{setBusy(false)}
 }

 async function download(id:number){
  const response=await fetch("/api/admin/financial-report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,action:"download",id})});
  if(!response.ok)return setMsg("PDF gagal dibuat.");
  const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement("a");
  anchor.href=url;anchor.download=`lumaway-financial-${id}.pdf`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }

 const labels:Record<string,string>={sales:"Total Penjualan",api_cost:"Total Usage API",cashflow:"Cashflow",margin:"Margin",profit_loss:"Laba & Rugi"};
 const revenueReady=Boolean(latest?.metrics?.revenue_ready);
 const unavailable=<span className="financial-unavailable">Belum terbentuk</span>;
 const revenueDependent=type!=="api_cost";

 return <div className="owner-section-stack">
  <section className="owner-panel">
   <div className="owner-panel-head"><div><h3>Financial & Sales Reports</h3><p>Laporan operasional Lumaway. Revenue hanya dibentuk dari pembayaran subscription dan top-up token yang benar-benar berstatus <b>paid</b>; data penjualan customer workspace tidak dipakai sebagai revenue Lumaway.</p></div></div>

   <div className="financial-report-tabs">{Object.entries(labels).map(([key,label])=><button key={key} className={type===key?"active":""} onClick={()=>setType(key)}>{label}</button>)}</div>
   <div className="grid"><label>Start<input type="date" value={start} onChange={event=>setStart(event.target.value)}/></label><label>End<input type="date" value={end} onChange={event=>setEnd(event.target.value)}/></label></div>

   {!revenueReady&&<div className="financial-readiness-note"><strong>Revenue Lumaway belum terbentuk.</strong><span>Xendit/DOKU belum menghasilkan transaksi subscription/token terverifikasi pada periode ini. Sales, Direct Cost, Margin, Cashflow, dan Profit/Loss tidak dihitung agar dashboard tidak menampilkan angka semu.</span></div>}

   <div className="button-row">
    <button className="primary" disabled={busy||(revenueDependent&&!revenueReady)} onClick={()=>void generate()}>{busy?"Generating...":revenueDependent&&!revenueReady?"Menunggu Revenue Terverifikasi":"Generate "+labels[type]}</button>
    <button className="secondary" disabled={previewBusy} onClick={()=>void preview()}>{previewBusy?"Checking...":"Refresh Data"}</button>
   </div>

   {busy&&<LumaLoadingMotion compact label="Menyusun laporan keuangan Lumaway" detail="Menggunakan transaksi paid Lumaway, usage API, payment fee, dan Expense Ledger. Data customer workspace tidak dijadikan revenue platform."/>}

   {latest&&<div className="financial-snapshot">
    <div><span>Lumaway Revenue</span><b>{revenueReady?money(latest.metrics?.sales):unavailable}</b><small>{revenueReady?`${Number(latest.metrics?.paid_transactions||0)} paid transaction(s)`:"Subscription + token paid"}</small></div>
    <div><span>Direct Cost</span><b>{revenueReady?money(latest.metrics?.direct_cost):unavailable}</b><small>{revenueReady?"API + payment processing":"Menunggu revenue verified"}</small></div>
    <div><span>API Cost</span><b>{money(latest.metrics?.api_cost_idr)}</b><small>{money(latest.metrics?.api_cost_usd,"USD")}</small></div>
    <div><span>Margin</span><b>{revenueReady?`${Number(latest.metrics?.margin_pct||0).toFixed(2)}%`:unavailable}</b><small>Contribution margin</small></div>
    <div><span>Profit / Loss</span><b>{revenueReady?money(latest.metrics?.profit_loss):unavailable}</b><small>After Expense Ledger</small></div>
   </div>}

   {latest?.source?.note&&<div className="financial-source-note"><b>Source status</b><span>{latest.source.note}</span></div>}
   {latest?.insight&&<div className="card financial-ai-insight"><h4>AI Insight</h4><p>{latest.insight.executive_summary}</p><ul>{(latest.insight.key_findings||[]).map((item:string,index:number)=><li key={index}>{item}</li>)}</ul></div>}
   {msg&&<div className="owner-inline-note">{msg}</div>}
  </section>

  <section className="owner-panel">
   <div className="owner-panel-head"><div><h3>Expense Ledger</h3><p>Pengeluaran operasional Lumaway yang belum otomatis terbaca dari provider/API. Data dapat ditambah, diedit, diperbarui, atau dihapus.</p></div></div>
   <div className="expense-form">
    <label>Tanggal<input type="date" value={expense.expense_date} onChange={event=>setExpense({...expense,expense_date:event.target.value})}/></label>
    <label>Kategori<input value={expense.category} onChange={event=>setExpense({...expense,category:event.target.value})}/></label>
    <label>Vendor<input value={expense.vendor} onChange={event=>setExpense({...expense,vendor:event.target.value})}/></label>
    <label>Deskripsi<input value={expense.description} onChange={event=>setExpense({...expense,description:event.target.value})}/></label>
    <label>Amount<input type="number" value={expense.amount} onChange={event=>setExpense({...expense,amount:event.target.value})}/></label>
    <label>Currency<select value={expense.currency} onChange={event=>setExpense({...expense,currency:event.target.value})}><option>IDR</option><option>USD</option></select></label>
    <label className="inline-check"><input type="checkbox" checked={expense.recurring} onChange={event=>setExpense({...expense,recurring:event.target.checked})}/>Recurring</label>
    <label>Notes<input value={expense.notes} onChange={event=>setExpense({...expense,notes:event.target.value})}/></label>
    <div className="button-row"><button className="primary" onClick={()=>void saveExpense()}>{editingExpenseId?"Update Expense":"Save Expense"}</button>{editingExpenseId&&<button className="secondary" type="button" onClick={cancelExpenseEdit}>Cancel Edit</button>}</div>
   </div>
   <div className="owner-table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th>Amount</th><th>Notes</th><th></th></tr></thead><tbody>{expenses.map(row=><tr key={row.id}><td>{row.expense_date}</td><td>{row.category}</td><td>{row.vendor||"-"}</td><td>{row.description}</td><td>{money(row.amount,row.currency||"IDR")}</td><td>{row.notes||"-"}</td><td><div className="button-row"><button onClick={()=>editExpense(row)}>Edit</button><button onClick={()=>void removeExpense(Number(row.id))}>Delete</button></div></td></tr>)}</tbody></table></div>
  </section>

  <section className="owner-panel"><h3>Report History</h3><p className="muted">Report lama sebelum verified-revenue guardrail tetap disimpan untuk audit, tetapi ditandai legacy dan download dinonaktifkan agar angka customer workspace tidak digunakan sebagai laporan keuangan Lumaway.</p><div className="owner-table-wrap"><table><thead><tr><th>Type</th><th>Period</th><th>Source</th><th>Model</th><th>Created</th><th></th></tr></thead><tbody>{reports.map(row=>{const verified=Boolean(row.input_json?.source);return <tr key={row.id}><td>{labels[row.report_type]||row.report_type}</td><td>{row.period_start||"All"} → {row.period_end||"All"}</td><td><span className={verified?"status-pill s-success":"status-pill s-error"}>{verified?"Verified Lumaway":"Legacy · Unverified"}</span></td><td>{row.model||"-"}</td><td>{new Date(row.created_at).toLocaleString("id-ID")}</td><td><button disabled={!verified} title={verified?"Download verified report":"Legacy report disabled"} onClick={()=>void download(Number(row.id))}>Download PDF</button></td></tr>})}</tbody></table></div></section>
 </div>;
}
