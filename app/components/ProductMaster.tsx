"use client";

import {Fragment,useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

type ViewMode="table"|"grid"|"list";
type Product={
 id:number;workspace_id:string;sku:string;sku_normalized:string;product_name:string|null;category:string|null;
 selling_price:number|null;cost_price:number|null;point_per_unit:number|null;status:string|null;notes:string|null;
 image_url:string|null;image_alt:string|null;gallery_images:any[];
};
type PlatformItem={id:number;product_master_id:number;sku:string;platform:string;product_code:string;product_name:string|null;category:string|null;variant_slot:number|null;variant_name:string|null;image_url:string|null};
type ProductVariant={id:number;product_master_id:number;sku:string;slot:number;variant_name:string;hpp:number|null;selling_price:number|null;image_url:string|null};
type ProductForm={sku:string;product_name:string;category:string;selling_price:string;cost_price:string;point_per_unit:string;status:string;notes:string;image_url:string};
const EMPTY_FORM:ProductForm={sku:"",product_name:"",category:"",selling_price:"",cost_price:"",point_per_unit:"",status:"Active",notes:"",image_url:""};

export default function ProductMaster({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [products,setProducts]=useState<Product[]>([]);
 const [platformItems,setPlatformItems]=useState<PlatformItem[]>([]);
 const [variants,setVariants]=useState<ProductVariant[]>([]);
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState("");
 const [search,setSearch]=useState("");const [category,setCategory]=useState("");const [platform,setPlatform]=useState("");const [status,setStatus]=useState("");
 const [view,setView]=useState<ViewMode>("table");const [expanded,setExpanded]=useState<Set<number>>(new Set());
 const [showForm,setShowForm]=useState(false);const [editingId,setEditingId]=useState<number|null>(null);const [form,setForm]=useState<ProductForm>(EMPTY_FORM);

 async function loadProducts(){
  setLoading(true);setError("");
  const [p,m,v]=await Promise.all([
   supabase.from("product_master").select("id,workspace_id,sku,sku_normalized,product_name,category,selling_price,cost_price,point_per_unit,status,notes,image_url,image_alt,gallery_images").eq("workspace_id",workspaceId).order("sku"),
   supabase.from("product_platform_items").select("id,product_master_id,sku,platform,product_code,product_name,category,variant_slot,variant_name,image_url").eq("workspace_id",workspaceId).order("platform").order("product_code"),
   supabase.from("product_variants").select("id,product_master_id,sku,slot,variant_name,hpp,selling_price,image_url").eq("workspace_id",workspaceId).order("slot")
  ]);
  const e=p.error||m.error||v.error;
  if(e){setError(e.message);setProducts([]);setPlatformItems([]);setVariants([])}
  else{setProducts((p.data||[]) as Product[]);setPlatformItems((m.data||[]) as PlatformItem[]);setVariants((v.data||[]) as ProductVariant[])}
  setLoading(false);
 }
 useEffect(()=>{void loadProducts();try{const saved=localStorage.getItem("lumaway_product_master_view") as ViewMode|null;if(saved&&["table","grid","list"].includes(saved))setView(saved)}catch{}},[workspaceId]);
 useEffect(()=>{const fn=()=>void loadProducts();window.addEventListener("lumaway-database-updated",fn);return()=>window.removeEventListener("lumaway-database-updated",fn)},[workspaceId]);

 const mappingsByProduct=useMemo(()=>{const map=new Map<number,PlatformItem[]>();for(const x of platformItems)map.set(x.product_master_id,[...(map.get(x.product_master_id)||[]),x]);return map},[platformItems]);
 const variantsByProduct=useMemo(()=>{const map=new Map<number,ProductVariant[]>();for(const x of variants)map.set(x.product_master_id,[...(map.get(x.product_master_id)||[]),x]);return map},[variants]);
 const categories=useMemo(()=>[...new Set(products.map(x=>String(x.category||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id")),[products]);
 const platforms=useMemo(()=>[...new Set(platformItems.map(x=>String(x.platform||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id")),[platformItems]);
 const format=(v:number|null)=>v==null?"-":new Intl.NumberFormat("id-ID").format(Number(v));
 const productImage=(p:Product)=>{
  if(p.image_url)return p.image_url;
  const mapped=(mappingsByProduct.get(p.id)||[]).find(x=>x.image_url)?.image_url;
  if(mapped)return mapped;
  return (variantsByProduct.get(p.id)||[]).find(x=>x.image_url)?.image_url||"";
 };
 const filtered=useMemo(()=>products.filter(p=>{
  const q=search.trim().toLowerCase();const maps=mappingsByProduct.get(p.id)||[];const vars=variantsByProduct.get(p.id)||[];
  if(category&&p.category!==category)return false;
  if(status&&String(p.status||"").toLowerCase()!==status.toLowerCase())return false;
  if(platform&&!maps.some(x=>x.platform.toLowerCase()===platform.toLowerCase()))return false;
  if(!q)return true;
  return [p.sku,p.product_name,p.category,...maps.flatMap(x=>[x.platform,x.product_code,x.variant_name]),...vars.map(x=>x.variant_name)].filter(Boolean).some(x=>String(x).toLowerCase().includes(q));
 }),[products,search,category,status,platform,mappingsByProduct,variantsByProduct]);

 const stats=useMemo(()=>({
  total:products.length,
  variants:variants.length,
  active:products.filter(x=>String(x.status||"").toLowerCase()==="active").length,
  images:products.filter(x=>Boolean(productImage(x))).length
 }),[products,variants,mappingsByProduct]);

 function setViewMode(next:ViewMode){setView(next);try{localStorage.setItem("lumaway_product_master_view",next)}catch{}}
 function openAdd(){setEditingId(null);setForm(EMPTY_FORM);setShowForm(true);setError("")}
 function openEdit(p:Product){setEditingId(p.id);setForm({sku:p.sku||"",product_name:p.product_name||"",category:p.category||"",selling_price:p.selling_price==null?"":String(p.selling_price),cost_price:p.cost_price==null?"":String(p.cost_price),point_per_unit:p.point_per_unit==null?"":String(p.point_per_unit),status:p.status||"Active",notes:p.notes||"",image_url:p.image_url||""});setShowForm(true);setError("")}
 function closeForm(){setEditingId(null);setShowForm(false);setForm(EMPTY_FORM);setError("")}
 function field(k:keyof ProductForm,v:string){setForm(s=>({...s,[k]:v}))}
 async function saveProduct(){
  if(!form.sku.trim())return setError("SKU wajib diisi.");
  setSaving(true);setError("");
  const payload={workspace_id:workspaceId,sku:form.sku.trim(),sku_normalized:form.sku.trim().toLowerCase(),product_name:form.product_name.trim()||null,category:form.category.trim()||null,selling_price:Number(form.selling_price||0),cost_price:Number(form.cost_price||0),point_per_unit:Number(form.point_per_unit||0),status:form.status||"Active",notes:form.notes.trim()||null,image_url:form.image_url.trim()||null,image_alt:form.product_name.trim()||null};
  const result=editingId?await supabase.from("product_master").update(payload).eq("id",editingId).eq("workspace_id",workspaceId):await supabase.from("product_master").insert(payload);
  if(result.error){setError(result.error.message);setSaving(false);return}
  closeForm();setSaving(false);await loadProducts();
 }
 async function remove(id:number){if(!confirm("Hapus produk ini dari Product Master?"))return;const {error}=await supabase.from("product_master").delete().eq("id",id).eq("workspace_id",workspaceId);if(error)setError(error.message);else await loadProducts()}
 function toggleExpand(id:number){setExpanded(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next})}

 function Editor(){
  return <div className="pm-editor">
   <div className="pm-editor-head"><div><h3>{editingId?"Edit Produk":"Tambah Produk"}</h3><p>Kelola SKU induk, harga, HPP, status, dan gambar utama.</p></div><button onClick={closeForm}>×</button></div>
   <div className="pm-editor-grid">
    <label><span>SKU Induk *</span><input value={form.sku} onChange={e=>field("sku",e.target.value)} placeholder="GRS-01"/></label>
    <label><span>Nama Produk</span><input value={form.product_name} onChange={e=>field("product_name",e.target.value)} placeholder="Nama produk"/></label>
    <label><span>Kategori</span><input value={form.category} onChange={e=>field("category",e.target.value)} placeholder="Peralatan Dapur"/></label>
    <label><span>Gambar Produk</span><input value={form.image_url} onChange={e=>field("image_url",e.target.value)} placeholder="https://..."/></label>
    <label><span>Selling Price</span><input type="number" min="0" value={form.selling_price} onChange={e=>field("selling_price",e.target.value)}/></label>
    <label><span>HPP</span><input type="number" min="0" value={form.cost_price} onChange={e=>field("cost_price",e.target.value)}/></label>
    <label><span>Point</span><input type="number" min="0" value={form.point_per_unit} onChange={e=>field("point_per_unit",e.target.value)}/></label>
    <label><span>Status</span><select value={form.status} onChange={e=>field("status",e.target.value)}><option>Active</option><option>Inactive</option></select></label>
    <label className="pm-span-2"><span>Catatan</span><input value={form.notes} onChange={e=>field("notes",e.target.value)} placeholder="Catatan internal"/></label>
   </div>
   <div className="pm-editor-actions"><button onClick={closeForm}>Batal</button><button className="primary" disabled={saving} onClick={()=>void saveProduct()}>{saving?"Menyimpan...":"Simpan Produk"}</button></div>
  </div>
 }

 function Thumb({p,size="sm"}:{p:Product;size?:"sm"|"lg"}){
  const img=productImage(p);return img?<img className={"pm-thumb "+size} src={img} alt={p.image_alt||p.product_name||p.sku}/>:<div className={"pm-thumb pm-fallback "+size}>{String(p.product_name||p.sku||"P").slice(0,1).toUpperCase()}</div>
 }
 function Meta({p}:{p:Product}){
  const maps=mappingsByProduct.get(p.id)||[];const vars=variantsByProduct.get(p.id)||[];
  return <div className="pm-meta"><span>{maps.length} listing</span><span>{vars.length} variasi</span>{[...new Set(maps.map(x=>x.platform))].map(x=><b key={x}>{x}</b>)}</div>
 }
 function Expanded({p}:{p:Product}){
  const maps=mappingsByProduct.get(p.id)||[];const vars=variantsByProduct.get(p.id)||[];
  return <div className="pm-expanded">
    <section><h4>Listing Marketplace</h4>{maps.length?maps.map(x=><div className="pm-child-row" key={x.id}><span>{x.platform}</span><b>{x.product_code}</b><em>{x.variant_name||"Tanpa variasi"}</em></div>):<p>Belum ada listing marketplace.</p>}</section>
    <section><h4>Variasi Produk</h4>{vars.length?vars.map(x=><div className="pm-child-row" key={x.id}><span>#{x.slot}</span><b>{x.variant_name}</b><em>HPP Rp {format(x.hpp)} · Jual Rp {format(x.selling_price)}</em></div>):<p>Belum ada variasi.</p>}</section>
  </div>
 }

 return <section className="pm-shell">
  <div className="pm-header">
   <div><span className="pm-kicker">MASTER DATA</span><h2>Product Master</h2><p>Kelola SKU induk sebagai katalog visual. Satu SKU dapat terhubung ke banyak listing Shopee/TikTok dan variasi.</p></div>
   <button className="primary pm-add" onClick={openAdd}>+ Tambah Produk</button>
  </div>

  <div className="pm-stats">
   <article><span>Total SKU Induk</span><b>{format(stats.total)}</b></article>
   <article><span>Total Variasi</span><b>{format(stats.variants)}</b></article>
   <article><span>Produk Aktif</span><b>{format(stats.active)}</b></article>
   <article><span>Dengan Gambar</span><b>{format(stats.images)}</b></article>
  </div>

  <div className="pm-toolbar">
   <label className="pm-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari SKU, produk, kategori, kode marketplace, variasi..."/></label>
   <select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Semua kategori</option>{categories.map(x=><option key={x}>{x}</option>)}</select>
   <select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="">Semua platform</option>{platforms.map(x=><option key={x}>{x}</option>)}</select>
   <select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Semua status</option><option>Active</option><option>Inactive</option></select>
   <div className="pm-view-switch" aria-label="Mode tampilan">{(["table","grid","list"] as ViewMode[]).map(x=><button className={view===x?"active":""} key={x} onClick={()=>setViewMode(x)}>{x==="table"?"Tabel":x==="grid"?"Grid":"List"}</button>)}</div>
  </div>

  {error&&<div className="pm-alert">{error}</div>}
  {showForm&&editingId===null&&<Editor/>}

  {loading?<div className="pm-loading">Memuat Product Master...</div>:!filtered.length?<div className="pm-empty"><b>Produk belum ditemukan.</b><span>Ubah filter atau tambahkan SKU induk baru.</span></div>:
   view==="grid"?<div className="pm-grid">{filtered.map(p=><article className="pm-card" key={p.id}><Thumb p={p} size="lg"/><div className="pm-card-body"><div className="pm-card-title"><div><h3>{p.product_name||"Produk tanpa nama"}</h3><span>{p.sku}</span></div><button onClick={()=>openEdit(p)}>•••</button></div><Meta p={p}/><div className="pm-card-price"><span>Jual <b>Rp {format(p.selling_price)}</b></span><span>HPP <b>Rp {format(p.cost_price)}</b></span></div><div className="pm-card-footer"><span className={"pm-status "+(String(p.status).toLowerCase()==="active"?"ok":"off")}>● {p.status||"-"}</span><button onClick={()=>toggleExpand(p.id)}>{expanded.has(p.id)?"Tutup":"Detail"}</button></div>{expanded.has(p.id)&&<Expanded p={p}/>}</div></article>)}</div>:
   view==="list"?<div className="pm-list">{filtered.map(p=><Fragment key={p.id}><div className="pm-list-row"><Thumb p={p}/><div className="pm-list-copy"><h3>{p.product_name||"Produk tanpa nama"}</h3><span>{p.sku} · {p.category||"Tanpa kategori"}</span><Meta p={p}/></div><div className="pm-list-price"><b>Rp {format(p.selling_price)}</b><span>HPP Rp {format(p.cost_price)}</span></div><span className={"pm-status "+(String(p.status).toLowerCase()==="active"?"ok":"off")}>● {p.status||"-"}</span><div className="pm-actions"><button onClick={()=>toggleExpand(p.id)}>Detail</button><button onClick={()=>openEdit(p)}>Edit</button></div></div>{expanded.has(p.id)&&<Expanded p={p}/>}</Fragment>)}</div>:
   <div className="pm-table-wrap"><table className="pm-table"><thead><tr><th>Produk</th><th>SKU Induk</th><th>Kategori</th><th>Platform</th><th>Variasi</th><th>Selling Price</th><th>HPP</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map(p=><Fragment key={p.id}><tr><td><div className="pm-product-cell"><Thumb p={p}/><div><b>{p.product_name||"Produk tanpa nama"}</b><small>{p.notes||"Tidak ada catatan"}</small></div></div></td><td><b>{p.sku}</b></td><td>{p.category||"-"}</td><td><Meta p={p}/></td><td>{(variantsByProduct.get(p.id)||[]).length}</td><td>Rp {format(p.selling_price)}</td><td>Rp {format(p.cost_price)}</td><td><span className={"pm-status "+(String(p.status).toLowerCase()==="active"?"ok":"off")}>● {p.status||"-"}</span></td><td><div className="pm-actions"><button onClick={()=>toggleExpand(p.id)}>Detail</button><button onClick={()=>openEdit(p)}>Edit</button><button className="danger" onClick={()=>void remove(p.id)}>Hapus</button></div></td></tr>{expanded.has(p.id)&&<tr><td colSpan={9}><Expanded p={p}/></td></tr>}{showForm&&editingId===p.id&&<tr><td colSpan={9}><Editor/></td></tr>}</Fragment>)}</tbody></table></div>}
  <div className="pm-count">Menampilkan {filtered.length} dari {products.length} produk</div>
 </section>
}
