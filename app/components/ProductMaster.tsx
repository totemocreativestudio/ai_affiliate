"use client";

import {Fragment,useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

type ViewMode="table"|"grid"|"list";

type Product={
  id:number;
  workspace_id:string;
  sku:string;
  sku_normalized:string;
  product_name:string|null;
  category:string|null;
  selling_price:number|null;
  cost_price:number|null;
  point_per_unit:number|null;
  status:string|null;
  notes:string|null;
  image_url:string|null;
  image_alt:string|null;
  gallery_images:any;
  updated_at:string|null;
};

type PlatformItem={
  id:number;
  product_master_id:number;
  sku:string;
  platform:string;
  product_code:string;
  product_name:string|null;
  category:string|null;
  variant_slot:number|null;
  variant_name:string|null;
  image_url:string|null;
};

type ProductVariant={
  id:number;
  product_master_id:number;
  sku:string;
  slot:number;
  variant_name:string;
  hpp:number|null;
  selling_price:number|null;
  image_url:string|null;
};

type ProductForm={
  sku:string;
  product_name:string;
  category:string;
  selling_price:string;
  cost_price:string;
  point_per_unit:string;
  status:string;
  notes:string;
  image_url:string;
  image_alt:string;
};

const EMPTY_FORM:ProductForm={
  sku:"",product_name:"",category:"",selling_price:"",cost_price:"",point_per_unit:"",
  status:"Active",notes:"",image_url:"",image_alt:""
};

const money=(value:number|null)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(value||0));
const number=(value:number|null)=>new Intl.NumberFormat("id-ID").format(Number(value||0));

function ProductImage({product,size="md"}:{product:Product;size?:"sm"|"md"|"lg"}){
  const label=String(product.product_name||product.sku||"P").trim();
  if(product.image_url)return <img className={"pm72-image pm72-image-"+size} src={product.image_url} alt={product.image_alt||label}/>;
  return <span className={"pm72-image pm72-image-"+size+" pm72-image-fallback"} aria-label={"Belum ada gambar "+label}>{label.slice(0,2).toUpperCase()}</span>;
}

function platformLabel(items:PlatformItem[]){
  return [...new Set(items.map(item=>String(item.platform||"").trim()).filter(Boolean))];
}

