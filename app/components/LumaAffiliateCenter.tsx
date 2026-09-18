"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Row=Record<string,any>;
type ChatVariant={title:string;contact_name:string;messages:{side:"incoming"|"outgoing";text:string}[]};
type ReviewVariant={username:string;rating:number;review:string;avatar_style:string};
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const CHANNELS=[
  ["BANK","BCA","BCA"],["BANK","BNI","BNI"],["BANK","BRI","BRI"],["BANK","MANDIRI","Mandiri"],["BANK","PERMATA","Permata"],
  ["EWALLET","ID_DANA","DANA"],["EWALLET","ID_GOPAY","GoPay"],["EWALLET","ID_OVO","OVO"],["EWALLET","ID_SHOPEEPAY","ShopeePay"],
] as const;

function wrapText(ctx:CanvasRenderingContext2D,text:string,maxWidth:number){
  const words=String(text||"").split(/\s+/);const lines:string[]=[];let line="";
  for(const word of words){const test=line?line+" "+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test}
  if(line)lines.push(line);return lines;
}
function downloadCanvas(canvas:HTMLCanvasElement,name:string){canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)},"image/png")}
function drawLumawayMark(ctx:CanvasRenderingContext2D,w:number,h:number,label="SIMULASI / MOCKUP"){
  ctx.fillStyle="rgba(15,23,42,.58)";ctx.font="700 20px Arial";ctx.fillText(label,34,42);
  ctx.fillStyle="rgba(99,91,255,.72)";ctx.font="800 18px Arial";ctx.textAlign="right";ctx.fillText("LUMAWAY.",w-30,h-28);ctx.textAlign="left";
}
function renderReview(variant:ReviewVariant){
  const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1080;const ctx=canvas.getContext("2d")!;
  ctx.fillStyle="#f8fafc";ctx.fillRect(0,0,1080,1080);ctx.fillStyle="#fff";ctx.strokeStyle="#e2e8f0";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(90,160,900,690,34);ctx.fill();ctx.stroke();
  ctx.fillStyle="#ede9fe";ctx.beginPath();ctx.arc(190,270,62,0,Math.PI*2);ctx.fill();ctx.fillStyle="#4f46e5";ctx.font="800 42px Arial";ctx.textAlign="center";ctx.fillText(variant.username.slice(0,1).toUpperCase(),190,284);ctx.textAlign="left";
  ctx.fillStyle="#0f172a";ctx.font="800 34px Arial";ctx.fillText(variant.username,285,250);ctx.fillStyle="#f59e0b";ctx.font="32px Arial";ctx.fillText("★".repeat(Math.max(1,Math.min(5,variant.rating))),285,302);
  ctx.fillStyle="#334155";ctx.font="500 31px Arial";const lines=wrapText(ctx,variant.review,750);lines.slice(0,10).forEach((line,i)=>ctx.fillText(line,145,410+i*48));
  drawLumawayMark(ctx,1080,1080);return canvas;
}
function renderChat(variant:ChatVariant,offset=0){
  const canvas=document.createElement("canvas");canvas.width=720;canvas.height=1280;const ctx=canvas.getContext("2d")!;
  ctx.fillStyle="#e7efe9";ctx.fillRect(0,0,720,1280);ctx.fillStyle="#0b5c4b";ctx.fillRect(0,0,720,118);ctx.fillStyle="#fff";ctx.font="800 27px Arial";ctx.fillText(variant.contact_name,78,54);ctx.font="500 16px Arial";ctx.fillStyle="#d7efe8";ctx.fillText("online · simulasi percakapan",78,83);
  const bubbles:{side:string;lines:string[];height:number}[]=[];ctx.font="500 21px Arial";
  for(const m of variant.messages){const lines=wrapText(ctx,m.text,430);bubbles.push({side:m.side,lines,height:Math.max(54,lines.length*29+26)})}
  let total=0;for(const b of bubbles)total+=b.height+14;const maxOffset=Math.max(0,total-(1280-210));let y=150-Math.min(maxOffset,offset);
  for(const b of bubbles){const bw=480,bx=b.side==="outgoing"?720-bw-28:28;ctx.fillStyle=b.side==="outgoing"?"#d9fdd3":"#fff";ctx.beginPath();ctx.roundRect(bx,y,bw,b.height,16);ctx.fill();ctx.fillStyle="#1f2937";ctx.font="500 21px Arial";b.lines.forEach((line,i)=>ctx.fillText(line,bx+18,y+31+i*29));y+=b.height+14}
  drawLumawayMark(ctx,720,1280);return {canvas,maxOffset};
}
async function downloadChatVideo(variant:ChatVariant,index:number){
  const probe=renderChat(variant,0);const stream=(probe.canvas as any).captureStream?.(30);if(!stream||typeof MediaRecorder==="undefined"){downloadCanvas(probe.canvas,`lumaway-chat-${index+1}.png`);return}
  const chunks:BlobPart[]=[];const recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm"});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  const done=new Promise<void>(resolve=>{recorder.onstop=()=>{const blob=new Blob(chunks,{type:"video/webm"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`lumaway-chat-${index+1}.webm`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);resolve()}});
  recorder.start();const duration=5200,start=performance.now();await new Promise<void>(resolve=>{function tick(now:number){const p=Math.min(1,(now-start)/duration);const frame=renderChat(variant,probe.maxOffset*p);const ctx=probe.canvas.getContext("2d")!;ctx.clearRect(0,0,720,1280);ctx.drawImage(frame.canvas,0,0);if(p<1)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)});recorder.stop();await done;
}

