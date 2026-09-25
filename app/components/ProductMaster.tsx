"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Product = {
  id: number;
  workspace_id: string;
  sku: string;
  sku_normalized: string;
  product_name: string | null;
  category: string | null;
  selling_price: number | null;
  cost_price: number | null;
  point_per_unit: number | null;
  status: string | null;
  notes: string | null;
};

type PlatformItem = {
  id: number;
  product_master_id: number;
  sku: string;
  platform: string;
  product_code: string;
  product_name: string | null;
  category: string | null;
  variant_slot: number | null;
  variant_name: string | null;
};

type ProductVariant = {
  id: number;
  product_master_id: number;
  sku: string;
  slot: number;
  variant_name: string;
  hpp: number | null;
  selling_price: number | null;
};

type ProductForm = {
  sku: string;
  product_name: string;
  category: string;
  selling_price: string;
  cost_price: string;
  point_per_unit: string;
  status: string;
  notes: string;
};

const EMPTY_FORM: ProductForm = {
  sku: "",
  product_name: "",
  category: "",
  selling_price: "",
  cost_price: "",
  point_per_unit: "",
  status: "Active",
  notes: "",
};

type ProductMasterProps = {
  workspaceId: string;
};

export default function ProductMaster({
  workspaceId,
}: ProductMasterProps) {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [platformItems, setPlatformItems] = useState<PlatformItem[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);

  async function loadProducts() {
    setLoading(true);
    setError("");

    const [productsResult, platformResult, variantsResult] = await Promise.all([
      supabase
        .from("product_master")
        .select("id,workspace_id,sku,sku_normalized,product_name,category,selling_price,cost_price,point_per_unit,status,notes")
        .eq("workspace_id", workspaceId)
        .order("sku", { ascending: true }),
      supabase
        .from("product_platform_items")
        .select("id,product_master_id,sku,platform,product_code,product_name,category,variant_slot,variant_name")
        .eq("workspace_id", workspaceId)
        .order("platform", { ascending: true })
        .order("product_code", { ascending: true }),
      supabase
        .from("product_variants")
        .select("id,product_master_id,sku,slot,variant_name,hpp,selling_price")
        .eq("workspace_id", workspaceId)
        .order("slot", { ascending: true }),
    ]);

    const firstError = productsResult.error || platformResult.error || variantsResult.error;
    if (firstError) {
      setError(firstError.message);
      setProducts([]);
      setPlatformItems([]);
      setVariants([]);
    } else {
      setProducts((productsResult.data ?? []) as Product[]);
      setPlatformItems((platformResult.data ?? []) as PlatformItem[]);
      setVariants((variantsResult.data ?? []) as ProductVariant[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadProducts();
  }, [workspaceId]);

  useEffect(() => {
    const refresh = () => { void loadProducts(); };
    window.addEventListener("lumaway-database-updated", refresh as EventListener);
    return () => window.removeEventListener("lumaway-database-updated", refresh as EventListener);
  }, [workspaceId]);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(product: Product) {
    setEditingId(product.id);

    setForm({
      sku: product.sku ?? "",
      product_name: product.product_name ?? "",
      category: product.category ?? "",
      selling_price:
        product.selling_price !== null
          ? String(product.selling_price)
          : "",
      cost_price:
        product.cost_price !== null
          ? String(product.cost_price)
          : "",
      point_per_unit:
        product.point_per_unit !== null
          ? String(product.point_per_unit)
          : "",
      status: product.status ?? "Active",
      notes: product.notes ?? "",
    });

    setError("");
    setShowForm(true);
  }

  function updateField(
    field: keyof ProductForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveProduct() {
    if (!form.sku.trim()) {
      setError("SKU wajib diisi.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      workspace_id: workspaceId,
      sku: form.sku.trim(),
      sku_normalized: form.sku.trim().toLowerCase(),
      product_name: form.product_name.trim() || null,
      category: form.category.trim() || null,
      selling_price: form.selling_price
        ? Number(form.selling_price)
        : 0,
      cost_price: form.cost_price
        ? Number(form.cost_price)
        : 0,
      point_per_unit: form.point_per_unit
        ? Number(form.point_per_unit)
        : 0,
      status: form.status || "Active",
      notes: form.notes.trim() || null,
    };

    let result;

    if (editingId !== null) {
      const original = products.find((product) => product.id === editingId);
      result = await supabase
        .from("product_master")
        .update(payload)
        .eq("id", editingId)
        .eq("workspace_id", workspaceId);

      if (!result.error && original && original.sku_normalized !== payload.sku_normalized) {
        const oldSku = original.sku;
        await Promise.all([
          supabase.from("product_platform_items").update({ sku: payload.sku }).eq("workspace_id", workspaceId).eq("product_master_id", editingId),
          supabase.from("product_variants").update({ sku: payload.sku }).eq("workspace_id", workspaceId).eq("product_master_id", editingId),
          supabase.from("product_hpp_history").update({ sku: payload.sku }).eq("workspace_id", workspaceId).eq("product_master_id", editingId),
          supabase.from("sales").update({ sku: payload.sku }).eq("workspace_id", workspaceId).eq("sku", oldSku),
        ]);
      }
    } else {
      result = await supabase
        .from("product_master")
        .insert(payload);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);

    await loadProducts();
  }

  async function deleteProduct(id: number) {
    const confirmed = window.confirm(
      "Hapus produk ini dari Product Master?"
    );

    if (!confirmed) return;

    setError("");

    const { error } = await supabase
      .from("product_master")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) {
      setError(error.message);
      return;
    }

    await loadProducts();
  }

  const mappingsByProduct = useMemo(() => {
    const map = new Map<number, PlatformItem[]>();
    for (const item of platformItems) {
      const list = map.get(item.product_master_id) || [];
      list.push(item);
      map.set(item.product_master_id, list);
    }
    return map;
  }, [platformItems]);

  const variantsByProduct = useMemo(() => {
    const map = new Map<number, ProductVariant[]>();
    for (const variant of variants) {
      const list = map.get(variant.product_master_id) || [];
      list.push(variant);
      map.set(variant.product_master_id, list);
    }
    return map;
  }, [variants]);

  const marketplaceCategories = useMemo(() => {
    return [...new Set(platformItems.map(item=>String(item.category||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id"));
  }, [platformItems]);

  const filteredProducts = products.filter((product) => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return true;

    return (
      product.sku?.toLowerCase().includes(keyword) ||
      product.product_name?.toLowerCase().includes(keyword) ||
      product.category?.toLowerCase().includes(keyword) ||
      (mappingsByProduct.get(product.id) || []).some((item) =>
        [item.platform, item.product_code, item.variant_name].filter(Boolean).some((value) =>
          String(value).toLowerCase().includes(keyword)
        )
      ) ||
      (variantsByProduct.get(product.id) || []).some((variant) =>
        variant.variant_name.toLowerCase().includes(keyword)
      )
    );
  });

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return "-";

    return new Intl.NumberFormat("id-ID").format(Number(value));
  };

  function closeForm(){
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  function renderProductEditor(mode:"add"|"edit"){
    return <div style={{
      padding:18,border:"1px solid #cfd5df",borderRadius:10,background:"#f8fafc",
      boxShadow:"0 8px 24px rgba(15,23,42,.06)"
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:14}}>
        <div>
          <h3 style={{margin:0}}>{mode==="edit"?"Edit Product":"Tambah Product"}</h3>
          <small style={{color:"#667085"}}>{mode==="edit"?"Form berada tepat di bawah produk yang sedang diedit.":"Tambahkan SKU induk baru. Product ID marketplace tetap terhubung terpisah per platform."}</small>
        </div>
        <button type="button" aria-label="Tutup" onClick={closeForm} style={{width:34,height:34,borderRadius:"50%"}}>×</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
        <label style={{display:"grid",gap:6}}><span>SKU Produk / SKU Induk *</span><input placeholder="Contoh: GRS-01" value={form.sku} onChange={(e)=>updateField("sku",e.target.value)}/></label>
        <label style={{display:"grid",gap:6}}><span>Nama Produk</span><input placeholder="Nama produk yang mudah dikenali" value={form.product_name} onChange={(e)=>updateField("product_name",e.target.value)}/></label>
        <label style={{display:"grid",gap:6}}><span>Kategori Marketplace</span><input list="product-category-options" placeholder="Contoh: Peralatan Dapur" value={form.category} onChange={(e)=>updateField("category",e.target.value)}/><datalist id="product-category-options">{marketplaceCategories.map(category=><option key={category} value={category}/>)}</datalist></label>
        <label style={{display:"grid",gap:6}}><span>Selling Price</span><input type="number" min="0" placeholder="Harga jual produk" value={form.selling_price} onChange={(e)=>updateField("selling_price",e.target.value)}/></label>
        <label style={{display:"grid",gap:6}}><span>HPP / Cost Price</span><input type="number" min="0" placeholder="Harga pokok produk" value={form.cost_price} onChange={(e)=>updateField("cost_price",e.target.value)}/></label>
        <label style={{display:"grid",gap:6}}><span>Point per Unit</span><input type="number" min="0" placeholder="Point per produk terjual" value={form.point_per_unit} onChange={(e)=>updateField("point_per_unit",e.target.value)}/></label>
        <label style={{display:"grid",gap:6}}><span>Status</span><select value={form.status} onChange={(e)=>updateField("status",e.target.value)}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></label>
        <label style={{display:"grid",gap:6}}><span>Catatan</span><input placeholder="Catatan internal produk (opsional)" value={form.notes} onChange={(e)=>updateField("notes",e.target.value)}/></label>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
        <button type="button" onClick={closeForm}>Batal</button>
        <button type="button" className="primary" onClick={saveProduct} disabled={saving}>{saving?"Menyimpan...":"Simpan"}</button>
      </div>
    </div>;
  }

  return (
    <section
      style={{
        marginTop: 30,
        padding: 20,
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 15,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
            }}
          >
            Product Master
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#777",
              fontSize: 13,
            }}
          >
            Master produk dikelompokkan berdasarkan SKU induk. Satu SKU dapat memiliki banyak kode produk Shopee/TikTok dan variasi.
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          style={{
            padding: "10px 16px",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            background: "#111827",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          + Tambah Produk
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <input
          type="text"
          placeholder="Cari SKU, nama produk, kategori, kode Shopee/TikTok, atau variasi..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
          }}
        />
      </div>

      {error && (
        <div
          style={{
            marginTop: 15,
            padding: 12,
            border: "1px solid #ef4444",
            borderRadius: 6,
            color: "#b91c1c",
            background: "#fef2f2",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {showForm&&editingId===null&&<div style={{marginTop:16}}>{renderProductEditor("add")}</div>}

      <div
        style={{
          marginTop: 20,
          overflowX: "auto",
        }}
      >
        {loading ? (
          <p>Memuat Product Master...</p>
        ) : filteredProducts.length === 0 ? (
          <div
            style={{
              padding: 30,
              textAlign: "center",
              color: "#777",
              border: "1px dashed #d1d5db",
              borderRadius: 8,
            }}
          >
            Belum ada Product Master.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                {[
                  "SKU Produk",
                  "Produk",
                  "Shopee",
                  "TikTok",
                  "Variasi",
                  "Kategori",
                  "Selling Price",
                  "HPP",
                  "Point",
                  "Status",
                  "Action",
                ].map((header) => (
                  <th
                    key={header}
                    style={{
                      textAlign: "left",
                      padding: 10,
                      borderBottom:
                        "1px solid #e5e7eb",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product) => (
                <Fragment key={product.id}>
                  <tr>
                    <td style={{ padding: 10 }}>{product.sku}</td>
                    <td style={{ padding: 10 }}>{product.product_name || "-"}</td>
                    <td style={{ padding: 10, minWidth: 180 }}>
                      {(mappingsByProduct.get(product.id) || []).filter((item) => item.platform.toLowerCase() === "shopee").length ? (
                        <div style={{ display: "grid", gap: 5 }}>
                          {(mappingsByProduct.get(product.id) || []).filter((item) => item.platform.toLowerCase() === "shopee").map((item) => (
                            <span key={item.id} style={{ display: "block" }}><b>{item.product_code}</b>{item.variant_name ? <small style={{ display: "block", color: "#667085" }}>{item.variant_name}</small> : null}</span>
                          ))}
                        </div>
                      ) : "-"}
                    </td>
                    <td style={{ padding: 10, minWidth: 180 }}>
                      {(mappingsByProduct.get(product.id) || []).filter((item) => item.platform.toLowerCase() === "tiktok").length ? (
                        <div style={{ display: "grid", gap: 5 }}>
                          {(mappingsByProduct.get(product.id) || []).filter((item) => item.platform.toLowerCase() === "tiktok").map((item) => (
                            <span key={item.id} style={{ display: "block" }}><b>{item.product_code}</b>{item.variant_name ? <small style={{ display: "block", color: "#667085" }}>{item.variant_name}</small> : null}</span>
                          ))}
                        </div>
                      ) : "-"}
                    </td>
                    <td style={{ padding: 10, minWidth: 160 }}>
                      {(variantsByProduct.get(product.id) || []).length ? <div style={{ display: "grid", gap: 4 }}>{(variantsByProduct.get(product.id) || []).map((variant) => <span key={variant.id}>{variant.slot}. {variant.variant_name}</span>)}</div> : "-"}
                    </td>
                    <td style={{ padding: 10, minWidth: 170 }}>
                      {(()=>{
                        const categories=(mappingsByProduct.get(product.id)||[]).filter(item=>item.category).map(item=>({platform:item.platform,category:String(item.category)})).filter((item,index,list)=>list.findIndex(x=>x.platform.toLowerCase()===item.platform.toLowerCase()&&x.category.toLowerCase()===item.category.toLowerCase())===index);
                        return categories.length?<div style={{display:"grid",gap:3}}>{categories.map(item=><small key={item.platform+"|"+item.category}><b>{item.platform}:</b> {item.category}</small>)}</div>:product.category||"-";
                      })()}
                    </td>
                    <td style={{ padding: 10 }}>Rp {formatNumber(product.selling_price)}</td>
                    <td style={{ padding: 10 }}>Rp {formatNumber(product.cost_price)}</td>
                    <td style={{ padding: 10 }}>{formatNumber(product.point_per_unit)}</td>
                    <td style={{ padding: 10 }}>{product.status || "-"}</td>
                    <td style={{ padding: 10 }}>
                      <div style={{display:"flex",gap:6}}>
                        <button type="button" onClick={()=>openEdit(product)}>{editingId===product.id?"Editing":"Edit"}</button>
                        <button type="button" onClick={()=>deleteProduct(product.id)}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                  {showForm&&editingId===product.id&&<tr><td colSpan={11} style={{padding:"8px 10px 18px",background:"#f8fafc"}}>{renderProductEditor("edit")}</td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 12,
          color: "#777",
        }}
      >
        Menampilkan {filteredProducts.length} dari{" "}
        {products.length} produk
      </div>
    </section>
  );
}
