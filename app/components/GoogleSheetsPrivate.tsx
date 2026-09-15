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
  const [status,setStatus]=useState("Google Sheets belum diizinkan untuk user ini.");
  const [busy,setBusy]=useState(false);
  const [googleLinked,setGoogleLinked]=useState(false);

  useEffect(()=>{
    let alive=true;
    void restoreSession();
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!alive||!session)return;
      const providerToken=(session as any).provider_token||"";
      if(providerToken){
        sessionStorage.setItem("luma_google_provider_token",providerToken);
        setToken(providerToken);
        setTimeout(()=>void listSheets(providerToken),0);
      }
    });
    return()=>{alive=false;subscription.unsubscribe()};
  },[workspaceId]);

  async function restoreSession(){
    const [{data:{session}},{data:identityData},{data:connection}]=await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUserIdentities(),
      supabase.from("google_sheet_connections").select("spreadsheet_id,spreadsheet_name,status").eq("workspace_id",workspaceId).maybeSingle(),
    ]);
    const linked=(identityData?.identities||[]).some((x:any)=>x.provider==="google");
    setGoogleLinked(linked);
    const providerToken=(session as any)?.provider_token||sessionStorage.getItem("luma_google_provider_token")||"";
    if(providerToken){setToken(providerToken);await listSheets(providerToken)}
    if(connection?.spreadsheet_id)setSelected({id:connection.spreadsheet_id,name:connection.spreadsheet_name||"Connected Sheet"});
  }

  async function connect(){
    setStatus("Membuka izin Google untuk akun user yang sedang login...");
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return setStatus("Session user tidak ditemukan. Login ulang terlebih dahulu.");
    const options={
      redirectTo:`${window.location.origin}/#google-sheets-private`,
      scopes:"https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly",
      queryParams:{access_type:"offline",prompt:"consent",include_granted_scopes:"true",login_hint:user.email||""},
    } as any;

    if(!googleLinked){
      const {error}=await supabase.auth.linkIdentity({provider:"google",options});
      if(error)return setStatus(`Google belum dapat ditautkan ke user ini: ${error.message}`);
      return;
    }

    const {error}=await supabase.auth.signInWithOAuth({provider:"google",options});
    if(error)setStatus(error.message);
  }

  async function listSheets(accessToken=token){
    if(!accessToken)return setStatus("Klik Authorize Google Sheets untuk memberi izin private ke akun Google Anda.");
    setBusy(true);setStatus("Membaca daftar spreadsheet private milik akun Google Anda...");
    try{
      const url="https://www.googleapis.com/drive/v3/files?q="+encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false")+"&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=100";
      const r=await fetch(url,{headers:{Authorization:`Bearer ${accessToken}`}});const d=await r.json();
      if(r.status===401){sessionStorage.removeItem("luma_google_provider_token");setToken("");throw new Error("Izin Google sudah kedaluwarsa. Klik Authorize Google Sheets untuk mengizinkan kembali.");}
      if(!r.ok)throw new Error(d?.error?.message||"Gagal membaca Google Drive.");
      setSheets(d.files||[]);setStatus(`${(d.files||[]).length} spreadsheet private ditemukan. Tidak ada public share link yang digunakan.`);
    }catch(e:any){setStatus(e.message||"Google connection gagal.");}finally{setBusy(false)}
  }

  async function choose(sheet:Sheet){
    setSelected(sheet);setStatus(`Menghubungkan ${sheet.name} ke workspace user...`);
    const {data:{user}}=await supabase.auth.getUser();if(!user)return;
    const {error}=await supabase.from("google_sheet_connections").upsert({workspace_id:workspaceId,user_id:user.id,spreadsheet_id:sheet.id,spreadsheet_name:sheet.name,status:"connected",updated_at:new Date().toISOString()},{onConflict:"user_id,workspace_id"});
    if(error)return setStatus(error.message);await loadValues(sheet.id);
  }

  async function loadValues(id=selected?.id||""){
    if(!token||!id)return setStatus("Authorize Google Sheets terlebih dahulu untuk membaca file private ini.");
    setBusy(true);setStatus("Memuat data spreadsheet...");
    try{
      const meta=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties.title`,{headers:{Authorization:`Bearer ${token}`}});const md=await meta.json();if(!meta.ok)throw new Error(md?.error?.message||"Gagal membaca metadata spreadsheet.");
      const firstTitle=md?.sheets?.[0]?.properties?.title||"Sheet1";
      const range=`${firstTitle}!A1:Z100`;
      const r=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}`,{headers:{Authorization:`Bearer ${token}`}});const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"Gagal membaca spreadsheet.");
      setValues((d.values||[]).map((row:any[])=>row.map(x=>String(x??""))));setStatus(`Spreadsheet siap dilihat dan diedit · ${firstTitle}`);
    }catch(e:any){setStatus(e.message)}finally{setBusy(false)}
  }

  function changeCell(r:number,c:number,value:string){setValues(prev=>{const next=prev.map(row=>[...row]);while(next.length<=r)next.push([]);while(next[r].length<=c)next[r].push("");next[r][c]=value;return next})}

  async function save(){
    if(!token||!selected)return;setBusy(true);setStatus("Menyimpan perubahan ke Google Sheets...");
    try{
      const meta=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${selected.id}?fields=sheets.properties.title`,{headers:{Authorization:`Bearer ${token}`}});const md=await meta.json();if(!meta.ok)throw new Error(md?.error?.message||"Gagal membaca metadata spreadsheet.");
      const firstTitle=md?.sheets?.[0]?.properties?.title||"Sheet1";const range=`${firstTitle}!A1`;
      const r=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${selected.id}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,{method:"PUT",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({range,majorDimension:"ROWS",values})});const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"Gagal menyimpan.");setStatus(`Tersimpan · ${d.updatedCells||0} cell diperbarui di file private user.`);
    }catch(e:any){setStatus(e.message)}finally{setBusy(false)}
  }

  return <section id="google-sheets-private" className="legacy-page-anchor gs-page">
    <div className="eyebrow">INTEGRATION · PRIVATE PER USER</div><h1>Google Sheets</h1><p className="muted">Setiap user mengizinkan akun Google miliknya sendiri. Tidak perlu share link, tidak dibuat public, dan pilihan spreadsheet hanya tersimpan untuk user + workspace tersebut.</p>
    <div className="card"><div className="section-head"><div><h3>Google Account Permission</h3><p className="muted">Akses yang diminta hanya daftar spreadsheet serta read/write Google Sheets atas izin user.</p></div><div className="button-row"><button className="primary" onClick={connect}>{token?"Re-authorize Google":"Authorize Google Sheets"}</button><button className="secondary" disabled={!token||busy} onClick={()=>listSheets()}>Refresh Files</button></div></div><div className={`flash ${token?"success":""}`}>{status}</div></div>
    {!!sheets.length&&<div className="card"><h3>My Private Spreadsheets</h3><div className="sheet-picker">{sheets.map(s=><button className={`sheet-file ${selected?.id===s.id?"active":""}`} key={s.id} onClick={()=>choose(s)}><strong>{s.name}</strong><span>{s.modifiedTime?new Date(s.modifiedTime).toLocaleString("id-ID"):"Google Sheet"}</span></button>)}</div></div>}
    {selected&&<div className="card"><div className="section-head"><div><h3>{selected.name}</h3><p className="muted">Private spreadsheet · yang disimpan hanya Spreadsheet ID + nama, bukan public URL.</p></div><div className="button-row"><button className="secondary" onClick={()=>loadValues()}>Reload</button><button className="primary" disabled={!token||busy} onClick={save}>Save Changes</button></div></div>{values.length?<div className="sheet-grid-wrap"><table className="sheet-grid"><tbody>{values.map((row,r)=><tr key={r}>{Array.from({length:Math.max(1,...values.map(x=>x.length))}).map((_,c)=><td key={c}><input value={row[c]||""} onChange={e=>changeCell(r,c,e.target.value)}/></td>)}</tr>)}</tbody></table></div>:<div className="empty-state"><strong>Belum ada data preview.</strong><span>Klik Reload setelah Google terhubung.</span></div>}</div>}
  </section>;
}
