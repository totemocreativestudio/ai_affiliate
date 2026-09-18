"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Row = { id?: number; row_order: number; row_data: Record<string,string> };
type Sheet = { id:number; name:string; columns_json:string[] };
type Mode = "sheet" | "import";
const DEFAULT_COLUMNS=["Column A","Column B","Column C","Column D"];

function parseDelimited(text:string){
  const delimiter=(text.split("\n")[0]?.match(/\t/g)?.length||0)>(text.split("\n")[0]?.match(/,/g)?.length||0)?"\t":",";
  const rows:string[][]=[];let row:string[]=[];let value="";let quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted;
    }else if(ch===delimiter&&!quoted){row.push(value.trim());value=""}
    else if((ch==="\n"||ch==="\r")&&!quoted){
      if(ch==="\r"&&text[i+1]==="\n")i++;
      row.push(value.trim());value="";
      if(row.some(Boolean))rows.push(row);
      row=[];
    }else value+=ch;
  }
  if(value||row.length){row.push(value.trim());if(row.some(Boolean))rows.push(row)}
  return rows;
}
function uniqueHeaders(values:string[]){
  const used=new Map<string,number>();
  return values.map((value,index)=>{
    const base=String(value||`Column ${index+1}`).trim()||`Column ${index+1}`;
    const count=used.get(base)||0;used.set(base,count+1);
    return count? `${base} ${count+1}`:base;
  });
}

