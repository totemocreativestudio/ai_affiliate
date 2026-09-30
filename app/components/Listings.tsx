"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {CreatorAutocomplete,ProductAutocomplete,CreatorSearchResult,ProductSearchResult,resolveOrCreateCreator} from "./SmartAutocomplete";

type Creator={
  id:number;creator_code:string|null;name:string|null;username:string|null;platform:string|null;
  affiliate_id:string|null;phone:string|null;payment_type:string|null;ratecard:number|null;status:string|null;
};
type Product={id:number;sku:string;product_name:string|null;category:string|null;cost_price:number|null};
type Listing={
  id:number;data_date:string|null;creator_id:number|null;creator_name:string|null;platform:string|null;
  product_master_id:number|null;product_name:string|null;sku:string|null;product_hpp:number|null;stage:string|null;
  payment_type:string|null;ratecard:number;posting_date:string|null;post_link:string|null;next_action:string|null;
  agreement_id:string|null;notes:string|null;
};
type Activity={
  id:number;listing_id:number;creator_id:number|null;activity_date:string;activity_type:string;
  result:string|null;note:string|null;created_at:string;
};
type FormState={
  data_date:string;creator_id:string;creator_name:string;platform:string;product_master_id:string;product_hpp:string;
  stage:string;payment_type:string;ratecard:string;posting_date:string;post_link:string;next_action:string;agreement_id:string;notes:string;
};

