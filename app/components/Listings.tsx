"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import {CreatorAutocomplete,ProductAutocomplete,CreatorSearchResult,ProductSearchResult} from "./SmartAutocomplete";

type Creator = {
  id: number;
  creator_code: string | null;
  name: string | null;
  username: string | null;
  platform: string | null;
  affiliate_id: string | null;
  phone: string | null;
  payment_type: string | null;
  ratecard: number | null;
  status: string | null;
};

type Product = {
  id: number;
  sku: string;
  product_name: string | null;
  category: string | null;
  cost_price: number | null;
};

type Listing = {
  id: number;
  data_date: string | null;
  creator_id: number | null;
  creator_name: string | null;
  platform: string | null;
  product_master_id: number | null;
  product_name: string | null;
  sku: string | null;
  product_hpp: number | null;
  stage: string | null;
  payment_type: string | null;
  ratecard: number;
  posting_date: string | null;
  post_link: string | null;
  next_action: string | null;
  agreement_id: string | null;
  notes: string | null;
};

type FormState = {
  data_date: string;
  creator_id: string;
  creator_name: string;
  platform: string;
  product_master_id: string;
  product_hpp: string;
  stage: string;
  payment_type: string;
  ratecard: string;
  posting_date: string;
  post_link: string;
  next_action: string;
  agreement_id: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  data_date: "",
  creator_id: "",
  creator_name: "",
  platform: "",
  product_master_id: "",
  product_hpp: "0",
  stage: "",
  payment_type: "",
  ratecard: "",
  posting_date: "",
  post_link: "",
  next_action: "",
  agreement_id: "",
  notes: "",
};

export default function Listings({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const supabase = createClient();

  const [rows, setRows] = useState<Listing[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [masterCreators,setMasterCreators]=useState<Creator[]>([]);
  const [masterCreatorSearch,setMasterCreatorSearch]=useState("");
  const [masterCreatorPage,setMasterCreatorPage]=useState(1);
  const [masterCreatorTotal,setMasterCreatorTotal]=useState(0);
  const [products, setProducts] = useState<Product[]>([]);

  const [creatorSearch, setCreatorSearch] = useState("");
  const [manualCreatorConfirmed, setManualCreatorConfirmed] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const [listingResult, creatorResult, productResult] =
      await Promise.all([
        supabase
          .from("listings")
          .select(
            "id,data_date,creator_id,creator_name,platform,product_master_id,product_name,sku,product_hpp,stage,payment_type,ratecard,posting_date,post_link,next_action,agreement_id,notes"
          )
          .eq("workspace_id", workspaceId)
          .order("id", { ascending: false }),

        supabase
          .from("creators")
          .select("id,creator_code,name,username,platform,affiliate_id,phone,payment_type,ratecard,status")
          .eq("workspace_id", workspaceId)
          .order("name")
          .limit(7770),

        supabase
          .from("product_master")
          .select("id,sku,product_name,category,cost_price")
          .eq("workspace_id", workspaceId)
          .order("sku")
          .limit(1000),
      ]);

    if (listingResult.error) {
      setError(listingResult.error.message);
    } else {
      setRows((listingResult.data ?? []) as Listing[]);
    }

    if (!creatorResult.error) {
      setCreators((creatorResult.data ?? []) as Creator[]);
    }

    if (!productResult.error) {
      setProducts((productResult.data ?? []) as Product[]);
    }

    setLoading(false);
  }

  async function loadMasterCreators(targetPage=1,query=masterCreatorSearch){
    const params=new URLSearchParams({workspace_id:workspaceId,page:String(targetPage),page_size:"100"});
    if(query.trim())params.set("q",query.trim());
    const r=await fetch(`/api/master-data/creators?${params.toString()}`,{cache:"no-store"});
    const d=await r.json();
    if(!r.ok||!d.ok){setError(d.error||"Gagal memuat Master Creator.");return}
    setMasterCreators((d.results||[]) as Creator[]);
    setMasterCreatorTotal(Number(d.total||0));
    setMasterCreatorPage(Number(d.page||targetPage));
  }

  useEffect(() => {
    void loadData();
    void loadMasterCreators(1,"");
  }, [workspaceId]);

  useEffect(() => {
    const refresh = () => { void loadData(); void loadMasterCreators(1,masterCreatorSearch); };
    window.addEventListener("lumaway-database-updated", refresh as EventListener);
    return () => window.removeEventListener("lumaway-database-updated", refresh as EventListener);
  }, [workspaceId]);

  function updateField(
    field: keyof FormState,
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function openAdd() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      data_date: new Date().toISOString().slice(0, 10),
    });
    setCreatorSearch("");
    setManualCreatorConfirmed(false);
    setProductSearch("");
    setError("");
    setShowForm(true);
  }

  function openEdit(row: Listing) {
    setEditingId(row.id);

    setForm({
      data_date: row.data_date ?? "",
      creator_name: row.creator_name ?? "",
      creator_id: row.creator_id?.toString() ?? "",
      platform: row.platform ?? "",
      product_master_id:
        row.product_master_id?.toString() ?? "",
      product_hpp: String(row.product_hpp ?? 0),
      stage: row.stage ?? "",
      payment_type: row.payment_type ?? "",
      ratecard: row.ratecard?.toString() ?? "",
      posting_date: row.posting_date ?? "",
      post_link: row.post_link ?? "",
      next_action: row.next_action ?? "",
      agreement_id: row.agreement_id ?? "",
      notes: row.notes ?? "",
    });

    setCreatorSearch(row.creator_name ?? "");
    setManualCreatorConfirmed(!row.creator_id && Boolean(row.creator_name));
    setProductSearch(row.sku ?? row.product_name ?? "");
    setError("");
    setShowForm(true);
  }

  
