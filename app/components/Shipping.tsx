"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import {CreatorAutocomplete,ProductAutocomplete,CreatorSearchResult,ProductSearchResult} from "./SmartAutocomplete";

type Creator = {
  id: number;
  creator_code: string | null;
  name: string | null;
  username: string | null;
  platform: string | null;
};

type Product = {
  id: number;
  sku: string;
  product_name: string | null;
  cost_price: number | null;
};

type ShippingRow = {
  id: number;
  data_date: string | null;
  creator_id: number | null;
  creator_name: string | null;
  platform: string | null;
  product_master_id: number | null;
  sku: string | null;
  product_name: string | null;
  qty: number | null;
  product_cost: number | null;
  shipping_cost: number | null;
  courier: string | null;
  tracking: string | null;
  status: string | null;
};

type Props = { workspaceId: string };

type FormState = {
  data_date: string;
  creator_id: string;
  creator_name: string;
  platform: string;
  product_master_id: string;
  qty: string;
  product_cost: string;
  shipping_cost: string;
  courier: string;
  tracking: string;
  status: string;
};

const EMPTY_FORM: FormState = {
  data_date: "",
  creator_id: "",
  creator_name: "",
  platform: "",
  product_master_id: "",
  qty: "1",
  product_cost: "0",
  shipping_cost: "0",
  courier: "",
  tracking: "",
  status: "Pending",
};

const money = (v: number | null | undefined) =>
  `Rp ${Number(v || 0).toLocaleString("id-ID")}`;

