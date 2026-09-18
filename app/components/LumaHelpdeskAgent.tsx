"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type ChatMessage = {
  id?: number | string;
  sender_type: string;
  body: string;
  created_at?: string;
  metadata?: any;
};

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

function getFirstName(fullName?: string | null, email?: string | null) {
  const source = String(fullName || email?.split("@")[0] || "Kak").trim();
  return source.split(/\s+/)[0] || "Kak";
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function LumaHelpdeskAgent({ workspaceId, userId, fullName, email }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [ticketCode, setTicketCode] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoffRecommended, setHandoffRecommended] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [status, setStatus] = useState("");
  const [suggested, setSuggested] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const firstName = getFirstName(fullName, email);

  async function loadHistory() {
    const { data: ticket } = await supabase
      .from("luma_support_tickets")
      .select("id,ticket_code,status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ticket) return;
    setTicketId(ticket.id);
    setTicketCode(ticket.ticket_code || "");
    setEscalated(["escalated", "waiting_human"].includes(String(ticket.status || "")));
    const { data } = await supabase
      .from("luma_support_messages")
      .select("id,sender_type,body,created_at,metadata")
      .eq("ticket_id", ticket.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(80);
    setMessages((data || []) as ChatMessage[]);
  }

  useEffect(() => {
    void loadHistory();
  }, [workspaceId, userId]);

  useEffect(() => {
    if (open) setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 40);
  }, [open, messages, busy]);

  useEffect(() => () => {
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
  }, [attachmentPreview]);

  function chooseAttachment(file: File | null) {
    setStatus("");
    if (!file) {
      setAttachment(null);
      setAttachmentPreview("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setStatus("Lampiran harus berupa foto.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setStatus("Ukuran foto melebihi 2 MB. Silakan unggah file yang lebih kecil.");
      return;
    }
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    setAttachment(file);
    setAttachmentPreview(URL.createObjectURL(file));
  }

  async function send(text?: string) {
    const message = String(text ?? input).trim();
    if ((!message && !attachment) || busy) return;

    const currentAttachment = attachment;
    const localPreview = attachmentPreview;
    setInput("");
    setAttachment(null);
    setAttachmentPreview("");
    setBusy(true);
    setStatus("");
    setSuggested([]);

    setMessages((value) => [
      ...value,
      {
        id: `local-${Date.now()}`,
        sender_type: "user",
        body: message || "Lampiran foto kendala",
        metadata: localPreview ? { attachment_preview: localPreview, attachment_name: currentAttachment?.name } : undefined,
      },
    ]);

    try {
      const imageDataUrl = currentAttachment ? await fileToDataUrl(currentAttachment) : "";
      const response = await fetch("/api/support/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          ticket_id: ticketId || undefined,
          message: message || "Mohon bantu analisis kendala pada foto terlampir.",
          page: window.location.pathname,
          image_data_url: imageDataUrl || undefined,
          image_name: currentAttachment?.name || undefined,
          image_type: currentAttachment?.type || undefined,
          image_size: currentAttachment?.size || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error();
      setTicketId(data.ticket_id || ticketId);
      setTicketCode(data.ticket_code || ticketCode);
      setHandoffRecommended(Boolean(data.escalation_recommended));
      setSuggested(Array.isArray(data.suggested_actions) ? data.suggested_actions : []);
      setMessages((value) => [
        ...value,
        { id: `ai-${Date.now()}`, sender_type: "agent", body: data.reply || "Saya siap membantu." },
      ]);
    } catch {
      setStatus("error, terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  }

  async function escalate() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/support/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          ticket_id: ticketId || undefined,
          action: "escalate",
          message: "Solusi Luma belum menyelesaikan kendala saya. Mohon lanjutkan ke Support Lumaway melalui WhatsApp.",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error();
      setTicketId(data.ticket_id || ticketId);
      setTicketCode(data.ticket_code || ticketCode);
      setHandoffRecommended(false);
      setEscalated(true);
      const note = data.whatsapp_sent
        ? `Tiket ${data.ticket_code} sudah diteruskan. Follow-up WhatsApp juga sudah dikirim ke nomor terverifikasi Anda.`
        : `Tiket ${data.ticket_code} sudah masuk ke Support Lumaway dan akan dilanjutkan oleh admin CS/owner.`;
      setMessages((value) => [...value, { id: `system-${Date.now()}`, sender_type: "system", body: note }]);
    } catch {
      setStatus("error, terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="luma-helpdesk">
      <button className="luma-helpdesk-launcher" type="button" onClick={() => setOpen((value) => !value)} aria-label="Buka Luma Help Desk">
        <span className="luma-launcher-ring"><img src="/luma-mark.png" alt="" /></span><i />
      </button>

      {open && (
        <section className="luma-helpdesk-panel" aria-label="Luma Help Desk">
          <header className="luma-helpdesk-head">
            <div className="luma-helpdesk-agent">
              <div className="luma-agent-avatar"><img src="/luma-mark.png" alt="Luma" /></div>
              <div><small>AI support Lumaway</small><strong>Luma</strong><span><i /> Online</span></div>
            </div>
            <div className="luma-helpdesk-actions">
              <button type="button" onClick={() => void loadHistory()} title="Refresh">↻</button>
              <button type="button" onClick={() => setOpen(false)} title="Tutup">×</button>
            </div>
          </header>

          <div className="luma-helpdesk-hero">
            <p>Halo, <b>{firstName}</b></p>
            <h3>Ada yang bisa Luma bantu?</h3>
            <span>Kirim pesan atau foto kendala. Foto maksimal 2 MB dan hanya digunakan untuk penanganan tiket Anda.</span>
          </div>

          <div className="luma-helpdesk-body" ref={scrollRef}>
            {!messages.length && <div className="luma-quick-list">{QUICK.map((question) => <button type="button" key={question} onClick={() => void send(question)}>{question}<span>→</span></button>)}</div>}
            <div className="luma-chat-list">
              {messages.map((message, index) => {
                const type = message.sender_type === "user" ? "user" : message.sender_type === "owner" ? "owner" : message.sender_type === "system" ? "system" : "agent";
                return (
                  <div key={String(message.id ?? index)} className={`luma-chat-row ${type}`}>
                    <div className="luma-chat-bubble">
                      <small>{type === "user" ? firstName : type === "owner" ? "Lumaway Support" : type === "system" ? "Status" : "Luma"}</small>
                      {message.metadata?.attachment_preview && <img className="luma-chat-attachment" src={message.metadata.attachment_preview} alt={message.metadata?.attachment_name || "Lampiran kendala"} />}
                      {message.metadata?.attachment_url && <img className="luma-chat-attachment" src={message.metadata.attachment_url} alt={message.metadata?.attachment_name || "Lampiran kendala"} />}
                      <p>{message.body}</p>
                    </div>
                  </div>
                );
              })}
              {busy && <div className="luma-chat-row agent"><div className="luma-chat-bubble typing"><span /><span /><span /></div></div>}
            </div>

            {suggested.length > 0 && <div className="luma-suggested-actions">{suggested.map((item) => <button key={item} type="button" onClick={() => void send(item)}>{item}</button>)}</div>}
            {(handoffRecommended || messages.length >= 6 || escalated) && (
              <div className={`luma-handoff ${escalated ? "done" : ""}`}>
                <div>
                  <strong>{escalated ? "Tiket sudah diteruskan" : "Masih belum selesai?"}</strong>
                  <span>{escalated ? `Support Lumaway akan melanjutkan penanganan tiket ${ticketCode || "Anda"}.` : "Lanjutkan ke Support Lumaway. Konteks percakapan dan foto kendala tetap dibawa agar Anda tidak perlu mengulang dari awal."}</span>
                </div>
                {!escalated && <button type="button" onClick={escalate} disabled={busy}>Lanjut ke WhatsApp</button>}
              </div>
            )}
            {status && <div className="luma-helpdesk-notice">{status}</div>}
          </div>

          <footer className="luma-helpdesk-compose">
            {attachmentPreview && <div className="luma-attachment-preview"><img src={attachmentPreview} alt="Preview lampiran" /><div><strong>{attachment?.name}</strong><span>{attachment ? (attachment.size / 1024 / 1024).toFixed(2) : "0"} MB</span></div><button type="button" onClick={() => chooseAttachment(null)}>×</button></div>}
            <div className="luma-compose-row">
              <label className="luma-attach-button" title="Lampirkan foto maksimal 2 MB">＋<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseAttachment(event.target.files?.[0] || null)} /></label>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={`Tulis kendala Anda, ${firstName}...`} rows={1} />
              <button type="button" onClick={() => void send()} disabled={busy || (!input.trim() && !attachment)} aria-label="Kirim">➤</button>
            </div>
            <p>{ticketCode ? `Ticket ${ticketCode} · ` : ""}Foto maksimal 2 MB · Luma tidak dapat mengakses credential, data admin, atau data user lain.</p>
          </footer>
        </section>
      )}
    </div>
  );
}
