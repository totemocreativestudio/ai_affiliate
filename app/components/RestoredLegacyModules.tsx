"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import LumaAffiliateCenter from "./LumaAffiliateCenter";
import PromoStudioV2 from "./PromoStudioV2";
import BillingCenter from "./BillingCenter";
import KanbanBoard from "./KanbanBoard";
import InternalExcelGrid from "./InternalExcelGrid";
import UserProfile from "./UserProfile";
import AdminDashboard from "./AdminDashboard";
import {CreatorAutocomplete,ProductAutocomplete,CreatorSearchResult,ProductSearchResult} from "./SmartAutocomplete";

type Row=Record<string,any>;
const fmt=(v:any)=>new Intl.NumberFormat("id-ID").format(Number(v||0));

export default function RestoredLegacyModules({workspaceId,userId,isAdmin}:{workspaceId:string;userId:string;isAdmin:boolean}){
  if(isAdmin) return <AdminDashboard workspaceId={workspaceId}/>;
  return <>
    <InternalExcelGrid workspaceId={workspaceId}/>
    <Agreements workspaceId={workspaceId}/>
    <AffiliateSupport workspaceId={workspaceId}/>
    <LumaAffiliateCenter workspaceId={workspaceId} userId={userId}/>
    <PromoStudioV2 workspaceId={workspaceId} userId={userId}/>
    <KanbanBoard workspaceId={workspaceId} userId={userId}/>
    <Tutorials workspaceId={workspaceId}/>
    <BillingCenter workspaceId={workspaceId} userId={userId}/>
    <UserProfile workspaceId={workspaceId} userId={userId}/>
  </>;
}

function Table({rows,columns}:{rows:Row[];columns?:string[]}){
  const cols=useMemo(()=>(columns||(rows[0]?Object.keys(rows[0]):[])).filter(c=>c!=="workspace_id").slice(0,10),[columns,rows]);
  const [sort,setSort]=useState({key:cols[0]||"",asc:true});
  const sorted=useMemo(()=>[...rows].sort((a,b)=>{const av=a?.[sort.key],bv=b?.[sort.key];const an=Number(av),bn=Number(bv);if(av!==""&&bv!==""&&Number.isFinite(an)&&Number.isFinite(bn))return(an-bn)*(sort.asc?1:-1);return String(av??"").localeCompare(String(bv??""),"id",{numeric:true,sensitivity:"base"})*(sort.asc?1:-1)}),[rows,sort]);
  if(!rows.length)return <div className="empty-state"><strong>Belum ada data.</strong></div>;
  return <div className="scroll"><table><thead><tr>{cols.map(c=><th key={c}><button className="table-sort" onClick={()=>setSort(v=>({key:c,asc:v.key===c?!v.asc:true}))}>{c.replaceAll("_"," ")}<span>{sort.key===c?(sort.asc?"↑":"↓"):"↕"}</span></button></th>)}</tr></thead><tbody>{sorted.map((r,i)=><tr key={r.id??i}>{cols.map(c=><td key={c}>{typeof r[c]==="object"?JSON.stringify(r[c]):String(r[c]??"")}</td>)}</tr>)}</tbody></table></div>
}