export default function Shipping({ workspaceId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ShippingRow[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [creatorSearch, setCreatorSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [manualCreatorConfirmed, setManualCreatorConfirmed] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    if (!workspaceId) return;
    setLoading(true);
    setError("");

    const [shipRes, creatorRes, productRes] = await Promise.all([
      supabase.from("shipping")
        .select("id,data_date,creator_id,creator_name,platform,product_master_id,sku,product_name,qty,product_cost,shipping_cost,courier,tracking,status")
        .eq("workspace_id", workspaceId)
        .order("id", { ascending: false }),
      supabase.from("creators")
        .select("id,creator_code,name,username,platform")
        .eq("workspace_id", workspaceId)
        .order("name")
        .limit(7770),
      supabase.from("product_master")
        .select("id,sku,product_name,cost_price")
        .eq("workspace_id", workspaceId)
        .order("sku")
        .limit(1000),
    ]);

    if (shipRes.error) setError(shipRes.error.message);
    else setRows((shipRes.data ?? []) as ShippingRow[]);
    if (!creatorRes.error) setCreators((creatorRes.data ?? []) as Creator[]);
    if (!productRes.error) setProducts((productRes.data ?? []) as Product[]);
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, [workspaceId]);

  const filteredCreators =
    form.creator_id || manualCreatorConfirmed
      ? []
      : creators.filter((c) => {
          const q = creatorSearch.trim().toLowerCase();
          if (!q) return false;

          return (
            (c.name ?? "").toLowerCase().includes(q) ||
            (c.username ?? "").toLowerCase().includes(q) ||
            (c.creator_code ?? "").toLowerCase().includes(q)
          );
        }).slice(0, 50);

  const filteredProducts = products.filter((p) => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return p.sku.toLowerCase().includes(q) ||
      (p.product_name ?? "").toLowerCase().includes(q);
  }).slice(0, 50);

  const visibleRows = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.creator_name,r.platform,r.sku,r.product_name,r.courier,r.tracking,r.status]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, data_date: new Date().toISOString().slice(0, 10) });
    setCreatorSearch("");
    setProductSearch("");
    setManualCreatorConfirmed(false);
    setError("");
    setShowForm(true);
  }

  function openEdit(r: ShippingRow) {
    setEditingId(r.id);
    setForm({
      data_date: r.data_date ?? "",
      creator_id: r.creator_id?.toString() ?? "",
      creator_name: r.creator_name ?? "",
      platform: r.platform ?? "",
      product_master_id: r.product_master_id?.toString() ?? "",
      qty: String(r.qty ?? 1),
      product_cost: String(r.product_cost ?? 0),
      shipping_cost: String(r.shipping_cost ?? 0),
      courier: r.courier ?? "",
      tracking: r.tracking ?? "",
      status: r.status ?? "Pending",
    });
    setCreatorSearch(r.creator_name ?? "");
    setProductSearch(r.sku ? `${r.sku}${r.product_name ? ` - ${r.product_name}` : ""}` : "");
    setManualCreatorConfirmed(!r.creator_id && Boolean(r.creator_name));
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    setError("");

    const creator = creators.find((c) => c.id === Number(form.creator_id));
    const product = products.find((p) => p.id === Number(form.product_master_id));

    const payload = {
      workspace_id: workspaceId,
      data_date: form.data_date || null,
      creator_id: form.creator_id ? Number(form.creator_id) : null,
      creator_name: form.creator_name.trim() || creator?.name || creator?.username || creator?.creator_code || null,
      platform: form.platform || creator?.platform || null,
      product_master_id: form.product_master_id ? Number(form.product_master_id) : null,
      sku: product?.sku ?? null,
      product_name: product?.product_name ?? null,
      qty: form.qty ? Number(form.qty) : 0,
      product_cost: form.product_cost ? Number(form.product_cost) : 0,
      shipping_cost: form.shipping_cost ? Number(form.shipping_cost) : 0,
      courier: form.courier.trim() || null,
      tracking: form.tracking.trim() || null,
      status: form.status || null,
    };

    const result = editingId !== null
      ? await supabase.from("shipping").update(payload).eq("id", editingId).eq("workspace_id", workspaceId)
      : await supabase.from("shipping").insert(payload);

    setSaving(false);
    if (result.error) return setError(result.error.message);
    setShowForm(false);
    setEditingId(null);
    await loadData();
  }

  async function remove(id: number) {
    if (!window.confirm("Hapus data shipping ini?")) return;
    const res = await supabase.from("shipping").delete().eq("id", id).eq("workspace_id", workspaceId);
    if (res.error) setError(res.error.message);
    else await loadData();
  }

  return (
    <section style={{ border: "1px solid #d9dee7", borderRadius: 10, padding: 20, marginTop: 24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:15 }}>
        <div>
          <h2 style={{ margin:0 }}>Shipping</h2>
          <p style={{ color:"#777", fontSize:13, marginTop:5 }}>Tracking pengiriman produk / sample ke creator</p>
        </div>
        <button onClick={openAdd} style={{ background:"#111827", color:"#fff", border:0, borderRadius:7, padding:"10px 16px", fontWeight:600 }}>+ Tambah Shipping</button>
      </div>

      <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Cari creator, SKU, courier, tracking, status..." style={{ width:"100%", boxSizing:"border-box", marginTop:14, padding:10 }} />

      {error && <div style={{ marginTop:12, padding:10, color:"red", border:"1px solid red", borderRadius:6 }}>{error}</div>}

      {showForm && (
        <div style={{ border:"1px solid #d9dee7", borderRadius:8, padding:18, marginTop:16, background:"#fafbfc" }}>
          <h3 style={{ marginTop:0 }}>{editingId ? "Edit Shipping" : "Tambah Shipping"}</h3>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:12 }}>
            <label>Data Date
              <input type="date" value={form.data_date} onChange={(e)=>setForm(p=>({...p,data_date:e.target.value}))} style={{ width:"100%", padding:8 }} />
            </label>

            <label>Creator Search
              <CreatorAutocomplete
                workspaceId={workspaceId}
                value={creatorSearch}
                selectedId={form.creator_id}
                placeholder="Ketik username atau nama creator"
                onTextChange={(value)=>{setCreatorSearch(value);setManualCreatorConfirmed(false);setForm(p=>({...p,creator_id:"",creator_name:value}))}}
                onSelect={(creator:CreatorSearchResult)=>{
                  const name=creator.name??creator.username??creator.creator_code??"";
                  setCreators(prev=>prev.some(x=>x.id===creator.id)?prev:[creator as Creator,...prev]);
                  setForm(p=>({...p,creator_id:String(creator.id),creator_name:name,platform:creator.platform??p.platform}));
                  setCreatorSearch(name);setManualCreatorConfirmed(false);
                }}
              />
            </label>

            <label>Platform
              <select value={form.platform} onChange={(e)=>setForm(p=>({...p,platform:e.target.value}))} style={{ width:"100%", padding:8 }}>
                <option value="">Pilih Platform</option>
                <option value="TikTok">TikTok</option><option value="Shopee">Shopee</option>
                <option value="Instagram">Instagram</option><option value="YouTube">YouTube</option><option value="Other">Other</option>
              </select>
            </label>

            <label>Product / SKU Search
              <ProductAutocomplete
                workspaceId={workspaceId}
                value={productSearch}
                selectedId={form.product_master_id}
                placeholder="Ketik SKU produk atau nama produk"
                onTextChange={(value)=>{setProductSearch(value);setForm(p=>({...p,product_master_id:""}))}}
                onSelect={(product:ProductSearchResult)=>{
                  setProducts(prev=>prev.some(x=>x.id===product.id)?prev:[product as Product,...prev]);
                  setForm(p=>({...p,product_master_id:String(product.id),product_cost:String(product.cost_price??0)}));
                  setProductSearch(`${product.sku}${product.product_name?` - ${product.product_name}`:""}`);
                }}
              />
              {form.product_master_id&&<small className="field-note">HPP produk: Rp {Number(products.find(p=>p.id===Number(form.product_master_id))?.cost_price||form.product_cost||0).toLocaleString("id-ID")}</small>}
            </label>

            <label>Qty<input type="number" min="0" placeholder="Jumlah produk dikirim" value={form.qty} onChange={(e)=>setForm(p=>({...p,qty:e.target.value}))} style={{ width:"100%", padding:8 }} /></label>
            <label>Product Cost<input type="number" min="0" placeholder="HPP per produk" value={form.product_cost} onChange={(e)=>setForm(p=>({...p,product_cost:e.target.value}))} style={{ width:"100%", padding:8 }} /></label>
            <label>Shipping Cost<input type="number" min="0" placeholder="Biaya ongkir" value={form.shipping_cost} onChange={(e)=>setForm(p=>({...p,shipping_cost:e.target.value}))} style={{ width:"100%", padding:8 }} /></label>
            <label>Courier<input value={form.courier} onChange={(e)=>setForm(p=>({...p,courier:e.target.value}))} placeholder="JNE / J&T / SiCepat..." style={{ width:"100%", padding:8 }} /></label>
            <label>Tracking<input value={form.tracking} onChange={(e)=>setForm(p=>({...p,tracking:e.target.value}))} placeholder="Nomor resi" style={{ width:"100%", padding:8 }} /></label>
            <label>Status
              <select value={form.status} onChange={(e)=>setForm(p=>({...p,status:e.target.value}))} style={{ width:"100%", padding:8 }}>
                <option>Pending</option><option>Packed</option><option>Shipped</option><option>Delivered</option><option>Returned</option><option>Cancelled</option>
              </select>
            </label>
          </div>

          <div style={{ marginTop:15 }}>
            <button onClick={save} disabled={saving} style={{ background:"#111827",color:"#fff",border:0,borderRadius:7,padding:"10px 18px",marginRight:8 }}>{saving?"Menyimpan...":"Simpan"}</button>
            <button onClick={()=>setShowForm(false)} style={{ padding:"10px 18px" }}>Batal</button>
          </div>
        </div>
      )}

      {loading ? <p>Loading Shipping...</p> : visibleRows.length===0 ? <p style={{color:"#777"}}>Belum ada data Shipping.</p> : (
        <div style={{overflowX:"auto",marginTop:16}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>{["Date","Creator","Platform","SKU","Product","Qty","Product Cost","Shipping Cost","Courier","Tracking","Status","Action"].map(h=><th key={h} style={{textAlign:"left",padding:9,borderBottom:"1px solid #ddd",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>{visibleRows.map(r=>(
              <tr key={r.id}>
                <td style={{padding:9}}>{r.data_date??"-"}</td><td style={{padding:9}}>{r.creator_name??"-"}</td><td style={{padding:9}}>{r.platform??"-"}</td>
                <td style={{padding:9}}>{r.sku??"-"}</td><td style={{padding:9}}>{r.product_name??"-"}</td><td style={{padding:9}}>{Number(r.qty??0).toLocaleString("id-ID")}</td>
                <td style={{padding:9}}>{money(r.product_cost)}</td><td style={{padding:9}}>{money(r.shipping_cost)}</td><td style={{padding:9}}>{r.courier??"-"}</td>
                <td style={{padding:9}}>{r.tracking??"-"}</td><td style={{padding:9}}>{r.status??"-"}</td>
                <td style={{padding:9,whiteSpace:"nowrap"}}><button onClick={()=>openEdit(r)} style={{marginRight:5}}>Edit</button><button onClick={()=>void remove(r.id)}>Hapus</button></td>
              </tr>
            ))}</tbody>
          </table>
          <p style={{color:"#777",fontSize:13}}>Menampilkan {visibleRows.length} dari {rows.length} shipping</p>
        </div>
      )}
    </section>
  );
}
