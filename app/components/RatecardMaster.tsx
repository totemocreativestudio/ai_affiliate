"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import {CreatorAutocomplete,CreatorSearchResult} from "./SmartAutocomplete";

type Creator = {
  id: number;
  name: string | null;
  username: string | null;
  creator_code: string | null;
  platform: string | null;
};

type RatecardRow = {
  id: number;
  creator_id: number | null;
  platform: string | null;
  ratecard: number | string;
  effective_from: string | null;
  effective_to: string | null;
  status: string;
  notes: string | null;
  creators?: Creator | Creator[] | null;
};

type FormState = {
  creator_id: string;
  creator_name: string;
  platform: string;
  ratecard: string;
  effective_from: string;
  effective_to: string;
  status: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  creator_id: "",
  creator_name: "",
  platform: "",
  ratecard: "0",
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: "",
  status: "Active",
  notes: "",
};

const money = (v: number | string | null | undefined) =>
  `Rp ${Math.round(Number(v ?? 0)).toLocaleString("id-ID")}`;

function creatorLabel(c: Creator) {
  return c.name || c.username || c.creator_code || `Creator #${c.id}`;
}

function joinedCreator(row: RatecardRow): Creator | null {
  if (Array.isArray(row.creators)) return row.creators[0] ?? null;
  return row.creators ?? null;
}

