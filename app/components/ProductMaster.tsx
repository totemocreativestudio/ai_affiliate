"use client";

import { useEffect, useState } from "react";
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

    const { data, error } = await supabase
      .from("product_master")
      .select(
        "id,workspace_id,sku,sku_normalized,product_name,category,selling_price,cost_price,point_per_unit,status,notes"
      )
      .eq("workspace_id", workspaceId)
      .order("sku", { ascending: true });

    if (error) {
      setError(error.message);
      setProducts([]);
    } else {
      setProducts((data ?? []) as Product[]);
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
      result = await supabase
        .from("product_master")
        .update(payload)
        .eq("id", editingId)
        .eq("workspace_id", workspaceId);
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

  const filteredProducts = products.filter((product) => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return true;

    return (
      product.sku?.toLowerCase().includes(keyword) ||
      product.product_name?.toLowerCase().includes(keyword) ||
      product.category?.toLowerCase().includes(keyword)
    );
  });

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return "-";

    return new Intl.NumberFormat("id-ID").format(Number(value));
  };

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
            Master data produk dan SKU workspace
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
          placeholder="Cari SKU, nama produk, atau kategori..."
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

      {showForm && (
        <div
          style={{
            marginTop: 20,
            padding: 18,
            border: "1px solid #d1d5db",
            borderRadius: 8,
            background: "#f9fafb",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            {editingId !== null
              ? "Edit Product"
              : "Tambah Product"}
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <input
              placeholder="SKU *"
              value={form.sku}
              onChange={(e) =>
                updateField("sku", e.target.value)
              }
            />

            <input
              placeholder="Nama Produk"
              value={form.product_name}
              onChange={(e) =>
                updateField("product_name", e.target.value)
              }
            />

            <input
              placeholder="Kategori"
              value={form.category}
              onChange={(e) =>
                updateField("category", e.target.value)
              }
            />

            <input
              type="number"
              placeholder="Selling Price"
              value={form.selling_price}
              onChange={(e) =>
                updateField("selling_price", e.target.value)
              }
            />

            <input
              type="number"
              placeholder="Cost Price / HPP"
              value={form.cost_price}
              onChange={(e) =>
                updateField("cost_price", e.target.value)
              }
            />

            <input
              type="number"
              placeholder="Point per Unit"
              value={form.point_per_unit}
              onChange={(e) =>
                updateField("point_per_unit", e.target.value)
              }
            />

            <select
              value={form.status}
              onChange={(e) =>
                updateField("status", e.target.value)
              }
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <input
              placeholder="Notes"
              value={form.notes}
              onChange={(e) =>
                updateField("notes", e.target.value)
              }
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 15,
            }}
          >
            <button
              type="button"
              onClick={saveProduct}
              disabled={saving}
              style={{
                padding: "9px 15px",
                border: "none",
                borderRadius: 6,
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
                background: "#111827",
                color: "#fff",
              }}
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(EMPTY_FORM);
                setError("");
              }}
              style={{
                padding: "9px 15px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

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
                  "SKU",
                  "Produk",
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
                <tr key={product.id}>
                  <td style={{ padding: 10 }}>
                    {product.sku}
                  </td>

                  <td style={{ padding: 10 }}>
                    {product.product_name || "-"}
                  </td>

                  <td style={{ padding: 10 }}>
                    {product.category || "-"}
                  </td>

                  <td style={{ padding: 10 }}>
                    Rp {formatNumber(product.selling_price)}
                  </td>

                  <td style={{ padding: 10 }}>
                    Rp {formatNumber(product.cost_price)}
                  </td>

                  <td style={{ padding: 10 }}>
                    {formatNumber(product.point_per_unit)}
                  </td>

                  <td style={{ padding: 10 }}>
                    {product.status || "-"}
                  </td>

                  <td style={{ padding: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          openEdit(product)
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteProduct(product.id)
                        }
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
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
