
"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {CreatorAutocomplete,ProductAutocomplete,CreatorSearchResult,ProductSearchResult,resolveOrCreateCreator} from "./SmartAutocomplete";
import Creator360Modal from "./Creator360Modal";

type Creator={id:number;creator_code:string|null;name:string|null;username:string|null;platform:string|null;};
type Product={id:number;sku:string;product_name:string|null;selling_price:number|null;cost_price:number|null;};
type SampleRow={
  id:number;creator_id:number|null;creator_name:string|null;platform:string|null;product_master_id:number|null;sku:string|null;product_name:string|null;
  sample_status:string|null;sent_date:string|null;return_date:string|null;qty:number|null;product_value:number|null;tracking:string|null;notes:string|null;source:string|null;
};
type FormState={
  creator_id:string;creator_name:string;platform:string;product_master_id:string;sample_status:string;sent_date:string;return_date:string;qty:string;product_value:string;tracking:string;notes:string;
};

const EMPTY_FORM:FormState={creator_id:"",creator_name:"",platform:"",product_master_id:"",sample_status:"sent",sent_date:"",return_date:"",qty:"1",product_value:"0",tracking:"",notes:""};
const STATUS_OPTIONS=["all","sent","received","content_pending","content_done","returned","cancelled"] as const;
const money=(v:number|null|undefined)=>"Rp "+Number(v||0).toLocaleString("id-ID");
const dateLabel=(value:string|null)=>value?new Date(value+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"-";
const statusLabel=(value:string|null)=>({
  sent:"Sent",received:"Received",content_pending:"Content Pending",content_done:"Content Done",returned:"Returned",cancelled:"Cancelled"
}[String(value||"")]||String(value||"Pending"));
const statusTone=(value:string|null)=>{
  const key=String(value||"").toLowerCase();
  if(key==="content_done"||key==="received")return"success";
  if(key==="content_pending")return"warning";
  if(key==="returned"||key==="cancelled")return"danger";
  return"info";
};

export default function CreatorSamples({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [rows,setRows]=useState<SampleRow[]>([]);
  const [creators,setCreators]=useState<Creator[]>([]);
  const [products,setProducts]=useState<Product[]>([]);
  const [form,setForm]=useState<FormState>(EMPTY_FORM);
  const [creatorSearch,setCreatorSearch]=useState("");
  const [productSearch,setProductSearch]=useState("");
  const [manualCreatorConfirmed,setManualCreatorConfirmed]=useState(false);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [editingId,setEditingId]=useState<number|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [creator360Id,setCreator360Id]=useState<number|null>(null);

  async function loadData(){
    if(!workspaceId)return;
    setLoading(true);setError("");
    const [sampleRes,creatorRes,productRes]=await Promise.all([
      supabase.from("creator_samples").select("id,creator_id,creator_name,platform,product_master_id,sku,product_name,sample_status,sent_date,return_date,qty,product_value,tracking,notes,source").eq("workspace_id",workspaceId).order("id",{ascending:false}),
      supabase.from("creators").select("id,creator_code,name,username,platform").eq("workspace_id",workspaceId).order("name").limit(7770),
      supabase.from("product_master").select("id,sku,product_name,selling_price,cost_price").eq("workspace_id",workspaceId).order("sku").limit(1000)
    ]);
    if(sampleRes.error)setError(sampleRes.error.message);
    else{
      const data=(sampleRes.data||[]) as SampleRow[];
      setRows(data);
      setSelectedId(current=>current&&data.some(row=>row.id===current)?current:data[0]?.id||null);
    }
    if(!creatorRes.error)setCreators((creatorRes.data||[]) as Creator[]);
    if(!productRes.error)setProducts((productRes.data||[]) as Product[]);
    setLoading(false);
  }

  useEffect(()=>{void loadData()},[workspaceId]);
  useEffect(()=>{const refresh=()=>void loadData();window.addEventListener("lumaway-database-updated",refresh as EventListener);return()=>window.removeEventListener("lumaway-database-updated",refresh as EventListener)},[workspaceId]);

  const visibleRows=useMemo(()=>rows.filter(row=>{
    const q=search.trim().toLowerCase();
    if(statusFilter!=="all"&&String(row.sample_status||"")!==statusFilter)return false;
    if(!q)return true;
    return [row.creator_name,row.platform,row.sku,row.product_name,row.sample_status,row.tracking,row.notes].filter(Boolean).some(value=>String(value).toLowerCase().includes(q));
  }),[rows,search,statusFilter]);

  const counts=useMemo(()=>Object.fromEntries(STATUS_OPTIONS.map(status=>[status,status==="all"?rows.length:rows.filter(row=>String(row.sample_status||"")===status).length])),[rows]);
  const selected=rows.find(row=>row.id===selectedId)||null;

  function openAdd(){
    setEditingId(null);setForm({...EMPTY_FORM,sent_date:new Date().toISOString().slice(0,10)});setCreatorSearch("");setProductSearch("");setManualCreatorConfirmed(false);setError("");setShowForm(true);
  }

  function openEdit(row:SampleRow){
    setEditingId(row.id);
    setForm({
      creator_id:row.creator_id?.toString()||"",creator_name:row.creator_name||"",platform:row.platform||"",product_master_id:row.product_master_id?.toString()||"",
      sample_status:row.sample_status||"sent",sent_date:row.sent_date||"",return_date:row.return_date||"",qty:String(row.qty||1),product_value:String(row.product_value||0),tracking:row.tracking||"",notes:row.notes||""
    });
    setCreatorSearch(row.creator_name||"");
    setProductSearch(row.sku?(row.sku+(row.product_name?" - "+row.product_name:"")):"");
    setManualCreatorConfirmed(!row.creator_id&&Boolean(row.creator_name));
    setShowForm(true);
  }

  async function save(){
    setSaving(true);setError("");
    let creator=creators.find(item=>item.id===Number(form.creator_id));
    if(!creator&&(form.creator_name.trim()||creatorSearch.trim())){
      if(!form.platform.trim()){setSaving(false);setError("Pilih platform terlebih dahulu untuk creator baru.");return}
      try{
        const resolved=await resolveOrCreateCreator(workspaceId,form.creator_name.trim()||creatorSearch.trim(),form.platform);
        if(resolved){creator=resolved as Creator;setCreators(prev=>prev.some(item=>item.id===resolved.id)?prev:[resolved as Creator,...prev])}
      }catch(err){setSaving(false);setError(err instanceof Error?err.message:"Gagal membuat creator baru.");return}
    }
    const product=products.find(item=>item.id===Number(form.product_master_id));
    const payload={
      workspace_id:workspaceId,
      creator_id:creator?.id??(form.creator_id?Number(form.creator_id):null),
      creator_name:form.creator_name.trim()||creator?.name||creator?.username||creator?.creator_code||null,
      platform:form.platform||creator?.platform||null,
      product_master_id:form.product_master_id?Number(form.product_master_id):null,
      sku:product?.sku||null,
      product_name:product?.product_name||null,
      sample_status:form.sample_status||"sent",
      sent_date:form.sent_date||null,
      return_date:form.return_date||null,
      qty:Number(form.qty||1),
      product_value:product?.cost_price!=null?Number(product.cost_price):Number(form.product_value||0),
      tracking:form.tracking.trim()||null,
      notes:form.notes.trim()||null,
      source:"web"
    };
    const result=editingId!==null
      ? await supabase.from("creator_samples").update(payload).eq("id",editingId).eq("workspace_id",workspaceId)
      : await supabase.from("creator_samples").insert(payload).select("id").single();
    setSaving(false);
    if(result.error){setError(result.error.message);return}
    if(!editingId&&result.data?.id)setSelectedId(Number(result.data.id));
    setShowForm(false);setEditingId(null);await loadData();
  }

  async function quickStatus(row:SampleRow,next:string){
    const {error}=await supabase.from("creator_samples").update({sample_status:next,updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",row.id);
    if(error){setError(error.message);return}
    await loadData();
  }

  async function remove(id:number){
    if(!window.confirm("Hapus data sample creator ini?"))return;
    const result=await supabase.from("creator_samples").delete().eq("id",id).eq("workspace_id",workspaceId);
    if(result.error)setError(result.error.message);else{if(selectedId===id)setSelectedId(null);await loadData()}
  }

  const steps=[
    {key:"sent",label:"Sample Sent"},
    {key:"received",label:"Received"},
    {key:"content_pending",label:"Content Pending"},
    {key:"content_done",label:"Content Done"}
  ];
  const activeStep=Math.max(0,steps.findIndex(step=>step.key===selected?.sample_status));

  return <section id="creator-samples" className="legacy-page-anchor samples-v2-page">
    <header className="samples-v2-header">
      <div><span>CREATOR OPERATIONS</span><h2>Creator Samples</h2><p>Kelola sample creator dari persiapan, pengiriman, penerimaan, sampai hasil konten dalam satu tampilan.</p></div>
      <button className="primary" onClick={openAdd}>+ Tambah Sample</button>
    </header>

    <div className="samples-v2-toolbar">
      <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Cari creator, SKU, produk, tracking..."/>
      <div className="samples-v2-status-tabs">{STATUS_OPTIONS.map(status=><button key={status} className={statusFilter===status?"active":""} onClick={()=>setStatusFilter(status)}>{status==="all"?"Semua":statusLabel(status)}<span>{Number(counts[status]||0)}</span></button>)}</div>
    </div>

    {error&&<div className="samples-v2-alert">{error}</div>}

    {showForm&&<section className="samples-v2-editor">
      <div className="samples-v2-editor-head"><div><span>{editingId?"EDIT SAMPLE":"NEW SAMPLE"}</span><h3>{editingId?"Edit Creator Sample":"Tambah Creator Sample"}</h3></div><button onClick={()=>setShowForm(false)}>×</button></div>
      <div className="samples-v2-form-grid">
        <label><span>Creator</span><CreatorAutocomplete workspaceId={workspaceId} value={creatorSearch} selectedId={form.creator_id} createPlatform={form.platform} placeholder="Ketik username atau nama creator" onTextChange={value=>{setCreatorSearch(value);setManualCreatorConfirmed(false);setForm(prev=>({...prev,creator_id:"",creator_name:value}))}} onSelect={(creator:CreatorSearchResult)=>{const name=creator.name||creator.username||creator.creator_code||"";setCreators(prev=>prev.some(item=>item.id===creator.id)?prev:[creator as Creator,...prev]);setForm(prev=>({...prev,creator_id:String(creator.id),creator_name:name,platform:creator.platform||prev.platform}));setCreatorSearch(name);setManualCreatorConfirmed(false)}} onCreate={value=>{setCreatorSearch(value);setManualCreatorConfirmed(true);setForm(prev=>({...prev,creator_id:"",creator_name:value}))}}/>{manualCreatorConfirmed&&!form.creator_id&&<small>Creator baru akan dibuat saat sample disimpan.</small>}</label>
        <label><span>Platform</span><select value={form.platform} onChange={event=>setForm(prev=>({...prev,platform:event.target.value}))}><option value="">Pilih Platform</option><option>TikTok</option><option>Shopee</option><option>Instagram</option><option>YouTube</option><option>Other</option></select></label>
        <label><span>Product / SKU</span><ProductAutocomplete workspaceId={workspaceId} value={productSearch} selectedId={form.product_master_id} placeholder="Ketik SKU atau nama produk" onTextChange={value=>{setProductSearch(value);setForm(prev=>({...prev,product_master_id:""}))}} onSelect={(product:ProductSearchResult)=>{setProducts(prev=>prev.some(item=>item.id===product.id)?prev:[product as Product,...prev]);setForm(prev=>({...prev,product_master_id:String(product.id),product_value:String(product.cost_price||0)}));setProductSearch(product.sku+(product.product_name?" - "+product.product_name:""))}}/></label>
        <label><span>Status</span><select value={form.sample_status} onChange={event=>setForm(prev=>({...prev,sample_status:event.target.value}))}><option value="sent">Sent</option><option value="received">Received</option><option value="content_pending">Content Pending</option><option value="content_done">Content Done</option><option value="returned">Returned</option><option value="cancelled">Cancelled</option></select></label>
        <label><span>Sent Date</span><input type="date" value={form.sent_date} onChange={event=>setForm(prev=>({...prev,sent_date:event.target.value}))}/></label>
        <label><span>Return Date</span><input type="date" value={form.return_date} onChange={event=>setForm(prev=>({...prev,return_date:event.target.value}))}/></label>
        <label><span>Qty</span><input type="number" min="1" value={form.qty} onChange={event=>setForm(prev=>({...prev,qty:event.target.value}))}/></label>
        <label><span>Product Value / HPP</span><input type="number" min="0" value={form.product_value} onChange={event=>setForm(prev=>({...prev,product_value:event.target.value}))}/><small>{form.product_master_id?"HPP mengikuti Product Master.":"Isi manual jika produk belum terhubung."}</small></label>
        <label><span>Tracking / AWB</span><input value={form.tracking} onChange={event=>setForm(prev=>({...prev,tracking:event.target.value}))} placeholder="Nomor resi"/></label>
        <label className="wide"><span>Notes</span><textarea rows={3} value={form.notes} onChange={event=>setForm(prev=>({...prev,notes:event.target.value}))} placeholder="Catatan sample, follow up, atau hasil konten..."/></label>
      </div>
      <div className="samples-v2-editor-actions"><button className="secondary" onClick={()=>setShowForm(false)}>Batal</button><button className="primary" disabled={saving} onClick={()=>void save()}>{saving?"Menyimpan...":"Simpan Sample"}</button></div>
    </section>}

    <div className="samples-v2-layout">
      <section className="samples-v2-list">
        <div className="samples-v2-list-head"><div><h3>Sample List</h3><p>{visibleRows.length} dari {rows.length} sample</p></div></div>
        {loading?<div className="samples-v2-empty">Memuat sample...</div>:visibleRows.length===0?<div className="samples-v2-empty"><b>Belum ada sample pada filter ini.</b></div>:<div className="samples-v2-list-stack">{visibleRows.map(row=><button key={row.id} className={"samples-v2-list-card "+(selectedId===row.id?"selected":"")} onClick={()=>setSelectedId(row.id)}>
          <div className="samples-v2-avatar">{String(row.creator_name||"C").slice(0,1).toUpperCase()}</div>
          <div className="samples-v2-list-copy"><div><b>{row.creator_name||"Creator"}</b><span className={"samples-v2-status "+statusTone(row.sample_status)}>{statusLabel(row.sample_status)}</span></div><p>{row.product_name||row.sku||"Produk belum dipilih"}</p><small>{row.platform||"-"} · {dateLabel(row.sent_date)}{row.tracking?" · "+row.tracking:""}</small></div>
        </button>)}</div>}
      </section>

      <section className="samples-v2-detail">
        {!selected?<div className="samples-v2-empty detail"><b>Pilih creator sample.</b><span>Detail sample dan timeline akan tampil di sini.</span></div>:<>
          <div className="samples-v2-detail-head">
            <div className="samples-v2-detail-person">
              <div className="samples-v2-avatar large">{String(selected.creator_name||"C").slice(0,1).toUpperCase()}</div>
              <div className="samples-v2-detail-copy">
                <div className="samples-v2-detail-meta"><span>{selected.platform||"Creator"}</span><span className={"samples-v2-status "+statusTone(selected.sample_status)}>{statusLabel(selected.sample_status)}</span></div>
                <h3>{selected.creator_name||"Creator"}</h3>
                <p>{selected.product_name||selected.sku||"Produk belum dipilih"}</p>
                <small>Sample #{selected.id} · {dateLabel(selected.sent_date)}{selected.sku?" · SKU "+selected.sku:""}</small>
              </div>
            </div>
            <div className="samples-v2-detail-actions"><button onClick={()=>openEdit(selected)}>Edit</button>{selected.creator_id&&<button onClick={()=>setCreator360Id(selected.creator_id)}>Customer 360</button>}<a href="/shipping">Shipping</a><button className="danger" onClick={()=>void remove(selected.id)}>Hapus</button></div>
          </div>

          <div className="samples-v2-summary">
            <article><span>Sample Value</span><b>{money(selected.product_value)}</b><small>HPP / nilai sample</small></article>
            <article><span>Qty</span><b>{Number(selected.qty||0).toLocaleString("id-ID")}</b><small>Unit dikirim</small></article>
            <article><span>Tracking</span><b>{selected.tracking||"-"}</b><small>AWB / resi</small></article>
            <article><span>Status</span><b>{statusLabel(selected.sample_status)}</b><small>Update terakhir</small></article>
          </div>

          <section className="samples-v2-timeline-card">
            <div className="samples-v2-section-head"><div><h4>Sample Timeline</h4><p>Progress sample dari pengiriman sampai konten selesai.</p></div><span className={"samples-v2-status "+statusTone(selected.sample_status)}>{statusLabel(selected.sample_status)}</span></div>
            <div className="samples-v2-timeline">{steps.map((step,index)=><div key={step.key} className={index<=activeStep?"done":""}><i/><span><b>{step.label}</b><small>{index===0?dateLabel(selected.sent_date):index<activeStep?"Completed":index===activeStep?statusLabel(selected.sample_status):"Waiting"}</small></span></div>)}</div>
          </section>

          <section className="samples-v2-info-grid">
            <article className="samples-v2-product-card"><div className="samples-v2-card-title"><div><span>PRODUCT & SHIPPING</span><h4>Informasi sample</h4></div><button type="button" onClick={()=>openEdit(selected)}>Edit Data</button></div><dl><div><dt>SKU</dt><dd>{selected.sku||"-"}</dd></div><div className="product-row"><dt>Product</dt><dd>{selected.product_name||"-"}</dd></div><div><dt>Tracking</dt><dd>{selected.tracking||"-"}</dd></div><div><dt>Source</dt><dd>{selected.source||"-"}</dd></div></dl></article>
            <article className="samples-v2-followup-card"><div className="samples-v2-card-title"><div><span>NEXT ACTION</span><h4>Follow Up</h4></div></div><p>{selected.notes||"Belum ada catatan follow up. Gunakan action di bawah untuk memperbarui progress sample."}</p><div className="samples-v2-quick-actions">{selected.sample_status==="sent"&&<button className="primary" onClick={()=>void quickStatus(selected,"received")}>Tandai Diterima</button>}{selected.sample_status==="received"&&<button className="primary" onClick={()=>void quickStatus(selected,"content_pending")}>Mulai Content Pending</button>}{selected.sample_status==="content_pending"&&<button className="primary" onClick={()=>void quickStatus(selected,"content_done")}>Tandai Content Done</button>}{selected.sample_status==="content_done"&&<span className="samples-v2-complete">Sample workflow selesai.</span>}{selected.sample_status==="returned"&&<span className="samples-v2-complete neutral">Sample sudah dikembalikan.</span>}{selected.sample_status==="cancelled"&&<span className="samples-v2-complete danger">Sample dibatalkan.</span>}</div></article>
          </section>
        </>}
      </section>
    </div>

    {creator360Id&&<Creator360Modal workspaceId={workspaceId} creatorId={creator360Id} startDate={selected?.sent_date||""} endDate={new Date().toISOString().slice(0,10)} onClose={()=>setCreator360Id(null)}/>}
  </section>;
}
