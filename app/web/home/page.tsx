import Link from "next/link";
import {getPublicBlogs,STATIC_INSIGHTS} from "../../../lib/public-insights";

export const dynamic="force-dynamic";
export const metadata={
  title:"Lumaway — Light Up Your Potential.",
  description:"Business Intelligence Operating Workspace untuk menghubungkan data, analisis, AI insight, dan tindak lanjut bisnis.",
  alternates:{canonical:"https://www.lumaway.online/web/home"}
};

const capabilities=[
 ["Affiliate Intelligence","Baca kontribusi creator, produk, GMV, order, dan dukungan affiliate dari data workspace."],
 ["Product Intelligence","Hubungkan master produk, SKU, HPP, penjualan, dan konteks campaign dalam satu alur analisis."],
 ["AI Insights","Gunakan AI untuk merangkum pola, risiko, anomali, dan rekomendasi berdasarkan data yang tersedia."],
 ["Decision Workspace","Ubah insight menjadi pekerjaan, prioritas, catatan keputusan, dan tindak lanjut yang bisa dipantau."],
 ["Financial Intelligence","Baca penjualan, biaya API, cashflow, margin, laba/rugi, dan skenario HPP dalam owner workspace."],
 ["Market & R&D","Bangun fondasi riset pasar, kompetitor, hipotesis, eksperimen, dan pembelajaran marketing."]
];

const roles=[
 ["Brand Owner","Melihat kondisi bisnis tanpa harus menyusun laporan dari banyak file."],
 ["Marketplace Team","Merapikan data penjualan, creator, produk, dan periode untuk review operasional."],
 ["Marketing & Affiliate","Membaca performa creator dan campaign serta mengubah insight menjadi action."],
 ["Product & R&D","Menghubungkan sinyal pasar, produk, biaya, dan eksperimen untuk pengembangan berikutnya."],
 ["Agency","Mengelola konteks multi-workspace, laporan, dan analisis dengan alur yang konsisten."],
 ["Management","Mendapat ringkasan yang lebih mudah dibaca sebelum menentukan prioritas."]
];

