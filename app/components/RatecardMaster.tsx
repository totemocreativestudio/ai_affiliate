
"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {CreatorAutocomplete,CreatorSearchResult,resolveOrCreateCreator} from "./SmartAutocomplete";
import Creator360Modal from "./Creator360Modal";

type Creator={id:number;name:string|null;username:string|null;creator_code:string|null;platform:string|null};
type RatecardRow={
  id:number;creator_id:number|null;platform:string|null;ratecard:number|string;effective_from:string|null;effective_to:string|null;status:string;notes:string|null;creators?:Creator|Creator[]|null;
};
type FormState={creator_id:string;creator_name:string;platform:string;ratecard:string;effective_from:string;effective_to:string;status:string;notes:string};
type ViewMode="table"|"card"|"profile";

const EMPTY_FORM:FormState={creator_id:"",creator_name:"",platform:"",ratecard:"0",effective_from:new Date().toISOString().slice(0,10),effective_to:"",status:"Active",notes:""};
const money=(value:number|string|null|undefined)=>"Rp "+Math.round(Number(value||0)).toLocaleString("id-ID");
const dateLabel=(value:string|null)=>value?new Date(value+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"-";
const creatorLabel=(creator:Creator)=>creator.name||creator.username||creator.creator_code||("Creator #"+creator.id);
const joinedCreator=(row:RatecardRow):Creator|null=>Array.isArray(row.creators)?row.creators[0]||null:row.creators||null;

export default function RatecardMaster({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [rows,setRows]=useState<RatecardRow[]>([]);
  const [creators,setCreators]=useState<Creator[]>([]);
  const [search,setSearch]=useState("");
  const [platformFilter,setPlatformFilter]=useState("");
  const [statusFilter,setStatusFilter]=useState("");
  const [viewMode,setViewMode]=useState<ViewMode>("table");
  const [creatorSearch,setCreatorSearch]=useState("");
  const [manualCreatorConfirmed,setManualCreatorConfirmed]=useState(false);
  const [form,setForm]=useState<FormState>(EMPTY_FORM);
  const [showForm,setShowForm]=useState(false);
  const [editingId,setEditingId]=useState<number|null>(null);
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [creator360Id,setCreator360Id]=useState<number|null>(null);

  async function loadData(){
    setLoading(true);setError("");
    const [ratecardsResult,creatorsResult]=await Promise.all([
      supabase.from("ratecard_master").select("id,creator_id,platform,ratecard,effective_from,effective_to,status,notes,creators(id,name,username,creator_code,platform)").eq("workspace_id",workspaceId).order("effective_from",{ascending:false}).order("id",{ascending:false}).limit(1500),
      supabase.from("creators").select("id,name,username,creator_code,platform").eq("workspace_id",workspaceId).order("id",{ascending:true}).limit(10000)
    ]);
    if(ratecardsResult.error)setError(ratecardsResult.error.message);
    else{
      const data=(ratecardsResult.data||[]) as unknown as RatecardRow[];
      setRows(data);setSelectedId(current=>current&&data.some(row=>row.id===current)?current:data[0]?.id||null);
    }
    if(!creatorsResult.error)setCreators((creatorsResult.data||[]) as Creator[]);
    setLoading(false);
  }

  useEffect(()=>{void loadData()},[workspaceId]);

  const filteredRows=useMemo(()=>rows.filter(row=>{
    const creator=joinedCreator(row),q=search.trim().toLowerCase();
    if(platformFilter&&String(row.platform||"")!==platformFilter)return false;
    if(statusFilter&&String(row.status||"")!==statusFilter)return false;
    if(!q)return true;
    return [creator?.name,creator?.username,creator?.creator_code,row.platform,row.status,row.ratecard,row.effective_from,row.effective_to,row.notes].some(value=>String(value||"").toLowerCase().includes(q));
  }),[rows,search,platformFilter,statusFilter]);

  const selected=rows.find(row=>row.id===selectedId)||null;
  const selectedCreator=selected?joinedCreator(selected):null;
  const selectedHistory=selectedCreator?rows.filter(row=>row.creator_id===selectedCreator.id).sort((a,b)=>String(b.effective_from||"").localeCompare(String(a.effective_from||""))):[];
  const activeRows=rows.filter(row=>row.status==="Active");
  const averageRate=activeRows.length?activeRows.reduce((sum,row)=>sum+Number(row.ratecard||0),0)/activeRows.length:0;
  const platforms=Array.from(new Set(rows.map(row=>row.platform).filter(Boolean) as string[])).sort();

  function chooseCreator(creator:Creator){
    setForm(prev=>({...prev,creator_id:String(creator.id),creator_name:creatorLabel(creator),platform:creator.platform||prev.platform}));
    setCreatorSearch(creatorLabel(creator));setManualCreatorConfirmed(false);
  }

  function openAdd(){
    setEditingId(null);setForm({...EMPTY_FORM,effective_from:new Date().toISOString().slice(0,10)});setCreatorSearch("");setManualCreatorConfirmed(false);setError("");setShowForm(true);
  }

  function openEdit(row:RatecardRow){
    const creator=joinedCreator(row);setEditingId(row.id);
    setForm({creator_id:row.creator_id?.toString()||"",creator_name:creator?creatorLabel(creator):"",platform:row.platform||"",ratecard:String(row.ratecard||0),effective_from:row.effective_from||"",effective_to:row.effective_to||"",status:row.status||"Active",notes:row.notes||""});
    setCreatorSearch(creator?creatorLabel(creator):"");setManualCreatorConfirmed(false);setError("");setShowForm(true);
  }

  async function ensureCreatorId(){
    if(form.creator_id)return Number(form.creator_id);
    const manualName=form.creator_name.trim()||creatorSearch.trim();
    if(!manualName)return null;
    if(!form.platform)throw new Error("Pilih platform terlebih dahulu untuk creator baru.");
    const resolved=await resolveOrCreateCreator(workspaceId,manualName,form.platform);
    if(!resolved)return null;
    const creator=resolved as Creator;setCreators(prev=>prev.some(item=>item.id===creator.id)?prev:[creator,...prev]);chooseCreator(creator);return creator.id;
  }

  async function save(){
    if(!form.platform.trim()){setError("Platform wajib dipilih.");return}
    const ratecardValue=Number(form.ratecard||0);
    if(!Number.isFinite(ratecardValue)||ratecardValue<0){setError("Ratecard harus berupa angka 0 atau lebih.");return}
    setSaving(true);setError("");
    try{
      const creatorId=await ensureCreatorId();if(!creatorId)throw new Error("Creator wajib dipilih atau diketik manual.");
      const payload={workspace_id:workspaceId,creator_id:creatorId,platform:form.platform,ratecard:ratecardValue,effective_from:form.effective_from||null,effective_to:form.effective_to||null,status:form.status||"Active",notes:form.notes.trim()||null,updated_at:new Date().toISOString()};
      const result=editingId
        ?await supabase.from("ratecard_master").update(payload).eq("id",editingId).eq("workspace_id",workspaceId)
        :await supabase.from("ratecard_master").insert(payload).select("id").single();
      if(result.error)throw result.error;
      if(!editingId&&result.data?.id)setSelectedId(Number(result.data.id));
      setShowForm(false);setEditingId(null);await loadData();
    }catch(err){setError(err instanceof Error?err.message:"Gagal menyimpan ratecard.")}finally{setSaving(false)}
  }

  async function remove(id:number){
    if(!window.confirm("Hapus ratecard ini?"))return;
    const result=await supabase.from("ratecard_master").delete().eq("id",id).eq("workspace_id",workspaceId);
    if(result.error)setError(result.error.message);else{if(selectedId===id)setSelectedId(null);await loadData()}
  }

  function rowCard(row:RatecardRow){
    const creator=joinedCreator(row);
    return <button key={row.id} className={"rate-v2-card "+(selectedId===row.id?"selected":"")} onClick={()=>setSelectedId(row.id)}>
      <div className="rate-v2-card-top"><div className="rate-v2-avatar">{String(creator?creatorLabel(creator):"C").slice(0,1).toUpperCase()}</div><div><b>{creator?creatorLabel(creator):"Creator"}</b><small>{row.platform||"-"}</small></div><span className={"rate-v2-status "+(row.status==="Active"?"active":"inactive")}>{row.status}</span></div>
      <strong>{money(row.ratecard)}</strong>
      <p>{dateLabel(row.effective_from)} → {dateLabel(row.effective_to)}</p>
      <footer><span>{row.notes||"Tanpa catatan"}</span><em>Open</em></footer>
    </button>;
  }

  return <section className="rate-v2-page">
    <header className="rate-v2-header"><div><span>CREATOR COMMERCIAL</span><h2>Ratecard Master</h2><p>Kelola rate creator berdasarkan platform dan periode efektif dengan tampilan table, card, atau profile.</p></div><button className="primary" onClick={openAdd}>+ Tambah Ratecard</button></header>

    <div className="rate-v2-stats">
      <article><span>Total Ratecard</span><b>{rows.length.toLocaleString("id-ID")}</b></article>
      <article><span>Active</span><b>{activeRows.length.toLocaleString("id-ID")}</b></article>
      <article><span>Average Active Rate</span><b>{money(averageRate)}</b></article>
      <article><span>Platform</span><b>{platforms.length.toLocaleString("id-ID")}</b></article>
    </div>

    <div className="rate-v2-toolbar">
      <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Cari creator, username, platform, notes..."/>
      <select value={platformFilter} onChange={event=>setPlatformFilter(event.target.value)}><option value="">Semua Platform</option>{platforms.map(platform=><option key={platform}>{platform}</option>)}</select>
      <select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="">Semua Status</option><option>Active</option><option>Inactive</option></select>
      <div className="rate-v2-view-switch"><button className={viewMode==="table"?"active":""} onClick={()=>setViewMode("table")}>Table</button><button className={viewMode==="card"?"active":""} onClick={()=>setViewMode("card")}>Card</button><button className={viewMode==="profile"?"active":""} onClick={()=>setViewMode("profile")}>Profile</button></div>
    </div>

    {error&&<div className="rate-v2-alert">{error}</div>}

    {showForm&&<section className="rate-v2-editor">
      <div className="rate-v2-editor-head"><div><span>{editingId?"EDIT RATECARD":"NEW RATECARD"}</span><h3>{editingId?"Edit Ratecard":"Tambah Ratecard"}</h3></div><button onClick={()=>setShowForm(false)}>×</button></div>
      <div className="rate-v2-form-grid">
        <label><span>Creator</span><CreatorAutocomplete workspaceId={workspaceId} value={creatorSearch} selectedId={form.creator_id} createPlatform={form.platform} placeholder="Ketik username atau nama creator" onTextChange={value=>{setCreatorSearch(value);setManualCreatorConfirmed(false);setForm(prev=>({...prev,creator_id:"",creator_name:value}))}} onSelect={(creator:CreatorSearchResult)=>{const item=creator as Creator;setCreators(prev=>prev.some(x=>x.id===item.id)?prev:[item,...prev]);chooseCreator(item)}} onCreate={value=>{setCreatorSearch(value);setManualCreatorConfirmed(true);setForm(prev=>({...prev,creator_id:"",creator_name:value}))}}/>{manualCreatorConfirmed&&!form.creator_id&&<small>Creator baru akan otomatis dibuat saat ratecard disimpan.</small>}</label>
        <label><span>Platform</span><select value={form.platform} onChange={event=>setForm(prev=>({...prev,platform:event.target.value}))}><option value="">Pilih Platform</option><option>TikTok</option><option>Shopee</option><option>Instagram</option><option>YouTube</option><option>Other</option></select></label>
        <label><span>Ratecard</span><input type="number" min="0" step="1" value={form.ratecard} onChange={event=>setForm(prev=>({...prev,ratecard:event.target.value}))}/></label>
        <label><span>Status</span><select value={form.status} onChange={event=>setForm(prev=>({...prev,status:event.target.value}))}><option>Active</option><option>Inactive</option></select></label>
        <label><span>Effective From</span><input type="date" value={form.effective_from} onChange={event=>setForm(prev=>({...prev,effective_from:event.target.value}))}/></label>
        <label><span>Effective To</span><input type="date" value={form.effective_to} onChange={event=>setForm(prev=>({...prev,effective_to:event.target.value}))}/></label>
        <label className="wide"><span>Notes</span><textarea rows={3} value={form.notes} onChange={event=>setForm(prev=>({...prev,notes:event.target.value}))} placeholder="Catatan negosiasi, paket, atau scope kerja..."/></label>
      </div>
      <div className="rate-v2-editor-actions"><button className="secondary" onClick={()=>setShowForm(false)}>Batal</button><button className="primary" disabled={saving} onClick={()=>void save()}>{saving?"Menyimpan...":"Simpan Ratecard"}</button></div>
    </section>}

    {loading?<div className="rate-v2-empty">Memuat Ratecard Master...</div>:<>
      {viewMode==="table"&&<div className="rate-v2-table-wrap"><table className="rate-v2-table"><thead><tr><th>Creator</th><th>Platform</th><th>Ratecard</th><th>Effective From</th><th>Effective To</th><th>Status</th><th>Notes</th><th>Action</th></tr></thead><tbody>{filteredRows.map(row=>{const creator=joinedCreator(row);return <tr key={row.id} className={selectedId===row.id?"selected":""} onClick={()=>setSelectedId(row.id)}><td><div className="rate-v2-table-creator"><div className="rate-v2-avatar small">{String(creator?creatorLabel(creator):"C").slice(0,1).toUpperCase()}</div><span><b>{creator?creatorLabel(creator):"-"}</b><small>{creator?.creator_code||creator?.username||"-"}</small></span></div></td><td>{row.platform||"-"}</td><td><b>{money(row.ratecard)}</b></td><td>{dateLabel(row.effective_from)}</td><td>{dateLabel(row.effective_to)}</td><td><span className={"rate-v2-status "+(row.status==="Active"?"active":"inactive")}>{row.status}</span></td><td>{row.notes||"-"}</td><td><div className="rate-v2-row-actions"><button onClick={event=>{event.stopPropagation();openEdit(row)}}>Edit</button><button className="danger" onClick={event=>{event.stopPropagation();void remove(row.id)}}>Hapus</button></div></td></tr>})}</tbody></table></div>}

      {viewMode==="card"&&<div className="rate-v2-card-grid">{filteredRows.map(row=>rowCard(row))}</div>}

      {viewMode==="profile"&&<div className="rate-v2-profile-layout">
        <section className="rate-v2-profile-list"><div><h3>Creator Ratecards</h3><p>{filteredRows.length} ratecard</p></div><div>{filteredRows.map(row=>rowCard(row))}</div></section>
        <section className="rate-v2-profile-detail">{selected&&selectedCreator?<><div className="rate-v2-profile-head"><div className="rate-v2-avatar large">{creatorLabel(selectedCreator).slice(0,1).toUpperCase()}</div><div><span>{selected.platform||selectedCreator.platform||"Creator"}</span><h3>{creatorLabel(selectedCreator)}</h3><p>{selectedCreator.username||selectedCreator.creator_code||"-"}</p></div><div className="rate-v2-profile-actions"><button onClick={()=>openEdit(selected)}>Edit</button><button onClick={()=>setCreator360Id(selectedCreator.id)}>Customer 360</button></div></div><div className="rate-v2-profile-current"><span>Current Ratecard</span><b>{money(selected.ratecard)}</b><small>{dateLabel(selected.effective_from)} → {dateLabel(selected.effective_to)} · {selected.status}</small></div><section className="rate-v2-history"><div><h4>Ratecard History</h4><p>Histori ratecard creator berdasarkan periode efektif.</p></div>{selectedHistory.map(row=><button key={row.id} onClick={()=>setSelectedId(row.id)}><span><b>{money(row.ratecard)}</b><small>{dateLabel(row.effective_from)} → {dateLabel(row.effective_to)}</small></span><em className={"rate-v2-status "+(row.status==="Active"?"active":"inactive")}>{row.status}</em></button>)}</section><section className="rate-v2-profile-note"><h4>Notes</h4><p>{selected.notes||"Belum ada catatan untuk ratecard ini."}</p></section></>:<div className="rate-v2-empty detail"><b>Pilih creator ratecard.</b></div>}</section>
      </div>}

      {!filteredRows.length&&<div className="rate-v2-empty"><b>Belum ada ratecard pada filter ini.</b></div>}
    </>}

    {creator360Id&&<Creator360Modal workspaceId={workspaceId} creatorId={creator360Id} startDate={selected?.effective_from||""} endDate={selected?.effective_to||new Date().toISOString().slice(0,10)} onClose={()=>setCreator360Id(null)}/>}
  </section>;
}
