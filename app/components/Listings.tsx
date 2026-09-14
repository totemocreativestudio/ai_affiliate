"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

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
  category: string | null;
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
            "id,data_date,creator_id,creator_name,platform,product_master_id,product_name,sku,stage,payment_type,ratecard,posting_date,post_link,next_action,agreement_id,notes"
          )
          .eq("workspace_id", workspaceId)
          .order("id", { ascending: false }),

        supabase
          .from("creators")
          .select("id,creator_code,name,username,platform")
          .eq("workspace_id", workspaceId)
          .order("name")
          .limit(7770),

        supabase
          .from("product_master")
          .select("id,sku,product_name,category")
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

  useEffect(() => {
    loadData();
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
            background: "#fafbfc",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            {editingId ? "Edit Listing" : "Tambah Listing"}
          </h3>

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

            <input
              value={creatorSearch}
              onChange={(e) => {
                const value = e.target.value;

                setCreatorSearch(value);
                setManualCreatorConfirmed(false);

                setForm((prev) => ({
                  ...prev,
                  creator_id: "",
                  creator_name: value,
                }));
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;

                e.preventDefault();
                e.stopPropagation();

                const value = creatorSearch.trim();
                if (!value) return;

                const keyword = value.toLowerCase();

                const exactMatch = creators.find((creator) =>
                  (creator.name ?? "").trim().toLowerCase() === keyword ||
                  (creator.username ?? "").trim().toLowerCase() === keyword ||
                  (creator.creator_code ?? "").trim().toLowerCase() === keyword
                );

                if (exactMatch) {
                  const creatorName =
                    exactMatch.name ??
                    exactMatch.username ??
                    exactMatch.creator_code ??
                    value;

                  setForm((prev) => ({
                    ...prev,
                    creator_id: exactMatch.id.toString(),
                    creator_name: creatorName,
                    platform: exactMatch.platform ?? prev.platform,
                  }));

                  setCreatorSearch(creatorName);
                  setManualCreatorConfirmed(false);
                } else {
                  setForm((prev) => ({
                    ...prev,
                    creator_id: "",
                    creator_name: value,
                  }));

                  setCreatorSearch(value);
                  setManualCreatorConfirmed(true);
                }
              }}
              placeholder="Nama / username / code"
              style={{
                width: "100%",
                padding: 8,
                boxSizing: "border-box",
              }}
            />

            {creatorSearch.trim() &&
              !form.creator_id &&
              filteredCreators.length > 0 &&
              !manualCreatorConfirmed && (
                <select
                  size={Math.min(6, filteredCreators.length)}
                  value=""
                  onChange={(e) => {
                    const selected = creators.find(
                      (creator) => creator.id === Number(e.target.value)
                    );
                    if (!selected) return;

                    const creatorName =
                      selected.name ??
                      selected.username ??
                      selected.creator_code ??
                      "";

                    setForm((prev) => ({
                      ...prev,
                      creator_id: selected.id.toString(),
                      creator_name: creatorName,
                      platform: selected.platform ?? prev.platform,
                    }));

                    setCreatorSearch(creatorName);
                    setManualCreatorConfirmed(false);
                  }}
                  style={{ width: "100%", marginTop: 5 }}
                >
                  {filteredCreators.map((creator) => (
                    <option key={creator.id} value={creator.id}>
                      {creator.name ??
                        creator.username ??
                        creator.creator_code ??
                        "-"}
                      {creator.platform ? ` - ${creator.platform}` : ""}
                    </option>
                  ))}
                </select>
              )}

            {manualCreatorConfirmed &&
              !form.creator_id &&
              form.creator_name.trim() && (
                <div
                  style={{
                    marginTop: 6,
                    padding: "7px 9px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    background: "#f9fafb",
                    fontSize: 12,
                  }}
                >
                  Creator baru / pending:{" "}
                  <strong>{form.creator_name}</strong>
                </div>
              )}
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

            <input
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);

                setForm((prev) => ({
                  ...prev,
                  product_master_id: "",
                }));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();

                  const selected = filteredProducts[0];

                  if (selected) {
                    setForm((prev) => ({
                      ...prev,
                      product_master_id: selected.id.toString(),
                    }));

                    setProductSearch(
                      selected.sku +
                        (selected.product_name
                          ? " - " + selected.product_name
                          : "")
                    );
                  }
                }

                if (e.key === "Escape") {
                  setProductSearch("");
                  setForm((prev) => ({
                    ...prev,
                    product_master_id: "",
                  }));
                }
              }}
              placeholder="SKU / nama produk"
              style={{
                width: "100%",
                padding: 8,
                boxSizing: "border-box",
              }}
            />

            {productSearch && filteredProducts.length > 0 && (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  marginTop: 4,
                  border: "1px solid #999",
                  background: "#fff",
                  maxHeight: 180,
                  overflowY: "auto",
                  zIndex: 1000,
                }}
              >
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onMouseDown={(e) => {
                      e.preventDefault();

                      setForm((prev) => ({
                        ...prev,
                        product_master_id: product.id.toString(),
                      }));

                      setProductSearch(
                        product.sku +
                          (product.product_name
                            ? " - " + product.product_name
                            : "")
                      );
                    }}
                    style={{
                      padding: "8px 10px",
                      cursor: "pointer",
                      borderBottom: "1px solid #eee",
                      background: "#fff",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f1f5f9";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#fff";
                    }}
                  >
                    <strong>{product.sku}</strong>
                    {product.product_name
                      ? " - " + product.product_name
                      : ""}
                  </div>
                ))}
              </div>
            )}
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
