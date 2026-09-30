"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {CreatorAutocomplete,ProductAutocomplete,CreatorSearchResult,ProductSearchResult,resolveOrCreateCreator} from "./SmartAutocomplete";

type Campaign={
  id:number;workspace_id:string;name:string;brand_name:string|null;campaign_type:string;platform:string|null;
  start_date:string|null;end_date:string|null;status:string;target_gmv:number;actual_gmv:number;target_orders:number;
  actual_orders:number;budget:number;notes:string|null;banner_urls:any;banner_storage_paths:any;created_at:string;updated_at:string;
};
type CampaignCreator={
  id:number;campaign_id:number;creator_id:number|null;creator_name:string|null;platform:string|null;product_id:number|null;
  product_name:string|null;sku:string|null;content_type:string|null;due_date:string|null;deliverable_status:string;
  orders:number;gmv:number;commission:number;sample_status:string|null;shipping_order_id:number|null;notes:string|null;
};
type Creator={id:number;creator_code:string|null;name:string|null;username:string|null;platform:string|null};
type Product={id:number;sku:string;product_name:string|null;cost_price:number|null};
type ShippingOption={id:number;reference_no:string|null;tracking:string|null;creator_name:string|null;status:string|null};
type CampaignForm={name:string;brand_name:string;campaign_type:string;platform:string;start_date:string;end_date:string;status:string;target_gmv:string;target_orders:string;budget:string;notes:string;banner_urls:string[];banner_storage_paths:string[]};
type CreatorForm={creator_id:string;creator_name:string;platform:string;product_id:string;content_type:string;due_date:string;deliverable_status:string;orders:string;gmv:string;commission:string;sample_status:string;shipping_order_id:string;notes:string};

