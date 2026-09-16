"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type ChatMessage = { id?: number|string; sender_type: string; body: string; created_at?: string };

type Props = {
  workspaceId: string;
  userId: string;
  fullName?: string | null;
  email?: string | null;
};

const QUICK = [
  "Ada data yang tidak muncul di dashboard",
  "Saya mengalami error saat upload",
  "Jelaskan fitur Lumaway yang sedang saya buka",
];

function getFirstName(fullName?: string|null, email?: string|null) {
  const source = String(fullName || email?.split("@")[0] || "Kak").trim();
  return source.split(/\s+/)[0] || "Kak";
}

export default function LumaHelpdeskAgent({workspaceId,userId,fullName,email}:Props){
  const supabase = useMemo(()=>createClient(),[]);
  const [open,setOpen]=useState(false);
  const [ticketId,setTicketId]=useState("");
  const [ticketCode,setTicketCode]=useState("");
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [input,setInput]=useState("");
  const [busy,setBusy]=useState(false);
  const [handoffRecommended,setHandoffRecommended]=useState(false);
  const [status,setStatus]=useState("");
  const scrollRef=useRef<HTMLDivElement|null>(null);
  const firstName=getFirstName(fullName,email);

  async function loadHistory(){
    const {data:ticket}=await supabase.from("luma_support_tickets").select("id,ticket_code,status").eq("workspace_id",workspaceId).eq("user_id",userId).order("updated_at",{ascending:false}).limit(1).maybeSingle();
    if(!ticket)return;
    setTicketId(ticket.id);setTicketCode(ticket.ticket_code||"");
    setHandoffRecommended(["escalated","waiting_human"].includes(String(ticket.status||"")));
    const {data}=await supabase.from("luma_support_messages").select("id,sender_type,body,created_at").eq("ticket_id",ticket.id).eq("user_id",userId).order("created_at",{ascending:true}).limit(80);
    setMessages((data||[]) as ChatMessage[]);
  }

  useEffect(()=>{void loadHistory()},[workspaceId,userId]);
  useEffect(()=>{if(open)setTimeout(()=>scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:"smooth"}),40)},[open,messages,busy]);

  async function send(text?:string){
    const message=String(text??input).trim();if(!message||busy)return;
    setInput("");setBusy(true);setStatus("");
    setMessages(v=>[...v,{id:`local-${Date.now()}`,sender_type:"user",body:message}]);
    try{
      const r=await fetch("/api/support/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,ticket_id:ticketId||undefined,message,page:window.location.hash||"#dashboard"})});
      const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Luma belum bisa merespons.");
      setTicketId(d.ticket_id||ticketId);setTicketCode(d.ticket_code||ticketCode);setHandoffRecommended(Boolean(d.escalation_recommended));
      setMessages(v=>[...v,{id:`ai-${Date.now()}`,sender_type:"agent",body:d.reply||"Saya siap membantu."}]);
    }catch(e:any){setStatus(e?.message||"Luma sedang tidak tersedia.");}
    finally{setBusy(false)}
  }

  async function escalate(){
    if(busy)return;setBusy(true);setStatus("");
    try{
      const r=await fetch("/api/support/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,ticket_id:ticketId||undefined,action:"escalate",message:"Solusi Luma belum menyelesaikan kendala saya. Mohon lanjutkan ke Support Lumaway melalui WhatsApp."})});
      const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Tiket belum dapat diteruskan.");
      setTicketId(d.ticket_id||ticketId);setTicketCode(d.ticket_code||ticketCode);setHandoffRecommended(false);
      const note=d.whatsapp_sent?`Tiket ${d.ticket_code} sudah diteruskan. Follow-up WhatsApp juga sudah dikirim ke nomor terverifikasi Anda.`:`Tiket ${d.ticket_code} sudah masuk ke Support Lumaway. ${d.phone_available?"WhatsApp belum berhasil dikirim, tetapi owner tetap dapat melihat tiket Anda.":"Verifikasi nomor WhatsApp di My Profile agar follow-up dapat dilanjutkan lewat WhatsApp."}`;
      setMessages(v=>[...v,{id:`system-${Date.now()}`,sender_type:"system",body:note}]);
    }catch(e:any){setStatus(e?.message||"Tiket belum dapat diteruskan.");}
    finally{setBusy(false)}
  }

  return <>
    <button className="luma-help-launcher" type="button" onClick={()=>setOpen(v=>!v)} aria-label="Buka Luma Help Desk">
      <span className="luma-help-launcher-ring"><img src="/luma-mark.png" alt=""/></span>
      <span className="luma-help-online"/>
    </button>

    {open&&<section className="luma-help-panel" aria-label="Luma Help Desk">
      <header className="luma-help-head">
        <div className="luma-help-agent"><div className="luma-help-avatar"><img src="/luma-mark.png" alt="Luma"/></div><div><strong>Luma</strong><span><i/> Lumaway Help Desk</span></div></div>
        <div className="luma-help-head-actions"><button type="button" onClick={()=>void loadHistory()} title="Refresh">↻</button><button type="button" onClick={()=>setOpen(false)} title="Tutup">×</button></div>
      </header>

      <div className="luma-help-intro"><span>Halo, {firstName}</span><strong>Ada yang bisa Luma bantu?</strong><p>Luma khusus membantu penggunaan, error, bug, dan kebutuhan seputar Lumaway.</p></div>

      <div className="luma-help-thread" ref={scrollRef}>
        {!messages.length&&<div className="luma-help-quick">{QUICK.map(q=><button type="button" key={q} onClick={()=>void send(q)}>{q}</button>)}</div>}
        {messages.map((m,i)=><div key={String(m.id??i)} className={`luma-help-msg ${m.sender_type==="user"?"user":m.sender_type==="system"?"system":"agent"}`}><div>{m.body}</div></div>)}
        {busy&&<div className="luma-help-msg agent"><div className="luma-help-typing"><span/><span/><span/></div></div>}
      </div>

      {(handoffRecommended||messages.length>=6)&&<div className="luma-help-handoff"><div><b>Masih belum selesai?</b><span>Lanjutkan sebagai tiket Support Lumaway. Konteks percakapan ini tetap dibawa.</span></div><button type="button" onClick={escalate} disabled={busy}>Lanjut ke WhatsApp</button></div>}
      {status&&<div className="luma-help-status">{status}</div>}
      {ticketCode&&<div className="luma-help-ticket">Ticket: {ticketCode}</div>}

      <footer className="luma-help-compose"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send()}}} placeholder={`Tulis kendala Anda, ${firstName}...`} rows={1}/><button type="button" onClick={()=>void send()} disabled={busy||!input.trim()} aria-label="Kirim">➤</button></footer>
      <small className="luma-help-note">Luma hanya membantu produk Lumaway dan tidak dapat mengakses credential, data admin, atau data user lain.</small>
    </section>}
  </>;
}