export default function LumaAffiliateCenter({workspaceId,userId}:{workspaceId:string;userId:string}){
  const supabase=createClient();
  const [profile,setProfile]=useState<Row|null>(null);const [events,setEvents]=useState<Row[]>([]);const [withdrawals,setWithdrawals]=useState<Row[]>([]);
  const [status,setStatus]=useState("");const [amount,setAmount]=useState("");const [channel,setChannel]=useState("BCA");const [account,setAccount]=useState("");const [accountName,setAccountName]=useState("");const [busy,setBusy]=useState(false);const [origin,setOrigin]=useState("");
  const [genBusy,setGenBusy]=useState(false);const [genStatus,setGenStatus]=useState("");const [brief,setBrief]=useState({product:"",context:"",audience:"",tone:"friendly",rating:5});const [chats,setChats]=useState<ChatVariant[]>([]);const [reviews,setReviews]=useState<ReviewVariant[]>([]);

  async function load(){const [p,e,w]=await Promise.all([supabase.from("referral_profiles").select("*").eq("user_id",userId).maybeSingle(),supabase.from("referral_events").select("*").eq("referrer_user_id",userId).order("created_at",{ascending:false}).limit(200),supabase.from("referral_withdrawals").select("*").eq("user_id",userId).order("requested_at",{ascending:false}).limit(100)]);if(p.error)setStatus(p.error.message);else setProfile(p.data as Row);setEvents((e.data||[]) as Row[]);setWithdrawals((w.data||[]) as Row[])}
  useEffect(()=>{setOrigin(window.location.origin);void load()},[workspaceId,userId]);
  const referralUrl=profile?.referral_code&&origin?`${origin}/app.lumaway/register?ref=${profile.referral_code}`:"";
  const earned=useMemo(()=>events.filter(x=>["confirmed","paid"].includes(String(x.status).toLowerCase())).reduce((a,x)=>a+Number(x.commission_amount||0),0),[events]);
  const pending=useMemo(()=>events.filter(x=>String(x.status).toLowerCase()==="pending").reduce((a,x)=>a+Number(x.commission_amount||0),0),[events]);
  const reserved=useMemo(()=>withdrawals.filter(x=>["pending","processing","paid"].includes(String(x.status).toLowerCase())).reduce((a,x)=>a+Number(x.amount||0),0),[withdrawals]);
  const available=Math.max(0,earned-reserved);const chosen=CHANNELS.find(x=>x[1]===channel)||CHANNELS[0];

  async function copy(text:string){try{await navigator.clipboard.writeText(text);setStatus("Referral URL disalin.")}catch{setStatus("Tidak dapat menyalin otomatis. Silakan copy URL secara manual.")}}
  async function withdraw(){const numeric=Number(amount||0);if(!numeric||numeric<=0)return setStatus("Masukkan nominal withdraw.");if(numeric>available)return setStatus("Nominal melebihi saldo referral tersedia.");if(!account.trim())return setStatus("Nomor rekening / nomor e-wallet wajib diisi.");setBusy(true);setStatus("Membuat permintaan pencairan...");const {data,error}=await supabase.rpc("luma_request_referral_withdrawal",{p_workspace_id:workspaceId,p_amount:numeric,p_method:chosen[0],p_channel_code:chosen[1],p_account_number:account.trim(),p_account_name:accountName.trim()||null});setBusy(false);if(error)return setStatus(error.message);setStatus(`Permintaan withdraw #${data} dibuat. Status awal: pending review.`);setAmount("");setAccount("");setAccountName("");await load()}
  async function generateMockups(){if(!brief.product.trim()||!brief.context.trim())return setGenStatus("Produk/layanan dan konteks wajib diisi.");setGenBusy(true);setGenStatus("Membuat 5 variasi chat dan 5 mockup ulasan...");try{const r=await fetch("/api/affiliate/generator",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,...brief})});const d=await r.json();if(!r.ok||!d.ok)throw new Error();setChats(d.result?.whatsapp_variants||[]);setReviews(d.result?.review_variants||[]);setGenStatus("Selesai. Generator ini gratis dan tidak mengurangi token.")}catch{setGenStatus("error, terjadi kesalahan.")}finally{setGenBusy(false)}}

  return <section id="luma-affiliate" className="legacy-page-anchor affiliate-center">
    <div className="eyebrow">LUMA AFFILIATE</div><h1>Luma Affiliate</h1><p className="muted">Referral, komisi, payout, dan creative tools Lumaway dari satu halaman.</p>
    <div className="affiliate-summary-grid"><div className="card referral-link-card"><div className="section-head"><div><small>Referral Code</small><strong className="referral-code">{profile?.referral_code||"Belum tersedia"}</strong></div><span className="ref-percent">5%</span></div><label>Referral URL<div className="copy-field"><input readOnly value={referralUrl}/><button className="secondary" disabled={!referralUrl} onClick={()=>copy(referralUrl)}>Copy URL</button></div></label><p className="muted">User baru yang registrasi melalui URL akan terhubung ke kode referral Anda.</p></div><div className="affiliate-balance-card card"><span>Saldo dapat dicairkan</span><b>{money(available)}</b><div className="affiliate-mini-stats"><div><small>Confirmed</small><strong>{money(earned)}</strong></div><div><small>Pending</small><strong>{money(pending)}</strong></div><div><small>Withdrawn / Reserved</small><strong>{money(reserved)}</strong></div></div></div></div>

    <div className="card affiliate-generator">
      <div className="section-head"><div><div className="eyebrow">FREE CREATIVE TOOLS</div><h3>WhatsApp & Review Mockup Generator</h3><p className="muted">AI membuat 5 simulasi chat dan 5 mockup ulasan untuk desain, demo, training, atau materi konsep. Tidak memakai token Lumaway.</p></div><span className="free-tool-badge">FREE · 0 TOKEN</span></div>
      <div className="generator-safety-note"><b>Simulasi / Mockup</b><span>Output harus digunakan sebagai materi simulasi atau desain, bukan diklaim sebagai testimoni pelanggan nyata.</span></div>
      <div className="generator-form grid"><label>Produk / layanan<input value={brief.product} onChange={e=>setBrief({...brief,product:e.target.value})} placeholder="Contoh: Lumaway Affiliate Intelligence"/></label><label>Target audience<input value={brief.audience} onChange={e=>setBrief({...brief,audience:e.target.value})} placeholder="Contoh: seller & affiliate specialist"/></label><label>Gaya bahasa<select value={brief.tone} onChange={e=>setBrief({...brief,tone:e.target.value})}><option value="friendly">Friendly & natural</option><option value="professional">Professional</option><option value="casual">Casual</option><option value="educational">Educational</option></select></label><label>Rating mockup<select value={brief.rating} onChange={e=>setBrief({...brief,rating:Number(e.target.value)})}>{[5,4,3,2,1].map(x=><option key={x} value={x}>{x} bintang</option>)}</select></label></div>
      <label>Konteks / poin utama<textarea value={brief.context} onChange={e=>setBrief({...brief,context:e.target.value})} placeholder="Tuliskan fakta produk, situasi percakapan, benefit yang benar, dan konteks yang ingin disimulasikan."/></label>
      <button className="primary" disabled={genBusy} onClick={generateMockups}>{genBusy?"Generating...":"✦ Generate 5 Chat + 5 Review Mockup"}</button>{genStatus&&<div className={`owner-inline-note ${genStatus.startsWith("error")?"error":""}`}>{genStatus}</div>}
      {chats.length>0&&<><h3 className="generator-result-title">WhatsApp Mockups</h3><div className="generator-scroll">{chats.map((chat,i)=><article className="wa-mockup" key={i}><div className="wa-mockup-head"><div><b>{chat.contact_name}</b><small>Simulasi percakapan</small></div><span>#{i+1}</span></div><div className="wa-messages">{chat.messages.map((m,j)=><p key={j} className={m.side}><span>{m.text}</span></p>)}</div><div className="mockup-watermark">LUMAWAY. · SIMULASI</div><div className="button-row"><button onClick={()=>downloadCanvas(renderChat(chat).canvas,`lumaway-chat-${i+1}.png`)}>Download PNG</button><button onClick={()=>void downloadChatVideo(chat,i)}>Download Video</button></div></article>)}</div></>}
      {reviews.length>0&&<><h3 className="generator-result-title">Review Mockups</h3><div className="generator-scroll">{reviews.map((review,i)=><article className="review-mockup" key={i}><span className="mockup-label">SIMULASI / MOCKUP</span><div className="review-user"><i>{review.username.slice(0,1).toUpperCase()}</i><div><b>{review.username}</b><span>{"★".repeat(Math.max(1,Math.min(5,review.rating)))}</span></div></div><p>{review.review}</p><small>LUMAWAY.</small><button onClick={()=>downloadCanvas(renderReview(review),`lumaway-review-${i+1}.png`)}>Download PNG</button></article>)}</div></>}
    </div>

    <div className="grid affiliate-main-grid"><div className="card"><h3>Withdraw Commission</h3><p className="muted">Pencairan melalui Xendit Payout. Permintaan masuk ke review admin sebelum diproses.</p><div className="grid"><label>Nominal<input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Rp"/></label><label>Tujuan<select value={channel} onChange={e=>setChannel(e.target.value)}>{CHANNELS.map(x=><option key={x[1]} value={x[1]}>{x[2]} · {x[0]==="BANK"?"Bank":"E-Wallet"}</option>)}</select></label><label>Nomor rekening / e-wallet<input value={account} onChange={e=>setAccount(e.target.value)} placeholder={chosen[0]==="BANK"?"Nomor rekening":"Nomor HP e-wallet"}/></label><label>Nama pemilik<input value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Sesuai akun tujuan"/></label></div><button className="primary" disabled={busy||available<=0} onClick={withdraw}>{busy?"Processing...":"Ajukan Withdraw"}</button><div className="withdraw-guide"><b>Alur pencairan</b><span>1. Pilih tujuan → 2. Ajukan nominal → 3. Admin review → 4. Payout diproses → 5. Status paid.</span></div>{status&&<div className="flash success">{status}</div>}</div>
    <div className="card"><h3>Riwayat Withdraw</h3>{withdrawals.length?<div className="scroll"><table><thead><tr><th>ID</th><th>Amount</th><th>Channel</th><th>Status</th><th>Requested</th></tr></thead><tbody>{withdrawals.map(x=><tr key={x.id}><td>#{x.id}</td><td>{money(x.amount)}</td><td>{x.channel_code}</td><td><span className={`status-pill s-${String(x.status).toLowerCase()}`}>{x.status}</span></td><td>{x.requested_at?new Date(x.requested_at).toLocaleString("id-ID"):"-"}</td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Belum ada withdraw.</strong><span>Saldo confirmed akan tersedia untuk diajukan.</span></div>}</div></div>
    <div className="card"><div className="section-head"><div><h3>Riwayat Penjualan Referral</h3><p className="muted">Order, nilai transaksi, komisi 5%, dan status pencairan.</p></div></div>{events.length?<div className="scroll"><table><thead><tr><th>Order</th><th>Sale</th><th>Rate</th><th>Commission</th><th>Status</th><th>Date</th></tr></thead><tbody>{events.map(x=><tr key={x.id}><td>{x.reference||"-"}</td><td>{money(x.base_amount)}</td><td>{Number(x.commission_rate||.05)*100}%</td><td><b>{money(x.commission_amount)}</b></td><td><span className={`status-pill s-${String(x.status).toLowerCase()}`}>{x.status}</span></td><td>{x.created_at?new Date(x.created_at).toLocaleString("id-ID"):"-"}</td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Belum ada penjualan referral.</strong><span>Riwayat akan muncul setelah user referral melakukan pembayaran berhasil.</span></div>}</div>
  </section>;
}