function makeCreatorCode(name: string) {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 10) || "CREATOR";
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CR-${base}-${suffix}`;
}

export default function RatecardMaster({ workspaceId }: { workspaceId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<RatecardRow[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [search, setSearch] = useState("");
  const [creatorSearch, setCreatorSearch] = useState("");
  const [manualCreatorConfirmed, setManualCreatorConfirmed] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setError("");

    const [ratecardsResult, creatorsResult] = await Promise.all([
      supabase
        .from("ratecard_master")
        .select(
          "id,creator_id,platform,ratecard,effective_from,effective_to,status,notes,creators(id,name,username,creator_code,platform)"
        )
        .eq("workspace_id", workspaceId)
        .order("effective_from", { ascending: false })
        .order("id", { ascending: false })
        .limit(1000),

      supabase
        .from("creators")
        .select("id,name,username,creator_code,platform")
        .eq("workspace_id", workspaceId)
        .order("id", { ascending: true })
        .limit(10000),
    ]);

    if (ratecardsResult.error) {
      setError(ratecardsResult.error.message);
    } else {
      setRows((ratecardsResult.data ?? []) as unknown as RatecardRow[]);
    }

    if (!creatorsResult.error) {
      setCreators((creatorsResult.data ?? []) as Creator[]);
    }
  }

  useEffect(() => {
    void loadData();
  }, [workspaceId]);

  const creatorMatches = useMemo(() => {
    const q = creatorSearch.trim().toLowerCase();
    if (!q || form.creator_id || manualCreatorConfirmed) return [];

    return creators
      .filter((c) =>
        [c.name, c.username, c.creator_code]
          .some((v) => String(v ?? "").toLowerCase().includes(q))
      )
      .slice(0, 50);
  }, [creators, creatorSearch, form.creator_id, manualCreatorConfirmed]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      const c = joinedCreator(row);
      return [
        c?.name,
        c?.username,
        c?.creator_code,
        row.platform,
        row.status,
        row.ratecard,
        row.effective_from,
        row.effective_to,
        row.notes,
      ].some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [rows, search]);

  function chooseCreator(c: Creator) {
    setForm((prev) => ({
      ...prev,
      creator_id: String(c.id),
      creator_name: creatorLabel(c),
      platform: c.platform ?? prev.platform,
    }));
    setCreatorSearch(creatorLabel(c));
    setManualCreatorConfirmed(false);
  }

  function commitCreatorSearch() {
    const value = creatorSearch.trim();
    if (!value) return;

    const keyword = value.toLowerCase();

    const exact = creators.find((c) =>
      [c.name, c.username, c.creator_code].some(
        (v) => String(v ?? "").trim().toLowerCase() === keyword
      )
    );

    if (exact) {
      chooseCreator(exact);
      return;
    }

    setForm((prev) => ({
      ...prev,
      creator_id: "",
      creator_name: value,
    }));
    setCreatorSearch(value);
    setManualCreatorConfirmed(true);
  }

  function openAdd() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      effective_from: new Date().toISOString().slice(0, 10),
    });
    setCreatorSearch("");
    setManualCreatorConfirmed(false);
    setError("");
    setShowForm(true);
  }

  function openEdit(row: RatecardRow) {
    const c = joinedCreator(row);

    setEditingId(row.id);
    setForm({
      creator_id: row.creator_id?.toString() ?? "",
      creator_name: c ? creatorLabel(c) : "",
      platform: row.platform ?? "",
      ratecard: String(row.ratecard ?? 0),
      effective_from: row.effective_from ?? "",
      effective_to: row.effective_to ?? "",
      status: row.status ?? "Active",
      notes: row.notes ?? "",
    });

    setCreatorSearch(c ? creatorLabel(c) : "");
    setManualCreatorConfirmed(false);
    setError("");
    setShowForm(true);
  }

  async function ensureCreatorId(): Promise<number | null> {
    if (form.creator_id) return Number(form.creator_id);

    const manualName = form.creator_name.trim() || creatorSearch.trim();
    if (!manualName) return null;

    if (!form.platform) {
      throw new Error("Pilih platform terlebih dahulu untuk creator baru.");
    }

    const creatorCode = makeCreatorCode(manualName);

    const { data, error: creatorError } = await supabase
      .from("creators")
      .insert({
        workspace_id: workspaceId,
        creator_code: creatorCode,
        name: manualName,
        platform: form.platform,
        status: "Active",
      })
      .select("id,name,username,creator_code,platform")
      .single();

    if (creatorError) throw new Error(creatorError.message);

    const newCreator = data as Creator;
    setCreators((prev) => [newCreator, ...prev]);
    setForm((prev) => ({
      ...prev,
      creator_id: String(newCreator.id),
      creator_name: creatorLabel(newCreator),
    }));
    setCreatorSearch(creatorLabel(newCreator));
    setManualCreatorConfirmed(false);

    return newCreator.id;
  }

  async function save() {
    if (!form.platform.trim()) {
      setError("Platform wajib dipilih.");
      return;
    }

    const ratecardValue = Number(form.ratecard || 0);
    if (!Number.isFinite(ratecardValue) || ratecardValue < 0) {
      setError("Ratecard harus berupa angka 0 atau lebih.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const creatorId = await ensureCreatorId();

      if (!creatorId) {
        throw new Error("Creator wajib dipilih atau diketik manual lalu tekan Enter.");
      }

      const payload = {
        workspace_id: workspaceId,
        creator_id: creatorId,
        platform: form.platform,
        ratecard: ratecardValue,
        effective_from: form.effective_from || null,
        effective_to: form.effective_to || null,
        status: form.status || "Active",
        notes: form.notes.trim() || null,
      };

      const result = editingId
        ? await supabase
            .from("ratecard_master")
            .update(payload)
            .eq("id", editingId)
            .eq("workspace_id", workspaceId)
        : await supabase
            .from("ratecard_master")
            .insert(payload);

      if (result.error) throw new Error(result.error.message);

      setShowForm(false);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan ratecard.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Hapus ratecard ini?")) return;

    const result = await supabase
      .from("ratecard_master")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (result.error) setError(result.error.message);
    else await loadData();
  }

  const inputStyle = {
    width: "100%",
    padding: 9,
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    display: "grid",
    gap: 5,
  };

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
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Ratecard Master</h2>
          <p
            style={{
              margin: "5px 0 0",
              color: "#777",
              fontSize: 13,
            }}
          >
            Master ratecard creator berdasarkan platform dan periode efektif
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
          + Tambah Ratecard
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari creator, platform, status, ratecard..."
        style={{
          ...inputStyle,
          marginTop: 18,
          border: "1px solid #cfd5df",
          borderRadius: 7,
        }}
      />

      {error && (
        <div
          style={{
            color: "red",
            border: "1px solid red",
            borderRadius: 7,
            padding: 10,
            marginTop: 12,
          }}
        >
          {error}
        </div>
      )}

      {showForm && (
        <div
          style={{
            border: "1px solid #d9dee7",
            borderRadius: 9,
            padding: 18,
            marginTop: 15,
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            {editingId ? "Edit Ratecard" : "Tambah Ratecard"}
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <label style={labelStyle}>
              Creator Search
              <CreatorAutocomplete
                workspaceId={workspaceId}
                value={creatorSearch}
                selectedId={form.creator_id}
                placeholder="Ketik username atau nama creator"
                onTextChange={(value)=>{setCreatorSearch(value);setManualCreatorConfirmed(false);setForm(prev=>({...prev,creator_id:"",creator_name:value}))}}
                onSelect={(creator:CreatorSearchResult)=>{
                  const item=creator as Creator;
                  setCreators(prev=>prev.some(x=>x.id===item.id)?prev:[item,...prev]);
                  chooseCreator(item);
                }}
              />
            </label>

            <label style={labelStyle}>
              Platform
              <select
                value={form.platform}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    platform: e.target.value,
                  }))
                }
                style={inputStyle}
              >
                <option value="">Pilih Platform</option>
                <option value="TikTok">TikTok</option>
                <option value="Shopee">Shopee</option>
                <option value="Instagram">Instagram</option>
                <option value="YouTube">YouTube</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label style={labelStyle}>
              Ratecard
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Nominal ratecard creator"
                value={form.ratecard}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    ratecard: e.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Status
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    status: e.target.value,
                  }))
                }
                style={inputStyle}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>

            <label style={labelStyle}>
              Effective From
              <input
                type="date"
                value={form.effective_from}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    effective_from: e.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Effective To
              <input
                type="date"
                value={form.effective_to}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    effective_to: e.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>

            <label
              style={{
                ...labelStyle,
                gridColumn: "span 2",
              }}
            >
              Notes
              <input
                placeholder="Catatan ratecard (opsional)"
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    notes: e.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              onClick={() => void save()}
              disabled={saving}
              style={{
                background: "#111827",
                color: "white",
                border: 0,
                borderRadius: 7,
                padding: "10px 18px",
                cursor: "pointer",
              }}
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>

            <button
              onClick={() => setShowForm(false)}
              style={{ padding: "10px 18px" }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto", marginTop: 18 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
          }}
        >
          <thead>
            <tr>
              {[
                "Creator",
                "Platform",
                "Ratecard",
                "Effective From",
                "Effective To",
                "Status",
                "Notes",
                "Action",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "10px 9px",
                    borderBottom: "1px solid #d9dee7",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row) => {
              const c = joinedCreator(row);

              return (
                <tr key={row.id}>
                  <td style={{ padding: 9, borderBottom: "1px solid #eee" }}>
                    <strong>{c ? creatorLabel(c) : "-"}</strong>
                    {c?.creator_code && (
                      <div
                        style={{
                          color: "#777",
                          fontSize: 12,
                        }}
                      >
                        {c.creator_code}
                      </div>
                    )}
                  </td>

                  <td style={{ padding: 9, borderBottom: "1px solid #eee" }}>
                    {row.platform ?? "-"}
                  </td>

                  <td style={{ padding: 9, borderBottom: "1px solid #eee" }}>
                    {money(row.ratecard)}
                  </td>

                  <td style={{ padding: 9, borderBottom: "1px solid #eee" }}>
                    {row.effective_from ?? "-"}
                  </td>

                  <td style={{ padding: 9, borderBottom: "1px solid #eee" }}>
                    {row.effective_to ?? "-"}
                  </td>

                  <td style={{ padding: 9, borderBottom: "1px solid #eee" }}>
                    {row.status}
                  </td>

                  <td style={{ padding: 9, borderBottom: "1px solid #eee" }}>
                    {row.notes ?? "-"}
                  </td>

                  <td
                    style={{
                      padding: 9,
                      borderBottom: "1px solid #eee",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <button onClick={() => openEdit(row)}>Edit</button>{" "}
                    <button onClick={() => void remove(row.id)}>Hapus</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ color: "#777", fontSize: 12, marginTop: 10 }}>
          Menampilkan {filteredRows.length} dari {rows.length} ratecard
        </div>
      </div>
    </section>
  );
}