function commitManualCreator() {
  const value = creatorSearch.trim();

  if (!value) {
    return;
  }

  const exact = creators.find((creator) => {
    const values = [
      creator.name,
      creator.username,
      creator.creator_code,
    ];

    return values.some(
      (item) =>
        item &&
        item.trim().toLowerCase() === value.toLowerCase()
    );
  });

  if (exact) {
    setForm((prev) => ({
      ...prev,
      creator_id: String(exact.id),
      creator_name:
        exact.name ??
        exact.username ??
        exact.creator_code ??
        value,
      platform: exact.platform ?? prev.platform,
    }));

    setCreatorSearch(
      exact.name ??
        exact.username ??
        exact.creator_code ??
        value
    );

    return;
  }

  // Creator baru / pending:
  // tidak wajib memiliki creator_id.
  setForm((prev) => ({
    ...prev,
    creator_id: "",
    creator_name: value,
  }));
}

async function saveListing() {
    setSaving(true);
    setError("");

    const creator = creators.find(
      (item) => item.id === Number(form.creator_id)
    );

    const product = products.find(
      (item) => item.id === Number(form.product_master_id)
    );

    const payload = {
      workspace_id: workspaceId,

      data_date: form.data_date || null,

      creator_id: form.creator_id
        ? Number(form.creator_id)
        : null,

      creator_name:
      form.creator_name.trim() ||
      creator?.name ||
      creator?.username ||
      creator?.creator_code ||
      null,

      platform:
        form.platform ||
        creator?.platform ||
        null,

      product_master_id: form.product_master_id
        ? Number(form.product_master_id)
        : null,

      product_name: product?.product_name ?? null,

      sku: product?.sku ?? null,

      product_hpp: product?.cost_price != null ? Number(product.cost_price) : Number(form.product_hpp || 0),

      stage: form.stage || null,

      payment_type: form.payment_type || null,

      ratecard: form.ratecard
        ? Number(form.ratecard)
        : 0,

      posting_date: form.posting_date || null,

      post_link: form.post_link || null,

      next_action: form.next_action || null,

      agreement_id: form.agreement_id || null,

      notes: form.notes || null,
    };

    let result;

    if (editingId !== null) {
      result = await supabase
        .from("listings")
        .update(payload)
        .eq("id", editingId)
        .eq("workspace_id", workspaceId);
    } else {
      result = await supabase
        .from("listings")
        .insert(payload);
    }

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);

    await loadData();
  }

  async function deleteListing(id: number) {
    if (!window.confirm("Hapus listing ini?")) {
      return;
    }

    setError("");

    const result = await supabase
      .from("listings")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await loadData();
  }

  const filteredCreators = creators.filter((creator) => {
    const q = creatorSearch.toLowerCase().trim();

    if (!q) return true;

    return (
      (creator.name ?? "").toLowerCase().includes(q) ||
      (creator.username ?? "").toLowerCase().includes(q) ||
      (creator.creator_code ?? "").toLowerCase().includes(q)
    );
  }).slice(0, 50);

  const filteredProducts = products.filter((product) => {
    const q = productSearch.toLowerCase().trim();

    if (!q) return true;

    return (
      product.sku.toLowerCase().includes(q) ||
      (product.product_name ?? "").toLowerCase().includes(q) ||
      (product.category ?? "").toLowerCase().includes(q)
    );
  }).slice(0, 50);

  const masterCreatorPages=Math.max(1,Math.ceil(masterCreatorTotal/100));

  const visibleRows = rows.filter((row) => {
    const q = search.toLowerCase().trim();

    if (!q) return true;

    return [
      row.creator_name,
      row.product_name,
      row.sku,
      row.platform,
      row.stage,
      row.payment_type,
    ]
      .filter(Boolean)
      .some((value) =>
        String(value).toLowerCase().includes(q)
      );
  });

  return (
    <section
      style={{
        border: "1px solid #d9dee7",
        borderRadius: 10,
        padding: 20,
        marginTop: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 15,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Listings</h2>
          <p
            style={{
              margin: "5px 0 0",
              color: "#777",
              fontSize: 13,
            }}
          >
            Management creator listing dan produk workspace
          </p>
        </div>

        <button
          onClick={openAdd}
          style={{
            background: "#111827",
            color: "white",
            border: 0,
            borderRadius: 7,
            padding: "10px 16px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Tambah Listing
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari creator, produk, SKU, platform..."
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: 11,
          border: "1px solid #cfd5df",
          borderRadius: 7,
          marginBottom: 15,
        }}
      />

      {error && (
        <div
          style={{
            color: "red",
            background: "#fff5f5",
            border: "1px solid #ffb4b4",
            borderRadius: 7,
            padding: 12,
            marginBottom: 15,
          }}
        >
          {error}
        </div>
      )}

      {showForm && (
        <div
          style={{
            border: "1px solid #d9dee7",
            borderRadius: 8,
            padding: 18,
            marginBottom: 20,
            background: "#fff",
            boxShadow: "0 12px 32px rgba(15,23,42,.08)",
          }}
        >
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><h3 style={{ margin: 0 }}>
            {editingId ? "Edit Listing" : "Tambah Listing"}
          </h3><button type="button" aria-label="Tutup form listing" onClick={()=>{setShowForm(false);setEditingId(null);setError("");}} style={{width:36,height:36,borderRadius:"50%"}}>×</button></div><p style={{margin:"6px 0 16px",fontSize:12,color:"#667085"}}>Isi creator, platform, dan produk. HPP produk akan mengikuti Product Master.</p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <label>
              Data Date
              <input
                type="date"
                value={form.data_date}
                onChange={(e) =>
                  updateField("data_date", e.target.value)
                }
                style={{ width: "100%", padding: 8 }}
              />
            </label>
          <label>
            Creator Search
            <CreatorAutocomplete
              workspaceId={workspaceId}
              value={creatorSearch}
              selectedId={form.creator_id}
              onTextChange={(value)=>{setCreatorSearch(value);setManualCreatorConfirmed(false);setForm(prev=>({...prev,creator_id:"",creator_name:value}))}}
              placeholder="Ketik username atau nama creator"
              onSelect={(creator:CreatorSearchResult)=>{
                const creatorName=creator.name??creator.username??creator.creator_code??"";
                setCreators(prev=>prev.some(x=>x.id===creator.id)?prev:[creator as Creator,...prev]);
                setForm(prev=>({...prev,creator_id:String(creator.id),creator_name:creatorName,platform:creator.platform??prev.platform,ratecard:String(creator.ratecard??prev.ratecard??"")}));
                setCreatorSearch(creatorName);setManualCreatorConfirmed(false);
              }}
            />
          </label>

            <label>
              Platform
              <select
                value={form.platform}
                onChange={(e) =>
                  updateField("platform", e.target.value)
                }
                style={{ width: "100%", padding: 8 }}
              >
                <option value="">Pilih Platform</option>
                <option value="TikTok">TikTok</option>
                <option value="Shopee">Shopee</option>
                <option value="Instagram">Instagram</option>
                <option value="YouTube">YouTube</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label>
            Product / SKU Search
            <ProductAutocomplete
              workspaceId={workspaceId}
              value={productSearch}
              selectedId={form.product_master_id}
              onTextChange={(value)=>{setProductSearch(value);setForm(prev=>({...prev,product_master_id:"",product_hpp:"0"}))}}
              placeholder="Ketik SKU produk atau nama produk"
              onSelect={(product:ProductSearchResult)=>{
                setProducts(prev=>prev.some(x=>x.id===product.id)?prev:[product as Product,...prev]);
                setForm(prev=>({...prev,product_master_id:String(product.id),product_hpp:String(product.cost_price??0)}));
                setProductSearch(`${product.sku}${product.product_name?` - ${product.product_name}`:""}`);
              }}
            />
            {form.product_master_id&&<small className="field-note">HPP terhubung otomatis: Rp {Number(form.product_hpp||0).toLocaleString("id-ID")}</small>}
          </label>

          <label>
              Stage
              <input
                value={form.stage}
                onChange={(e) =>
                  updateField("stage", e.target.value)
                }
                placeholder="Contoh: Prospect"
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              Payment Type
              <input
                value={form.payment_type}
                onChange={(e) =>
                  updateField(
                    "payment_type",
                    e.target.value
                  )
                }
                placeholder="Contoh: Paid / Barter"
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              Ratecard
              <input
                type="number"
                value={form.ratecard}
                onChange={(e) =>
                  updateField("ratecard", e.target.value)
                }
                placeholder="Nominal ratecard creator"
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              Posting Date
              <input
                type="date"
                value={form.posting_date}
                onChange={(e) =>
                  updateField(
                    "posting_date",
                    e.target.value
                  )
                }
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              Post Link
              <input
                value={form.post_link}
                onChange={(e) =>
                  updateField(
                    "post_link",
                    e.target.value
                  )
                }
                placeholder="https://..."
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              Next Action
              <input
                value={form.next_action}
                onChange={(e) =>
                  updateField(
                    "next_action",
                    e.target.value
                  )
                }
                placeholder="Contoh: Follow up konten / kirim brief"
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              Agreement ID
              <input
                value={form.agreement_id}
                onChange={(e) =>
                  updateField(
                    "agreement_id",
                    e.target.value
                  )
                }
                placeholder="ID agreement jika sudah ada"
                style={{ width: "100%", padding: 8 }}
              />
            </label>
          </div>

          <label
            style={{
              display: "block",
              marginTop: 12,
            }}
          >
            Notes
            <textarea
              value={form.notes}
              onChange={(e) =>
                updateField("notes", e.target.value)
              }
              rows={3}
              placeholder="Catatan listing creator (opsional)"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 8,
              }}
            />
          </label>

          <div style={{ marginTop: 15 }}>
            <button
              onClick={saveListing}
              disabled={saving}
              style={{
                background: "#111827",
                color: "white",
                border: 0,
                borderRadius: 7,
                padding: "10px 18px",
                marginRight: 8,
                cursor: "pointer",
              }}
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>

            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setError("");
              }}
              style={{
                padding: "10px 18px",
                border: "1px solid #ccd2dc",
                borderRadius: 7,
                background: "white",
              }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div style={{border:"1px solid #e5e7eb",borderRadius:8,padding:14,marginBottom:18,background:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:10}}><div><h3 style={{margin:0}}>Master Creator</h3><p style={{margin:"5px 0 0",color:"#777",fontSize:12}}>Seluruh creator database workspace tersedia secara paginated. Creator dari Affiliate Performance otomatis terhubung ke master data.</p></div><span style={{fontSize:12,color:"#667085"}}>{masterCreatorTotal.toLocaleString("id-ID")} creator</span></div>
        <div className="button-row" style={{marginBottom:10}}>
          <input value={masterCreatorSearch} onChange={e=>setMasterCreatorSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void loadMasterCreators(1,masterCreatorSearch)}}} placeholder="Cari username / nama creator / platform..." style={{flex:1,minWidth:240}}/>
          <button className="secondary" type="button" onClick={()=>void loadMasterCreators(1,masterCreatorSearch)}>Cari</button>
          {masterCreatorSearch&&<button className="secondary" type="button" onClick={()=>{setMasterCreatorSearch("");void loadMasterCreators(1,"")}}>Reset</button>}
        </div>
        {masterCreators.length===0?<p style={{color:"#777"}}>Belum ada Master Creator.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Creator / Username","Platform","Affiliate ID","Phone","Payment","Ratecard","Status"].map(h=><th key={h} style={{textAlign:"left",padding:8,borderBottom:"1px solid #e5e7eb",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{masterCreators.map(creator=>{const name=String(creator.name||"").trim();const username=String(creator.username||"").trim();return <tr key={creator.id}><td style={{padding:8}}><b>{name||username||"-"}</b>{username&&username.toLowerCase()!==name.toLowerCase()&&<small style={{display:"block",color:"#667085"}}>@{username}</small>}</td><td style={{padding:8}}><b>{creator.platform||"-"}</b></td><td style={{padding:8}}>{creator.affiliate_id||"-"}</td><td style={{padding:8}}>{creator.phone||"-"}</td><td style={{padding:8}}>{creator.payment_type||"-"}</td><td style={{padding:8}}>Rp {Number(creator.ratecard||0).toLocaleString("id-ID")}</td><td style={{padding:8}}>{creator.status||"-"}</td></tr>})}</tbody></table></div>}
        <div className="pager"><span className="pager-info">Page {masterCreatorPage} / {masterCreatorPages} · {masterCreatorTotal.toLocaleString("id-ID")} creator</span><div className="button-row"><button className="secondary" disabled={masterCreatorPage<=1} onClick={()=>void loadMasterCreators(masterCreatorPage-1,masterCreatorSearch)}>Previous</button><button className="secondary" disabled={masterCreatorPage>=masterCreatorPages} onClick={()=>void loadMasterCreators(masterCreatorPage+1,masterCreatorSearch)}>Next</button></div></div>
      </div>


      {loading ? (
        <p>Loading Listings...</p>
      ) : visibleRows.length === 0 ? (
        <p style={{ color: "#777" }}>
          Belum ada Listings.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
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
                  "Date",
                  "Creator",
                  "Platform",
                  "SKU",
                  "Product",
                  "Stage",
                  "Payment",
                  "Ratecard",
                  "Posting",
                  "Action",
                ].map((header) => (
                  <th
                    key={header}
                    style={{
                      textAlign: "left",
                      padding: 9,
                      borderBottom:
                        "1px solid #d9dee7",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: 9 }}>
                    {row.data_date ?? "-"}
                  </td>

                  <td style={{ padding: 9 }}>
                    {row.creator_name ?? "-"}
                  </td>

                  <td style={{ padding: 9 }}>
                    {row.platform ?? "-"}
                  </td>

                  <td style={{ padding: 9 }}>
                    {row.sku ?? "-"}
                  </td>

                  <td style={{ padding: 9 }}>
                    {row.product_name ?? "-"}
                  </td>

                  <td style={{ padding: 9 }}>
                    {row.stage ?? "-"}
                  </td>

                  <td style={{ padding: 9 }}>
                    {row.payment_type ?? "-"}
                  </td>

                  <td style={{ padding: 9 }}>
                    Rp{" "}
                    {Number(
                      row.ratecard ?? 0
                    ).toLocaleString("id-ID")}
                  </td>

                  <td style={{ padding: 9 }}>
                    {row.posting_date ?? "-"}
                  </td>

                  <td
                    style={{
                      padding: 9,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <button
                      onClick={() => openEdit(row)}
                      style={{ marginRight: 5 }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() =>
                        deleteListing(row.id)
                      }
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p
            style={{
              color: "#777",
              fontSize: 13,
              marginBottom: 0,
            }}
          >
            Menampilkan {visibleRows.length} dari{" "}
            {rows.length} listing
          </p>
        </div>
      )}
    </section>
  );
}
