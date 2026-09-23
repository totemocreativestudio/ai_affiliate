"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ChatMessage={id?:number|string;sender_type:"user"|"agent"|"owner"|"system"|"whatsapp";body:string;created_at?:string;metadata?:any};
type Props={workspaceId:string;userId:string;userName:string|null};

const QUICK=["Dashboard saya error","Data upload tidak masuk","Token / billing bermasalah","Referral / withdraw belum sesuai"];

export default function LumaHelpDesk({workspaceId,userId,userName}:Props){
  const name=useMemo(()=>String(userName||"Kak").trim().split(/\s+/)[0]||"Kak",[userName]);
  const [open,setOpen]=useState(false);const [messages,setMessages]=useState<ChatMessage[]>([]);const [ticketId,setTicketId]=useState<string>("");const [ticketCode,setTicketCode]=useState<string>("");const [input,setInput]=useState("");const [busy,setBusy]=useState(false);const [escalateRecommended,setEscalateRecommended]=useState(false);const [escalated,setEscalated]=useState(false);const [notice,setNotice]=useState("");const [voiceLang,setVoiceLang]=useState<"id-ID"|"en-US">("id-ID");const [listening,setListening]=useState(false);const recognitionRef=useRef<any>(null);const endRef=useRef<HTMLDivElement|null>(null);

  async function load(){
    try{const r=await fetch(`/api/support/tickets?workspace_id=${encodeURIComponent(workspaceId)}`,{cache:"no-store"});const d=await r.json();if(!r.ok||!d.ok)return;const t=d.active_ticket;if(t){setTicketId(t.id);setTicketCode(t.ticket_code||"");setEscalated(["escalated","open","awaiting_user"].includes(t.status));}setMessages((d.messages||[]) as ChatMessage[]);}catch{}
  }
  useEffect(()=>{if(open)void load()},[open,workspaceId,userId]);
  useEffect(()=>{if(!open)return;const timer=window.setInterval(()=>void load(),15000);return()=>window.clearInterval(timer)},[open,workspaceId,userId]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[messages,busy,open]);

  async function send(text?:string){
    const value=String(text??input).trim();if(!value||busy)return;setBusy(true);setNotice("");setInput("");setMessages(prev=>[...prev,{sender_type:"user",body:value,created_at:new Date().toISOString()}]);
    try{const r=await fetch("/api/support/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,ticket_id:ticketId||undefined,message:value,page:window.location.hash||"#dashboard"})});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Luma belum bisa menjawab.");setTicketId(d.ticket_id||ticketId);setTicketCode(d.ticket_code||ticketCode);setEscalateRecommended(Boolean(d.escalation_recommended));setMessages(prev=>[...prev,{sender_type:"agent",body:d.reply,metadata:{suggested_actions:d.suggested_actions||[]},created_at:new Date().toISOString()}]);}catch(e:any){setNotice(e?.message||"Luma sedang mengalami kendala. Coba lagi sebentar.");}finally{setBusy(false)}
  }

  function toggleVoice(){
    if(listening){try{recognitionRef.current?.stop()}catch{};setListening(false);return}
    const SpeechRecognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SpeechRecognition){setNotice("Perekam suara belum didukung browser ini. Gunakan Chrome/Edge terbaru atau ketik pesan.");return}
    const recognition=new SpeechRecognition();
    recognition.lang=voiceLang;
    recognition.continuous=false;
    recognition.interimResults=true;
    recognition.maxAlternatives=1;
    recognition.onstart=()=>{setListening(true);setNotice(voiceLang==="id-ID"?"Mendengarkan Bahasa Indonesia...":"Listening in English...")};
    recognition.onresult=(event:any)=>{
      let finalText="";let interim="";
      for(let i=event.resultIndex;i<event.results.length;i++){
        const text=String(event.results[i][0]?.transcript||"");
        if(event.results[i].isFinal)finalText+=text;else interim+=text;
      }
      const text=(finalText||interim).trim();
      if(text)setInput(prev=>finalText?([prev.trim(),text].filter(Boolean).join(" ")):text);
    };
    recognition.onerror=(event:any)=>{setListening(false);setNotice(event?.error==="not-allowed"?"Izin mikrofon ditolak. Aktifkan microphone permission untuk menggunakan voice input.":"Voice input tidak dapat diproses. Coba lagi.")};
    recognition.onend=()=>{setListening(false);setNotice("")};
    recognitionRef.current=recognition;
    try{recognition.start()}catch{setListening(false);setNotice("Voice input belum siap. Coba lagi.")}
  }

  async function escalate(){
    if(busy)return;setBusy(true);setNotice("");
    try{const r=await fetch("/api/support/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,ticket_id:ticketId||undefined,action:"escalate",message:"Solusi dari Luma Agent belum menyelesaikan kendala. Mohon bantuan Support Lumaway."})});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Gagal membuat tiket support.");setTicketId(d.ticket_id||ticketId);setTicketCode(d.ticket_code||ticketCode);setEscalated(true);setEscalateRecommended(false);setNotice(d.whatsapp_sent?`Ticket ${d.ticket_code} sudah diteruskan. Notifikasi WhatsApp juga terkirim.`:`Ticket ${d.ticket_code} sudah masuk ke Support Lumaway. Owner dapat melihat tiket ini dari Support Desk.`);await load();}catch(e:any){setNotice(e?.message||"Gagal meneruskan ke support.");}finally{setBusy(false)}
  }

  return <div className={`luma-helpdesk ${open?"is-open":""}`}>
    {open&&<section className="luma-helpdesk-panel" aria-label="Luma Help Desk">
      <header className="luma-helpdesk-head">
        <div className="luma-helpdesk-agent"><div className="luma-agent-avatar"><img src="/luma-mark.png" alt="Luma"/></div><div><small>Help Desk Lumaway</small><strong>Luma</strong><span><i/> Online assistant</span></div></div>
        <div className="luma-helpdesk-actions"><button title="Refresh" onClick={()=>void load()}>↻</button><button title="Tutup" onClick={()=>setOpen(false)}>×</button></div>
      </header>
      <div className="luma-helpdesk-hero"><p>Halo, <b>{name}</b> 👋</p><h3>Ada yang bisa Luma bantu?</h3><span>Luma fokus membantu penggunaan Lumaway, error, data, billing, referral, AI, dan kebutuhan produk.</span></div>
      <div className="luma-helpdesk-body">
        {messages.length===0&&<div className="luma-quick-list">{QUICK.map(q=><button key={q} onClick={()=>void send(q)}>{q}<span>→</span></button>)}</div>}
        <div className="luma-chat-list">{messages.map((m,i)=><div key={`${m.id||i}-${m.created_at||""}`} className={`luma-chat-row ${m.sender_type}`}><div className="luma-chat-bubble"><small>{m.sender_type==="user"?name:m.sender_type==="owner"?"Support Lumaway":m.sender_type==="system"?"System":"Luma"}</small><p>{m.body}</p>{Array.isArray(m.metadata?.suggested_actions)&&m.metadata.suggested_actions.length>0&&<div className="luma-suggested-actions">{m.metadata.suggested_actions.map((x:string)=><button key={x} onClick={()=>void send(x)}>{x}</button>)}</div>}</div></div>)}{busy&&<div className="luma-chat-row agent"><div className="luma-chat-bubble typing"><span/><span/><span/></div></div>}<div ref={endRef}/></div>
        {(escalateRecommended||escalated)&&<div className={`luma-handoff ${escalated?"done":""}`}><div><strong>{escalated?"Sudah diteruskan ke Support":"Masih belum selesai?"}</strong><span>{escalated?(ticketCode?`Ticket ${ticketCode} sedang ditangani.`:"Tim support akan membantu lebih lanjut."):"Luma bisa membuat tiket dan meneruskan konteks percakapan ke Support Lumaway."}</span></div>{!escalated&&<button onClick={()=>void escalate()} disabled={busy}>Hubungkan ke Support</button>}</div>}
        {notice&&<div className="luma-helpdesk-notice">{notice}</div>}
      </div>
      <footer className="luma-helpdesk-compose">
        <div className="luma-helpdesk-voice-controls">
          <select value={voiceLang} onChange={e=>setVoiceLang(e.target.value as "id-ID"|"en-US")} aria-label="Bahasa voice input"><option value="id-ID">ID</option><option value="en-US">EN</option></select>
          <button type="button" className={listening?"is-listening":""} onClick={toggleVoice} aria-label={listening?"Hentikan perekaman suara":"Mulai perekaman suara"} title={listening?"Stop voice input":"Voice input"}>{listening?"■":"🎙"}</button>
        </div>
        <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder={listening?(voiceLang==="id-ID"?"Silakan bicara...":"Speak now..."):`Tulis kebutuhan ${name}...`} rows={1} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}}}/>
        <button onClick={()=>void send()} disabled={busy||!input.trim()} aria-label="Kirim">➜</button>
        <p>Voice input hanya Bahasa Indonesia & English. Luma adalah AI Help Desk Lumaway; informasi sensitif dan data user lain tidak dapat diakses.</p>
      </footer>
    </section>}
    <button className="luma-helpdesk-launcher" onClick={()=>setOpen(v=>!v)} aria-label={open?"Tutup Luma":"Buka Luma Help Desk"}>{!open&&<span className="luma-launcher-callout">Jika ada yang bisa dibantu, panggil aku saja</span>}<span className="luma-launcher-ring"><img src="/luma-mark.png" alt="Luma"/></span>{!open&&<i/>}</button>
  </div>;
}