export default function InternalExcelGrid({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [mode,setMode]=useState<Mode>("sheet");
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
  const [sortColumn,setSortColumn]=useState("");
  const [sortAsc,setSortAsc]=useState(true);
  const [importName,setImportName]=useState("");
  const [importHeaders,setImportHeaders]=useState<string[]>([]);
  const [importRows,setImportRows]=useState<string[][]>([]);
  const [mappedHeaders,setMappedHeaders]=useState<string[]>([]);

  async function loadSheets(){
    let {data,error}=await supabase.from("workspace_grid_sheets").select("id,name,columns_json").eq("workspace_id",workspaceId).order("id");
    if(error){setStatus("error, terjadi kesalahan.");return}
    if(!data?.length){
      const created=await supabase.from("workspace_grid_sheets").insert({workspace_id:workspaceId,name:"Manual Control",columns_json:DEFAULT_COLUMNS}).select("id,name,columns_json").single();
      if(created.error){setStatus("error, terjadi kesalahan.");return}
      data=[created.data];
    }
    const list=(data||[]) as Sheet[];setSheets(list);if(!sheetId&&list[0])setSheetId(list[0].id);
  }
  useEffect(()=>{void loadSheets()},[workspaceId]);
  useEffect(()=>{if(sheetId)void loadRows(sheetId)},[sheetId,sheets.length]);

  async function loadRows(id:number){
    const sheet=sheets.find(x=>x.id===id);if(sheet)setColumns(Array.isArray(sheet.columns_json)?sheet.columns_json:DEFAULT_COLUMNS);
    const {data,error}=await supabase.from("workspace_grid_rows").select("id,row_order,row_data").eq("workspace_id",workspaceId).eq("sheet_id",id).order("row_order");
    if(error)return setStatus("error, terjadi kesalahan.");
    setRows(((data||[]) as any[]).map(x=>({id:x.id,row_order:Number(x.row_order||0),row_data:x.row_data||{}})));
    setStatus("");
  }

  async function createSheet(){
    const name=newSheet.trim();if(!name)return;
    const {data,error}=await supabase.from("workspace_grid_sheets").insert({workspace_id:workspaceId,name,columns_json:DEFAULT_COLUMNS}).select("id,name,columns_json").single();
    if(error)return setStatus("error, terjadi kesalahan.");setNewSheet("");await loadSheets();if(data)setSheetId(data.id);
  }
  async function renameSheet(){
    if(!sheetId)return;const current=sheets.find(x=>x.id===sheetId);if(!current)return;const name=prompt("Nama sheet",current.name)?.trim();if(!name)return;
    const {error}=await supabase.from("workspace_grid_sheets").update({name,updated_at:new Date().toISOString()}).eq("id",sheetId).eq("workspace_id",workspaceId);
    if(error)return setStatus("error, terjadi kesalahan.");await loadSheets();
  }
  async function addColumn(){
    const name=newColumn.trim();if(!name||columns.includes(name)||!sheetId)return;
    const next=[...columns,name];const {error}=await supabase.from("workspace_grid_sheets").update({columns_json:next,updated_at:new Date().toISOString()}).eq("id",sheetId).eq("workspace_id",workspaceId);
    if(error)return setStatus("error, terjadi kesalahan.");setColumns(next);setNewColumn("");
  }
  async function addRow(){
    if(!sheetId)return;const rowData=Object.fromEntries(columns.map(c=>[c,""]));const order=rows.length?Math.max(...rows.map(r=>r.row_order))+1:1;
    const {data,error}=await supabase.from("workspace_grid_rows").insert({workspace_id:workspaceId,sheet_id:sheetId,row_order:order,row_data:rowData}).select("id,row_order,row_data").single();
    if(error)return setStatus("error, terjadi kesalahan.");setRows(v=>[...v,{id:data.id,row_order:Number(data.row_order),row_data:data.row_data||{}}]);
  }
  function updateCell(index:number,column:string,value:string){setRows(v=>v.map((r,i)=>i===index?{...r,row_data:{...r.row_data,[column]:value}}:r))}
  async function saveRow(row:Row){
    if(!row.id)return;setBusy(true);const {error}=await supabase.from("workspace_grid_rows").update({row_data:row.row_data,updated_at:new Date().toISOString()}).eq("id",row.id).eq("workspace_id",workspaceId);setBusy(false);setStatus(error?"error, terjadi kesalahan.":"Tersimpan otomatis ✓");
  }
  async function deleteRow(row:Row){if(!row.id||!confirm("Hapus row ini?"))return;const {error}=await supabase.from("workspace_grid_rows").delete().eq("id",row.id).eq("workspace_id",workspaceId);if(error)return setStatus("error, terjadi kesalahan.");setRows(v=>v.filter(x=>x.id!==row.id))}
  const visibleRows=useMemo(()=>{
    let next=search.trim()?rows.filter(r=>Object.values(r.row_data||{}).some(v=>String(v||"").toLowerCase().includes(search.trim().toLowerCase()))):[...rows];
    if(sortColumn)next=[...next].sort((a,b)=>String(a.row_data[sortColumn]||"").localeCompare(String(b.row_data[sortColumn]||""),"id",{numeric:true})*(sortAsc?1:-1));
    return next;
  },[rows,search,sortColumn,sortAsc]);

  function sortBy(column:string){if(sortColumn===column)setSortAsc(v=>!v);else{setSortColumn(column);setSortAsc(true)}}
  function exportCsv(){
    const esc=(x:any)=>`"${String(x??"").replaceAll('"','""')}"`;const csv=[columns.map(esc).join(","),...rows.map(r=>columns.map(c=>esc(r.row_data[c])).join(","))].join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`lumaway-${sheets.find(x=>x.id===sheetId)?.name||"sheet"}.csv`;a.click();URL.revokeObjectURL(a.href);
  }
  async function readImport(file:File|null){
    if(!file)return;
    if(file.size>10*1024*1024){setStatus("File import maksimal 10 MB.");return}
    const text=await file.text();const parsed=parseDelimited(text);
    if(parsed.length<1){setStatus("File tidak memiliki data.");return}
    const headers=uniqueHeaders(parsed[0]||[]);const data=parsed.slice(1).filter(r=>r.some(Boolean)).slice(0,5000);
    setImportName(file.name.replace(/\.[^.]+$/,"")||"Imported Sheet");setImportHeaders(headers);setMappedHeaders(headers);setImportRows(data);setStatus(data.length>=5000?"Preview dibatasi 5.000 row per import.":"File siap direview sebelum import.");
  }
  async function commitImport(){
    if(!importRows.length||!mappedHeaders.length)return;setBusy(true);setStatus("Mengimpor data...");
    try{
      const safeHeaders=uniqueHeaders(mappedHeaders.map((x,i)=>String(x||importHeaders[i]||`Column ${i+1}`).trim()));
      const created=await supabase.from("workspace_grid_sheets").insert({workspace_id:workspaceId,name:importName.trim()||"Imported Sheet",columns_json:safeHeaders}).select("id,name,columns_json").single();
      if(created.error)throw created.error;
      const payload=importRows.map((values,index)=>({workspace_id:workspaceId,sheet_id:created.data.id,row_order:index+1,row_data:Object.fromEntries(safeHeaders.map((header,i)=>[header,String(values[i]??"")]))}));
      for(let i=0;i<payload.length;i+=500){const part=payload.slice(i,i+500);const {error}=await supabase.from("workspace_grid_rows").insert(part);if(error)throw error}
      await loadSheets();setSheetId(created.data.id);setMode("sheet");setImportRows([]);setImportHeaders([]);setMappedHeaders([]);setStatus(`${payload.length.toLocaleString("id-ID")} row berhasil diimpor.`);
    }catch{setStatus("error, terjadi kesalahan.")}finally{setBusy(false)}
  }

  return <section id="excel-sync" className="legacy-page-anchor internal-sheet-page">
    <div className="eyebrow">DATA & SYNC</div><h1>Excel Sync</h1><p className="muted">Pilih cara kerja yang paling mudah: edit langsung seperti spreadsheet, atau import CSV/TSV lalu review sebelum masuk ke workspace.</p>
    <div className="excel-mode-switch"><button className={mode==="sheet"?"active":""} onClick={()=>setMode("sheet")}>Spreadsheet Editor</button><button className={mode==="import"?"active":""} onClick={()=>setMode("import")}>Import Data</button></div>

    {mode==="import"?<div className="card excel-import-card">
      <div className="sheet-quick-start"><div><b>1</b><span>Pilih CSV/TSV</span></div><div><b>2</b><span>Periksa nama kolom</span></div><div><b>3</b><span>Review contoh data</span></div><div><b>4</b><span>Import ke sheet baru</span></div></div>
      <div className="excel-import-drop"><label><strong>Pilih file data</strong><span>CSV atau TSV, maksimal 10 MB. File XLSX tetap dapat diunggah melalui Upload Center.</span><input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={e=>void readImport(e.target.files?.[0]||null)}/></label></div>
      {importRows.length>0&&<><div className="excel-import-config"><label>Nama Sheet<input value={importName} onChange={e=>setImportName(e.target.value)}/></label><div><b>Mapping Kolom</b><span>Ubah nama kolom bila perlu sebelum data disimpan.</span></div></div><div className="import-mapping-grid">{mappedHeaders.map((header,index)=><label key={index}><span>Kolom {index+1}: {importHeaders[index]}</span><input value={header} onChange={e=>setMappedHeaders(v=>v.map((x,i)=>i===index?e.target.value:x))}/></label>)}</div><div className="internal-sheet-scroll import-preview"><table className="internal-sheet-table"><thead><tr><th>#</th>{mappedHeaders.map((h,i)=><th key={i}>{h||`Column ${i+1}`}</th>)}</tr></thead><tbody>{importRows.slice(0,20).map((r,i)=><tr key={i}><td>{i+1}</td>{mappedHeaders.map((_,j)=><td key={j}>{r[j]||""}</td>)}</tr>)}</tbody></table></div><div className="excel-import-footer"><span>Preview 20 dari {importRows.length.toLocaleString("id-ID")} row.</span><button className="primary" disabled={busy} onClick={()=>void commitImport()}>{busy?"Mengimpor...":"Import ke Lumaway"}</button></div></>}
      {status&&<div className="owner-inline-note">{status}</div>}
    </div>:<>
      <div className="sheet-quick-start"><div><b>1</b><span>Pilih atau buat Sheet</span></div><div><b>2</b><span>Tambah kolom & row</span></div><div><b>3</b><span>Klik sel lalu edit</span></div><div><b>4</b><span>Tersimpan otomatis</span></div></div>
      <div className="sheet-toolbar card"><div className="sheet-tabs">{sheets.map(s=><button key={s.id} className={sheetId===s.id?"active":""} onClick={()=>setSheetId(s.id)}>{s.name}</button>)}</div><div className="sheet-actions"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari isi sheet..."/><input value={newSheet} onChange={e=>setNewSheet(e.target.value)} placeholder="Nama sheet baru"/><button onClick={createSheet}>+ Sheet</button><button onClick={renameSheet}>Rename</button><button onClick={()=>sheetId&&void loadRows(sheetId)}>Reload</button><button onClick={exportCsv}>Export CSV</button></div></div>
      <div className="card internal-sheet-card"><div className="sheet-column-tools"><input value={newColumn} onChange={e=>setNewColumn(e.target.value)} placeholder="Nama kolom baru"/><button onClick={addColumn}>+ Column</button><button className="primary" onClick={addRow}>+ Row</button><span>{visibleRows.length.toLocaleString("id-ID")} dari {rows.length.toLocaleString("id-ID")} rows · {columns.length} columns {busy?"· menyimpan...":status==="Tersimpan otomatis ✓"?"· tersimpan ✓":""}</span></div>
        <div className="internal-sheet-scroll"><table className="internal-sheet-table"><thead><tr><th className="row-number">#</th>{columns.map(c=><th key={c}><button className="sheet-sort" onClick={()=>sortBy(c)}>{c}{sortColumn===c?<small>{sortAsc?" ↑":" ↓"}</small>:null}</button></th>)}<th>Action</th></tr></thead><tbody>{visibleRows.map((row,i)=>{const realIndex=rows.findIndex(x=>x.id===row.id);return <tr key={row.id||i}><td className="row-number">{realIndex+1}</td>{columns.map(col=><td key={col} className={selectedCell?.row===realIndex&&selectedCell.column===col?"selected-cell":""}><input value={row.row_data[col]??""} onFocus={()=>setSelectedCell({row:realIndex,column:col})} onChange={e=>updateCell(realIndex,col,e.target.value)} onBlur={()=>void saveRow(rows[realIndex])}/></td>)}<td><div className="button-row"><button disabled={busy} onClick={()=>saveRow(row)}>Save</button><button onClick={()=>deleteRow(row)}>Delete</button></div></td></tr>})}{!visibleRows.length&&<tr><td colSpan={columns.length+2}><div className="empty-state"><strong>{search?"Tidak ada data yang cocok.":"Sheet masih kosong."}</strong><span>{search?"Coba kata pencarian lain.":"Tambahkan row dan kolom untuk mulai bekerja seperti spreadsheet."}</span></div></td></tr>}</tbody></table></div>{status&&<div className="owner-inline-note">{status}</div>}
      </div>
    </>}
  </section>;
}
