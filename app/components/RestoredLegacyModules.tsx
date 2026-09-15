"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import LumaAffiliateCenter from "./LumaAffiliateCenter";
import PromoStudioV2 from "./PromoStudioV2";
import BillingCenter from "./BillingCenter";
import KanbanBoard from "./KanbanBoard";
import InternalExcelGrid from "./InternalExcelGrid";
import UserProfile from "./UserProfile";
import AdminDashboard from "./AdminDashboard";

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
  if(!rows.length)return <div className="empty-state"><strong>Belum ada data.</strong></div>;
  const cols=(columns||Object.keys(rows[0])).filter(c=>c!=="workspace_id").slice(0,10);
  return <div className="scroll"><table><thead><tr>{cols.map(c=><th key={c}>{c.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id??i}>{cols.map(c=><td key={c}>{typeof r[c]==="object"?JSON.stringify(r[c]):String(r[c]??"")}</td>)}</tr>)}</tbody></table></div>
}

function Agreements({workspaceId}:{workspaceId:string}){
  const supabase=createClient();
  const [rows,setRows]=useState<Row[]>([]),[msg,setMsg]=useState("");
  const [form,setForm]=useState<Row>({creator_name:"",platform:"TikTok",brand:"",category:"",product_name:"",deal_type:"",ratecard:"",support_type:"",support_value:"",start_date:"",end_date:"",document_status:"Pending",support_status:"Pending",bonus_eligible:"No",notes:""});
  async function load(){const {data,error}=await supabase.from("agreements").select("*").eq("workspace_id",workspaceId).order("id",{ascending:false}).limit(100);if(error)setMsg(error.message);else setRows((data||[]) as Row[])}
  useEffect(()=>{void load()},[workspaceId]);
  async function save(){if(!form.creator_name)return setMsg("Creator wajib diisi.");const payload={...form,workspace_id:workspaceId,agreement_id:`AGR-${Date.now()}`,ratecard:Number(form.ratecard||0),support_value:Number(form.support_value||0)};const {error}=await supabase.from("agreements").insert(payload);setMsg(error?error.message:"Agreement tersimpan.");if(!error){await load();setForm({...form,creator_name:"",brand:"",product_name:"",notes:""})}}
  const f=(k:string,l:string,type="text")=><label>{l}<input type={type} value={form[k]||""} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>;
  return <section id="agreements" className="legacy-page-anchor"><div className="eyebrow">CREATOR MANAGEMENT</div><h1>Agreement</h1><div className="card"><div className="grid">{f("creator_name","Creator")}{f("platform","Platform")}{f("brand","Brand")}{f("category","Category")}{f("product_name","Product")}{f("deal_type","Deal Type")}{f("ratecard","Ratecard","number")}{f("support_type","Support Type")}{f("support_value","Support Value","number")}{f("start_date","Start","date")}{f("end_date","End","date")}<label>Document Status<select value={form.document_status} onChange={e=>setForm({...form,document_status:e.target.value})}><option>Pending</option><option>Approved</option><option>Rejected</option></select></label><label>Support Status<select value={form.support_status} onChange={e=>setForm({...form,support_status:e.target.value})}><option>Pending</option><option>Approved</option><option>Completed</option></select></label><label>Bonus Eligible<select value={form.bonus_eligible} onChange={e=>setForm({...form,bonus_eligible:e.target.value})}><option>No</option><option>Yes</option></select></label></div><label>Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label><button className="primary" onClick={save}>Simpan Agreement</button>{msg&&<p className="muted">{msg}</p>}</div><div className="card"><h3>Agreement aktif</h3><Table rows={rows} columns={["agreement_id","creator_name","platform","brand","product_name","document_status","support_status","bonus_eligible","start_date","end_date"]}/></div></section>
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
