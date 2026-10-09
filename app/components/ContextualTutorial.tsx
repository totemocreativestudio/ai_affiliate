"use client";

import {useEffect,useMemo,useState} from "react";
import {navigateToSection,sectionFromPath} from "../../lib/luma-navigation";
import LumaIcon from "./LumaIcon";

type Step={title:string;what:string;why:string;result:string};
type Guide={title:string;description:string;steps:Step[];featureRoute?:string};

const GUIDES:Record<string,Guide>={
 dashboard:{title:"Mulai dari Dashboard",description:"Baca kondisi workspace lalu pilih tindakan yang paling penting.",steps:[
  {title:"Baca Action Center",what:"Periksa Kritis, Hari Ini, dan 7 Hari.",why:"Ini memprioritaskan pekerjaan yang paling mendesak.",result:"Anda tahu tindakan pertama yang perlu dikerjakan."},
  {title:"Periksa KPI utama",what:"Lihat ringkasan performa dan perubahan periode.",why:"Dashboard memberi konteks sebelum masuk ke detail.",result:"Area yang perlu dibuka berikutnya lebih jelas."},
  {title:"Gunakan pencarian global",what:"Tekan Ctrl/Cmd + K untuk mencari creator, SKU, campaign, resi atau listing.",why:"Lebih cepat daripada mencari menu satu per satu.",result:"Data target terbuka langsung."}
 ]},
 upload:{title:"Upload Data",description:"Masukkan data marketplace dengan aman sebelum dipakai dashboard.",steps:[
  {title:"Pilih jenis data",what:"Tentukan Affiliate Performance, Product Performance atau jenis upload yang sesuai.",why:"Jenis data menentukan tujuan penyimpanan.",result:"Mapping diarahkan ke field yang benar."},
  {title:"Upload file",what:"Pilih XLSX/CSV dari marketplace.",why:"Lumaway membaca header dan contoh baris sebelum import.",result:"File masuk ke tahap mapping."},
  {title:"Periksa mapping",what:"Pastikan GMV, Order, Qty, Commission dan field penting lain cocok.",why:"Mapping salah dapat membuat analisis tidak akurat.",result:"Preview siap diperiksa."},
  {title:"Preview lalu import",what:"Periksa contoh row kemudian Import.",why:"Preview adalah validasi terakhir sebelum data tersimpan.",result:"Dashboard dapat membaca data baru."}
 ]},
 listings:{title:"Kelola Creator Listing",description:"Gunakan Listing untuk mengatur pipeline, follow-up dan komunikasi creator.",steps:[
  {title:"Pilih creator & produk",what:"Hubungkan creator dan SKU/Product Master.",why:"Listing menjadi konteks hubungan creator-produk.",result:"Aktivitas tersimpan pada entity yang benar."},
  {title:"Atur Follow Up Via",what:"Pilih WhatsApp, DM Instagram, DM TikTok atau channel lainnya.",why:"Channel menentukan tindakan follow-up.",result:"Queue dan reminder lebih relevan."},
  {title:"Atur PIC dan jadwal",what:"Pilih PIC, priority dan Next Follow Up.",why:"Tanggung jawab dan deadline menjadi jelas.",result:"Listing masuk Follow-Up Queue dan Calendar."},
  {title:"Gunakan Generate dari History",what:"Buat draft follow-up dari aktivitas sebelumnya.",why:"Pesan lebih konsisten dengan progres creator.",result:"Draft bisa diedit lalu dibuka di WhatsApp."}
 ]},
 "product-master":{title:"Product Master",description:"Jadikan SKU dan HPP sebagai reference layer untuk modul lain.",steps:[
  {title:"Pastikan SKU konsisten",what:"Gunakan SKU induk yang sama untuk produk yang sama.",why:"Mapping Affiliate/Live bergantung pada identitas SKU.",result:"Data produk lebih mudah direkonsiliasi."},
  {title:"Lengkapi HPP",what:"Isi cost price/HPP setiap produk aktif.",why:"Margin dan contribution membutuhkan HPP.",result:"Perhitungan profit dapat dilakukan."},
  {title:"Jangan campur performance",what:"Product Master hanya identity/HPP reference.",why:"Affiliate dan Live adalah dua fact domain berbeda.",result:"Tidak terjadi cross-counting."}
 ]},
 "campaign-tracker":{title:"Campaign Tracker",description:"Pantau creator, target, deadline dan hasil campaign.",steps:[
  {title:"Buat campaign",what:"Isi periode, platform, target dan konteks campaign.",why:"Campaign membutuhkan baseline.",result:"Campaign siap menerima creator."},
  {title:"Hubungkan creator",what:"Tambahkan creator ke campaign.",why:"Performance dapat dibaca per campaign.",result:"Progress creator terpantau."},
  {title:"Cek deadline & action",what:"Gunakan Action Center untuk item mendekati deadline.",why:"Mengurangi campaign yang terlewat.",result:"Next action terlihat jelas."}
 ]},
 "live-streaming":{title:"Live Streaming",description:"Import Shopee/TikTok Live, validasi datanya, lalu analisis tanpa mencampur Affiliate.",steps:[
  {title:"Upload report Live",what:"Buka Upload Center lalu pilih file Shopee/TikTok.",why:"Parser mendeteksi source berdasarkan struktur file.",result:"Platform, dataset dan parser version muncul otomatis."},
  {title:"Cek Auto Detect & Preview",what:"Pastikan dataset, periode dan normalized preview sesuai.",why:"Titik/koma, persen, tanggal dan durasi dinormalisasi.",result:"Data siap diimport tanpa miss kolom."},
  {title:"Import",what:"Klik Import ke Live Streaming.",why:"Data disimpan ke domain Live-only.",result:"Shopee/TikTok masuk tabel Live yang sesuai."},
  {title:"Buka Data Health",what:"Cek Exact, Difference atau Sumber Belum Lengkap.",why:"Reconciliation memvalidasi kualitas data.",result:"Anda tahu apakah data aman dipakai analisis."},
  {title:"Buka Analytics",what:"Pilih Unified, TikTok atau Shopee.",why:"Setiap platform punya semantic metric berbeda.",result:"Analisis tidak memaksa semua source menjadi session."},
  {title:"Cek Product Intelligence",what:"Map SKU/nama ke Product Master jika diperlukan.",why:"Product Master hanya memberi identity/HPP.",result:"Live HPP dan contribution muncul tanpa memengaruhi Affiliate."}
 ]},
 "affiliate-360":{title:"Affiliate 360",description:"Cari creator lalu baca performance dan relationship dalam satu konteks.",steps:[
  {title:"Cari creator",what:"Masukkan username atau nama creator.",why:"Search-first mempercepat drill-down.",result:"Creator terpilih."},
  {title:"Baca performance",what:"Periksa GMV, Order, Qty, Commission, Sample dan activity.",why:"Anda mendapat gambaran performa dan hubungan.",result:"Next action lebih jelas."},
  {title:"Cek timeline",what:"Baca reach out, sample, agreement dan campaign.",why:"Riwayat menjelaskan konteks di balik angka.",result:"Follow-up dapat disesuaikan."}
 ]},
 "goal-forecast":{title:"Goal & Forecast",description:"Bandingkan Actual, Target dan Forecast pada periode yang sama.",steps:[
  {title:"Pilih periode",what:"Atur start dan end date.",why:"Target harus dibandingkan pada periode yang konsisten.",result:"Actual dihitung ulang."},
  {title:"Set target",what:"Isi target GMV, Order, Qty dan Contribution.",why:"Target menjadi baseline evaluasi.",result:"Progress dan gap terlihat."},
  {title:"Baca forecast",what:"Bandingkan Actual vs Forecast.",why:"Forecast membantu membaca pace saat ini.",result:"Tim tahu apakah perlu tindakan."}
 ]},
 "automation-rules":{title:"Automation Rules",description:"Ubah kondisi operasional menjadi Action Center item.",steps:[
  {title:"Pilih trigger",what:"Tentukan kapan rule diperiksa.",why:"Trigger menentukan sumber kondisi.",result:"Rule punya titik mulai."},
  {title:"Atur kondisi",what:"Tentukan threshold atau batas waktu.",why:"Mengurangi alert yang tidak relevan.",result:"Rule lebih presisi."},
  {title:"Atur action",what:"Pilih severity dan tindakan.",why:"Action menentukan apa yang muncul di Action Center.",result:"Rule siap diaktifkan."}
 ]},
 "scheduled-reports":{title:"Scheduled Report",description:"Jadwalkan report dan pindahkan jadwal melalui kalender.",steps:[
  {title:"Buat schedule",what:"Pilih jenis report, cadence, tanggal dan penerima.",why:"Scheduler membutuhkan tujuan dan waktu.",result:"Report masuk kalender."},
  {title:"Geser bila perlu",what:"Drag ke tanggal lain.",why:"Reschedule lebih cepat.",result:"Next run berubah."},
  {title:"Cek history",what:"Pantau Delivered atau Failed.",why:"Menjamin report benar-benar diproses.",result:"Status pengiriman terverifikasi."}
 ]},
 "affiliate-support":{title:"Reward & Affiliate Challenge",description:"Buat program, hubungkan creator, lalu impor pencapaian untuk dihitung sebagai estimasi reward.",steps:[
  {title:"Buat Program",what:"Klik Buat Program, pilih reward, Spark Ads, incentive atau challenge; isi tanggal & target.",why:"Program menentukan aturan eligibility dan batas waktu.",result:"Program tersimpan sebagai draft atau active."},
  {title:"Atur Reward Tier",what:"Pilih target dan nominal reward tiap tier; misalnya 3, 5, atau 9 tingkat.",why:"Tier tertinggi yang tercapai menjadi reward dasar.",result:"Bonus tidak dihitung ganda."},
  {title:"Tambahkan peserta",what:"Buka Tracker, pilih Master Creator dan klik Tambah Peserta.",why:"Hanya creator terdaftar masuk perhitungan.",result:"Creator muncul di leaderboard."},
  {title:"Pantau leaderboard",what:"Periksa progress, masa berlaku dan estimasi bonus.",why:"Bonus belum sama dengan pembayaran yang sudah disetujui.",result:"Status kualifikasi lebih jelas."},
  {title:"Upload laporan",what:"Pilih Excel/CSV, petakan header, tanggal, SKU dan creator lalu validasi.",why:"Menghindari duplikasi atau data di luar periode.",result:"Angka tracker masuk setelah diperiksa."}
 ]},
 "social-lumaway":{title:"Lumaway Social",description:"Semua postingan publik terlihat oleh pengguna Lumaway; pemilik postingan dapat menghapus kontennya.",steps:[
  {title:"Buat post publik",what:"Isi teks dan unggah gambar sesuai aturan Community.",why:"Post bisa ditampilkan ke semua pengguna.",result:"Post muncul di feed."},
  {title:"Baca feed",what:"Lihat postingan pengguna lain dan gunakan Like, Save, Share.",why:"Interaksi memperkaya discovery.",result:"Post dapat diakses seluruh member Lumaway."},
  {title:"Trending & kata kunci",what:"Cek lima konten terpopuler dan kata kunci paling sering muncul.",why:"Ranking berdasarkan interaksi terukur.",result:"Ide konten terlihat lebih mudah."}
 ]},
 shipping:{title:"Shipping",description:"Kelola pengiriman sample/produk dan biaya ongkir.",steps:[
  {title:"Lengkapi resi",what:"Isi courier dan tracking.",why:"Shipping tanpa resi akan masuk Action Center.",result:"Pengiriman dapat dilacak."},
  {title:"Isi biaya",what:"Masukkan shipping cost/ongkir.",why:"Biaya harus masuk Spending.",result:"Pengeluaran shipping terhitung."},
  {title:"Update status",what:"Perbarui status sampai delivered.",why:"Lifecycle shipping harus lengkap.",result:"Action lama dapat ditutup."}
 ]}
};