const CAMPAIGN_STATUSES=["Draft","Active","Paused","Completed","Cancelled"];
const CAMPAIGN_TYPES=["Affiliate","Influencer","Hybrid"];
const DELIVERABLES=["Brief Sent","Sample Sent","Sample Received","Content Draft","Revision","Content Approved","Video Uploaded","Live Started","Live Finished","Performance Running","Closed"];
const CONTENT_TYPES=["Video","LIVE","Video + LIVE","Post","Story","Other"];
const SAMPLE_STATUSES=["Not Required","Pending","Sent","Received","Returned","Cancelled"];
const EMPTY_CAMPAIGN:CampaignForm={name:"",brand_name:"",campaign_type:"Affiliate",platform:"TikTok",start_date:"",end_date:"",status:"Draft",target_gmv:"0",target_orders:"0",budget:"0",notes:"",banner_urls:[],banner_storage_paths:[]};
const EMPTY_CREATOR:CreatorForm={creator_id:"",creator_name:"",platform:"TikTok",product_id:"",content_type:"Video",due_date:"",deliverable_status:"Brief Sent",orders:"0",gmv:"0",commission:"0",sample_status:"Not Required",shipping_order_id:"",notes:""};
const money=(value:any)=>"Rp "+Number(value||0).toLocaleString("id-ID",{maximumFractionDigits:0});
const number=(value:any)=>Number(value||0).toLocaleString("id-ID",{maximumFractionDigits:0});
const dateLabel=(value:string|null)=>value?new Date(value+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"-";
const pct=(actual:number,target:number)=>target>0?Math.max(0,Math.min(100,(actual/target)*100)):0;

function campaignTone(status:string){
  const key=String(status||"Draft").toLowerCase();
  if(key==="active")return"active";
  if(key==="completed")return"success";
  if(key==="paused")return"warning";
  if(key==="cancelled")return"danger";
  return"neutral";
}
function deliverableTone(status:string){
  const key=String(status||"").toLowerCase();
  if(key==="closed"||key.includes("finished"))return"success";
  if(key.includes("uploaded")||key.includes("approved")||key.includes("running"))return"active";
  if(key.includes("revision")||key.includes("sample"))return"warning";
  return"neutral";
}

export default function CampaignTracker({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [creatorRows,setCreatorRows]=useState<CampaignCreator[]>([]);
  const [creators,setCreators]=useState<Creator[]>([]);
  const [products,setProducts]=useState<Product[]>([]);
  const [shipping,setShipping]=useState<ShippingOption[]>([]);
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("");
  const [campaignForm,setCampaignForm]=useState<CampaignForm>(EMPTY_CAMPAIGN);
  const [creatorForm,setCreatorForm]=useState<CreatorForm>(EMPTY_CREATOR);
  const [creatorSearch,setCreatorSearch]=useState("");
  const [productSearch,setProductSearch]=useState("");
  const [editingCampaignId,setEditingCampaignId]=useState<number|null>(null);
  const [editingCreatorId,setEditingCreatorId]=useState<number|null>(null);
  const [showCampaignForm,setShowCampaignForm]=useState(false);
  const [showCreatorForm,setShowCreatorForm]=useState(false);
  const [manualCreatorConfirmed,setManualCreatorConfirmed]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [bannerFiles,setBannerFiles]=useState<File[]>([]);
  const [bannerIndex,setBannerIndex]=useState(0);

  async function load(){
    setLoading(true);setError("");
    const [campaignRes,creatorRes,productRes,shippingRes]=await Promise.all([
      supabase.from("campaign_trackers").select("id,workspace_id,name,brand_name,campaign_type,platform,start_date,end_date,status,target_gmv,actual_gmv,target_orders,actual_orders,budget,notes,banner_urls,banner_storage_paths,created_at,updated_at").eq("workspace_id",workspaceId).order("created_at",{ascending:false}),
      supabase.from("creators").select("id,creator_code,name,username,platform").eq("workspace_id",workspaceId).order("name").limit(7770),
      supabase.from("product_master").select("id,sku,product_name,cost_price").eq("workspace_id",workspaceId).order("sku").limit(1000),
      supabase.from("shipping").select("id,reference_no,tracking,creator_name,status").eq("workspace_id",workspaceId).order("id",{ascending:false}).limit(1000),
    ]);
    if(campaignRes.error)setError(campaignRes.error.message);
    else{
      const data=(campaignRes.data||[]) as Campaign[];
      setCampaigns(data);
      setSelectedId(current=>current&&data.some(x=>x.id===current)?current:data[0]?.id||null);
    }
    if(!creatorRes.error)setCreators((creatorRes.data||[]) as Creator[]);
    if(!productRes.error)setProducts((productRes.data||[]) as Product[]);
    if(!shippingRes.error)setShipping((shippingRes.data||[]) as ShippingOption[]);
    setLoading(false);
  }

  async function loadCreatorRows(campaignId:number|null){
    if(!campaignId){setCreatorRows([]);return}
    const {data,error}=await supabase.from("campaign_tracker_creators")
      .select("id,campaign_id,creator_id,creator_name,platform,product_id,product_name,sku,content_type,due_date,deliverable_status,orders,gmv,commission,sample_status,shipping_order_id,notes")
      .eq("workspace_id",workspaceId).eq("campaign_id",campaignId).order("due_date",{ascending:true}).order("id",{ascending:true});
    if(error)setError(error.message);else setCreatorRows((data||[]) as CampaignCreator[]);
  }

  useEffect(()=>{void load()},[workspaceId]);
  useEffect(()=>{void loadCreatorRows(selectedId)},[selectedId,workspaceId]);
  useEffect(()=>{
    const onQuick=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.type==="campaign")openCampaignAdd()};
    const onSelect=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.type!=="campaign")return;setSelectedId(Number(detail.id));setSearch("")};
    window.addEventListener("lumaway-quick-create",onQuick as EventListener);window.addEventListener("lumaway-global-select",onSelect as EventListener);
    return()=>{window.removeEventListener("lumaway-quick-create",onQuick as EventListener);window.removeEventListener("lumaway-global-select",onSelect as EventListener)};
  },[]);
  const selected=campaigns.find(x=>x.id===selectedId)||null;
  const selectedBanners=useMemo(()=>Array.isArray(selected?.banner_urls)?selected!.banner_urls.filter(Boolean).map(String).slice(0,3):[],[selected?.id,selected?.banner_urls]);
  const newBannerPreviews=useMemo(()=>bannerFiles.map(file=>URL.createObjectURL(file)),[bannerFiles]);
  useEffect(()=>()=>newBannerPreviews.forEach(url=>URL.revokeObjectURL(url)),[newBannerPreviews]);
  useEffect(()=>{setBannerIndex(0)},[selectedId]);
  useEffect(()=>{
    if(selectedBanners.length<=1)return;
    const timer=window.setInterval(()=>setBannerIndex(index=>(index+1)%selectedBanners.length),10000);
    return()=>window.clearInterval(timer);
  },[selectedId,selectedBanners.length]);
  const visibleCampaigns=useMemo(()=>campaigns.filter(row=>{
    const q=search.trim().toLowerCase();
    if(statusFilter&&row.status!==statusFilter)return false;
    if(!q)return true;
    return [row.name,row.brand_name,row.campaign_type,row.platform,row.status].filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
  }),[campaigns,search,statusFilter]);

  const summary=useMemo(()=>({
    total:campaigns.length,
    active:campaigns.filter(x=>x.status==="Active").length,
    creators:creatorRows.length,
    gmv:creatorRows.reduce((sum,row)=>sum+Number(row.gmv||0),0),
  }),[campaigns,creatorRows]);

  const deliverableCounts=useMemo(()=>DELIVERABLES.map(label=>({label,value:creatorRows.filter(row=>row.deliverable_status===label).length})).filter(x=>x.value>0),[creatorRows]);
  const actualGmv=creatorRows.reduce((sum,row)=>sum+Number(row.gmv||0),0);
  const actualOrders=creatorRows.reduce((sum,row)=>sum+Number(row.orders||0),0);
  const totalCommission=creatorRows.reduce((sum,row)=>sum+Number(row.commission||0),0);

  function openCampaignAdd(){
    setEditingCampaignId(null);setCampaignForm({...EMPTY_CAMPAIGN,start_date:new Date().toISOString().slice(0,10)});setBannerFiles([]);setShowCampaignForm(true);setMessage("");setError("");
  }
  function openCampaignEdit(row:Campaign){
    setEditingCampaignId(row.id);setCampaignForm({name:row.name,brand_name:row.brand_name||"",campaign_type:row.campaign_type||"Affiliate",platform:row.platform||"",start_date:row.start_date||"",end_date:row.end_date||"",status:row.status||"Draft",target_gmv:String(row.target_gmv||0),target_orders:String(row.target_orders||0),budget:String(row.budget||0),notes:row.notes||"",banner_urls:Array.isArray(row.banner_urls)?row.banner_urls.filter(Boolean).map(String).slice(0,3):[],banner_storage_paths:Array.isArray(row.banner_storage_paths)?row.banner_storage_paths.filter(Boolean).map(String).slice(0,3):[]});setBannerFiles([]);setShowCampaignForm(true);setMessage("");setError("");
  }
  function chooseBannerFiles(files:File[]){
    const valid=files.filter(file=>["image/jpeg","image/png","image/webp"].includes(file.type)&&file.size<=5*1024*1024);
    const remaining=Math.max(0,3-campaignForm.banner_urls.length);
    setBannerFiles(valid.slice(0,remaining));
    if(files.some(file=>file.size>5*1024*1024))setError("Setiap banner maksimal 5 MB.");
  }
  function removeExistingBanner(index:number){
    setCampaignForm(prev=>({...prev,banner_urls:prev.banner_urls.filter((_,i)=>i!==index),banner_storage_paths:prev.banner_storage_paths.filter((_,i)=>i!==index)}));
  }
  async function uploadCampaignBanners(campaignId:number){
    if(!bannerFiles.length)return{urls:campaignForm.banner_urls.slice(0,3),paths:campaignForm.banner_storage_paths.slice(0,3)};
    const urls=[...campaignForm.banner_urls],paths=[...campaignForm.banner_storage_paths];
    for(const [index,file] of bannerFiles.entries()){
      if(urls.length>=3)break;
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
      const path=`${workspaceId}/${campaignId}/banner-${Date.now()}-${index}.${ext}`;
      const {error:uploadError}=await supabase.storage.from("luma-campaigns").upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      const {data}=supabase.storage.from("luma-campaigns").getPublicUrl(path);
      urls.push(data.publicUrl);paths.push(path);
    }
    return{urls:urls.slice(0,3),paths:paths.slice(0,3)};
  }

  async function saveCampaign(){
    if(!campaignForm.name.trim())return setError("Nama campaign wajib diisi.");
    if(campaignForm.banner_urls.length+bannerFiles.length>3)return setError("Banner campaign maksimal 3 gambar.");
    setSaving(true);setError("");setMessage("");
    try{
      const {data:{user}}=await supabase.auth.getUser();
      const payload={workspace_id:workspaceId,name:campaignForm.name.trim(),brand_name:campaignForm.brand_name.trim()||null,campaign_type:campaignForm.campaign_type,platform:campaignForm.platform||null,start_date:campaignForm.start_date||null,end_date:campaignForm.end_date||null,status:campaignForm.status,target_gmv:Number(campaignForm.target_gmv||0),target_orders:Number(campaignForm.target_orders||0),budget:Number(campaignForm.budget||0),notes:campaignForm.notes.trim()||null,created_by:user?.id||null,updated_at:new Date().toISOString()};
      let campaignId=editingCampaignId;
      if(editingCampaignId){
        const {error}=await supabase.from("campaign_trackers").update(payload).eq("workspace_id",workspaceId).eq("id",editingCampaignId);
        if(error)throw error;
      }else{
        const {data,error}=await supabase.from("campaign_trackers").insert(payload).select("id").single();
        if(error)throw error;
        campaignId=Number(data?.id||0);
        if(campaignId)setSelectedId(campaignId);
      }
      if(!campaignId)throw new Error("Campaign ID tidak tersedia.");
      const banners=await uploadCampaignBanners(campaignId);
      const {error:bannerError}=await supabase.from("campaign_trackers").update({banner_urls:banners.urls,banner_storage_paths:banners.paths,updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",campaignId);
      if(bannerError)throw bannerError;
      setShowCampaignForm(false);setBannerFiles([]);setMessage(editingCampaignId?"Campaign diperbarui.":"Campaign berhasil dibuat.");setEditingCampaignId(null);await load();
    }catch(err:any){setError(err?.message||"Campaign belum dapat disimpan.")}finally{setSaving(false)}
  }

  async function deleteCampaign(id:number){
    if(!window.confirm("Hapus campaign dan seluruh creator/deliverable di dalamnya?"))return;
    const {error}=await supabase.from("campaign_trackers").delete().eq("workspace_id",workspaceId).eq("id",id);
    if(error)return setError(error.message);
    setSelectedId(null);setMessage("Campaign dihapus.");await load();
  }

  function openCreatorAdd(){
    if(!selected)return;
    setEditingCreatorId(null);setCreatorForm({...EMPTY_CREATOR,platform:selected.platform||"TikTok",due_date:selected.end_date||""});setCreatorSearch("");setProductSearch("");setManualCreatorConfirmed(false);setShowCreatorForm(true);setError("");
  }
  function openCreatorEdit(row:CampaignCreator){
    setEditingCreatorId(row.id);setCreatorForm({creator_id:row.creator_id?.toString()||"",creator_name:row.creator_name||"",platform:row.platform||"",product_id:row.product_id?.toString()||"",content_type:row.content_type||"Video",due_date:row.due_date||"",deliverable_status:row.deliverable_status||"Brief Sent",orders:String(row.orders||0),gmv:String(row.gmv||0),commission:String(row.commission||0),sample_status:row.sample_status||"Not Required",shipping_order_id:row.shipping_order_id?.toString()||"",notes:row.notes||""});setCreatorSearch(row.creator_name||"");setProductSearch(row.sku?(row.sku+(row.product_name?" - "+row.product_name:"")):"");setManualCreatorConfirmed(!row.creator_id&&Boolean(row.creator_name));setShowCreatorForm(true);setError("");
  }

  async function syncCampaignActuals(campaignId:number){
    const {data,error}=await supabase.from("campaign_tracker_creators").select("orders,gmv").eq("workspace_id",workspaceId).eq("campaign_id",campaignId);
    if(error)return;
    const total=(data||[]).reduce((acc:any,row:any)=>({orders:acc.orders+Number(row.orders||0),gmv:acc.gmv+Number(row.gmv||0)}),{orders:0,gmv:0});
    await supabase.from("campaign_trackers").update({actual_orders:total.orders,actual_gmv:total.gmv,updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",campaignId);
  }

  async function saveCreator(){
    if(!selected)return;
    setSaving(true);setError("");setMessage("");
    let creator=creators.find(x=>x.id===Number(creatorForm.creator_id));
    if(!creator&&(creatorForm.creator_name.trim()||creatorSearch.trim())){
      if(!creatorForm.platform.trim()){setSaving(false);return setError("Pilih platform creator terlebih dahulu.")}
      try{
        const resolved=await resolveOrCreateCreator(workspaceId,creatorForm.creator_name.trim()||creatorSearch.trim(),creatorForm.platform);
        if(resolved){creator=resolved as Creator;setCreators(prev=>prev.some(x=>x.id===resolved.id)?prev:[resolved as Creator,...prev])}
      }catch(err){setSaving(false);return setError(err instanceof Error?err.message:"Creator belum dapat disimpan.")}
    }
    const product=products.find(x=>x.id===Number(creatorForm.product_id));
    const payload={workspace_id:workspaceId,campaign_id:selected.id,creator_id:creator?.id??(creatorForm.creator_id?Number(creatorForm.creator_id):null),creator_name:creatorForm.creator_name.trim()||creator?.name||creator?.username||creator?.creator_code||null,platform:creatorForm.platform||creator?.platform||selected.platform||null,product_id:creatorForm.product_id?Number(creatorForm.product_id):null,product_name:product?.product_name||null,sku:product?.sku||null,content_type:creatorForm.content_type||null,due_date:creatorForm.due_date||null,deliverable_status:creatorForm.deliverable_status||"Brief Sent",orders:Number(creatorForm.orders||0),gmv:Number(creatorForm.gmv||0),commission:Number(creatorForm.commission||0),sample_status:creatorForm.sample_status||null,shipping_order_id:creatorForm.shipping_order_id?Number(creatorForm.shipping_order_id):null,notes:creatorForm.notes.trim()||null,updated_at:new Date().toISOString()};
    if(editingCreatorId){
      const {error}=await supabase.from("campaign_tracker_creators").update(payload).eq("workspace_id",workspaceId).eq("id",editingCreatorId);
      if(error){setSaving(false);return setError(error.message)}
    }else{
      const {error}=await supabase.from("campaign_tracker_creators").insert(payload);
      if(error){setSaving(false);return setError(error.message)}
    }
    await syncCampaignActuals(selected.id);
    setSaving(false);setShowCreatorForm(false);setEditingCreatorId(null);setMessage("Creator campaign diperbarui.");await Promise.all([loadCreatorRows(selected.id),load()]);
  }

  async function quickDeliverable(row:CampaignCreator,status:string){
    const {error}=await supabase.from("campaign_tracker_creators").update({deliverable_status:status,updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",row.id);
    if(error)return setError(error.message);await loadCreatorRows(row.campaign_id);
  }
  async function removeCreator(row:CampaignCreator){
    if(!window.confirm("Hapus creator dari campaign ini?"))return;
    const {error}=await supabase.from("campaign_tracker_creators").delete().eq("workspace_id",workspaceId).eq("id",row.id);
    if(error)return setError(error.message);await syncCampaignActuals(row.campaign_id);await Promise.all([loadCreatorRows(row.campaign_id),load()]);
  }

  return <section className="campaign-v1-page">
    <header className="campaign-v1-header">
      <div><span>GROWTH & WORKFLOW</span><h2>Campaign Tracker</h2><p>Monitor influencer dan affiliate campaign, deliverables, sample, shipping, serta hasil GMV dalam satu workspace.</p></div>
      <button className="primary" onClick={openCampaignAdd}>+ Buat Campaign</button>
    </header>

    <div className="campaign-v1-stats">
      <article><span>Total Campaign</span><b>{number(summary.total)}</b></article>
      <article><span>Campaign Aktif</span><b>{number(summary.active)}</b></article>
      <article><span>Creator di Campaign Terpilih</span><b>{number(summary.creators)}</b></article>
      <article><span>GMV Campaign Terpilih</span><b>{money(summary.gmv)}</b></article>
    </div>

    <div className="campaign-v1-toolbar">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari campaign, brand, platform..."/>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">Semua Status</option>{CAMPAIGN_STATUSES.map(x=><option key={x}>{x}</option>)}</select>
      {(search||statusFilter)&&<button className="secondary" onClick={()=>{setSearch("");setStatusFilter("")}}>Reset</button>}
    </div>

    {error&&<div className="campaign-v1-alert error">{error}</div>}
    {message&&<div className="campaign-v1-alert success">{message}</div>}

    {showCampaignForm&&<section className="campaign-v1-editor">
      <div className="campaign-v1-editor-head"><div><span>{editingCampaignId?"EDIT CAMPAIGN":"NEW CAMPAIGN"}</span><h3>{editingCampaignId?"Edit Campaign":"Buat Campaign"}</h3></div><button onClick={()=>setShowCampaignForm(false)}>×</button></div>
      <div className="campaign-v1-form-grid">
        <label><span>Campaign Name *</span><input value={campaignForm.name} onChange={e=>setCampaignForm({...campaignForm,name:e.target.value})}/></label>
        <label><span>Brand / Project</span><input value={campaignForm.brand_name} onChange={e=>setCampaignForm({...campaignForm,brand_name:e.target.value})}/></label>
        <label><span>Type</span><select value={campaignForm.campaign_type} onChange={e=>setCampaignForm({...campaignForm,campaign_type:e.target.value})}>{CAMPAIGN_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span>Platform</span><select value={campaignForm.platform} onChange={e=>setCampaignForm({...campaignForm,platform:e.target.value})}><option value="">Multi Platform</option><option>TikTok</option><option>Shopee</option><option>Instagram</option><option>YouTube</option><option>Other</option></select></label>
        <label><span>Start Date</span><input type="date" value={campaignForm.start_date} onChange={e=>setCampaignForm({...campaignForm,start_date:e.target.value})}/></label>
        <label><span>End Date</span><input type="date" value={campaignForm.end_date} onChange={e=>setCampaignForm({...campaignForm,end_date:e.target.value})}/></label>
        <label><span>Status</span><select value={campaignForm.status} onChange={e=>setCampaignForm({...campaignForm,status:e.target.value})}>{CAMPAIGN_STATUSES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span>Budget</span><input type="number" min="0" value={campaignForm.budget} onChange={e=>setCampaignForm({...campaignForm,budget:e.target.value})}/></label>
        <label><span>Target GMV</span><input type="number" min="0" value={campaignForm.target_gmv} onChange={e=>setCampaignForm({...campaignForm,target_gmv:e.target.value})}/></label>
        <label><span>Target Orders</span><input type="number" min="0" value={campaignForm.target_orders} onChange={e=>setCampaignForm({...campaignForm,target_orders:e.target.value})}/></label>
        <label className="wide campaign-banner-field"><span>Banner Campaign · maksimal 3</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>chooseBannerFiles(Array.from(e.target.files||[]))}/><small>JPG, PNG, WEBP · maksimal 5 MB/gambar · carousel otomatis setiap 10 detik.</small><div className="campaign-banner-editor-preview">{campaignForm.banner_urls.map((url,index)=><div key={url}><img src={url} alt={`Banner campaign ${index+1}`}/><button type="button" onClick={()=>removeExistingBanner(index)}>×</button><span>Banner {index+1}</span></div>)}{newBannerPreviews.map((url,index)=><div key={url} className="new"><img src={url} alt={`Banner baru ${index+1}`}/><span>Baru {index+1}</span></div>)}</div></label>
        <label className="wide"><span>Notes</span><textarea rows={3} value={campaignForm.notes} onChange={e=>setCampaignForm({...campaignForm,notes:e.target.value})}/></label>
      </div>
      <div className="campaign-v1-editor-actions"><button className="secondary" onClick={()=>setShowCampaignForm(false)}>Batal</button><button className="primary" disabled={saving} onClick={()=>void saveCampaign()}>{saving?"Menyimpan...":"Simpan Campaign"}</button></div>
    </section>}

    <div className="campaign-v1-layout">
      <section className="campaign-v1-list">
        <div className="campaign-v1-list-head"><div><h3>Campaign</h3><p>{visibleCampaigns.length} dari {campaigns.length} campaign</p></div></div>
        {loading?<div className="campaign-v1-empty">Memuat campaign...</div>:visibleCampaigns.length===0?<div className="campaign-v1-empty"><b>Belum ada campaign.</b><span>Buat campaign pertama untuk mulai tracking.</span></div>:<div className="campaign-v1-list-stack">{visibleCampaigns.map(row=>{
          const gmvProgress=pct(Number(row.actual_gmv||0),Number(row.target_gmv||0));
          return <button type="button" key={row.id} className={"campaign-v1-list-card "+(selectedId===row.id?"selected":"")} onClick={()=>setSelectedId(row.id)}>
            {Array.isArray(row.banner_urls)&&row.banner_urls[0]&&<img className="campaign-v1-list-banner" src={String(row.banner_urls[0])} alt={row.name}/>}
            <div className="campaign-v1-list-card-top"><span className={"campaign-v1-status "+campaignTone(row.status)}>{row.status}</span><small>{row.platform||"Multi Platform"}</small></div>
            <h4>{row.name}</h4><p>{row.brand_name||row.campaign_type}</p>
            <div className="campaign-v1-list-progress"><i style={{width:gmvProgress+"%"}}/></div>
            <footer><span>{money(row.actual_gmv)} / {money(row.target_gmv)}</span><span>{dateLabel(row.start_date)} → {dateLabel(row.end_date)}</span></footer>
          </button>;
        })}</div>}
      </section>

      <section className="campaign-v1-detail">
        {!selected?<div className="campaign-v1-empty detail"><b>Pilih campaign.</b><span>Detail, creator, deliverable, sample, dan performa akan tampil di sini.</span></div>:<>
          <div className="campaign-v1-detail-head">
            <div><span>{selected.campaign_type} · {selected.platform||"Multi Platform"}</span><h3>{selected.name}</h3><p>{selected.brand_name||"Tanpa brand"} · {dateLabel(selected.start_date)} – {dateLabel(selected.end_date)}</p></div>
            <div className="campaign-v1-detail-actions"><button onClick={()=>openCampaignEdit(selected)}>Edit</button><button className="danger" onClick={()=>void deleteCampaign(selected.id)}>Hapus</button></div>
          </div>

          {selectedBanners.length>0&&<div className="campaign-banner-carousel">
            <div className="campaign-banner-stage">
              {selectedBanners.map((url,index)=><img key={url} src={url} alt={`${selected.name} banner ${index+1}`} className={bannerIndex===index?"active":""}/>)}
              <div className="campaign-banner-overlay"><span>{selected.brand_name||selected.campaign_type}</span><strong>{selected.name}</strong><small>{selectedBanners.length>1?"Bergeser otomatis setiap 10 detik":"1 banner campaign"}</small></div>
              {selectedBanners.length>1&&<><button className="campaign-banner-nav prev" type="button" onClick={()=>setBannerIndex(i=>(i-1+selectedBanners.length)%selectedBanners.length)}>‹</button><button className="campaign-banner-nav next" type="button" onClick={()=>setBannerIndex(i=>(i+1)%selectedBanners.length)}>›</button></>}
            </div>
            {selectedBanners.length>1&&<div className="campaign-banner-dots">{selectedBanners.map((_,index)=><button key={index} type="button" className={bannerIndex===index?"active":""} onClick={()=>setBannerIndex(index)} aria-label={`Banner ${index+1}`}/>)}</div>}
          </div>}

          <div className="campaign-v1-kpis">
            <article><span>GMV</span><b>{money(actualGmv)}</b><small>Target {money(selected.target_gmv)}</small><div><i style={{width:pct(actualGmv,Number(selected.target_gmv||0))+"%"}}/></div></article>
            <article><span>Orders</span><b>{number(actualOrders)}</b><small>Target {number(selected.target_orders)}</small><div><i style={{width:pct(actualOrders,Number(selected.target_orders||0))+"%"}}/></div></article>
            <article><span>Creator</span><b>{number(creatorRows.length)}</b><small>{creatorRows.filter(x=>x.deliverable_status==="Closed").length} closed</small></article>
            <article><span>Commission</span><b>{money(totalCommission)}</b><small>Budget {money(selected.budget)}</small></article>
          </div>

          <div className="campaign-v1-deliverables">
            <div className="campaign-v1-section-head"><div><h4>Deliverable Progress</h4><p>Ringkasan stage creator pada campaign ini.</p></div></div>
            {deliverableCounts.length?<div className="campaign-v1-deliverable-bars">{deliverableCounts.map(item=><div key={item.label}><span>{item.label}</span><div><i style={{width:(creatorRows.length?item.value/creatorRows.length*100:0)+"%"}}/></div><b>{item.value}</b></div>)}</div>:<div className="campaign-v1-mini-empty">Belum ada creator/deliverable.</div>}
          </div>

          <div className="campaign-v1-section-head"><div><h4>Creator & Deliverables</h4><p>Track content, due date, sample, shipping, orders, GMV, dan komisi.</p></div><button className="primary" onClick={openCreatorAdd}>+ Tambah Creator</button></div>

          {showCreatorForm&&<section className="campaign-v1-creator-editor">
            <div className="campaign-v1-editor-head"><div><span>{editingCreatorId?"EDIT CREATOR":"ADD CREATOR"}</span><h3>{editingCreatorId?"Edit Deliverable Creator":"Tambah Creator ke Campaign"}</h3></div><button onClick={()=>setShowCreatorForm(false)}>×</button></div>
            <div className="campaign-v1-form-grid">
              <label><span>Creator</span><CreatorAutocomplete workspaceId={workspaceId} value={creatorSearch} selectedId={creatorForm.creator_id} createPlatform={creatorForm.platform}
                placeholder="Ketik username / nama creator"
                onTextChange={value=>{setCreatorSearch(value);setManualCreatorConfirmed(false);setCreatorForm(p=>({...p,creator_id:"",creator_name:value}))}}
                onSelect={(creator:CreatorSearchResult)=>{const name=creator.name||creator.username||creator.creator_code||"";setCreators(prev=>prev.some(x=>x.id===creator.id)?prev:[creator as Creator,...prev]);setCreatorForm(p=>({...p,creator_id:String(creator.id),creator_name:name,platform:creator.platform||p.platform}));setCreatorSearch(name);setManualCreatorConfirmed(false)}}
                onCreate={value=>{setCreatorSearch(value);setManualCreatorConfirmed(true);setCreatorForm(p=>({...p,creator_id:"",creator_name:value}))}}/>{manualCreatorConfirmed&&!creatorForm.creator_id&&<small>Creator baru akan dibuat saat disimpan.</small>}</label>
              <label><span>Platform</span><select value={creatorForm.platform} onChange={e=>setCreatorForm({...creatorForm,platform:e.target.value})}><option>TikTok</option><option>Shopee</option><option>Instagram</option><option>YouTube</option><option>Other</option></select></label>
              <label><span>Product / SKU</span><ProductAutocomplete workspaceId={workspaceId} value={productSearch} selectedId={creatorForm.product_id} placeholder="Ketik SKU atau nama produk" onTextChange={value=>{setProductSearch(value);setCreatorForm(p=>({...p,product_id:""}))}} onSelect={(product:ProductSearchResult)=>{setProducts(prev=>prev.some(x=>x.id===product.id)?prev:[product as Product,...prev]);setCreatorForm(p=>({...p,product_id:String(product.id)}));setProductSearch(product.sku+(product.product_name?" - "+product.product_name:""))}}/></label>
              <label><span>Content Type</span><select value={creatorForm.content_type} onChange={e=>setCreatorForm({...creatorForm,content_type:e.target.value})}>{CONTENT_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
              <label><span>Due Date</span><input type="date" value={creatorForm.due_date} onChange={e=>setCreatorForm({...creatorForm,due_date:e.target.value})}/></label>
              <label><span>Deliverable Status</span><select value={creatorForm.deliverable_status} onChange={e=>setCreatorForm({...creatorForm,deliverable_status:e.target.value})}>{DELIVERABLES.map(x=><option key={x}>{x}</option>)}</select></label>
              <label><span>Sample Status</span><select value={creatorForm.sample_status} onChange={e=>setCreatorForm({...creatorForm,sample_status:e.target.value})}>{SAMPLE_STATUSES.map(x=><option key={x}>{x}</option>)}</select></label>
              <label><span>Shipping</span><select value={creatorForm.shipping_order_id} onChange={e=>setCreatorForm({...creatorForm,shipping_order_id:e.target.value})}><option value="">Tidak terhubung</option>{shipping.map(x=><option key={x.id} value={x.id}>{x.reference_no||x.tracking||("Shipping #"+x.id)} · {x.creator_name||"-"} · {x.status||"-"}</option>)}</select></label>
              <label><span>Orders</span><input type="number" min="0" value={creatorForm.orders} onChange={e=>setCreatorForm({...creatorForm,orders:e.target.value})}/></label>
              <label><span>GMV</span><input type="number" min="0" value={creatorForm.gmv} onChange={e=>setCreatorForm({...creatorForm,gmv:e.target.value})}/></label>
              <label><span>Commission</span><input type="number" min="0" value={creatorForm.commission} onChange={e=>setCreatorForm({...creatorForm,commission:e.target.value})}/></label>
              <label className="wide"><span>Notes</span><textarea rows={3} value={creatorForm.notes} onChange={e=>setCreatorForm({...creatorForm,notes:e.target.value})}/></label>
            </div>
            <div className="campaign-v1-editor-actions"><button className="secondary" onClick={()=>setShowCreatorForm(false)}>Batal</button><button className="primary" disabled={saving} onClick={()=>void saveCreator()}>{saving?"Menyimpan...":"Simpan Creator"}</button></div>
          </section>}

          {creatorRows.length===0?<div className="campaign-v1-empty compact"><b>Belum ada creator di campaign ini.</b><span>Tambahkan creator untuk mulai memantau deliverable dan performa.</span></div>:<div className="campaign-v1-table-wrap"><table className="campaign-v1-table">
            <thead><tr><th>Creator</th><th>Content</th><th>Due Date</th><th>Deliverable</th><th>Sample / Shipping</th><th>Orders</th><th>GMV</th><th>Commission</th><th>Action</th></tr></thead>
            <tbody>{creatorRows.map(row=><tr key={row.id}>
              <td><b>{row.creator_name||"Creator"}</b><small>{row.platform||"-"}{row.sku?" · "+row.sku:""}</small></td>
              <td>{row.content_type||"-"}</td><td>{dateLabel(row.due_date)}</td>
              <td><select className={"campaign-v1-deliverable-select "+deliverableTone(row.deliverable_status)} value={row.deliverable_status} onChange={e=>void quickDeliverable(row,e.target.value)}>{DELIVERABLES.map(x=><option key={x}>{x}</option>)}</select></td>
              <td><b>{row.sample_status||"-"}</b><small>{row.shipping_order_id?"Shipping #"+row.shipping_order_id:"Belum terhubung"}</small></td>
              <td>{number(row.orders)}</td><td>{money(row.gmv)}</td><td>{money(row.commission)}</td>
              <td><div className="campaign-v1-row-actions"><button onClick={()=>openCreatorEdit(row)}>Edit</button><button className="danger" onClick={()=>void removeCreator(row)}>Hapus</button></div></td>
            </tr>)}</tbody>
          </table></div>}
        </>}
      </section>
    </div>
  </section>;
}