export default function ProductMaster({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [products,setProducts]=useState<Product[]>([]);
  const [platformItems,setPlatformItems]=useState<PlatformItem[]>([]);
  const [variants,setVariants]=useState<ProductVariant[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [uploadingImage,setUploadingImage]=useState(false);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [categoryFilter,setCategoryFilter]=useState("");
  const [platformFilter,setPlatformFilter]=useState("");
  const [statusFilter,setStatusFilter]=useState("");
  const [sort,setSort]=useState("name");
  const [view,setView]=useState<ViewMode>("table");
  const [showForm,setShowForm]=useState(false);
  const [editingId,setEditingId]=useState<number|null>(null);
  const [expanded,setExpanded]=useState<Set<number>>(new Set());
  const [form,setForm]=useState<ProductForm>(EMPTY_FORM);

  async function loadProducts(){
    setLoading(true);setError("");
    const [productsResult,platformResult,variantsResult]=await Promise.all([
      supabase.from("product_master").select("id,workspace_id,sku,sku_normalized,product_name,category,selling_price,cost_price,point_per_unit,status,notes,image_url,image_alt,gallery_images,updated_at").eq("workspace_id",workspaceId).order("updated_at",{ascending:false}),
      supabase.from("product_platform_items").select("id,product_master_id,sku,platform,product_code,product_name,category,variant_slot,variant_name,image_url").eq("workspace_id",workspaceId).order("platform",{ascending:true}).order("product_code",{ascending:true}),
      supabase.from("product_variants").select("id,product_master_id,sku,slot,variant_name,hpp,selling_price,image_url").eq("workspace_id",workspaceId).order("slot",{ascending:true})
    ]);
    const firstError=productsResult.error||platformResult.error||variantsResult.error;
    if(firstError){
      setError(firstError.message);setProducts([]);setPlatformItems([]);setVariants([]);
    }else{
      setProducts((productsResult.data||[]) as Product[]);
      setPlatformItems((platformResult.data||[]) as PlatformItem[]);
      setVariants((variantsResult.data||[]) as ProductVariant[]);
    }
    setLoading(false);
  }

  useEffect(()=>{
    const saved=window.localStorage.getItem("lumaway_product_master_view") as ViewMode|null;
    if(saved&&["table","grid","list"].includes(saved))setView(saved);
    void loadProducts();
  },[workspaceId]);

  useEffect(()=>{
    const refresh=()=>void loadProducts();
    window.addEventListener("lumaway-database-updated",refresh as EventListener);
    return()=>window.removeEventListener("lumaway-database-updated",refresh as EventListener);
  },[workspaceId]);

  function changeView(next:ViewMode){
    setView(next);
    try{window.localStorage.setItem("lumaway_product_master_view",next)}catch{}
  }

  const mappingsByProduct=useMemo(()=>{
    const map=new Map<number,PlatformItem[]>();
    for(const item of platformItems){const list=map.get(item.product_master_id)||[];list.push(item);map.set(item.product_master_id,list)}
    return map;
  },[platformItems]);

  const variantsByProduct=useMemo(()=>{
    const map=new Map<number,ProductVariant[]>();
    for(const item of variants){const list=map.get(item.product_master_id)||[];list.push(item);map.set(item.product_master_id,list)}
    return map;
  },[variants]);

  const categories=useMemo(()=>[...new Set([...products.map(x=>String(x.category||"").trim()),...platformItems.map(x=>String(x.category||"").trim())].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id")),[products,platformItems]);
  const platforms=useMemo(()=>[...new Set(platformItems.map(x=>String(x.platform||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id")),[platformItems]);

  const filteredProducts=useMemo(()=>{
    const keyword=search.trim().toLowerCase();
    const rows=products.filter(product=>{
      const mappings=mappingsByProduct.get(product.id)||[];
      const productVariants=variantsByProduct.get(product.id)||[];
      const matchesSearch=!keyword||
        product.sku.toLowerCase().includes(keyword)||
        String(product.product_name||"").toLowerCase().includes(keyword)||
        String(product.category||"").toLowerCase().includes(keyword)||
        mappings.some(item=>[item.platform,item.product_code,item.product_name,item.variant_name].some(value=>String(value||"").toLowerCase().includes(keyword)))||
        productVariants.some(item=>item.variant_name.toLowerCase().includes(keyword));
      const matchesCategory=!categoryFilter||String(product.category||"").toLowerCase()===categoryFilter.toLowerCase()||mappings.some(item=>String(item.category||"").toLowerCase()===categoryFilter.toLowerCase());
      const matchesPlatform=!platformFilter||mappings.some(item=>String(item.platform||"").toLowerCase()===platformFilter.toLowerCase());
      const matchesStatus=!statusFilter||String(product.status||"").toLowerCase()===statusFilter.toLowerCase();
      return matchesSearch&&matchesCategory&&matchesPlatform&&matchesStatus;
    });
    return [...rows].sort((a,b)=>{
      if(sort==="sku")return a.sku.localeCompare(b.sku,"id",{numeric:true});
      if(sort==="price-desc")return Number(b.selling_price||0)-Number(a.selling_price||0);
      if(sort==="price-asc")return Number(a.selling_price||0)-Number(b.selling_price||0);
      if(sort==="hpp-desc")return Number(b.cost_price||0)-Number(a.cost_price||0);
      if(sort==="updated")return new Date(b.updated_at||0).getTime()-new Date(a.updated_at||0).getTime();
      return String(a.product_name||a.sku).localeCompare(String(b.product_name||b.sku),"id",{numeric:true,sensitivity:"base"});
    });
  },[products,mappingsByProduct,variantsByProduct,search,categoryFilter,platformFilter,statusFilter,sort]);

  const stats=useMemo(()=>({
    total:products.length,
    active:products.filter(x=>String(x.status||"").toLowerCase()==="active").length,
    withImage:products.filter(x=>Boolean(x.image_url)).length,
    variants:variants.length
  }),[products,variants]);

  function openAdd(){setEditingId(null);setForm(EMPTY_FORM);setError("");setShowForm(true)}
  function openEdit(product:Product){
    setEditingId(product.id);setError("");setShowForm(true);
    setForm({
      sku:product.sku||"",product_name:product.product_name||"",category:product.category||"",
      selling_price:product.selling_price==null?"":String(product.selling_price),
      cost_price:product.cost_price==null?"":String(product.cost_price),
      point_per_unit:product.point_per_unit==null?"":String(product.point_per_unit),
      status:product.status||"Active",notes:product.notes||"",image_url:product.image_url||"",image_alt:product.image_alt||""
    });
  }
  function closeForm(){setShowForm(false);setEditingId(null);setForm(EMPTY_FORM);setError("")}
  function updateField(field:keyof ProductForm,value:string){setForm(current=>({...current,[field]:value}))}

  async function uploadImage(file:File){
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))return setError("Gunakan gambar JPG, PNG, atau WebP.");
    if(file.size>5*1024*1024)return setError("Ukuran gambar maksimal 5 MB.");
    setUploadingImage(true);setError("");
    try{
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
      const safe=String(form.sku||editingId||"draft").replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,60);
      const path=`${workspaceId}/${editingId||"draft"}/${safe}-${Date.now()}.${ext}`;
      const {error:uploadError}=await supabase.storage.from("luma-products").upload(path,file,{cacheControl:"3600",upsert:true,contentType:file.type});
      if(uploadError)throw uploadError;
      const {data}=supabase.storage.from("luma-products").getPublicUrl(path);
      setForm(current=>({...current,image_url:data.publicUrl,image_alt:current.image_alt||current.product_name||current.sku}));
    }catch(e:any){setError(e?.message||"Gambar produk belum dapat diupload.");}
    finally{setUploadingImage(false)}
  }

  async function saveProduct(){
    if(!form.sku.trim())return setError("SKU Produk / SKU Induk wajib diisi.");
    setSaving(true);setError("");
    const payload={
      workspace_id:workspaceId,
      sku:form.sku.trim(),
      sku_normalized:form.sku.trim().toLowerCase(),
      product_name:form.product_name.trim()||null,
      category:form.category.trim()||null,
      selling_price:form.selling_price?Number(form.selling_price):0,
      cost_price:form.cost_price?Number(form.cost_price):0,
      point_per_unit:form.point_per_unit?Number(form.point_per_unit):0,
      status:form.status||"Active",
      notes:form.notes.trim()||null,
      image_url:form.image_url.trim()||null,
      image_alt:form.image_alt.trim()||form.product_name.trim()||form.sku.trim(),
      updated_at:new Date().toISOString()
    };
    let result:any;
    if(editingId!==null){
      const original=products.find(x=>x.id===editingId);
      result=await supabase.from("product_master").update(payload).eq("id",editingId).eq("workspace_id",workspaceId);
      if(!result.error&&original&&original.sku_normalized!==payload.sku_normalized){
        const oldSku=original.sku;
        await Promise.all([
          supabase.from("product_platform_items").update({sku:payload.sku}).eq("workspace_id",workspaceId).eq("product_master_id",editingId),
          supabase.from("product_variants").update({sku:payload.sku}).eq("workspace_id",workspaceId).eq("product_master_id",editingId),
          supabase.from("product_hpp_history").update({sku:payload.sku}).eq("workspace_id",workspaceId).eq("product_master_id",editingId),
          supabase.from("sales").update({sku:payload.sku}).eq("workspace_id",workspaceId).eq("sku",oldSku)
        ]);
      }
    }else result=await supabase.from("product_master").insert(payload);
    if(result.error){setError(result.error.message);setSaving(false);return}
    setSaving(false);closeForm();await loadProducts();
  }

  async function deleteProduct(id:number){
    if(!window.confirm("Hapus produk ini dari Product Master? Mapping variasi dan marketplace yang terkait juga dapat terdampak."))return;
    const {error}=await supabase.from("product_master").delete().eq("id",id).eq("workspace_id",workspaceId);
    if(error)return setError(error.message);
    await loadProducts();
  }

  function toggleExpanded(id:number){
    setExpanded(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next});
  }

  function renderPlatforms(product:Product){
    const labels=platformLabel(mappingsByProduct.get(product.id)||[]);
    return labels.length?<div className="pm72-platforms">{labels.map(label=><span key={label}>{label}</span>)}</div>:<span className="pm72-muted">Belum dipetakan</span>;
  }

  function renderEditor(){
    return <section className="pm72-editor">
      <div className="pm72-editor-head"><div><h3>{editingId===null?"Tambah Produk":"Edit Produk"}</h3><p>Form tampil di konteks produk, bukan popup tengah layar.</p></div><button type="button" onClick={closeForm} aria-label="Tutup editor">×</button></div>
      <div className="pm72-editor-grid">
        <div className="pm72-image-editor">
          <div className="pm72-upload-preview">
            {form.image_url?<img src={form.image_url} alt={form.image_alt||form.product_name||"Preview produk"}/>:<span>{String(form.product_name||form.sku||"IMG").slice(0,2).toUpperCase()}</span>}
          </div>
          <label className="pm72-upload-button">{uploadingImage?"Mengupload...":"Upload Gambar"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingImage} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadImage(file);e.currentTarget.value=""}}/></label>
          <small>JPG, PNG, WebP · maksimal 5 MB</small>
          <label>URL gambar<input value={form.image_url} onChange={e=>updateField("image_url",e.target.value)} placeholder="https://..."/></label>
          <label>Alt text<input value={form.image_alt} onChange={e=>updateField("image_alt",e.target.value)} placeholder="Deskripsi singkat gambar"/></label>
        </div>
        <div className="pm72-fields">
          <label>SKU Produk / SKU Induk *<input value={form.sku} onChange={e=>updateField("sku",e.target.value)} placeholder="Contoh: GRS-01"/></label>
          <label>Nama Produk<input value={form.product_name} onChange={e=>updateField("product_name",e.target.value)} placeholder="Nama produk yang mudah dikenali"/></label>
          <label>Kategori<input list="pm72-categories" value={form.category} onChange={e=>updateField("category",e.target.value)} placeholder="Contoh: Peralatan Dapur"/><datalist id="pm72-categories">{categories.map(x=><option key={x} value={x}/>)}</datalist></label>
          <label>Selling Price<input type="number" min="0" value={form.selling_price} onChange={e=>updateField("selling_price",e.target.value)} placeholder="0"/></label>
          <label>HPP / Cost Price<input type="number" min="0" value={form.cost_price} onChange={e=>updateField("cost_price",e.target.value)} placeholder="0"/></label>
          <label>Point per Unit<input type="number" min="0" value={form.point_per_unit} onChange={e=>updateField("point_per_unit",e.target.value)} placeholder="0"/></label>
          <label>Status<select value={form.status} onChange={e=>updateField("status",e.target.value)}><option>Active</option><option>Inactive</option></select></label>
          <label className="wide">Catatan<input value={form.notes} onChange={e=>updateField("notes",e.target.value)} placeholder="Catatan internal produk"/></label>
        </div>
      </div>
      <div className="pm72-editor-actions"><button type="button" className="secondary" onClick={closeForm}>Batal</button><button type="button" className="primary" disabled={saving||uploadingImage} onClick={()=>void saveProduct()}>{saving?"Menyimpan...":"Simpan Produk"}</button></div>
    </section>;
  }

  function renderDetail(product:Product){
    const mappings=mappingsByProduct.get(product.id)||[];
    const productVariants=variantsByProduct.get(product.id)||[];
    return <div className="pm72-detail">
      <div><h4>Variasi</h4>{productVariants.length?<div className="pm72-detail-list">{productVariants.map(v=><div key={v.id}><span>{v.image_url?<img src={v.image_url} alt=""/>:<i/>}<b>{v.slot}. {v.variant_name}</b></span><small>{money(v.selling_price)} · HPP {money(v.hpp)}</small></div>)}</div>:<p>Belum ada variasi.</p>}</div>
      <div><h4>Mapping Marketplace</h4>{mappings.length?<div className="pm72-detail-list">{mappings.map(item=><div key={item.id}><span>{item.image_url?<img src={item.image_url} alt=""/>:<i/>}<b>{item.platform}</b> · {item.product_code}</span><small>{item.variant_name||item.product_name||"Tanpa variasi"}</small></div>)}</div>:<p>Belum ada kode produk Shopee/TikTok.</p>}</div>
    </div>;
  }

  const activeFilters=[categoryFilter,platformFilter,statusFilter].filter(Boolean).length;

  return <section className="pm72">
    <header className="pm72-head">
      <div><span className="pm72-kicker">MASTER DATA · VISUAL CATALOG</span><h2>Product Master</h2><p>Kelola SKU induk, gambar, variasi, kode marketplace, harga, HPP, dan status dalam tampilan yang lebih mudah dibedakan.</p></div>
      <div className="pm72-head-actions"><button type="button" className="secondary" onClick={()=>window.dispatchEvent(new CustomEvent("lumaway-routechange",{detail:{section:"upload"}}))}>Import</button><button type="button" className="primary" onClick={openAdd}>+ Tambah Produk</button></div>
    </header>

    <div className="pm72-stats">
      <div><span>Total SKU Induk</span><b>{number(stats.total)}</b></div>
      <div><span>Produk Active</span><b>{number(stats.active)}</b></div>
      <div><span>Dengan Gambar</span><b>{number(stats.withImage)}</b></div>
      <div><span>Total Variasi</span><b>{number(stats.variants)}</b></div>
    </div>

    <div className="pm72-toolbar">
      <label className="pm72-search"><span aria-hidden="true">⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari SKU, nama produk, kode Shopee/TikTok, kategori, atau variasi..."/></label>
      <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} aria-label="Filter kategori"><option value="">Semua kategori</option>{categories.map(x=><option key={x}>{x}</option>)}</select>
      <select value={platformFilter} onChange={e=>setPlatformFilter(e.target.value)} aria-label="Filter platform"><option value="">Semua platform</option>{platforms.map(x=><option key={x}>{x}</option>)}</select>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} aria-label="Filter status"><option value="">Semua status</option><option>Active</option><option>Inactive</option></select>
      <select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Urutkan produk"><option value="name">Nama A–Z</option><option value="sku">SKU</option><option value="updated">Terakhir diperbarui</option><option value="price-desc">Harga tertinggi</option><option value="price-asc">Harga terendah</option><option value="hpp-desc">HPP tertinggi</option></select>
      <div className="pm72-view-switch" aria-label="Mode tampilan"><button type="button" className={view==="table"?"active":""} onClick={()=>changeView("table")}>Table</button><button type="button" className={view==="grid"?"active":""} onClick={()=>changeView("grid")}>Grid</button><button type="button" className={view==="list"?"active":""} onClick={()=>changeView("list")}>List</button></div>
    </div>

    {activeFilters>0&&<div className="pm72-filter-info"><span>{activeFilters} filter aktif</span><button type="button" onClick={()=>{setCategoryFilter("");setPlatformFilter("");setStatusFilter("")}}>Reset filter</button></div>}
    {error&&<div className="pm72-alert">{error}</div>}
    {showForm&&editingId===null&&renderEditor()}

    {loading?<div className="pm72-loading">{Array.from({length:6}).map((_,i)=><i key={i}/>)}</div>:filteredProducts.length===0?<div className="pm72-empty"><strong>Produk tidak ditemukan.</strong><span>Coba ubah pencarian/filter atau tambahkan SKU induk baru.</span><button type="button" onClick={openAdd}>+ Tambah Produk</button></div>:<>
      {view==="table"&&<div className="pm72-table-wrap"><table className="pm72-table"><thead><tr><th>Produk</th><th>SKU</th><th>Kategori</th><th>Platform</th><th>Variasi</th><th>Selling Price</th><th>HPP</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {filteredProducts.map(product=><Fragment key={product.id}>
          <tr>
            <td><div className="pm72-product-cell"><ProductImage product={product} size="sm"/><div><b title={product.product_name||product.sku}>{product.product_name||"Produk tanpa nama"}</b><small>{product.image_url?"Gambar tersedia":"Belum ada gambar"}</small></div></div></td>
            <td><code>{product.sku}</code></td>
            <td>{product.category||"-"}</td>
            <td>{renderPlatforms(product)}</td>
            <td><button type="button" className="pm72-link" onClick={()=>toggleExpanded(product.id)}>{number((variantsByProduct.get(product.id)||[]).length)} variasi</button></td>
            <td><b>{money(product.selling_price)}</b></td>
            <td>{money(product.cost_price)}</td>
            <td><span className={"pm72-status "+(String(product.status||"").toLowerCase()==="active"?"active":"inactive")}>{product.status||"-"}</span></td>
            <td><div className="pm72-actions"><button type="button" onClick={()=>toggleExpanded(product.id)}>Detail</button><button type="button" onClick={()=>openEdit(product)}>Edit</button><button type="button" className="danger" onClick={()=>void deleteProduct(product.id)}>Hapus</button></div></td>
          </tr>
          {expanded.has(product.id)&&<tr className="pm72-expanded-row"><td colSpan={9}>{renderDetail(product)}</td></tr>}
          {showForm&&editingId===product.id&&<tr className="pm72-expanded-row"><td colSpan={9}>{renderEditor()}</td></tr>}
        </Fragment>)}
      </tbody></table></div>}

      {view==="grid"&&<div className="pm72-grid">{filteredProducts.map(product=><Fragment key={product.id}><article className="pm72-card">
        <div className="pm72-card-media"><ProductImage product={product} size="lg"/><span className={"pm72-status "+(String(product.status||"").toLowerCase()==="active"?"active":"inactive")}>{product.status||"-"}</span></div>
        <div className="pm72-card-body"><h3 title={product.product_name||product.sku}>{product.product_name||"Produk tanpa nama"}</h3><code>{product.sku}</code><div className="pm72-card-tags">{product.category&&<span>{product.category}</span>}{renderPlatforms(product)}</div><div className="pm72-card-prices"><span><small>Selling Price</small><b>{money(product.selling_price)}</b></span><span><small>HPP</small><b>{money(product.cost_price)}</b></span></div><div className="pm72-card-foot"><button type="button" onClick={()=>toggleExpanded(product.id)}>Detail · {number((variantsByProduct.get(product.id)||[]).length)} variasi</button><button type="button" onClick={()=>openEdit(product)}>Edit</button></div></div>
      </article>{expanded.has(product.id)&&<div className="pm72-grid-span">{renderDetail(product)}</div>}{showForm&&editingId===product.id&&<div className="pm72-grid-span">{renderEditor()}</div>}</Fragment>)}</div>}

      {view==="list"&&<div className="pm72-list">{filteredProducts.map(product=><Fragment key={product.id}><article className="pm72-list-row">
        <ProductImage product={product} size="md"/><div className="pm72-list-main"><h3>{product.product_name||"Produk tanpa nama"}</h3><p><code>{product.sku}</code> · {product.category||"Tanpa kategori"} · {number((variantsByProduct.get(product.id)||[]).length)} variasi</p>{renderPlatforms(product)}</div><div className="pm72-list-price"><small>Selling Price</small><b>{money(product.selling_price)}</b><span>HPP {money(product.cost_price)}</span></div><span className={"pm72-status "+(String(product.status||"").toLowerCase()==="active"?"active":"inactive")}>{product.status||"-"}</span><div className="pm72-actions"><button type="button" onClick={()=>toggleExpanded(product.id)}>Detail</button><button type="button" onClick={()=>openEdit(product)}>Edit</button></div>
      </article>{expanded.has(product.id)&&renderDetail(product)}{showForm&&editingId===product.id&&renderEditor()}</Fragment>)}</div>}
    </>}

    <footer className="pm72-footer"><span>Menampilkan <b>{number(filteredProducts.length)}</b> dari <b>{number(products.length)}</b> produk</span><span>View: {view}</span></footer>
  </section>;
}