/** Location-specific help points target the live UI, not generic illustration mockups. */
const FOCUS_SELECTORS:Record<string,string[]>={
  listings:[
    "#listings .listing-v2-editor .listing-v2-form-grid",
    "#listings .listing-v2-editor select",
    "#listings .listing-calendar .lc-calendar-reminders-layout",
    "#listings .listing-quick-message"
  ],
  shipping:[
    "#shipping .shipping-v2-form-grid",
    "#shipping .shipping-v2-editor",
    "#shipping .shipping-v2-layout"
  ],
  "affiliate-support":[
    "#affiliate-support .asp-hero",
    "#affiliate-support .asp-program-grid",
    "#affiliate-support .asp-participant",
    "#affiliate-support .asp-leaderboard",
    "#affiliate-support .asp-importer"
  ],
  "social-lumaway":[
    "#social-lumaway .social-v3-composer",
    "#social-lumaway .social-v3-feed",
    "#social-lumaway .social-v3-popular-posts"
  ],
  dashboard:["#dashboard .kpis","#dashboard .card",".topbar"],
  upload:["#upload select","#upload input[type=file]","#upload .card","#upload button.primary"],
  "live-streaming":["#live-streaming .live-upload","#live-streaming .live-data-health","#live-streaming .live-product-intelligence"],
  "product-master":["#product-master .card","#product-master input","#product-master .card"],
  "campaign-tracker":["#campaign-tracker .card","#campaign-tracker .card","#campaign-tracker .card"]
};
function findFocus(section:string,step:number):HTMLElement|null{
 const selector=FOCUS_SELECTORS[section]?.[step];
 if(!selector)return null;
 const element=document.querySelector<HTMLElement>(selector);
 if(!element)return null;
 const rect=element.getBoundingClientRect();
 if(rect.width<2||rect.height<2)return null;
 return element;
}
export default function ContextualTutorial(){
 const [open,setOpen]=useState(false),[section,setSection]=useState("dashboard"),[step,setStep]=useState(0),[focusFound,setFocusFound]=useState(false);
 function showOnPage(){
   const target=findFocus(section,step);
   if(!target){setFocusFound(false);return}
   setFocusFound(true);
   setOpen(false);
   target.classList.add("lumaway-help-target");
   target.scrollIntoView({behavior:"smooth",block:"center"});
   window.setTimeout(()=>target.classList.remove("lumaway-help-target"),6500);
 }

 useEffect(()=>{
  const sync=()=>{setSection(sectionFromPath(window.location.pathname)||"dashboard");setStep(0)};
  sync();
  window.addEventListener("popstate",sync);
  window.addEventListener("lumaway-routechange",sync as EventListener);
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};
  window.addEventListener("keydown",key);
  return()=>{window.removeEventListener("popstate",sync);window.removeEventListener("lumaway-routechange",sync as EventListener);window.removeEventListener("keydown",key)};
 },[]);

 const guide=useMemo(()=>GUIDES[section]||GUIDES.dashboard,[section]);
 const current=guide.steps[Math.min(step,guide.steps.length-1)];
 useEffect(()=>{
   if(open)setFocusFound(Boolean(findFocus(section,step)));
 },[open,section,step]);

 return <>
  <button type="button" className="context-help-trigger" onClick={()=>setOpen(true)} aria-label="Panduan halaman ini"><LumaIcon name="support"/><span>Panduan</span></button>
  {open&&<div className="context-help-backdrop" onMouseDown={()=>setOpen(false)}>
   <aside className="context-help-drawer" role="dialog" aria-modal="true" aria-label={"Panduan "+guide.title} onMouseDown={e=>e.stopPropagation()}>
    <header><div><span>PANDUAN HALAMAN</span><h2>{guide.title}</h2><p>{guide.description}</p></div><button onClick={()=>setOpen(false)}>×</button></header>
    <div className="context-help-progress">{guide.steps.map((_,i)=><button key={i} className={i===step?"active":i<step?"done":""} onClick={()=>setStep(i)}>{i<step?"✓":i+1}</button>)}</div>
    <article className="context-help-step">
      <span>LANGKAH {step+1} / {guide.steps.length}</span>
      <h3>{current.title}</h3>
      {focusFound?<button className="context-help-show-on-page" onClick={showOnPage}>Lihat posisi pada fitur asli ↗</button>:<p className="context-help-not-visible">Bagian ini belum terbuka di layar. Buka fitur yang dijelaskan, lalu gunakan panduan sesuai halaman.</p>}
      <section><b>Apa yang dilakukan</b><p>{current.what}</p></section>
      <section><b>Kenapa</b><p>{current.why}</p></section>
      <section><b>Hasil</b><p>{current.result}</p></section>
    </article>
    <footer><button disabled={step===0} onClick={()=>setStep(x=>Math.max(0,x-1))}>← Sebelumnya</button>{step<guide.steps.length-1?<button className="primary" onClick={()=>setStep(x=>Math.min(guide.steps.length-1,x+1))}>Berikutnya →</button>:<button className="primary" onClick={()=>{setOpen(false);navigateToSection("tutorial")}}>Buka Tutorial Lengkap →</button>}</footer>
   </aside>
  </div>}
 </>;
}