const STAGES=["New Lead","Reach Out","Follow Up","Negotiation","Sample Sent","Content In Progress","Uploaded","Live","Won / Active","Lost / Inactive"];
const ACTIVITY_TYPES=["Listing dibuat","Reach Out","Follow Up","Negotiation","Kirim Sample","Sample Received","Take Video","Video Upload","Live","Deal","Rejected","No Response","Catatan"];
const ACTIVITY_STAGE:Record<string,string>={
  "Reach Out":"Reach Out","Follow Up":"Follow Up","Negotiation":"Negotiation","Kirim Sample":"Sample Sent",
  "Sample Received":"Content In Progress","Take Video":"Content In Progress","Video Upload":"Uploaded","Live":"Live",
  "Deal":"Won / Active","Rejected":"Lost / Inactive","No Response":"Follow Up",
};
const EMPTY_FORM:FormState={data_date:"",creator_id:"",creator_name:"",platform:"",product_master_id:"",product_hpp:"0",stage:"New Lead",payment_type:"",ratecard:"",posting_date:"",post_link:"",next_action:"",agreement_id:"",notes:""};
const money=(value:any)=>"Rp "+new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(Number(value||0));
const dateLabel=(value:string|null)=>value?new Date(value+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"-";

function stageTone(stage:string|null){
  const value=String(stage||"New Lead").toLowerCase();
  if(value.includes("won")||value==="live"||value.includes("uploaded"))return"success";
  if(value.includes("lost"))return"danger";
  if(value.includes("sample")||value.includes("content")||value.includes("negotiation"))return"warning";
  if(value.includes("follow")||value.includes("reach"))return"info";
  return"neutral";
}

export default function Listings({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [rows,setRows]=useState<Listing[]>([]);
  const [creators,setCreators]=useState<Creator[]>([]);
  const [products,setProducts]=useState<Product[]>([]);
  const [masterCreators,setMasterCreators]=useState<Creator[]>([]);
  const [masterCreatorSearch,setMasterCreatorSearch]=useState("");
  const [masterCreatorPage,setMasterCreatorPage]=useState(1);
  const [masterCreatorTotal,setMasterCreatorTotal]=useState(0);

  const [search,setSearch]=useState("");
  const [platformFilter,setPlatformFilter]=useState("");
  const [stageFilter,setStageFilter]=useState("");
  const [dateStart,setDateStart]=useState("");
  const [dateEnd,setDateEnd]=useState("");

  const [form,setForm]=useState<FormState>(EMPTY_FORM);
  const [creatorSearch,setCreatorSearch]=useState("");
  const [productSearch,setProductSearch]=useState("");
  const [manualCreatorConfirmed,setManualCreatorConfirmed]=useState(false);
  const [editingId,setEditingId]=useState<number|null>(null);
  const [showForm,setShowForm]=useState(false);

  const [selected,setSelected]=useState<Listing|null>(null);
  const [selectedCreator,setSelectedCreator]=useState<Creator|null>(null);
  const [activities,setActivities]=useState<Activity[]>([]);
  const [activityFor,setActivityFor]=useState<Listing|null>(null);
  const [activityForm,setActivityForm]=useState({activity_date:new Date().toISOString().slice(0,10),activity_type:"Follow Up",result:"",note:""});

  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [detailLoading,setDetailLoading]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function loadData(){
    setLoading(true);setError("");
    const [listingResult,creatorResult,productResult]=await Promise.all([
      supabase.from("listings").select("id,data_date,creator_id,creator_name,platform,product_master_id,product_name,sku,product_hpp,stage,payment_type,ratecard,posting_date,post_link,next_action,agreement_id,notes").eq("workspace_id",workspaceId).order("id",{ascending:false}),
      supabase.from("creators").select("id,creator_code,name,username,platform,affiliate_id,phone,payment_type,ratecard,status").eq("workspace_id",workspaceId).order("name").limit(7770),
      supabase.from("product_master").select("id,sku,product_name,category,cost_price").eq("workspace_id",workspaceId).order("sku").limit(1000),
    ]);
    if(listingResult.error)setError(listingResult.error.message); else {
      const data=(listingResult.data||[]) as Listing[];
      setRows(data);
      setSelected(current=>current?data.find(x=>x.id===current.id)||data[0]||null:data[0]||null);
    }
    if(!creatorResult.error)setCreators((creatorResult.data||[]) as Creator[]);
    if(!productResult.error)setProducts((productResult.data||[]) as Product[]);
    setLoading(false);
  }

  async function loadMasterCreators(targetPage=1,query=masterCreatorSearch){
    const params=new URLSearchParams({workspace_id:workspaceId,page:String(targetPage),page_size:"100"});
    if(query.trim())params.set("q",query.trim());
    const response=await fetch(`/api/master-data/creators?${params.toString()}`,{cache:"no-store"});
    const data=await response.json();
    if(!response.ok||!data.ok){setError(data.error||"Gagal memuat Master Creator.");return}
    setMasterCreators((data.results||[]) as Creator[]);
    setMasterCreatorTotal(Number(data.total||0));
    setMasterCreatorPage(Number(data.page||targetPage));
  }

  async function loadSelectedDetail(row:Listing|null){
    if(!row){setActivities([]);setSelectedCreator(null);return}
    setDetailLoading(true);
    const activitiesResult=await supabase.from("listing_activities")
      .select("id,listing_id,creator_id,activity_date,activity_type,result,note,created_at")
      .eq("workspace_id",workspaceId).eq("listing_id",row.id)
      .order("activity_date",{ascending:false}).order("id",{ascending:false});
    if(activitiesResult.error)setError(activitiesResult.error.message);
    else setActivities((activitiesResult.data||[]) as Activity[]);

    let creator=creators.find(x=>x.id===row.creator_id)||null;
    if(!creator&&row.creator_name){
      try{
        const params=new URLSearchParams({workspace_id:workspaceId,page:"1",page_size:"25",q:row.creator_name});
        const response=await fetch(`/api/master-data/creators?${params.toString()}`,{cache:"no-store"});
        const data=await response.json();
        if(response.ok&&data.ok){
          creator=(data.results||[]).find((x:Creator)=>x.id===row.creator_id)||(data.results||[])[0]||null;
        }
      }catch{}
    }
    setSelectedCreator(creator);
    setDetailLoading(false);
  }

  useEffect(()=>{void loadData();void loadMasterCreators(1,"")},[workspaceId]);
  useEffect(()=>{void loadSelectedDetail(selected)},[selected?.id,workspaceId]);
  useEffect(()=>{
    const refresh=()=>{void loadData();void loadMasterCreators(1,masterCreatorSearch)};
    window.addEventListener("lumaway-database-updated",refresh as EventListener);
    return()=>window.removeEventListener("lumaway-database-updated",refresh as EventListener);
  },[workspaceId,masterCreatorSearch]);

  useEffect(()=>{
    const onQuick=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.type==="listing")openAdd()};
    const onSelect=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      if(detail?.type==="listing"){
        const row=rows.find(item=>item.id===Number(detail.id));if(row){setSelected(row);setSearch(row.creator_name||row.product_name||String(detail.title||""))}
      }else if(detail?.type==="creator"){
        const row=rows.find(item=>item.creator_id===Number(detail.id))||rows.find(item=>String(item.creator_name||"").toLowerCase()===String(detail.title||"").toLowerCase());
        setSearch(String(detail.title||""));if(row)setSelected(row);
      }
    };
    window.addEventListener("lumaway-quick-create",onQuick as EventListener);window.addEventListener("lumaway-global-select",onSelect as EventListener);
    return()=>{window.removeEventListener("lumaway-quick-create",onQuick as EventListener);window.removeEventListener("lumaway-global-select",onSelect as EventListener)};
  },[rows]);

  function updateField(field:keyof FormState,value:string){setForm(prev=>({...prev,[field]:value}))}

  function openAdd(){
    setEditingId(null);setForm({...EMPTY_FORM,data_date:new Date().toISOString().slice(0,10)});
    setCreatorSearch("");setProductSearch("");setManualCreatorConfirmed(false);setError("");setShowForm(true);
  }

  function openEdit(row:Listing){
    setEditingId(row.id);
    setForm({
      data_date:row.data_date||"",creator_name:row.creator_name||"",creator_id:row.creator_id?.toString()||"",
      platform:row.platform||"",product_master_id:row.product_master_id?.toString()||"",product_hpp:String(row.product_hpp||0),
      stage:row.stage||"New Lead",payment_type:row.payment_type||"",ratecard:row.ratecard?.toString()||"",
      posting_date:row.posting_date||"",post_link:row.post_link||"",next_action:row.next_action||"",
      agreement_id:row.agreement_id||"",notes:row.notes||"",
    });
    setCreatorSearch(row.creator_name||"");setProductSearch(row.sku||row.product_name||"");setManualCreatorConfirmed(!row.creator_id&&Boolean(row.creator_name));
    setError("");setShowForm(true);
  }

  async function saveListing(){
    setSaving(true);setError("");setMessage("");
    let creator=creators.find(item=>item.id===Number(form.creator_id));
    if(!creator&&(form.creator_name.trim()||creatorSearch.trim())){
      if(!form.platform.trim()){setSaving(false);return setError("Pilih platform terlebih dahulu untuk creator baru.")}
      try{
        const resolved=await resolveOrCreateCreator(workspaceId,form.creator_name.trim()||creatorSearch.trim(),form.platform);
        if(resolved){creator=resolved as Creator;setCreators(prev=>prev.some(x=>x.id===resolved.id)?prev:[resolved as Creator,...prev])}
      }catch(err){setSaving(false);return setError(err instanceof Error?err.message:"Gagal membuat creator baru.")}
    }
    const product=products.find(item=>item.id===Number(form.product_master_id));
    const payload={
      workspace_id:workspaceId,data_date:form.data_date||null,creator_id:creator?.id??(form.creator_id?Number(form.creator_id):null),
      creator_name:form.creator_name.trim()||creator?.name||creator?.username||creator?.creator_code||null,
      platform:form.platform||creator?.platform||null,product_master_id:form.product_master_id?Number(form.product_master_id):null,
      product_name:product?.product_name||null,sku:product?.sku||null,product_hpp:product?.cost_price!=null?Number(product.cost_price):Number(form.product_hpp||0),
      stage:form.stage||"New Lead",payment_type:form.payment_type||null,ratecard:form.ratecard?Number(form.ratecard):0,
      posting_date:form.posting_date||null,post_link:form.post_link||null,next_action:form.next_action||null,agreement_id:form.agreement_id||null,notes:form.notes||null,
    };

    if(editingId!==null){
      const result=await supabase.from("listings").update(payload).eq("id",editingId).eq("workspace_id",workspaceId);
      if(result.error){setSaving(false);return setError(result.error.message)}
    }else{
      const result=await supabase.from("listings").insert(payload).select("id").single();
      if(result.error){setSaving(false);return setError(result.error.message)}
      if(result.data?.id){
        const {data:{user}}=await supabase.auth.getUser();
        await supabase.from("listing_activities").insert({
          workspace_id:workspaceId,listing_id:result.data.id,creator_id:payload.creator_id,
          activity_date:payload.data_date||new Date().toISOString().slice(0,10),activity_type:"Listing dibuat",
          result:payload.stage,note:payload.notes,created_by:user?.id||null,
        });
      }
    }
    setSaving(false);setShowForm(false);setEditingId(null);setForm(EMPTY_FORM);setCreatorSearch("");setProductSearch("");setManualCreatorConfirmed(false);
    setMessage(editingId!==null?"Listing diperbarui.":"Listing berhasil ditambahkan.");await loadData();
  }

  async function deleteListing(id:number){
    if(!window.confirm("Hapus listing ini beserta history aktivitasnya?"))return;
    const result=await supabase.from("listings").delete().eq("id",id).eq("workspace_id",workspaceId);
    if(result.error)return setError(result.error.message);
    setMessage("Listing dihapus.");if(selected?.id===id)setSelected(null);await loadData();
  }

  function openActivity(row:Listing,type="Follow Up"){
    setActivityFor(row);setActivityForm({activity_date:new Date().toISOString().slice(0,10),activity_type:type,result:"",note:""});
  }

  async function saveActivity(){
    if(!activityFor)return;
    setSaving(true);setError("");
    const {data:{user}}=await supabase.auth.getUser();
    const insert=await supabase.from("listing_activities").insert({
      workspace_id:workspaceId,listing_id:activityFor.id,creator_id:activityFor.creator_id,
      activity_date:activityForm.activity_date,activity_type:activityForm.activity_type,
      result:activityForm.result.trim()||null,note:activityForm.note.trim()||null,created_by:user?.id||null,
    });
    if(insert.error){setSaving(false);return setError(insert.error.message)}
    const mappedStage=ACTIVITY_STAGE[activityForm.activity_type];
    if(mappedStage){
      const update=await supabase.from("listings").update({
        stage:mappedStage,next_action:activityForm.result.trim()||activityFor.next_action||null,updated_at:new Date().toISOString(),
      }).eq("workspace_id",workspaceId).eq("id",activityFor.id);
      if(update.error){setSaving(false);return setError(update.error.message)}
    }
    setSaving(false);setMessage("Aktivitas creator ditambahkan.");setActivityFor(null);await loadData();
  }

  const platforms=useMemo(()=>[...new Set(rows.map(x=>x.platform).filter(Boolean) as string[])].sort(),[rows]);
  const visibleRows=useMemo(()=>rows.filter(row=>{
    const q=search.trim().toLowerCase();
    if(platformFilter&&row.platform!==platformFilter)return false;
    if(stageFilter&&(row.stage||"New Lead")!==stageFilter)return false;
    if(dateStart&&String(row.data_date||"")<dateStart)return false;
    if(dateEnd&&String(row.data_date||"")>dateEnd)return false;
    if(!q)return true;
    return [row.creator_name,row.product_name,row.sku,row.platform,row.stage,row.payment_type,row.next_action].filter(Boolean).some(value=>String(value).toLowerCase().includes(q));
  }),[rows,search,platformFilter,stageFilter,dateStart,dateEnd]);

  const stats=useMemo(()=>({
    total:rows.length,
    followup:rows.filter(x=>["Reach Out","Follow Up","Negotiation"].includes(x.stage||"")).length,
    sample:rows.filter(x=>String(x.stage||"").toLowerCase().includes("sample")).length,
    active:rows.filter(x=>["Uploaded","Live","Won / Active"].includes(x.stage||"")).length,
  }),[rows]);

  const masterCreatorPages=Math.max(1,Math.ceil(masterCreatorTotal/100));
  const creatorName=selectedCreator?.name||selectedCreator?.username||selected?.creator_name||"Creator";
  const initials=creatorName.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"C";

  return <section className="listing-v2-page">
    <header className="listing-v2-header">
      <div><span>CREATOR OPERATIONS</span><h2>Listings</h2><p>Kelola hasil listing, follow up, sample, konten, dan progres creator dalam satu workspace.</p></div>
      <button className="primary" onClick={openAdd}>+ Tambah Listing</button>
    </header>

    <div className="listing-v2-stats">
      <article><span>Total Listing</span><b>{stats.total.toLocaleString("id-ID")}</b></article>
      <article><span>Follow Up / Negotiation</span><b>{stats.followup.toLocaleString("id-ID")}</b></article>
      <article><span>Sample Sent</span><b>{stats.sample.toLocaleString("id-ID")}</b></article>
      <article><span>Uploaded / Live / Active</span><b>{stats.active.toLocaleString("id-ID")}</b></article>
    </div>

    <div className="listing-v2-toolbar">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari creator, produk, SKU, platform, next action..."/>
      <select value={platformFilter} onChange={e=>setPlatformFilter(e.target.value)}><option value="">Semua Platform</option>{platforms.map(x=><option key={x}>{x}</option>)}</select>
      <select value={stageFilter} onChange={e=>setStageFilter(e.target.value)}><option value="">Semua Stage</option>{STAGES.map(x=><option key={x}>{x}</option>)}</select>
      <input type="date" value={dateStart} onChange={e=>setDateStart(e.target.value)}/>
      <input type="date" value={dateEnd} onChange={e=>setDateEnd(e.target.value)}/>
      {(search||platformFilter||stageFilter||dateStart||dateEnd)&&<button className="secondary" onClick={()=>{setSearch("");setPlatformFilter("");setStageFilter("");setDateStart("");setDateEnd("")}}>Reset</button>}
    </div>

    {error&&<div className="listing-v2-alert error">{error}</div>}
    {message&&<div className="listing-v2-alert success">{message}</div>}

    {showForm&&<section className="listing-v2-editor">
      <div className="listing-v2-editor-head"><div><span>{editingId?"EDIT LISTING":"NEW LISTING"}</span><h3>{editingId?"Edit Listing":"Tambah Listing"}</h3><p>Creator baru otomatis terhubung ke Master Creator. HPP mengikuti Product Master.</p></div><button onClick={()=>{setShowForm(false);setEditingId(null)}}>×</button></div>
      <div className="listing-v2-form-grid">
        <label><span>Data Date</span><input type="date" value={form.data_date} onChange={e=>updateField("data_date",e.target.value)}/></label>
        <label><span>Creator</span><CreatorAutocomplete workspaceId={workspaceId} value={creatorSearch} selectedId={form.creator_id} createPlatform={form.platform}
          onTextChange={value=>{setCreatorSearch(value);setManualCreatorConfirmed(false);setForm(prev=>({...prev,creator_id:"",creator_name:value}))}}
          placeholder="Ketik username / nama creator"
          onSelect={(creator:CreatorSearchResult)=>{const creatorName=creator.name||creator.username||creator.creator_code||"";setCreators(prev=>prev.some(x=>x.id===creator.id)?prev:[creator as Creator,...prev]);setForm(prev=>({...prev,creator_id:String(creator.id),creator_name:creatorName,platform:creator.platform||prev.platform,ratecard:String(creator.ratecard??prev.ratecard??"")}));setCreatorSearch(creatorName);setManualCreatorConfirmed(false)}}
          onCreate={value=>{setCreatorSearch(value);setManualCreatorConfirmed(true);setForm(prev=>({...prev,creator_id:"",creator_name:value}))}}/>
          {manualCreatorConfirmed&&!form.creator_id&&<small>Creator baru akan dibuat saat listing disimpan.</small>}
        </label>
        <label><span>Platform</span><select value={form.platform} onChange={e=>updateField("platform",e.target.value)}><option value="">Pilih Platform</option><option>TikTok</option><option>Shopee</option><option>Instagram</option><option>YouTube</option><option>Other</option></select></label>
        <label><span>Product / SKU</span><ProductAutocomplete workspaceId={workspaceId} value={productSearch} selectedId={form.product_master_id}
          onTextChange={value=>{setProductSearch(value);setForm(prev=>({...prev,product_master_id:"",product_hpp:"0"}))}}
          placeholder="Ketik SKU atau nama produk"
          onSelect={(product:ProductSearchResult)=>{setProducts(prev=>prev.some(x=>x.id===product.id)?prev:[product as Product,...prev]);setForm(prev=>({...prev,product_master_id:String(product.id),product_hpp:String(product.cost_price||0)}));setProductSearch(`${product.sku}${product.product_name?` - ${product.product_name}`:""}`)}}/>
          {form.product_master_id&&<small>HPP otomatis: {money(form.product_hpp)}</small>}
        </label>
        <label><span>Stage</span><select value={form.stage} onChange={e=>updateField("stage",e.target.value)}>{STAGES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span>Payment Type</span><input value={form.payment_type} onChange={e=>updateField("payment_type",e.target.value)} placeholder="Paid / Barter"/></label>
        <label><span>Ratecard</span><input type="number" value={form.ratecard} onChange={e=>updateField("ratecard",e.target.value)} placeholder="0"/></label>
        <label><span>Posting Date</span><input type="date" value={form.posting_date} onChange={e=>updateField("posting_date",e.target.value)}/></label>
        <label><span>Post Link</span><input value={form.post_link} onChange={e=>updateField("post_link",e.target.value)} placeholder="https://..."/></label>
        <label><span>Next Action</span><input value={form.next_action} onChange={e=>updateField("next_action",e.target.value)} placeholder="Follow up / kirim brief"/></label>
        <label><span>Agreement ID</span><input value={form.agreement_id} onChange={e=>updateField("agreement_id",e.target.value)} placeholder="Optional"/></label>
        <label className="wide"><span>Notes</span><textarea rows={3} value={form.notes} onChange={e=>updateField("notes",e.target.value)} placeholder="Catatan listing..."/></label>
      </div>
      <div className="listing-v2-editor-actions"><button className="secondary" onClick={()=>setShowForm(false)}>Batal</button><button className="primary" disabled={saving} onClick={()=>void saveListing()}>{saving?"Menyimpan...":"Simpan Listing"}</button></div>
    </section>}

    <div className="listing-v2-layout">
      <section className="listing-v2-main">
        <div className="listing-v2-section-head"><div><h3>Hasil Listing</h3><p>Aktivitas terbaru creator dan progres listing.</p></div><span>{visibleRows.length.toLocaleString("id-ID")} hasil</span></div>
        {loading?<div className="listing-v2-empty">Memuat Listings...</div>:visibleRows.length===0?<div className="listing-v2-empty"><b>Belum ada hasil listing.</b><span>Tambahkan listing atau ubah filter pencarian.</span></div>:
        <div className="listing-v2-table-wrap"><table><thead><tr><th>Creator</th><th>Platform</th><th>Product / SKU</th><th>Stage</th><th>Ratecard</th><th>Latest / Next</th><th>Action</th></tr></thead><tbody>
          {visibleRows.map(row=><tr key={row.id} className={selected?.id===row.id?"selected":""} onClick={()=>setSelected(row)}>
            <td><div className="listing-v2-creator-cell"><span>{String(row.creator_name||"C").slice(0,1).toUpperCase()}</span><div><b>{row.creator_name||"-"}</b><small>{dateLabel(row.data_date)}</small></div></div></td>
            <td><span className="listing-v2-platform">{row.platform||"-"}</span></td>
            <td><b>{row.product_name||"-"}</b><small>{row.sku||"Tanpa SKU"}</small></td>
            <td><span className={"listing-v2-stage "+stageTone(row.stage)}>{row.stage||"New Lead"}</span></td>
            <td>{money(row.ratecard)}</td>
            <td><b>{row.next_action||"Belum ada next action"}</b><small>{row.posting_date?`Posting ${dateLabel(row.posting_date)}`:""}</small></td>
            <td><div className="listing-v2-actions" onClick={e=>e.stopPropagation()}><button onClick={()=>setSelected(row)}>Detail</button><button onClick={()=>openActivity(row,"Follow Up")}>+ Follow Up</button><button onClick={()=>openEdit(row)}>Edit</button><button className="danger" onClick={()=>void deleteListing(row.id)}>Hapus</button></div></td>
          </tr>)}
        </tbody></table></div>}
      </section>

      <aside className="listing-v2-detail">
        {!selected?<div className="listing-v2-empty"><b>Pilih listing</b><span>Detail creator dan timeline akan tampil di sini.</span></div>:<>
          <div className="listing-v2-profile">
            <div className="listing-v2-avatar">{initials}</div>
            <div><span>CUSTOMER 360</span><h3>{creatorName}</h3><p>@{selectedCreator?.username||selected.creator_name||"-"} · {selected.platform||selectedCreator?.platform||"-"}</p></div>
            <span className={"listing-v2-stage "+stageTone(selected.stage)}>{selected.stage||"New Lead"}</span>
          </div>
          <div className="listing-v2-profile-grid">
            <div><span>Affiliate ID</span><b>{selectedCreator?.affiliate_id||"-"}</b></div>
            <div><span>Ratecard</span><b>{money(selectedCreator?.ratecard??selected.ratecard)}</b></div>
            <div><span>Phone</span><b>{selectedCreator?.phone||"-"}</b></div>
            <div><span>Payment</span><b>{selectedCreator?.payment_type||selected.payment_type||"-"}</b></div>
            <div><span>Product</span><b>{selected.product_name||"-"}</b></div>
            <div><span>SKU</span><b>{selected.sku||"-"}</b></div>
          </div>
          <div className="listing-v2-detail-actions"><button className="primary" onClick={()=>openActivity(selected,"Follow Up")}>+ Tambah Follow Up</button><button className="secondary" onClick={()=>openEdit(selected)}>Edit Listing</button>{selected.post_link&&<a href={selected.post_link} target="_blank" rel="noreferrer">Buka Konten</a>}</div>
          <div className="listing-v2-timeline-head"><div><h4>Activity Timeline</h4><p>Riwayat listing, follow up, sample, konten, dan hasil creator.</p></div></div>
          {detailLoading?<div className="listing-v2-empty small">Memuat timeline...</div>:activities.length===0?<div className="listing-v2-empty small">Belum ada aktivitas.</div>:
          <div className="listing-v2-timeline">{activities.map(activity=><article key={activity.id}><span className="dot"/><time>{dateLabel(activity.activity_date)}</time><div><b>{activity.activity_type}</b>{activity.result&&<em>{activity.result}</em>}{activity.note&&<p>{activity.note}</p>}</div></article>)}</div>}
        </>}
      </aside>
    </div>

    <details className="listing-v2-master">
      <summary><div><h3>Master Creator</h3><p>Database creator workspace tetap tersedia untuk pencarian dan pengecekan data master.</p></div><span>{masterCreatorTotal.toLocaleString("id-ID")} creator</span></summary>
      <div className="listing-v2-master-body">
        <div className="listing-v2-master-search"><input value={masterCreatorSearch} onChange={e=>setMasterCreatorSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void loadMasterCreators(1,masterCreatorSearch)}}} placeholder="Cari username / nama creator / platform..."/><button className="secondary" onClick={()=>void loadMasterCreators(1,masterCreatorSearch)}>Cari</button>{masterCreatorSearch&&<button className="secondary" onClick={()=>{setMasterCreatorSearch("");void loadMasterCreators(1,"")}}>Reset</button>}</div>
        <div className="listing-v2-table-wrap"><table><thead><tr><th>Creator / Username</th><th>Platform</th><th>Affiliate ID</th><th>Phone</th><th>Payment</th><th>Ratecard</th><th>Status</th></tr></thead><tbody>
          {masterCreators.map(creator=><tr key={creator.id}><td><b>{creator.name||creator.username||"-"}</b>{creator.username&&creator.username!==creator.name&&<small>@{creator.username}</small>}</td><td>{creator.platform||"-"}</td><td>{creator.affiliate_id||"-"}</td><td>{creator.phone||"-"}</td><td>{creator.payment_type||"-"}</td><td>{money(creator.ratecard)}</td><td><span className="listing-v2-stage success">{creator.status||"-"}</span></td></tr>)}
        </tbody></table></div>
        <div className="pager"><span className="pager-info">Page {masterCreatorPage} / {masterCreatorPages}</span><div className="button-row"><button className="secondary" disabled={masterCreatorPage<=1} onClick={()=>void loadMasterCreators(masterCreatorPage-1,masterCreatorSearch)}>Previous</button><button className="secondary" disabled={masterCreatorPage>=masterCreatorPages} onClick={()=>void loadMasterCreators(masterCreatorPage+1,masterCreatorSearch)}>Next</button></div></div>
      </div>
    </details>

    {activityFor&&<div className="listing-v2-modal-backdrop" onMouseDown={()=>!saving&&setActivityFor(null)}>
      <section className="listing-v2-modal" onMouseDown={e=>e.stopPropagation()}>
        <header><div><span>CREATOR ACTIVITY</span><h3>Tambah Aktivitas</h3><p>{activityFor.creator_name||"Creator"} · {activityFor.product_name||activityFor.sku||"Listing"}</p></div><button onClick={()=>setActivityFor(null)}>×</button></header>
        <div className="listing-v2-activity-form">
          <label><span>Tanggal</span><input type="date" value={activityForm.activity_date} onChange={e=>setActivityForm({...activityForm,activity_date:e.target.value})}/></label>
          <label><span>Aktivitas</span><select value={activityForm.activity_type} onChange={e=>setActivityForm({...activityForm,activity_type:e.target.value})}>{ACTIVITY_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
          <label><span>Hasil / Next Action</span><input value={activityForm.result} onChange={e=>setActivityForm({...activityForm,result:e.target.value})} placeholder="Contoh: Follow up 3 hari lagi"/></label>
          <label><span>Catatan</span><textarea rows={4} value={activityForm.note} onChange={e=>setActivityForm({...activityForm,note:e.target.value})} placeholder="Catatan aktivitas..."/></label>
        </div>
        <footer><button className="secondary" onClick={()=>setActivityFor(null)}>Batal</button><button className="primary" disabled={saving} onClick={()=>void saveActivity()}>{saving?"Menyimpan...":"Simpan Aktivitas"}</button></footer>
      </section>
    </div>}
  </section>;
}
