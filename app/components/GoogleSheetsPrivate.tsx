"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Props={workspaceId:string};
type Sheet={id:string;name:string;modifiedTime?:string};

export default function GoogleSheetsPrivate({workspaceId}:Props){
  const supabase=createClient();
  const [token,setToken]=useState("");
  const [sheets,setSheets]=useState<Sheet[]>([]);
  const [selected,setSelected]=useState<Sheet|null>(null);
  const [values,setValues]=useState<string[][]>([]);
  const [status,setStatus]=useState("Google Sheets belum terhubung untuk sesi ini.");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{void restoreSession()},[workspaceId]);

  async function restoreSession(){
    const {data:{session}}=await supabase.auth.getSession();
    const providerToken=(session as any)?.provider_token||"";
    if(providerToken){setToken(providerToken);await listSheets(providerToken)}
    const {data}=await supabase.from("google_sheet_connections").select("spreadsheet_id,spreadsheet_name,status").eq("workspace_id",workspaceId).maybeSingle();
    if(data?.spreadsheet_id)setSelected({id:data.spreadsheet_id,name:data.spreadsheet_name||"Connected Sheet"});
  }

  async function connect(){
    setStatus("Membuka izin Google...");
    const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}/#google-sheets-private`,scopes:"https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly",queryParams:{access_type:"offline",prompt:"consent"}}});
    if(error)setStatus(error.message);
  }

  async function listSheets(accessToken=token){
    if(!accessToken)return;
    setBusy(true);setStatus("Membaca file Google Sheets private milik akun Anda...");
    try{
      const url="https://www.googleapis.com/drive/v3/files?q="+encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false")+"&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=100";
      const r=await fetch(url,{headers:{Authorization:`Bearer ${accessToken}`}});const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"Gagal membaca Google Drive.");setSheets(d.files||[]);setStatus(`${(d.files||[]).length} spreadsheet ditemukan. Tidak ada public link yang disimpan.`);
    }catch(e:any){setStatus(e.message||"Google connection gagal.");}finally{setBusy(false)}
  }

  async function choose(sheet:Sheet){
    setSelected(sheet);setStatus(`Menghubungkan ${sheet.name}...`);
    const {data:{user}}=await supabase.auth.getUser();if(!user)return;
    const {error}=await supabase.from("google_sheet_connections").upsert({workspace_id:workspaceId,user_id:user.id,spreadsheet_id:sheet.id,spreadsheet_name:sheet.name,status:"connected",updated_at:new Date().toISOString()},{onConflict:"user_id,workspace_id"});
    if(error)return setStatus(error.message);await loadValues(sheet.id);
  }

  async function loadValues(id=selected?.id||""){
    if(!token||!id)return setStatus("Hubungkan ulang Google untuk mendapatkan token akses sesi.");
    setBusy(true);setStatus("Memuat data spreadsheet...");
    try{const r=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/A1:Z100`,{headers:{Authorization:`Bearer ${token}`}});const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"Gagal membaca spreadsheet.");setValues((d.values||[]).map((r:any[])=>r.map(x=>String(x??""))));setStatus("Spreadsheet siap dilihat dan diedit.");}catch(e:any){setStatus(e.message)}finally{setBusy(false)}
  }

  function changeCell(r:number,c:number,value:string){setValues(prev=>{const next=prev.map(row=>[...row]);while(next.length<=r)next.push([]);while(next[r].length<=c)next[r].push("");next[r][c]=value;return next})}

  async function save(){
    if(!token||!selected)return;setBusy(true);setStatus("Menyimpan perubahan ke Google Sheets...");
    try{const r=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${selected.id}/values/A1?valueInputOption=USER_ENTERED`,{method:"PUT",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({range:"A1",majorDimension:"ROWS",values})});const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"Gagal menyimpan.");setStatus(`Tersimpan · ${d.updatedCells||0} cell diperbarui.`);}catch(e:any){setStatus(e.message)}finally{setBusy(false)}
  }

  return <section id="google-sheets-private" className="legacy-page-anchor gs-page">
    <div className="eyebrow">INTEGRATION · PRIVATE PER USER</div><h1>Google Sheets</h1><p className="muted">Setiap user memberi izin ke akun Google miliknya sendiri. LUMA tidak meminta public share link dan koneksi database hanya dapat dibaca oleh user pemilik.</p>
    <div className="card"><div className="section-head"><div><h3>Google Account Permission</h3><p className="muted">Scope: view daftar spreadsheet + read/write Google Sheets.</p></div><div className="button-row"><button className="primary" onClick={connect}>Connect Google</button><button className="secondary" disabled={!token||busy} onClick={()=>listSheets()}>Refresh Files</button></div></div><div className="flash success">{status}</div></div>
    {!!sheets.length&&<div className="card"><h3>My Private Spreadsheets</h3><div className="sheet-picker">{sheets.map(s=><button className={`sheet-file ${selected?.id===s.id?"active":""}`} key={s.id} onClick={()=>choose(s)}><strong>{s.name}</strong><span>{s.modifiedTime?new Date(s.modifiedTime).toLocaleString("id-ID"):"Google Sheet"}</span></button>)}</div></div>}
    {selected&&<div className="card"><div className="section-head"><div><h3>{selected.name}</h3><p className="muted">Private spreadsheet · ID disimpan, bukan public URL.</p></div><div className="button-row"><button className="secondary" onClick={()=>loadValues()}>Reload</button><button className="primary" disabled={!token||busy} onClick={save}>Save Changes</button></div></div>{values.length?<div className="sheet-grid-wrap"><table className="sheet-grid"><tbody>{values.map((row,r)=><tr key={r}>{Array.from({length:Math.max(1,...values.map(x=>x.length))}).map((_,c)=><td key={c}><input value={row[c]||""} onChange={e=>changeCell(r,c,e.target.value)}/></td>)}</tr>)}</tbody></table></div>:<div className="empty-state"><strong>Belum ada data preview.</strong><span>Klik Reload setelah Google terhubung.</span></div>}</div>}
  </section>;
}
