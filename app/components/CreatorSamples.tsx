"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Creator = { id:number; creator_code:string|null; name:string|null; username:string|null; platform:string|null; };
type Product = { id:number; sku:string; product_name:string|null; selling_price:number|null; };
type SampleRow = {
  id:number; creator_id:number|null; creator_name:string|null; platform:string|null;
  product_master_id:number|null; sku:string|null; product_name:string|null;
  sample_status:string|null; sent_date:string|null; return_date:string|null;
  qty:number|null; product_value:number|null; tracking:string|null; notes:string|null; source:string|null;
};
type Props = { workspaceId:string };
type FormState = {
  creator_id:string; creator_name:string; platform:string; product_master_id:string;
  sample_status:string; sent_date:string; return_date:string; qty:string;
  product_value:string; tracking:string; notes:string;
};

const EMPTY_FORM:FormState = {
  creator_id:"", creator_name:"", platform:"", product_master_id:"",
  sample_status:"sent", sent_date:"", return_date:"", qty:"1",
  product_value:"0", tracking:"", notes:""
};

const money = (v:number|null|undefined)=>`Rp ${Number(v||0).toLocaleString("id-ID")}`;

export default function CreatorSamples({workspaceId}:Props){
  const supabase=useMemo(()=>createClient(),[]);
  const [rows,setRows]=useState<SampleRow[]>([]);
  const [creators,setCreators]=useState<Creator[]>([]);
  const [products,setProducts]=useState<Product[]>([]);
  const [form,setForm]=useState<FormState>(EMPTY_FORM);
  const [creatorSearch,setCreatorSearch]=useState("");
  const [productSearch,setProductSearch]=useState("");
  const [manualCreatorConfirmed,setManualCreatorConfirmed]=useState(false);
  const [search,setSearch]=useState("");
  const [editingId,setEditingId]=useState<number|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  async function loadData(){
    if(!workspaceId)return;
    setLoading(true); setError("");
    const [sampleRes,creatorRes,productRes]=await Promise.all([
      supabase.from("creator_samples")
        .select("id,creator_id,creator_name,platform,product_master_id,sku,product_name,sample_status,sent_date,return_date,qty,product_value,tracking,notes,source")
        .eq("workspace_id",workspaceId).order("id",{ascending:false}),
      supabase.from("creators").select("id,creator_code,name,username,platform")
        .eq("workspace_id",workspaceId).order("name").limit(7770),
      supabase.from("product_master").select("id,sku,product_name,selling_price")
        .eq("workspace_id",workspaceId).order("sku").limit(1000),
    ]);
    if(sampleRes.error)setError(sampleRes.error.message); else setRows((sampleRes.data??[]) as SampleRow[]);
    if(!creatorRes.error)setCreators((creatorRes.data??[]) as Creator[]);
    if(!productRes.error)setProducts((productRes.data??[]) as Product[]);
    setLoading(false);
  }

  useEffect(()=>{void loadData();},[workspaceId]);

  const filteredCreators=creators.filter(c=>{
    const q=creatorSearch.trim().toLowerCase();
    if(!q)return true;
    return (c.name??"").toLowerCase().includes(q)||(c.username??"").toLowerCase().includes(q)||(c.creator_code??"").toLowerCase().includes(q);
  }).slice(0,50);

  const filteredProducts=products.filter(p=>{
    const q=productSearch.trim().toLowerCase();
    if(!q)return true;
    return p.sku.toLowerCase().includes(q)||(p.product_name??"").toLowerCase().includes(q);
  }).slice(0,50);

  const visibleRows=rows.filter(r=>{
    const q=search.trim().toLowerCase();
    if(!q)return true;
    return [r.creator_name,r.platform,r.sku,r.product_name,r.sample_status,r.tracking]
      .filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
  });

  function openAdd(){
    setEditingId(null);
    setForm({...EMPTY_FORM,sent_date:new Date().toISOString().slice(0,10)});
    setCreatorSearch(""); setProductSearch(""); setManualCreatorConfirmed(false); setError(""); setShowForm(true);
  }

  function openEdit(r:SampleRow){
    setEditingId(r.id);
    setForm({
      creator_id:r.creator_id?.toString()??"", creator_name:r.creator_name??"", platform:r.platform??"",
      product_master_id:r.product_master_id?.toString()??"", sample_status:r.sample_status??"sent",
      sent_date:r.sent_date??"", return_date:r.return_date??"", qty:String(r.qty??1),
      product_value:String(r.product_value??0), tracking:r.tracking??"", notes:r.notes??""
    });
    setCreatorSearch(r.creator_name??"");
    setProductSearch(r.sku?`${r.sku}${r.product_name?` - ${r.product_name}`:""}`:"");
    setManualCreatorConfirmed(!r.creator_id&&Boolean(r.creator_name));
    setShowForm(true);
  }

  async function save(){
    setSaving(true); setError("");
    const creator=creators.find(c=>c.id===Number(form.creator_id));
    const product=products.find(p=>p.id===Number(form.product_master_id));
    const payload={
      workspace_id:workspaceId,
      creator_id:form.creator_id?Number(form.creator_id):null,
      creator_name:form.creator_name.trim()||creator?.name||creator?.username||creator?.creator_code||null,
      platform:form.platform||creator?.platform||null,
      product_master_id:form.product_master_id?Number(form.product_master_id):null,
      sku:product?.sku??null,
      product_name:product?.product_name??null,
      sample_status:form.sample_status||"sent",
      sent_date:form.sent_date||null,
      return_date:form.return_date||null,
      qty:form.qty?Number(form.qty):1,
      product_value:form.product_value?Number(form.product_value):0,
      tracking:form.tracking.trim()||null,
      notes:form.notes.trim()||null,
      source:"web",
    };
    const result=editingId!==null
      ? await supabase.from("creator_samples").update(payload).eq("id",editingId).eq("workspace_id",workspaceId)
      : await supabase.from("creator_samples").insert(payload);
    setSaving(false);
    if(result.error)return setError(result.error.message);
    setShowForm(false); setEditingId(null); await loadData();
  }

  async function remove(id:number){
    if(!window.confirm("Hapus data sample creator ini?"))return;
    const res=await supabase.from("creator_samples").delete().eq("id",id).eq("workspace_id",workspaceId);
    if(res.error)setError(res.error.message); else await loadData();
  }

  return (
    <section style={{border:"1px solid #d9dee7",borderRadius:10,padding:20,marginTop:24}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:15}}>
        <div>
          <h2 style={{margin:0}}>Creator Samples</h2>
          <p style={{color:"#777",fontSize:13,marginTop:5}}>Tracking produk sample yang dikirim ke creator</p>
        </div>
        <button onClick={openAdd} style={{background:"#111827",color:"#fff",border:0,borderRadius:7,padding:"10px 16px",fontWeight:600}}>+ Tambah Sample</button>
      </div>

      <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Cari creator, SKU, status, tracking..." style={{width:"100%",boxSizing:"border-box",marginTop:14,padding:10}} />
      {error&&<div style={{marginTop:12,padding:10,color:"red",border:"1px solid red",borderRadius:6}}>{error}</div>}

      {showForm&&(
        <div style={{border:"1px solid #d9dee7",borderRadius:8,padding:18,marginTop:16,background:"#fafbfc"}}>
          <h3 style={{marginTop:0}}>{editingId?"Edit Sample":"Tambah Sample"}</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12}}>
            <label>Creator Search
              <input value={creatorSearch}
                onChange={(e)=>{
                  const value=e.target.value; setCreatorSearch(value); setManualCreatorConfirmed(false);
                  setForm(p=>({...p,creator_id:"",creator_name:value}));
                }}
                onKeyDown={(e)=>{
                  if(e.key!=="Enter")return; e.preventDefault();
                  const value=creatorSearch.trim(); if(!value)return;
                  const key=value.toLowerCase();
                  const exact=creators.find(c=>(c.name??"").trim().toLowerCase()===key||(c.username??"").trim().toLowerCase()===key||(c.creator_code??"").trim().toLowerCase()===key);
                  if(exact){
                    const name=exact.name??exact.username??exact.creator_code??value;
                    setForm(p=>({...p,creator_id:String(exact.id),creator_name:name,platform:exact.platform??p.platform}));
                    setCreatorSearch(name); setManualCreatorConfirmed(false);
                  }else{
                    setForm(p=>({...p,creator_id:"",creator_name:value})); setManualCreatorConfirmed(true);
                  }
                }} style={{width:"100%",padding:8}} />
              {creatorSearch.trim()&&!form.creator_id&&filteredCreators.length>0&&!manualCreatorConfirmed&&(
                <select size={Math.min(5,filteredCreators.length)} value="" onChange={(e)=>{
                  const c=creators.find(x=>x.id===Number(e.target.value)); if(!c)return;
                  const name=c.name??c.username??c.creator_code??"";
                  setForm(p=>({...p,creator_id:String(c.id),creator_name:name,platform:c.platform??p.platform}));
                  setCreatorSearch(name);
                }} style={{width:"100%",marginTop:5}}>
                  {filteredCreators.map(c=><option key={c.id} value={c.id}>{c.name??c.username??c.creator_code??"-"}{c.platform?` - ${c.platform}`:""}</option>)}
                </select>
              )}
              {manualCreatorConfirmed&&!form.creator_id&&form.creator_name.trim()&&(
                <div style={{marginTop:6,padding:7,background:"#f9fafb",border:"1px solid #d1d5db",borderRadius:6,fontSize:12}}>
                  Creator baru / pending: <strong>{form.creator_name}</strong>
                </div>
              )}
            </label>

            <label>Platform
              <select value={form.platform} onChange={(e)=>setForm(p=>({...p,platform:e.target.value}))} style={{width:"100%",padding:8}}>
                <option value="">Pilih Platform</option><option value="TikTok">TikTok</option><option value="Shopee">Shopee</option><option value="Instagram">Instagram</option><option value="YouTube">YouTube</option><option value="Other">Other</option>
              </select>
            </label>

            <label>Product / SKU Search
              <input value={productSearch}
                onChange={(e)=>{setProductSearch(e.target.value);setForm(p=>({...p,product_master_id:""}));}}
                onKeyDown={(e)=>{
                  if(e.key!=="Enter")return; e.preventDefault();
                  const p=filteredProducts[0]; if(!p)return;
                  setForm(f=>({...f,product_master_id:String(p.id),product_value:String(p.selling_price??f.product_value)}));
                  setProductSearch(`${p.sku}${p.product_name?` - ${p.product_name}`:""}`);
                }} style={{width:"100%",padding:8}} />
              {productSearch.trim()&&!form.product_master_id&&filteredProducts.length>0&&(
                <div style={{marginTop:5,border:"1px solid #ccc",maxHeight:160,overflowY:"auto",background:"#fff"}}>
                  {filteredProducts.map(p=>(
                    <div key={p.id} onMouseDown={(e)=>{
                      e.preventDefault();
                      setForm(f=>({...f,product_master_id:String(p.id),product_value:String(p.selling_price??f.product_value)}));
                      setProductSearch(`${p.sku}${p.product_name?` - ${p.product_name}`:""}`);
                    }} style={{padding:8,cursor:"pointer",borderBottom:"1px solid #eee"}}>
                      <strong>{p.sku}</strong>{p.product_name?` - ${p.product_name}`:""}
                    </div>
                  ))}
                </div>
              )}
            </label>

            <label>Sample Status
              <select value={form.sample_status} onChange={(e)=>setForm(p=>({...p,sample_status:e.target.value}))} style={{width:"100%",padding:8}}>
                <option value="sent">Sent</option><option value="received">Received</option><option value="content_pending">Content Pending</option><option value="content_done">Content Done</option><option value="returned">Returned</option><option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label>Sent Date<input type="date" value={form.sent_date} onChange={(e)=>setForm(p=>({...p,sent_date:e.target.value}))} style={{width:"100%",padding:8}} /></label>
            <label>Return Date<input type="date" value={form.return_date} onChange={(e)=>setForm(p=>({...p,return_date:e.target.value}))} style={{width:"100%",padding:8}} /></label>
            <label>Qty<input type="number" min="1" value={form.qty} onChange={(e)=>setForm(p=>({...p,qty:e.target.value}))} style={{width:"100%",padding:8}} /></label>
            <label>Product Value<input type="number" min="0" value={form.product_value} onChange={(e)=>setForm(p=>({...p,product_value:e.target.value}))} style={{width:"100%",padding:8}} /></label>
            <label>Tracking<input value={form.tracking} onChange={(e)=>setForm(p=>({...p,tracking:e.target.value}))} placeholder="Nomor resi" style={{width:"100%",padding:8}} /></label>
          </div>

          <label style={{display:"block",marginTop:12}}>Notes
            <textarea value={form.notes} onChange={(e)=>setForm(p=>({...p,notes:e.target.value}))} rows={3} style={{width:"100%",boxSizing:"border-box",padding:8}} />
          </label>

          <div style={{marginTop:15}}>
            <button onClick={save} disabled={saving} style={{background:"#111827",color:"#fff",border:0,borderRadius:7,padding:"10px 18px",marginRight:8}}>{saving?"Menyimpan...":"Simpan"}</button>
            <button onClick={()=>setShowForm(false)} style={{padding:"10px 18px"}}>Batal</button>
          </div>
        </div>
      )}

      {loading?<p>Loading Creator Samples...</p>:visibleRows.length===0?<p style={{color:"#777"}}>Belum ada Creator Samples.</p>:(
        <div style={{overflowX:"auto",marginTop:16}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>{["Creator","Platform","SKU","Product","Status","Sent Date","Return Date","Qty","Value","Tracking","Source","Action"].map(h=><th key={h} style={{textAlign:"left",padding:9,borderBottom:"1px solid #ddd",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>{visibleRows.map(r=>(
              <tr key={r.id}>
                <td style={{padding:9}}>{r.creator_name??"-"}</td><td style={{padding:9}}>{r.platform??"-"}</td><td style={{padding:9}}>{r.sku??"-"}</td><td style={{padding:9}}>{r.product_name??"-"}</td>
                <td style={{padding:9}}>{r.sample_status??"-"}</td><td style={{padding:9}}>{r.sent_date??"-"}</td><td style={{padding:9}}>{r.return_date??"-"}</td><td style={{padding:9}}>{Number(r.qty??0).toLocaleString("id-ID")}</td>
                <td style={{padding:9}}>{money(r.product_value)}</td><td style={{padding:9}}>{r.tracking??"-"}</td><td style={{padding:9}}>{r.source??"-"}</td>
                <td style={{padding:9,whiteSpace:"nowrap"}}><button onClick={()=>openEdit(r)} style={{marginRight:5}}>Edit</button><button onClick={()=>void remove(r.id)}>Hapus</button></td>
              </tr>
            ))}</tbody>
          </table>
          <p style={{color:"#777",fontSize:13}}>Menampilkan {visibleRows.length} dari {rows.length} sample</p>
        </div>
      )}
    </section>
  );
}
