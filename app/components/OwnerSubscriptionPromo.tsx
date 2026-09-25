"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

type Row=Record<string,any>;
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));

export default function OwnerSubscriptionPromo(){
  const supabase=useMemo(()=>createClient(),[]);
  const [plans,setPlans]=useState<Row[]>([]);
  const [subs,setSubs]=useState<Row[]>([]);
  const [promos,setPromos]=useState<Row[]>([]);
  const [msg,setMsg]=useState("");
  const [savingPlan,setSavingPlan]=useState<number|null>(null);
  const [adjustingId,setAdjustingId]=useState<number|null>(null);
  const [adjustments,setAdjustments]=useState<Record<number,{days:string;reason:string}>>({});
  const [form,setForm]=useState<any>({code:"",title:"",promo_type:"subscription_percent",value:10,starts_at:"",ends_at:"",max_uses:"",per_user_limit:1,plan_codes:"",token_ids:"",notes:""});

  async function load(){
    const [p,s,c]=await Promise.all([
      supabase.from("luma_subscription_plans").select("*").order("sort_order"),
      supabase.from("luma_user_subscriptions").select("*,luma_subscription_plans(name,code),profiles(full_name,email)").order("ends_at",{ascending:false}).limit(500),
      supabase.from("luma_promo_codes").select("*").order("created_at",{ascending:false}).limit(300)
    ]);
    setPlans((p.data||[]) as Row[]);
    setSubs((s.data||[]) as Row[]);
    setPromos((c.data||[]) as Row[]);
  }

  useEffect(()=>{void load()},[]);

  async function savePlan(plan:Row){
    setSavingPlan(Number(plan.id));setMsg("");
    const payload={
      name:String(plan.name||"").trim(),
      duration_days:Math.max(1,Number(plan.duration_days||1)),
      price:plan.is_trial?0:Math.max(0,Number(plan.price||0)),
      bonus_tokens:Math.max(0,Number(plan.bonus_tokens||0)),
      priority_level:String(plan.priority_level||"normal").trim()||"normal",
      status:String(plan.status||"active"),
      sort_order:Number(plan.sort_order||0),
      updated_at:new Date().toISOString()
    };
    const {error}=await supabase.from("luma_subscription_plans").update(payload).eq("id",plan.id);
    setSavingPlan(null);
    setMsg(error?error.message:"Subscription plan diperbarui secara global untuk seluruh user.");
    if(!error){window.dispatchEvent(new Event("luma-pricing-updated"));await load()}
  }

  async function extendSubscription(subscription:Row){
    const input=adjustments[Number(subscription.id)]||{days:"",reason:""};
    const days=Number(input.days||0);
    if(!Number.isInteger(days)||days<1||days>3650){
      setMsg("Adjustment hari harus 1–3650 hari.");
      return;
    }
    setAdjustingId(Number(subscription.id));setMsg("");
    const {data,error}=await supabase.rpc("luma_admin_extend_subscription",{
      p_subscription_id:Number(subscription.id),
      p_days:days,
      p_reason:String(input.reason||"").trim()||null
    });
    setAdjustingId(null);
    if(error){setMsg(error.message);return}
    const result=(data||[])[0];
    setMsg(`Masa aktif berhasil ditambah ${days} hari sampai ${result?.new_ends_at?new Date(result.new_ends_at).toLocaleString("id-ID"):"tanggal baru"}. Adjustment ini hanya tercatat di Admin.`);
    setAdjustments(current=>({...current,[Number(subscription.id)]:{days:"",reason:""}}));
    await load();
  }

  async function createPromo(){
    const {data:{user}}=await supabase.auth.getUser();
    const payload={code:String(form.code).trim().toUpperCase(),title:form.title,promo_type:form.promo_type,value:Number(form.value),starts_at:form.starts_at||null,ends_at:form.ends_at||null,max_uses:form.max_uses?Number(form.max_uses):null,per_user_limit:Number(form.per_user_limit||1),applicable_plan_codes:String(form.plan_codes||"").split(",").map((x:string)=>x.trim()).filter(Boolean),applicable_token_package_ids:String(form.token_ids||"").split(",").map((x:string)=>Number(x.trim())).filter(Boolean),notes:form.notes||null,created_by:user?.id||null,active:true};
    const {error}=await supabase.from("luma_promo_codes").insert(payload);
    setMsg(error?error.message:"Promo berhasil dibuat.");
    if(!error){setForm({...form,code:"",title:"",notes:""});await load()}
  }

  async function toggle(p:Row){
    await supabase.from("luma_promo_codes").update({active:!p.active,updated_at:new Date().toISOString()}).eq("id",p.id);
    await load();
  }

  const visibleSubs=subs.filter(x=>["active","trialing","expired"].includes(String(x.status||"").toLowerCase())).slice(0,200);

  return <div className="owner-section-stack">
    <section className="owner-panel">
      <div className="owner-panel-head">
        <div>
          <h3>Subscription Plans · Global Pricing</h3>
          <p>Ubah nama paket, durasi, harga, bonus token, priority, status, dan urutan. Paket 12 bulan ikut tampil otomatis di Billing user.</p>
        </div>
        <span className="priority-badge p-high">GLOBAL</span>
      </div>

      <div className="owner-plan-editor">
        {plans.map((p,i)=><div className="owner-plan-editor-row" key={p.id}>
          <label>Plan<input value={p.name||""} onChange={e=>setPlans(rows=>rows.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/></label>
          <label>Durasi (hari)<input type="number" min="1" value={p.duration_days||1} onChange={e=>setPlans(rows=>rows.map((x,j)=>j===i?{...x,duration_days:e.target.value}:x))}/></label>
          <label>Harga (Rp)<input type="number" min="0" step="1000" disabled={Boolean(p.is_trial)} value={p.is_trial?0:(p.price||0)} onChange={e=>setPlans(rows=>rows.map((x,j)=>j===i?{...x,price:e.target.value}:x))}/></label>
          <label>Bonus Token<input type="number" min="0" value={p.bonus_tokens||0} onChange={e=>setPlans(rows=>rows.map((x,j)=>j===i?{...x,bonus_tokens:e.target.value}:x))}/></label>
          <label>Priority<input value={p.priority_level||"normal"} onChange={e=>setPlans(rows=>rows.map((x,j)=>j===i?{...x,priority_level:e.target.value}:x))}/></label>
          <label>Status<select value={p.status||"active"} onChange={e=>setPlans(rows=>rows.map((x,j)=>j===i?{...x,status:e.target.value}:x))}><option value="active">Active</option><option value="inactive">Inactive</option><option value="draft">Draft</option></select></label>
          <label>Urutan<input type="number" value={p.sort_order||0} onChange={e=>setPlans(rows=>rows.map((x,j)=>j===i?{...x,sort_order:e.target.value}:x))}/></label>
          <button className="primary" disabled={savingPlan===Number(p.id)} onClick={()=>void savePlan(p)}>{savingPlan===Number(p.id)?"Saving...":"Save Global"}</button>
          <small className="owner-price-preview">{p.is_trial?"Gratis":money(p.price)} · {p.duration_days} hari</small>
        </div>)}
      </div>

      {msg&&<div className="owner-inline-note">{msg}</div>}

      <div className="owner-panel-head owner-active-subscriptions-head">
        <div>
          <h3>User Subscription · Internal Adjustment</h3>
          <p>Admin dapat menambah masa aktif secara fleksibel. Adjustment tersimpan sebagai audit internal dan tidak mengirim notifikasi kepada user.</p>
        </div>
      </div>

      <div className="owner-table-wrap">
        <table>
          <thead><tr><th>User</th><th>Plan</th><th>Status</th><th>Priority</th><th>Active Until</th><th>Tambah Hari</th><th>Catatan Internal</th><th></th></tr></thead>
          <tbody>{visibleSubs.map(s=>{
            const input=adjustments[Number(s.id)]||{days:"",reason:""};
            return <tr key={s.id}>
              <td><b>{s.profiles?.full_name||s.profiles?.email||s.user_id}</b><br/><small>{s.profiles?.email||s.user_id}</small></td>
              <td>{s.luma_subscription_plans?.name||"-"}</td>
              <td>{s.status}</td>
              <td><span className={`priority-badge p-${s.priority_level}`}>{s.priority_level}</span></td>
              <td>{new Date(s.ends_at).toLocaleString("id-ID")}</td>
              <td><input className="subscription-adjust-days" type="number" min="1" max="3650" placeholder="Contoh 30" value={input.days} onChange={e=>setAdjustments(current=>({...current,[Number(s.id)]:{...input,days:e.target.value}}))}/></td>
              <td><input placeholder="Alasan / catatan admin" value={input.reason} onChange={e=>setAdjustments(current=>({...current,[Number(s.id)]:{...input,reason:e.target.value}}))}/></td>
              <td><button className="secondary" disabled={adjustingId===Number(s.id)} onClick={()=>void extendSubscription(s)}>{adjustingId===Number(s.id)?"Saving...":"Tambah Masa Aktif"}</button></td>
            </tr>
          })}</tbody>
        </table>
      </div>
    </section>

    <section className="owner-panel">
      <div className="owner-panel-head"><div><h3>Promotion Codes</h3><p>Diskon subscription, diskon token, bonus token gratis, atau tambahan masa aktif.</p></div></div>
      <div className="promo-admin-grid">
        <input placeholder="CODE" value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/>
        <input placeholder="Nama promo" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
        <select value={form.promo_type} onChange={e=>setForm({...form,promo_type:e.target.value})}><option value="subscription_percent">Subscription %</option><option value="subscription_amount">Subscription Rp</option><option value="token_percent">Token %</option><option value="token_amount">Token Rp</option><option value="free_tokens">Free Token</option><option value="extend_days">Extend Active Days</option></select>
        <input type="number" placeholder="Value" value={form.value} onChange={e=>setForm({...form,value:e.target.value})}/>
        <input type="datetime-local" value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})}/>
        <input type="datetime-local" value={form.ends_at} onChange={e=>setForm({...form,ends_at:e.target.value})}/>
        <input type="number" placeholder="Max uses" value={form.max_uses} onChange={e=>setForm({...form,max_uses:e.target.value})}/>
        <input type="number" placeholder="Per user" value={form.per_user_limit} onChange={e=>setForm({...form,per_user_limit:e.target.value})}/>
        <input placeholder="Plan codes: monthly_95,six_month_355,annual_510" value={form.plan_codes} onChange={e=>setForm({...form,plan_codes:e.target.value})}/>
        <input placeholder="Token package IDs: 1,2" value={form.token_ids} onChange={e=>setForm({...form,token_ids:e.target.value})}/>
        <input className="promo-notes" placeholder="Catatan / materi promosi" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
        <button className="primary" onClick={createPromo}>Buat Promo</button>
      </div>
      {msg&&<div className="owner-inline-note">{msg}</div>}
      <div className="owner-table-wrap"><table><thead><tr><th>Code</th><th>Title</th><th>Type</th><th>Value</th><th>End</th><th>Status</th><th></th></tr></thead><tbody>{promos.map(p=><tr key={p.id}><td><b>{p.code}</b></td><td>{p.title}</td><td>{p.promo_type}</td><td>{p.value}</td><td>{p.ends_at?new Date(p.ends_at).toLocaleString("id-ID"):"-"}</td><td>{p.active?"Active":"Inactive"}</td><td><button onClick={()=>toggle(p)}>{p.active?"Disable":"Enable"}</button></td></tr>)}</tbody></table></div>
    </section>
  </div>
}
