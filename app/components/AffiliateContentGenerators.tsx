"use client";

import { useMemo, useState } from "react";

type WhatsAppItem = {
  title: string;
  customer_name: string;
  messages: Array<{ from: "customer" | "brand"; text: string }>;
};

type ReviewItem = {
  username: string;
  rating: number;
  review: string;
  persona: string;
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function drawReview(canvas: HTMLCanvasElement, item: ReviewItem) {
  const ctx = canvas.getContext("2d")!;
  canvas.width = 1080;
  canvas.height = 1080;
  ctx.fillStyle = "#f6f7fb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#e4e7ec";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(70, 90, 940, 870, 36);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#d9d6ff";
  ctx.beginPath();
  ctx.arc(170, 210, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4f46e5";
  ctx.font = "700 42px Arial";
  ctx.textAlign = "center";
  ctx.fillText((item.username || "U").slice(0, 1).toUpperCase(), 170, 225);
  ctx.textAlign = "left";

  ctx.fillStyle = "#101828";
  ctx.font = "700 42px Arial";
  ctx.fillText(item.username, 260, 195);
  ctx.fillStyle = "#667085";
  ctx.font = "28px Arial";
  ctx.fillText(item.persona, 260, 240);

  ctx.fillStyle = "#f59e0b";
  ctx.font = "38px Arial";
  ctx.fillText("★".repeat(Math.max(1, Math.min(5, item.rating || 5))), 105, 360);

  ctx.fillStyle = "#344054";
  ctx.font = "34px Arial";
  const lines = wrapText(ctx, item.review, 820);
  lines.slice(0, 10).forEach((line, index) => ctx.fillText(line, 105, 450 + index * 48));

  ctx.fillStyle = "#98a2b3";
  ctx.font = "700 24px Arial";
  ctx.fillText("LUMAWAY · Review Generator", 105, 900);
}

function drawConversation(canvas: HTMLCanvasElement, item: WhatsAppItem, visibleCount = item.messages.length) {
  const ctx = canvas.getContext("2d")!;
  canvas.width = 720;
  canvas.height = 1280;
  ctx.fillStyle = "#efeae2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0b5d4d";
  ctx.fillRect(0, 0, canvas.width, 116);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 28px Arial";
  ctx.fillText(item.customer_name || "Customer", 92, 54);
  ctx.font = "20px Arial";
  ctx.fillText("online", 92, 86);

  let y = 150;
  ctx.font = "24px Arial";
  for (const message of item.messages.slice(0, visibleCount)) {
    const mine = message.from === "brand";
    const maxWidth = 450;
    const lines = wrapText(ctx, message.text, maxWidth - 40);
    const height = 34 + lines.length * 34;
    const width = Math.min(maxWidth, Math.max(180, Math.max(...lines.map((line) => ctx.measureText(line).width), 160) + 40));
    const x = mine ? canvas.width - width - 28 : 28;
    if (y + height > canvas.height - 90) break;
    ctx.fillStyle = mine ? "#d9fdd3" : "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 18);
    ctx.fill();
    ctx.fillStyle = "#1f2937";
    lines.forEach((line, index) => ctx.fillText(line, x + 20, y + 37 + index * 34));
    y += height + 18;
  }

  ctx.fillStyle = "rgba(15,23,42,.55)";
  ctx.font = "700 18px Arial";
  ctx.fillText("LUMAWAY", 28, 1240);
  ctx.font = "16px Arial";
  ctx.fillText("Generated preview", 145, 1240);
}

export default function AffiliateContentGenerators({ workspaceId }: { workspaceId: string }) {
  const [kind, setKind] = useState<"whatsapp" | "review">("whatsapp");
  const [subject, setSubject] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Natural, hangat, conversational");
  const [keyPoints, setKeyPoints] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const title = kind === "whatsapp" ? "WhatsApp Generator" : "Ulasan Generator";
  const description = kind === "whatsapp"
    ? "Buat 5 percakapan WhatsApp-style yang natural untuk materi promosi, edukasi, atau simulasi customer journey."
    : "Buat 5 kartu ulasan yang lebih manusiawi dengan username, rating, persona, dan gaya bahasa yang berbeda.";

  async function generate() {
    if (!subject.trim()) return setStatus("Isi produk atau topik terlebih dahulu.");
    setBusy(true);
    setStatus("");
    setItems([]);
    try {
      const response = await fetch("/api/affiliate/generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          kind,
          subject,
          audience,
          tone,
          key_points: keyPoints,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error();
      setItems(Array.isArray(data.items) ? data.items : []);
      setStatus("Selesai. 5 template dibuat gratis tanpa menggunakan token.");
    } catch {
      setStatus("error, terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadReview(item: ReviewItem, index: number) {
    const canvas = document.createElement("canvas");
    drawReview(canvas, item);
    canvas.toBlob((blob) => blob && downloadBlob(blob, `lumaway-review-${index + 1}.png`), "image/png");
  }

  async function downloadChatPng(item: WhatsAppItem, index: number) {
    const canvas = document.createElement("canvas");
    drawConversation(canvas, item);
    canvas.toBlob((blob) => blob && downloadBlob(blob, `lumaway-whatsapp-${index + 1}.png`), "image/png");
  }

  async function downloadChatVideo(item: WhatsAppItem, index: number) {
    const canvas = document.createElement("canvas");
    const stream = (canvas as any).captureStream?.(24);
    if (!stream || typeof MediaRecorder === "undefined") {
      await downloadChatPng(item, index);
      setStatus("Browser ini belum mendukung export video. Preview disimpan sebagai PNG.");
      return;
    }
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => downloadBlob(new Blob(chunks, { type: mime }), `lumaway-whatsapp-${index + 1}.webm`);
    recorder.start();
    for (let visible = 1; visible <= item.messages.length; visible += 1) {
      drawConversation(canvas, item, visible);
      await new Promise((resolve) => window.setTimeout(resolve, 650));
    }
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    recorder.stop();
  }

  return (
    <div className="card affiliate-generator">
      <div className="affiliate-generator-head">
        <div>
          <span className="subscription-kicker">FREE CREATIVE TOOL</span>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
        <div className="generator-tabs">
          <button className={kind === "whatsapp" ? "active" : ""} onClick={() => { setKind("whatsapp"); setItems([]); }}>WhatsApp</button>
          <button className={kind === "review" ? "active" : ""} onClick={() => { setKind("review"); setItems([]); }}>Ulasan</button>
        </div>
      </div>

      <div className="generator-form-grid">
        <label>Produk / Topik<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Contoh: Lumaway Affiliate Intelligence" /></label>
        <label>Target audiens<input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Contoh: seller marketplace, affiliate specialist" /></label>
        <label>Gaya bahasa<select value={tone} onChange={(event) => setTone(event.target.value)}><option>Natural, hangat, conversational</option><option>Profesional dan ringan</option><option>Santai dan friendly</option><option>Persuasif soft-selling</option><option>Edukasi sederhana</option><option>Antusias tetapi tetap natural</option></select></label>
        <label className="generator-keypoints">Poin penting<textarea value={keyPoints} onChange={(event) => setKeyPoints(event.target.value)} placeholder="Tuliskan konteks, manfaat, keberatan customer, atau poin yang wajib masuk." /></label>
      </div>
      <div className="generator-actions"><button className="primary" disabled={busy} onClick={generate}>{busy ? "Generating..." : "Generate 5 Template · Gratis"}</button><span>Tidak menggunakan token user.</span></div>
      {status && <div className={status.startsWith("error") ? "flash error" : "owner-inline-note"}>{status}</div>}

      {items.length > 0 && (
        <div className="generator-result-rail">
          {kind === "whatsapp"
            ? (items as WhatsAppItem[]).map((item, index) => (
              <article className="whatsapp-preview-card" key={index}>
                <div className="wa-preview-head"><div className="wa-avatar">{(item.customer_name || "C").slice(0, 1).toUpperCase()}</div><div><strong>{item.customer_name}</strong><small>online</small></div></div>
                <div className="wa-preview-body">{item.messages.map((message, messageIndex) => <p key={messageIndex} className={message.from === "brand" ? "wa-me" : "wa-them"}>{message.text}</p>)}</div>
                <div className="generator-watermark">LUMAWAY · Light Up Your Potential.</div>
                <div className="generator-card-actions"><button onClick={() => downloadChatPng(item, index)}>PNG</button><button onClick={() => void downloadChatVideo(item, index)}>Video</button></div>
              </article>
            ))
            : (items as ReviewItem[]).map((item, index) => (
              <article className="review-preview-card" key={index}>
                <div className="review-user"><span>{(item.username || "U").slice(0, 1).toUpperCase()}</span><div><strong>{item.username}</strong><small>{item.persona}</small></div></div>
                <div className="review-stars">{"★".repeat(Math.max(1, Math.min(5, Number(item.rating) || 5)))}</div>
                <p>{item.review}</p>
                <div className="generator-watermark">LUMAWAY.</div>
                <div className="generator-card-actions"><button onClick={() => downloadReview(item, index)}>Download PNG</button></div>
              </article>
            ))}
        </div>
      )}
    </div>
  );
}