function Agreements({workspaceId}:{workspaceId:string}){
  const supabase=createClient();
  const empty:Row={creator_id:"",creator_name:"",platform:"TikTok",brand:"",category:"",product_master_id:"",product_name:"",product_hpp:0,deal_type:"",ratecard:"",support_type:"",support_value:"",start_date:"",end_date:"",document_status:"Approved",support_status:"Pending",bonus_eligible:"No",notes:"",signed_by_name:""};
  const [rows,setRows]=useState<Row[]>([]),[msg,setMsg]=useState("");
  const [form,setForm]=useState<Row>(empty);
  const [creatorSearch,setCreatorSearch]=useState("");
  const [productSearch,setProductSearch]=useState("");

  async function load(){
    const {data,error}=await supabase.from("agreements").select("*").eq("workspace_id",workspaceId).order("id",{ascending:false}).limit(300);
    if(error)setMsg(error.message);else setRows((data||[]) as Row[]);
  }
  useEffect(()=>{void load()},[workspaceId]);

  function sealId(){
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes=new Uint8Array(22);crypto.getRandomValues(bytes);
    return Array.from(bytes,b=>chars[b%chars.length]).join("");
  }
  function chooseCreator(x:CreatorSearchResult){
    const label=x.name||x.username||x.creator_code||"";
    setCreatorSearch(label);
    setForm(p=>({...p,creator_id:String(x.id),creator_name:label,platform:x.platform||p.platform,ratecard:Number(x.ratecard||p.ratecard||0)}));
  }
  function chooseProduct(x:ProductSearchResult){
    setProductSearch(`${x.sku} - ${x.product_name||""}`);
    setForm(p=>({...p,product_master_id:String(x.id),product_name:x.product_name||x.sku,product_hpp:Number(x.cost_price||0)}));
  }
  async function save(){
    if(!form.creator_id)return setMsg("Pilih creator dari hasil pencarian.");
    if(!String(form.signed_by_name||"").trim())return setMsg("Nama tanda tangan wajib diisi.");
    const payload={
      ...form,workspace_id:workspaceId,agreement_id:`AGR-${Date.now()}`,
      creator_id:Number(form.creator_id),product_master_id:form.product_master_id?Number(form.product_master_id):null,
      product_hpp:Number(form.product_hpp||0),ratecard:Number(form.ratecard||0),support_value:Number(form.support_value||0),
      e_stamp_id:sealId(),signed_by_name:String(form.signed_by_name).trim(),signed_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    };
    const {error}=await supabase.from("agreements").insert(payload);
    setMsg(error?error.message:"Agreement tersimpan. Program creator otomatis Active dan PDF siap dibuat.");
    if(!error){await load();setForm({...empty});setCreatorSearch("");setProductSearch("")}
  }
  const f=(k:string,l:string,type="text")=><label>{l}<input type={type} value={form[k]||""} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>;

  return <section id="agreements" className="legacy-page-anchor">
    <div className="eyebrow">CREATOR MANAGEMENT</div><h1>Agreement</h1>
    <div className="card">
      <div className="grid">
        <label>Creator Search<CreatorAutocomplete workspaceId={workspaceId} value={creatorSearch} selectedId={form.creator_id} onTextChange={value=>{setCreatorSearch(value);setForm(p=>({...p,creator_id:"",creator_name:value}))}} onSelect={chooseCreator}/></label>
        {f("platform","Platform")}
        {f("brand","Brand")}
        {f("category","Category")}
        <label>Product / SKU Search<ProductAutocomplete workspaceId={workspaceId} value={productSearch} selectedId={form.product_master_id} onTextChange={value=>{setProductSearch(value);setForm(p=>({...p,product_master_id:"",product_name:"",product_hpp:0}))}} onSelect={chooseProduct}/><small className="field-note">HPP terhubung otomatis: Rp {Number(form.product_hpp||0).toLocaleString("id-ID")}</small></label>
        {f("deal_type","Deal Type")}
        {f("ratecard","Ratecard","number")}
        {f("support_type","Support Type")}
        {f("support_value","Support Value","number")}
        {f("start_date","Start","date")}
        {f("end_date","End","date")}
        <label>Document Status<select value={form.document_status} onChange={e=>setForm({...form,document_status:e.target.value})}><option>Pending</option><option>Approved</option><option>Rejected</option></select></label>
        <label>Support Status<select value={form.support_status} onChange={e=>setForm({...form,support_status:e.target.value})}><option>Pending</option><option>Approved</option><option>Completed</option></select></label>
        <label>Bonus Eligible<select value={form.bonus_eligible} onChange={e=>setForm({...form,bonus_eligible:e.target.value})}><option>No</option><option>Yes</option></select></label>
        {f("signed_by_name","Nama Tanda Tangan")}
      </div>
      <label>Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
      <div className="owner-inline-note"><b>Digital Seal ID:</b> dibuat otomatis 22 karakter unik saat Agreement disimpan. PDF akan memuat nama tanda tangan sebagai watermark. Untuk e-Meterai dengan status hukum resmi, tetap gunakan penyedia e-Meterai resmi/berizin.</div>
      <button className="primary" onClick={()=>void save()}>Simpan Agreement</button>{msg&&<p className="muted">{msg}</p>}
    </div>
    <div className="card"><h3>Agreement aktif</h3>
      <div className="scroll"><table><thead><tr>{["Agreement","Creator","Platform","Product","Status","Program","Digital Seal","Signed By","PDF"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>
        {rows.map(row=><tr key={row.id}><td>{row.agreement_id||"-"}</td><td>{row.creator_name||"-"}</td><td>{row.platform||"-"}</td><td>{row.product_name||"-"}</td><td>{row.document_status||"-"}</td><td><span className="status-pill s-paid">Active</span></td><td><code>{row.e_stamp_id||"-"}</code></td><td>{row.signed_by_name||"-"}</td><td>{row.e_stamp_id?<a className="secondary compact" href={`/api/agreements/${row.id}/pdf?workspace_id=${encodeURIComponent(workspaceId)}`} target="_blank" rel="noreferrer">PDF</a>:"-"}</td></tr>)}
        {!rows.length&&<tr><td colSpan={9}>Belum ada Agreement.</td></tr>}
      </tbody></table></div>
    </div>
  </section>
}

function AffiliateSupport({workspaceId}:{workspaceId:string}){
  const supabase=createClient();const [agreements,setAgreements]=useState<Row[]>([]),[samples,setSamples]=useState<Row[]>([]);
  useEffect(()=>{Promise.all([supabase.from("agreements").select("*").eq("workspace_id",workspaceId).limit(100),supabase.from("creator_samples").select("*").eq("workspace_id",workspaceId).limit(100)]).then(([a,s])=>{setAgreements((a.data||[]) as Row[]);setSamples((s.data||[]) as Row[])})},[workspaceId]);
  const eligible=agreements.filter(x=>String(x.bonus_eligible).toLowerCase()==="yes"&&String(x.document_status).toLowerCase()==="approved");
  return <section id="affiliate-support" className="legacy-page-anchor"><div className="eyebrow">CREATOR SUPPORT</div><h1>Affiliate Support Program</h1><div className="kpis"><div className="kpi"><small>Agreement</small><b>{fmt(agreements.length)}</b></div><div className="kpi"><small>Eligible Bonus</small><b>{fmt(eligible.length)}</b></div><div className="kpi"><small>Creator Samples</small><b>{fmt(samples.length)}</b></div></div><div className="card"><p>Eligibility final = Bonus Eligible <b>Yes</b> + Agreement Document <b>Approved</b>.</p><Table rows={eligible} columns={["creator_name","platform","brand","product_name","document_status","support_status","bonus_eligible"]}/></div><div className="card"><h3>Sample Snapshot</h3><Table rows={samples} columns={["creator_name","platform","sku","product_name","sample_status","sent_date","qty","product_value","tracking"]}/></div></section>
}

function Tutorials({workspaceId}:{workspaceId:string}){
  const supabase=createClient();const [rows,setRows]=useState<Row[]>([]);
  useEffect(()=>{supabase.from("tutorials").select("*").eq("workspace_id",workspaceId).order("id",{ascending:true}).limit(100).then(({data})=>setRows((data||[]) as Row[]))},[workspaceId]);
  return <section id="tutorial" className="legacy-page-anchor"><div className="eyebrow">LEARNING</div><h1>Tutorial</h1><p className="muted">Panduan penggunaan LUMA yang dikelola owner melalui Admin Dashboard.</p><div className="card"><h3>Materi Tutorial</h3><Table rows={rows} columns={["title","category","description","video_url","status","created_at"]}/></div></section>
}