export default async function PublicHome(){
 const dbPosts=await getPublicBlogs(3);
 const insightCards=dbPosts.length?dbPosts.map(p=>({slug:p.slug,title:p.title,description:p.excerpt||"Insight terbaru dari Lumaway.",category:p.category||"Insight"})):STATIC_INSIGHTS.slice(0,3).map(p=>({slug:p.slug,title:p.title,description:p.description,category:p.category}));
 return <main>
  <header className="lw-nav"><Link href="/web/home" className="lw-brand"><img src="/luma-mark.png" alt=""/><strong>LUMAWAY<span>.</span></strong></Link><nav><Link href="/web/home#platform">Platform</Link><Link href="/web/home#workflow">Cara Kerja</Link><Link href="/web/insights">Insights</Link><Link href="/web/pricing">Pricing</Link><Link href="/app.lumaway/login">Login</Link><Link className="lw-primary-link" href="/app.lumaway/register">Buat Akun</Link></nav></header>

  <section className="lw-hero"><div><span className="lw-eyebrow">BUSINESS INTELLIGENCE OPERATING WORKSPACE</span><h1>Data berlimpah.<br/>Saatnya punya<br/><em>arah yang jelas.</em></h1><p>Hubungkan data, temukan maknanya, dan ubah insight menjadi langkah berikutnya untuk bisnis Anda.</p><div className="lw-actions"><Link className="lw-button" href="/app.lumaway/register">Mulai dengan Lumaway →</Link><Link className="lw-text-link" href="/web/home#workflow">Lihat cara kerjanya ↓</Link></div></div><div className="lw-hero-visual"><div className="lw-glow"/><div className="lw-core"><img src="/luma-mark.png" alt=""/><strong>LUMAWAY</strong><span>DATA → UNDERSTAND → ANALYZE → DECIDE → ACT → GROW</span></div><div className="lw-orbit one">AI INSIGHT</div><div className="lw-orbit two">AFFILIATE</div><div className="lw-orbit three">FINANCE</div></div></section>

  <section className="lw-audience"><span>DIRANCANG UNTUK TIM YANG BERGERAK DENGAN DATA</span><div>{["Brand Owner","Marketplace","Marketing","Affiliate","Product & R&D","Agency"].map(x=><b key={x}>{x}</b>)}</div></section>

  <section className="lw-section lw-problem"><div><span className="lw-eyebrow">01 / TANTANGAN BISNIS</span><h2>Banyak laporan.<br/>Belum tentu banyak kejelasan.</h2><p>Data marketplace di satu tempat. Performa affiliate di tempat lain. Biaya operasional, API, dan catatan tim tersebar. Saat keputusan harus dibuat, konteks harus disusun dari awal.</p></div><div className="lw-problem-list">{[["01","Informasi tersebar","Waktu habis untuk menggabungkan file, dashboard, dan catatan."],["02","Konteks belum utuh","Angka berubah, tetapi penyebab dan dampaknya belum jelas."],["03","Insight berhenti di diskusi","Temuan belum otomatis menjadi pekerjaan dan keputusan terukur."]].map(([n,t,d])=><article key={n}><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div></article>)}</div></section>

  <section className="lw-transform"><div><small>DATA</small><strong>Informasi bisnis</strong></div><i>→</i><div className="active"><small>LUMAWAY</small><strong>Konteks terhubung</strong></div><i>→</i><div><small>DECISION</small><strong>Tindakan terukur</strong></div></section>

  <section className="lw-section" id="platform"><div className="lw-section-head"><div><span className="lw-eyebrow">02 / EKOSISTEM LUMAWAY</span><h2>Satu ruang kerja.<br/>Perspektif lebih utuh.</h2></div><p>Lumaway tidak berhenti sebagai dashboard. Data, analisis, AI, laporan, dan tindak lanjut disusun menjadi operating workspace untuk membantu tim melihat apa yang terjadi dan apa yang perlu dilakukan berikutnya.</p></div><div className="lw-cap-grid">{capabilities.map(([t,d],i)=><article key={t}><span>{String(i+1).padStart(2,"0")}</span><h3>{t}</h3><p>{d}</p></article>)}</div></section>

  <section className="lw-dark" id="workflow"><div><span className="lw-eyebrow">03 / CARA KERJA</span><h2>Dari data mentah,<br/>menuju keputusan.</h2><p>Setiap tahap memberi konteks untuk tahap berikutnya.</p></div><div className="lw-workflow">{[["01","Hubungkan","Upload dan satukan sumber yang relevan."],["02","Rapikan","Samakan identitas, periode, dan definisi metrik."],["03","Pahami","Baca kondisi bisnis bersama konteks."],["04","Analisis","Temukan pola, risiko, dan pertanyaan penting."],["05","Putuskan","Tentukan prioritas dengan bukti pendukung."],["06","Jalankan","Ubah keputusan menjadi pekerjaan dan evaluasi."]].map(([n,t,d])=><article key={n}><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div></article>)}</div></section>

  <section className="lw-section"><div className="lw-section-head"><div><span className="lw-eyebrow">04 / RELEVAN UNTUK TIM ANDA</span><h2>Beda peran.<br/>Satu kebutuhan akan kejelasan.</h2></div><p>Workspace dibuat untuk membantu setiap fungsi membaca data dalam bahasa yang lebih dekat dengan pekerjaannya.</p></div><div className="lw-role-grid">{roles.map(([t,d])=><article key={t}><h3>{t}</h3><p>{d}</p></article>)}</div></section>

  <section className="lw-section lw-insights"><div className="lw-section-head"><div><span className="lw-eyebrow">LUMAWAY INSIGHTS</span><h2>Perspektif untuk keputusan yang lebih baik.</h2></div><Link className="lw-text-link" href="/web/insights">Semua Insights →</Link></div><div className="lw-insight-grid">{insightCards.map(x=><Link href={`/web/insights/${x.slug}`} key={x.slug}><span>{x.category}</span><h3>{x.title}</h3><p>{x.description}</p><b>Baca insight →</b></Link>)}</div></section>

  <section className="lw-cta"><div><span className="lw-eyebrow">LIGHT UP YOUR POTENTIAL.</span><h2>Data Anda punya potensi.<br/>Mari temukan arahnya.</h2><p>Mulai dari workspace yang membantu tim memahami data, menyusun insight, dan menjaga tindak lanjut tetap terlihat.</p></div><div><Link className="lw-button light" href="/app.lumaway/register">Buat akun Lumaway →</Link><Link href="/web/contact?type=demo">Minta demo</Link></div></section>

  <footer className="lw-footer"><div className="lw-brand"><img src="/luma-mark.png" alt=""/><strong>LUMAWAY<span>.</span></strong></div><div><Link href="/web/insights">Insights</Link><Link href="/web/about">About</Link><Link href="/web/security">Security</Link><Link href="/web/privacy">Privacy</Link><Link href="/web/terms">Terms</Link></div><small>© {new Date().getFullYear()} Lumaway · Light Up Your Potential.</small></footer>
 </main>;
}
