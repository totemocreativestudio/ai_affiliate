"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Row = { id?: number; row_order: number; row_data: Record<string, string> };
type Sheet = { id: number; name: string; columns_json: string[] };

const DEFAULT_COLUMNS = ["Column A", "Column B", "Column C", "Column D"];

export default function InternalExcelGrid({ workspaceId }: { workspaceId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetId, setSheetId] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [newSheet, setNewSheet] = useState("");
  const [newColumn, setNewColumn] = useState("");
  const [search, setSearch] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadSheets() {
    let { data, error } = await supabase
      .from("workspace_grid_sheets")
      .select("id,name,columns_json")
      .eq("workspace_id", workspaceId)
      .order("id");

    if (error) {
      setStatus("error, terjadi kesalahan.");
      return;
    }

    if (!data?.length) {
      const created = await supabase
        .from("workspace_grid_sheets")
        .insert({ workspace_id: workspaceId, name: "Manual Control", columns_json: DEFAULT_COLUMNS })
        .select("id,name,columns_json")
        .single();

      if (created.error) {
        setStatus("error, terjadi kesalahan.");
        return;
      }
      data = [created.data];
    }

    const list = (data || []) as Sheet[];
    setSheets(list);
    if (!sheetId && list[0]) setSheetId(list[0].id);
  }

  useEffect(() => {
    void loadSheets();
  }, [workspaceId]);

  useEffect(() => {
    if (sheetId) void loadRows(sheetId);
  }, [sheetId, sheets.length]);

  async function loadRows(id: number) {
    const sheet = sheets.find((item) => item.id === id);
    if (sheet) setColumns(Array.isArray(sheet.columns_json) ? sheet.columns_json : DEFAULT_COLUMNS);

    const { data, error } = await supabase
      .from("workspace_grid_rows")
      .select("id,row_order,row_data")
      .eq("workspace_id", workspaceId)
      .eq("sheet_id", id)
      .order("row_order");

    if (error) return setStatus("error, terjadi kesalahan.");
    setRows(((data || []) as any[]).map((item) => ({
      id: item.id,
      row_order: Number(item.row_order || 0),
      row_data: item.row_data || {},
    })));
  }

  async function createSheet() {
    const name = newSheet.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("workspace_grid_sheets")
      .insert({ workspace_id: workspaceId, name, columns_json: DEFAULT_COLUMNS })
      .select("id,name,columns_json")
      .single();

    if (error) return setStatus("error, terjadi kesalahan.");
    setNewSheet("");
    await loadSheets();
    if (data) setSheetId(data.id);
    setStatus("Sheet baru berhasil dibuat.");
  }

  async function renameSheet() {
    if (!sheetId) return;
    const current = sheets.find((item) => item.id === sheetId);
    if (!current) return;
    const name = prompt("Nama sheet", current.name)?.trim();
    if (!name) return;

    const { error } = await supabase
      .from("workspace_grid_sheets")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", sheetId)
      .eq("workspace_id", workspaceId);

    if (error) return setStatus("error, terjadi kesalahan.");
    await loadSheets();
    setStatus("Nama sheet berhasil diperbarui.");
  }

  async function addColumn() {
    const name = newColumn.trim();
    if (!name || columns.includes(name) || !sheetId) return;
    const next = [...columns, name];

    const { error } = await supabase
      .from("workspace_grid_sheets")
      .update({ columns_json: next, updated_at: new Date().toISOString() })
      .eq("id", sheetId)
      .eq("workspace_id", workspaceId);

    if (error) return setStatus("error, terjadi kesalahan.");
    setColumns(next);
    setNewColumn("");
    setStatus(`Kolom “${name}” ditambahkan.`);
  }

  async function addRow() {
    if (!sheetId) return;
    const rowData = Object.fromEntries(columns.map((column) => [column, ""]));
    const order = rows.length ? Math.max(...rows.map((row) => row.row_order)) + 1 : 1;

    const { data, error } = await supabase
      .from("workspace_grid_rows")
      .insert({ workspace_id: workspaceId, sheet_id: sheetId, row_order: order, row_data: rowData })
      .select("id,row_order,row_data")
      .single();

    if (error) return setStatus("error, terjadi kesalahan.");
    setRows((value) => [...value, { id: data.id, row_order: Number(data.row_order), row_data: data.row_data || {} }]);
    setStatus("Baris baru ditambahkan. Klik cell untuk mulai mengisi data.");
  }

  function updateCell(index: number, column: string, value: string) {
    setRows((previous) => previous.map((row, rowIndex) =>
      rowIndex === index ? { ...row, row_data: { ...row.row_data, [column]: value } } : row,
    ));
  }

  async function saveRow(row: Row) {
    if (!row.id) return;
    setBusy(true);
    setStatus("Menyimpan perubahan...");
    const { error } = await supabase
      .from("workspace_grid_rows")
      .update({ row_data: row.row_data, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("workspace_id", workspaceId);
    setBusy(false);
    setStatus(error ? "error, terjadi kesalahan." : "Perubahan tersimpan otomatis.");
  }

  async function deleteRow(row: Row) {
    if (!row.id || !confirm("Hapus baris ini?")) return;
    const { error } = await supabase
      .from("workspace_grid_rows")
      .delete()
      .eq("id", row.id)
      .eq("workspace_id", workspaceId);
    if (error) return setStatus("error, terjadi kesalahan.");
    setRows((value) => value.filter((item) => item.id !== row.id));
    setStatus("Baris dihapus.");
  }

  function exportCsv() {
    const escape = (value: any) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      columns.map(escape).join(","),
      ...rows.map((row) => columns.map((column) => escape(row.row_data[column])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `lumaway-${sheets.find((item) => item.id === sheetId)?.name || "sheet"}.csv`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows.map((row, index) => ({ row, index }));
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => Object.values(row.row_data).some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [rows, search]);

  return (
    <section id="excel-sync" className="legacy-page-anchor internal-sheet-page">
      <div className="eyebrow">DATA & SYNC</div>
      <h1>Excel Sync</h1>
      <p className="muted">Spreadsheet private Lumaway untuk mengedit data manual dengan pola penggunaan yang familiar seperti Excel. Perubahan cell tersimpan otomatis saat Anda berpindah cell.</p>

      <div className="excel-beginner-guide card">
        <div>
          <span className="excel-guide-number">1</span>
          <strong>Pilih sheet</strong>
          <small>Pilih tab data yang ingin dikerjakan.</small>
        </div>
        <div>
          <span className="excel-guide-number">2</span>
          <strong>Klik dan edit cell</strong>
          <small>Tulis langsung seperti spreadsheet biasa.</small>
        </div>
        <div>
          <span className="excel-guide-number">3</span>
          <strong>Tersimpan otomatis</strong>
          <small>Saat berpindah cell, baris disimpan ke workspace.</small>
        </div>
      </div>

      <div className="sheet-toolbar card">
        <div className="sheet-tabs" aria-label="Daftar sheet">
          {sheets.map((sheet) => <button key={sheet.id} className={sheetId === sheet.id ? "active" : ""} onClick={() => setSheetId(sheet.id)}>{sheet.name}</button>)}
        </div>
        <div className="sheet-primary-tools">
          <label className="sheet-search">
            <span>⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari isi sheet..." />
          </label>
          <button className="primary" onClick={addRow}>+ Tambah Baris</button>
          <button onClick={() => setShowSetup((value) => !value)}>{showSetup ? "Tutup Pengaturan" : "Atur Sheet"}</button>
          <button onClick={exportCsv}>Export CSV</button>
        </div>
        {showSetup && (
          <div className="sheet-setup-panel">
            <div><input value={newSheet} onChange={(event) => setNewSheet(event.target.value)} placeholder="Nama sheet baru" /><button onClick={createSheet}>+ Sheet</button><button onClick={renameSheet}>Rename</button></div>
            <div><input value={newColumn} onChange={(event) => setNewColumn(event.target.value)} placeholder="Nama kolom baru" /><button onClick={addColumn}>+ Column</button></div>
          </div>
        )}
      </div>

      <div className="card internal-sheet-card">
        <div className="sheet-column-tools">
          <div><strong>{sheets.find((item) => item.id === sheetId)?.name || "Sheet"}</strong><span>{visibleRows.length.toLocaleString("id-ID")} dari {rows.length.toLocaleString("id-ID")} baris · {columns.length} kolom</span></div>
          <span className={busy ? "sheet-save-state saving" : "sheet-save-state"}>{busy ? "Menyimpan..." : "Autosave aktif"}</span>
        </div>

        <div className="internal-sheet-scroll">
          <table className="internal-sheet-table">
            <thead><tr><th className="row-number">#</th>{columns.map((column) => <th key={column}>{column}</th>)}<th className="sheet-action-col">Aksi</th></tr></thead>
            <tbody>
              {visibleRows.map(({ row, index }) => (
                <tr key={row.id || index}>
                  <td className="row-number">{index + 1}</td>
                  {columns.map((column) => <td key={column}><input value={rows[index]?.row_data[column] ?? ""} onChange={(event) => updateCell(index, column, event.target.value)} onBlur={() => void saveRow(rows[index])} /></td>)}
                  <td className="sheet-action-col"><button className="sheet-delete" onClick={() => deleteRow(row)}>Hapus</button></td>
                </tr>
              ))}
              {!visibleRows.length && <tr><td colSpan={columns.length + 2}><div className="empty-state"><strong>{search ? "Data tidak ditemukan." : "Sheet masih kosong."}</strong><span>{search ? "Coba kata pencarian lain." : "Klik “Tambah Baris” lalu isi cell seperti spreadsheet."}</span></div></td></tr>}
            </tbody>
          </table>
        </div>
        {status && <div className="owner-inline-note">{status}</div>}
      </div>
    </section>
  );
}
