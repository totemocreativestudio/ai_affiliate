"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import OpenAIIntegration from "./OpenAIIntegration";
import XenditIntegration from "./XenditIntegration";
import WhatsAppIntegration from "./WhatsAppIntegration";
import AdminBroadcast from "./AdminBroadcast";
import AdminBlog from "./AdminBlog";
import AdminSocialModeration from "./AdminSocialModeration";
import OwnerMonitoring360 from "./OwnerMonitoring360";

type Row=Record<string,any>;
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const fmt=(v:any)=>new Intl.NumberFormat("id-ID").format(Number(v||0));

export default function AdminDashboardV2({workspaceId}:{workspaceId:string}){
  const supabase=createClient();
  const [users,setUsers]=useState<Row[]>([]),[orders,setOrders]=useState<Row[]>([]),[runs,setRuns]=useState<Row[]>([]),[withdrawals,setWithdrawals]=useState<Row[]>([]),[issues,setIssues]=useState<Row[]>([]),[packages,setPackages]=useState<Row[]>([]),[tutorials,setTutorials]=useState<Row[]>([]),[status,setStatus]=useState("");
  const [tab,setTab]=useState("monitoring");
  const [tutorialForm,setTutorialForm]=useState({title:"",category:"Getting Started",description:"",youtube_url:"",embed_url:"",sort_order:0});

  async function load(){
    const [u,o,r,w,i,p,t]=await Promise.all([
      supabase.from("profiles").select("id,email,full_name,active,position_title,phone,phone_verified_at,whatsapp_opt_in,whatsapp_channel_joined_at,social_alias,created_at").order("created_at",{ascending:false}).limit(1000),
      supabase.from("luma_topup_orders").select("*").order("created_at",{ascending:false}).limit(1000),
      supabase.from("ai_analysis_runs").select("*").order("created_at",{ascending:false}).limit(1000),
      supabase.from("referral_withdrawals").select("*").order("requested_at",{ascending:false}).limit(500),
      supabase.from("luma_issue_logs").select("*").order("created_at",{ascending:false}).limit(500),
      supabase.from("luma_token_packages").select("*").order("sort_order",{ascending:true}),
      supabase.from("tutorials").select("*").order("sort_order",{ascending:true}).limit(200),
    ]);
    setUsers((u.data||[]) as Row[]);setOrders((o.data||[]) as Row[]);setRuns((r.data||[]) as Row[]);setWithdrawals((w.data||[]) as Row[]);setIssues((i.data||[]) as Row[]);setPackages((p.data||[]) as Row[]);setTutorials((t.data||[]) as Row[]);
  }
  useEffect(()=>{void load()},[workspaceId]);

  const revenue=useMemo(()=>orders.filter(x=>String(x.status).toLowerCase()==="paid").reduce((a,x)=>a+Number(x.amount||0),0),[orders]);
  const paidOrders=orders.filter(x=>String(x.status).toLowerCase()==="paid").length;
  const aiSuccess=runs.filter(x=>String(x.status).toLowerCase()==="success").length;
  const openIssues=issues.filter(x=>String(x.status).toLowerCase()!=="resolved").length;
  const pendingWithdraw=withdrawals.filter(x=>["pending","processing"].includes(String(x.status).toLowerCase())).length;
  const waVerified=users.filter(x=>x.phone_verified_at).length;const waJoined=users.filter(x=>x.whatsapp_channel_joined_at).length;

  async function savePackage(pkg:Row){const {error}=await supabase.from("luma_token_packages").update({label:pkg.label,tokens:Number(pkg.tokens),price:Number(pkg.price),status:pkg.status,updated_at:new Date().toISOString()}).eq("id",pkg.id);if(error)return setStatus(error.message);setStatus("Paket token diperbarui.");await load()}
  async function updateWithdrawal(id:number,statusValue:string){const {error}=await supabase.from("referral_withdrawals").update({status:statusValue,processed_at:["paid","rejected","failed"].includes(statusValue)?new Date().toISOString():null}).eq("id",id);if(error)return setStatus(error.message);setStatus(`Withdraw #${id} → ${statusValue}. User menerima notifikasi status.`);await load()}
  async function resolveIssue(id:number){const {error}=await supabase.from("luma_issue_logs").update({status:"resolved",resolved_at:new Date().toISOString()}).eq("id",id);if(error)return setStatus(error.message);await load()}
  async function addTutorial(){if(!tutorialForm.title||!tutorialForm.youtube_url)return setStatus("Title dan YouTube URL wajib diisi.");const embed=tutorialForm.embed_url||tutorialForm.youtube_url.replace("watch?v=","embed/").replace("youtu.be/","youtube.com/embed/");const {error}=await supabase.from("tutorials").insert({workspace_id:workspaceId,title:tutorialForm.title,category:tutorialForm.category,description:tutorialForm.description,youtube_url:tutorialForm.youtube_url,embed_url:embed,status:"Published",sort_order:Number(tutorialForm.sort_order||0)});if(error)return setStatus(error.message);setTutorialForm({title:"",category:"Getting Started",description:"",youtube_url:"",embed_url:"",sort_order:0});setStatus("Tutorial ditambahkan.");await load()}

  const tabs=[["monitoring","Monitoring 360"],["overview","Business"],["users","Users"],["broadcast","Broadcast & Promo"],["content","Blog & Tutorial"],["social","Social"],["payments","Payments"],["ai","AI Usage"],["referral","Referral"],["issues","Bugs & UI"],["integrations","Integrations"]];

  return <section id="administration" className="legacy-page-anchor admin-owner-page">
    <div className="admin-owner-hero"><div><div className="eyebrow">LUMAWAY OWNER CONTROL</div><h1>Owner Dashboard</h1><p>Monitoring dan pengelolaan seluruh bisnis Lumaway: user, workspace, creator, toko, database, storage, revenue, token, AI/API, referral, content, biaya layanan, error, dan integration.</p></div><button className="secondary" onClick={()=>load()}>Refresh Data</button></div>
    <div className="admin-kpi-grid"><div><span>Total Users</span><b>{fmt(users.length)}</b><small>{users.filter(x=>x.active).length} active</small></div><div><span>Revenue</span><b>{money(revenue)}</b><small>{paidOrders} paid orders</small></div><div><span>AI Runs</span><b>{fmt(runs.length)}</b><small>{aiSuccess} success</small></div><div><span>WhatsApp</span><b>{fmt(waVerified)}</b><small>{waJoined} channel joined</small></div><div><span>Open Issues</span><b>{fmt(openIssues)}</b><small>{pendingWithdraw} payout pending</small></div></div>
    <div className="admin-tabs">{tabs.map(([k,l])=><button className={tab===k?"active":""} key={k} onClick={()=>setTab(k)}>{l}</button>)}</div>

    {tab==="monitoring"&&<OwnerMonitoring360/>}
    {tab==="overview"&&<div className="grid admin-overview-grid"><div className="card"><h3>Business Snapshot</h3><div className="admin-metric-list"><span><b>{money(revenue)}</b> captured top-up revenue</span><span><b>{fmt(runs.length)}</b> AI analysis requests</span><span><b>{fmt(users.length)}</b> registered profiles</span><span><b>{fmt(waVerified)}</b> WhatsApp verified</span></div></div><div className="card"><h3>System Attention</h3><ul className="legacy-list"><li>{pendingWithdraw} referral payout menunggu tindakan.</li><li>{openIssues} bug/error/UI issue belum resolved.</li><li>{orders.filter(x=>String(x.status).toLowerCase()==="pending").length} payment masih pending.</li><li>{runs.filter(x=>String(x.status).toLowerCase()==="error").length} AI run berstatus error.</li><li>{Math.max(0,users.length-waJoined)} user belum mengonfirmasi join WhatsApp Channel.</li></ul></div></div>}

    {tab==="users"&&<div className="card"><h3>User Management</h3><p className="muted">Customer 360 lengkap tersedia di tab Monitoring 360 → User 360.</p><div className="scroll"><table><thead><tr><th>User</th><th>Email</th><th>Position</th><th>Social Alias</th><th>WA Verified</th><th>WA Channel</th><th>Status</th><th>Joined</th></tr></thead><tbody>{users.map(x=><tr key={x.id}><td>{x.full_name||"-"}</td><td>{x.email}</td><td>{x.position_title||"-"}</td><td>{x.social_alias||"-"}</td><td>{x.phone_verified_at?"Verified":"-"}</td><td>{x.whatsapp_channel_joined_at?"Joined":"Pending"}</td><td>{x.active?"Active":"Inactive"}</td><td>{x.created_at?new Date(x.created_at).toLocaleString("id-ID"):"-"}</td></tr>)}</tbody></table></div></div>}

    {tab==="broadcast"&&<AdminBroadcast workspaceId={workspaceId}/>} 

    {tab==="content"&&<><AdminBlog workspaceId={workspaceId}/><div className="card"><h3>Add Tutorial</h3><div className="grid"><label>Title<input value={tutorialForm.title} onChange={e=>setTutorialForm({...tutorialForm,title:e.target.value})}/></label><label>Category<input value={tutorialForm.category} onChange={e=>setTutorialForm({...tutorialForm,category:e.target.value})}/></label><label>YouTube URL<input value={tutorialForm.youtube_url} onChange={e=>setTutorialForm({...tutorialForm,youtube_url:e.target.value})}/></label><label>Embed URL (opsional)<input value={tutorialForm.embed_url} onChange={e=>setTutorialForm({...tutorialForm,embed_url:e.target.value})}/></label></div><label>Description<textarea value={tutorialForm.description} onChange={e=>setTutorialForm({...tutorialForm,description:e.target.value})}/></label><button className="primary" onClick={addTutorial}>Add Tutorial</button></div><div className="card"><h3>Tutorial Library</h3><div className="scroll"><table><thead><tr><th>Title</th><th>Category</th><th>Status</th><th>URL</th></tr></thead><tbody>{tutorials.map(x=><tr key={x.id}><td>{x.title}</td><td>{x.category}</td><td>{x.status}</td><td>{x.youtube_url||"-"}</td></tr>)}</tbody></table></div></div></>}

    {tab==="social"&&<AdminSocialModeration/>}

    {tab==="payments"&&<><div className="card"><h3>Token Package Pricing</h3><div className="admin-package-editor">{packages.map((pkg,i)=><div className="admin-package-row" key={pkg.id}><input value={pkg.label} onChange={e=>setPackages(p=>p.map((x,j)=>j===i?{...x,label:e.target.value}:x))}/><input type="number" value={pkg.tokens} onChange={e=>setPackages(p=>p.map((x,j)=>j===i?{...x,tokens:e.target.value}:x))}/><input type="number" value={pkg.price} onChange={e=>setPackages(p=>p.map((x,j)=>j===i?{...x,price:e.target.value}:x))}/><select value={pkg.status} onChange={e=>setPackages(p=>p.map((x,j)=>j===i?{...x,status:e.target.value}:x))}><option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option></select><button onClick={()=>savePackage(pkg)}>Save</button></div>)}</div></div><div className="card"><h3>Payment History</h3><div className="scroll"><table><thead><tr><th>Order</th><th>User</th><th>Tokens</th><th>Amount</th><th>Status</th><th>Provider</th><th>Date</th></tr></thead><tbody>{orders.map(x=><tr key={x.id}><td>{x.order_code}</td><td>{x.user_id}</td><td>{x.package_tokens}</td><td>{money(x.amount)}</td><td>{x.status}</td><td>{x.payment_provider||"-"}</td><td>{x.created_at?new Date(x.created_at).toLocaleString("id-ID"):"-"}</td></tr>)}</tbody></table></div></div></>}

    {tab==="ai"&&<div className="card"><h3>AI Usage History</h3><p className="muted">Detail API token usage tersedia di Monitoring 360 → API Usage.</p><div className="scroll"><table><thead><tr><th>Run</th><th>User</th><th>Type</th><th>Period</th><th>Model</th><th>Status</th><th>Date</th></tr></thead><tbody>{runs.map(x=><tr key={x.id}><td>{x.run_id}</td><td>{x.created_by}</td><td>{x.analysis_type}</td><td>{x.start_date||"All"} → {x.end_date||"All"}</td><td>{x.model}</td><td>{x.status}</td><td>{x.created_at?new Date(x.created_at).toLocaleString("id-ID"):"-"}</td></tr>)}</tbody></table></div></div>}

    {tab==="referral"&&<div className="card"><h3>Referral Withdrawals</h3><p className="muted">Setiap perubahan status otomatis membuat notifikasi personal untuk user.</p><div className="scroll"><table><thead><tr><th>ID</th><th>User</th><th>Amount</th><th>Channel</th><th>Account</th><th>Status</th><th>Action</th></tr></thead><tbody>{withdrawals.map(x=><tr key={x.id}><td>#{x.id}</td><td>{x.user_id}</td><td>{money(x.amount)}</td><td>{x.channel_code}</td><td>{x.account_number}<br/><small>{x.account_name}</small></td><td>{x.status}</td><td><div className="button-row"><button disabled={x.status!=="pending"} onClick={()=>updateWithdrawal(x.id,"processing")}>Process</button><button disabled={!["pending","processing"].includes(x.status)} onClick={()=>updateWithdrawal(x.id,"paid")}>Mark Paid</button><button disabled={!["pending","processing"].includes(x.status)} onClick={()=>updateWithdrawal(x.id,"rejected")}>Reject</button><button disabled={!["pending","processing"].includes(x.status)} onClick={()=>updateWithdrawal(x.id,"failed")}>Failed</button></div></td></tr>)}</tbody></table></div></div>}

    {tab==="issues"&&<div className="card"><h3>Bug, Error & UI Monitoring</h3>{issues.length?<div className="scroll"><table><thead><tr><th>Severity</th><th>Title</th><th>Page</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>{issues.map(x=><tr key={x.id}><td>{x.severity}</td><td><b>{x.title}</b><br/><small>{x.details}</small></td><td>{x.page_path||"-"}</td><td>{x.status}</td><td>{x.created_at?new Date(x.created_at).toLocaleString("id-ID"):"-"}</td><td><button disabled={x.status==="resolved"} onClick={()=>resolveIssue(x.id)}>Resolve</button></td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>No issues logged.</strong></div>}</div>}

    {tab==="integrations"&&<><OpenAIIntegration workspaceId={workspaceId}/><XenditIntegration workspaceId={workspaceId}/><WhatsAppIntegration workspaceId={workspaceId}/><div className="card"><h3>Google OAuth Readiness</h3><p className="muted">Google Sheets private per user membutuhkan OAuth consent app Production/verified atau user dimasukkan sebagai Test User selama testing. Error 403 access_denied berasal dari Google OAuth configuration.</p></div></>}
    {status&&<div className="flash success">{status}</div>}
  </section>;
}
