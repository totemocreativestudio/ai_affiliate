"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Row = { id?: number; row_order: number; row_data: Record<string,string> };
type Sheet = { id:number; name:string; columns_json:string[] };
const DEFAULT_COLUMNS=["Column A","Column B","Column C","Column D"];

export default function InternalExcelGrid({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [sheets,setSheets]=useState<Sheet[]>([]);
  const [sheetId,setSheetId]=useState<number|null>(null);
  const [rows,setRows]=useState<Row[]>([]);
  const [columns,setColumns]=useState<string[]>(DEFAULT_COLUMNS);
  const [newSheet,setNewSheet]=useState("");
  const [newColumn,setNewColumn]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState("");
  const [selectedCell,setSelectedCell]=useState<{row:number;column:string}|null>(null);

  async function loadSheets(){
    let {data,error}=await supabase.from("workspace_grid_sheets").select("id,name,columns_json").eq("workspace_id",workspaceId).order("id");
    if(error){setStatus(error.message);return;}
    if(!data?.length){
      const created=await supabase.from("workspace_grid_sheets").insert({workspace_id:workspaceId,name:"Manual Control",columns_json:DEFAULT_COLUMNS}).select("id,name,columns_json").single();
      if(created.error){setStatus(created.error.message);return;}
      data=[created.data];
    }
    const list=(data||[]) as Sheet[];setSheets(list);if(!sheetId&&list[0])setSheetId(list[0].id);
  }
  useEffect(()=>{void loadSheets()},[workspaceId]);
  useEffect(()=>{if(sheetId)void loadRows(sheetId)},[sheetId]);

  async function loadRows(id:number){
    const sheet=sheets.find(x=>x.id===id);if(sheet)setColumns(Array.isArray(sheet.columns_json)?sheet.columns_json:DEFAULT_COLUMNS);
    const {data,error}=await supabase.from("workspace_grid_rows").select("id,row_order,row_data").eq("workspace_id",workspaceId).eq("sheet_id",id).order("row_order");
    if(error)return setStatus(error.message);setRows(((data||[]) as any[]).map(x=>({id:x.id,row_order:Number(x.row_order||0),row_data:x.row_data||{}})));
  }

  async function createSheet(){
    const name=newSheet.trim();if(!name)return;
    const {data,error}=await supabase.from("workspace_grid_sheets").insert({workspace_id:workspaceId,name,columns_json:DEFAULT_COLUMNS}).select("id,name,columns_json").single();
    if(error)return setStatus(error.message);setNewSheet("");await loadSheets();if(data)setSheetId(data.id);
  }
  async function renameSheet(){
    if(!sheetId)return;const current=sheets.find(x=>x.id===sheetId);if(!current)return;const name=prompt("Nama sheet",current.name)?.trim();if(!name)return;
    const {error}=await supabase.from("workspace_grid_sheets").update({name,updated_at:new Date().toISOString()}).eq("id",sheetId).eq("workspace_id",workspaceId);if(error)return setStatus(error.message);await loadSheets();
  }
  async function addColumn(){
    const name=newColumn.trim();if(!name||columns.includes(name)||!sheetId)return;
    const next=[...columns,name];const {error}=await supabase.from("workspace_grid_sheets").update({columns_json:next,updated_at:new Date().toISOString()}).eq("id",sheetId).eq("workspace_id",workspaceId);if(error)return setStatus(error.message);setColumns(next);setNewColumn("");
  }
  async function addRow(){
    if(!sheetId)return;const rowData=Object.fromEntries(columns.map(c=>[c,""]));const order=rows.length?Math.max(...rows.map(r=>r.row_order))+1:1;
    const {data,error}=await supabase.from("workspace_grid_rows").insert({workspace_id:workspaceId,sheet_id:sheetId,row_order:order,row_data:rowData}).select("id,row_order,row_data").single();
    if(error)return setStatus(error.message);setRows(v=>[...v,{id:data.id,row_order:Number(data.row_order),row_data:data.row_data||{}}]);
  }
  function updateCell(index:number,column:string,value:string){setRows(v=>v.map((r,i)=>i===index?{...r,row_data:{...r.row_data,[column]:value}}:r));}
  async function saveRow(row:Row){
    if(!row.id)return;setBusy(true);const {error}=await supabase.from("workspace_grid_rows").update({row_data:row.row_data,updated_at:new Date().toISOString()}).eq("id",row.id).eq("workspace_id",workspaceId);setBusy(false);setStatus(error?error.message:"Perubahan tersimpan.");
  }
  async function deleteRow(row:Row){if(!row.id||!confirm("Hapus row ini?"))return;const {error}=await supabase.from("workspace_grid_rows").delete().eq("id",row.id).eq("workspace_id",workspaceId);if(error)return setStatus(error.message);setRows(v=>v.filter(x=>x.id!==row.id));}
  const visibleRows=useMemo(()=>search.trim()?rows.filter(r=>Object.values(r.row_data||{}).some(v=>String(v||"").toLowerCase().includes(search.trim().toLowerCase()))):rows,[rows,search]);

  function exportCsv(){
    const esc=(x:any)=>`"${String(x??"").replaceAll('"','""')}"`;const csv=[columns.map(esc).join(","),...rows.map(r=>columns.map(c=>esc(r.row_data[c])).join(","))].join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`luma-${sheets.find(x=>x.id===sheetId)?.name||"sheet"}.csv`;a.click();URL.revokeObjectURL(a.href);
  }

  return <section id="excel-sync" className="legacy-page-anchor internal-sheet-page">
    <div className="eyebrow">DATA & SYNC</div><h1>Excel Sync</h1><p className="muted">Spreadsheet Lumaway untuk mengedit data manual seperti Excel. Klik sel untuk mengetik, pindah kolom/row dengan bebas, lalu perubahan tersimpan otomatis saat Anda keluar dari sel.</p>
    <div className="sheet-quick-start"><div><b>1</b><span>Pilih atau buat Sheet</span></div><div><b>2</b><span>Tambah kolom & row</span></div><div><b>3</b><span>Klik sel lalu edit langsung</span></div><div><b>4</b><span>Data tersimpan otomatis</span></div></div>
    <div className="sheet-toolbar card">
      <div className="sheet-tabs">{sheets.map(s=><button key={s.id} className={sheetId===s.id?"active":""} onClick={()=>setSheetId(s.id)}>{s.name}</button>)}</div>
      <div className="sheet-actions"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari isi sheet..."/><input value={newSheet} onChange={e=>setNewSheet(e.target.value)} placeholder="Nama sheet baru"/><button onClick={createSheet}>+ Sheet</button><button onClick={renameSheet}>Rename</button><button onClick={exportCsv}>Export CSV</button></div>
    </div>
    <div className="card internal-sheet-card">
      <div className="sheet-column-tools"><input value={newColumn} onChange={e=>setNewColumn(e.target.value)} placeholder="Nama kolom baru"/><button onClick={addColumn}>+ Column</button><button className="primary" onClick={addRow}>+ Row</button><span>{visibleRows.length.toLocaleString("id-ID")} dari {rows.length.toLocaleString("id-ID")} rows · {columns.length} columns {busy?"· menyimpan...":status==="Perubahan tersimpan."?"· tersimpan ✓":""}</span></div>
      <div className="internal-sheet-scroll"><table className="internal-sheet-table"><thead><tr><th className="row-number">#</th>{columns.map(c=><th key={c}>{c}</th>)}<th>Action</th></tr></thead><tbody>{visibleRows.map((row,i)=>{const realIndex=rows.findIndex(x=>x.id===row.id);return <tr key={row.id||i}><td className="row-number">{realIndex+1}</td>{columns.map(col=><td key={col} className={selectedCell?.row===realIndex&&selectedCell.column===col?"selected-cell":""}><input value={row.row_data[col]??""} onFocus={()=>setSelectedCell({row:realIndex,column:col})} onChange={e=>updateCell(realIndex,col,e.target.value)} onBlur={()=>void saveRow(rows[realIndex])}/></td>)}<td><div className="button-row"><button disabled={busy} onClick={()=>saveRow(row)}>Save</button><button onClick={()=>deleteRow(row)}>Delete</button></div></td></tr>})}{!visibleRows.length&&<tr><td colSpan={columns.length+2}><div className="empty-state"><strong>{search?"Tidak ada data yang cocok.":"Sheet masih kosong."}</strong><span>{search?"Coba kata pencarian lain.":"Tambahkan row dan kolom untuk mulai bekerja seperti spreadsheet."}</span></div></td></tr>}</tbody></table></div>
      {status&&<div className="owner-inline-note">{status}</div>}
    </div>
  </section>;
}
