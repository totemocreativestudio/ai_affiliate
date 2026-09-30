"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {navigateToSection} from "../../lib/luma-navigation";

type Topic={id:string;title:string;category:string;description:string;minutes:number;route:string;steps:Array<{title:string;what:string;why:string;result:string;visual:string}>};

const builtIn:Topic[]=[
 {id:"upload-affiliate",title:"Upload Affiliate Performance",category:"Data & Upload",description:"Dari file marketplace sampai data muncul di dashboard.",minutes:7,route:"upload",steps:[
  {title:"Siapkan file report",what:"Export Affiliate Performance dari marketplace dalam format XLSX/CSV.",why:"Lumaway membaca data asli dari report untuk GMV, order, qty dan komisi.",result:"File laporan siap di-upload.",visual:"export"},
  {title:"Buka Upload Center",what:"Masuk Data & Intelligence → Upload Center lalu pilih Affiliate Performance.",why:"Jenis data menentukan mapping dan tujuan penyimpanan.",result:"Form upload Affiliate Performance terbuka.",visual:"upload"},
  {title:"Pilih platform & periode",what:"Pilih TikTok/Shopee dan tentukan tanggal jika file tidak memiliki periode yang jelas.",why:"Periode dipakai untuk reporting dan mencegah data tercampur.",result:"Konteks import sudah lengkap.",visual:"period"},
  {title:"Upload file",what:"Pilih file XLSX/CSV dari komputer.",why:"Lumaway akan membaca header sebelum proses import.",result:"File masuk ke tahap Mapping.",visual:"file"},
  {title:"Periksa Mapping",what:"Cocokkan kolom file dengan field Lumaway. Perbaiki yang belum dikenali.",why:"Mapping yang benar mencegah GMV/order/commission masuk ke kolom yang salah.",result:"Status mapping siap.",visual:"mapping"},
  {title:"Preview & Import",what:"Periksa contoh baris lalu klik Import.",why:"Preview memberi kesempatan terakhir sebelum data tersimpan.",result:"Data tersimpan ke workspace.",visual:"preview"},
  {title:"Cek hasil",what:"Buka Dashboard, Ranking Creator, Customer 360 atau Database.",why:"Pastikan angka sesuai report sumber.",result:"Upload selesai dan siap dianalisis.",visual:"dashboard"}
 ]},
 {id:"goal-forecast",title:"Membuat Target & Forecast",category:"Growth & Workflow",description:"Atur target GMV, order, qty dan contribution margin.",minutes:5,route:"goal-forecast",steps:[
  {title:"Buka Goal & Forecast",what:"Masuk Growth & Workflow → Goal & Forecast.",why:"Semua target periode dikelola dari satu tempat.",result:"Scorecard Actual, Target dan Forecast terlihat.",visual:"goal"},
  {title:"Pilih periode",what:"Atur tanggal mulai dan akhir.",why:"Target harus dibandingkan dengan periode data yang sama.",result:"Actual dihitung ulang otomatis.",visual:"period"},
  {title:"Atur target",what:"Klik Atur Target dan masukkan GMV, Orders, Qty dan Contribution Margin.",why:"Lumaway membutuhkan baseline untuk membaca gap.",result:"Progress % dan forecast terhitung.",visual:"target"},
  {title:"Baca forecast",what:"Bandingkan Actual, Target dan Forecast pada scorecard dan chart.",why:"Forecast menunjukkan kemungkinan hasil akhir berdasarkan pace saat ini.",result:"Anda tahu apakah target on-track atau perlu action.",visual:"forecast"}
 ]},
 {id:"automation",title:"Membuat Automation Rule",category:"Growth & Workflow",description:"Buat aturan KETIKA → JIKA → LAKUKAN tanpa workflow rumit.",minutes:5,route:"automation-rules",steps:[
  {title:"Buka Automation Rules",what:"Masuk Growth & Workflow → Automation Rules.",why:"Rules mengubah kondisi operasional menjadi action otomatis.",result:"Rules Builder tampil.",visual:"automation"},
  {title:"Pilih template",what:"Pilih Campaign Deadline, Sample Follow-up, Shipping atau HPP.",why:"Template mempercepat setup dan mengurangi salah konfigurasi.",result:"Rule dasar terbuat.",visual:"template"},
  {title:"Atur kondisi",what:"Sesuaikan hari/threshold dan tingkat prioritas.",why:"Setiap bisnis punya toleransi berbeda.",result:"Rule sesuai workflow tim.",visual:"condition"},
  {title:"Uji dengan Run Now",what:"Klik Run Now dan baca alasan MATCH/NO MATCH.",why:"Anda bisa memverifikasi rule sebelum mengandalkannya.",result:"Riwayat eksekusi tersimpan.",visual:"run"}
 ]},
 {id:"scheduled-report",title:"Menjadwalkan Report Otomatis",category:"Growth & Workflow",description:"Kirim report terjadwal dan geser jadwal langsung dari kalender.",minutes:4,route:"scheduled-reports",steps:[
  {title:"Buka Scheduled Report",what:"Masuk Growth & Workflow → Scheduled Report.",why:"Semua report otomatis dan histori pengiriman ada di sini.",result:"Kalender bulanan tampil.",visual:"calendar"},
  {title:"Buat jadwal",what:"Klik Jadwalkan Report, pilih jenis, frekuensi, tanggal, jam dan email penerima.",why:"Lumaway perlu tahu kapan dan ke siapa report dikirim.",result:"Schedule muncul di kalender.",visual:"schedule"},
  {title:"Pindahkan jadwal",what:"Drag card report ke tanggal lain.",why:"Reschedule lebih cepat tanpa membuka form.",result:"Tanggal next run berubah.",visual:"drag"},
  {title:"Cek histori",what:"Lihat status Delivered atau Failed di panel kanan.",why:"Anda bisa memastikan report benar-benar terkirim.",result:"Audit pengiriman tercatat.",visual:"history"}
 ]},
 {id:"creator360",title:"Memahami Affiliate / Creator 360",category:"Affiliate & Creator",description:"Cari creator dan baca performa, sample, agreement dan histori dalam satu konteks.",minutes:6,route:"creator-identity",steps:[
  {title:"Cari creator",what:"Gunakan search username atau nama creator.",why:"Search-first lebih cepat daripada membuka tabel satu per satu.",result:"Profil creator terpilih.",visual:"search"},
  {title:"Baca performance",what:"Periksa GMV, orders, qty, komisi, live, video dan sample.",why:"Metrik ringkas memberi kondisi creator secara cepat.",result:"Anda tahu kontribusi creator.",visual:"metrics"},
  {title:"Periksa timeline",what:"Baca reach out, sample, agreement dan aktivitas campaign.",why:"Timeline menjelaskan hubungan operasional, bukan hanya angka.",result:"Next action lebih jelas.",visual:"timeline"}
 ]}
];

function Visual({kind,index}:{kind:string;index:number}){
 return <div className="tutorial-visual">
   <div className="tv-browser"><div className="tv-top"><i/><i/><i/><span>app.lumaway.online</span></div>
   <div className="tv-body"><aside><b>L</b><span/><span/><span/><span/></aside><main>
     <div className="tv-kicker">STEP {String(index+1).padStart(2,"0")}</div>
     <div className="tv-titlebar"><strong>{kind.replaceAll("-"," ")}</strong><i/></div>
     <div className="tv-content"><div className="tv-panel"><span/><span/><span/></div><div className="tv-focus"><b>{index+1}</b><span>Area yang perlu diperhatikan</span></div></div>
   </main></div></div>
   <small>Ilustrasi flow Lumaway · posisi menu dan aksi dibuat menyerupai tampilan aplikasi.</small>
 </div>
}

export default function TutorialCenter({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [dbRows,setDbRows]=useState<any[]>([]);
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState("Semua");
 const [active,setActive]=useState<Topic>(builtIn[0]);
 const [step,setStep]=useState(0);
 useEffect(()=>{supabase.from("tutorials").select("*").or("workspace_id.eq."+workspaceId+",is_global.eq.true").eq("status","published").order("sort_order",{ascending:true}).limit(100).then(({data})=>setDbRows(data||[]))},[workspaceId]);
 const cats=["Semua",...Array.from(new Set(builtIn.map(x=>x.category)))];
 const topics=useMemo(()=>builtIn.filter(x=>(category==="Semua"||x.category===category)&&((x.title+" "+x.description).toLowerCase().includes(query.toLowerCase()))),[query,category]);
 const s=active.steps[step];

 return <section id="tutorial" className="legacy-page-anchor tutorial-center-page">
  <div className="tutorial-head"><div><div className="eyebrow">LEARNING</div><h1>Tutorial Lumaway</h1><p>Panduan praktis untuk pengguna baru. Ikuti langkah satu per satu sampai hasilnya terlihat.</p></div><div className="tutorial-progress-box"><b>{builtIn.length}</b><span>Panduan utama</span><small>{dbRows.length} materi tambahan dari Admin</small></div></div>
  <div className="tutorial-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari: upload, target, automation..."/><div>{cats.map(c=><button className={category===c?"active":""} onClick={()=>setCategory(c)} key={c}>{c}</button>)}</div></div>
  <div className="tutorial-layout">
   <aside className="tutorial-list">{topics.map(t=><button key={t.id} className={active.id===t.id?"active":""} onClick={()=>{setActive(t);setStep(0)}}><div><strong>{t.title}</strong><span>{t.description}</span></div><small>± {t.minutes} menit</small></button>)}</aside>
   <article className="tutorial-reader">
    <header><div><span>{active.category}</span><h2>{active.title}</h2></div><button onClick={()=>navigateToSection(active.route)}>Buka fitur</button></header>
    <div className="tutorial-step-tabs">{active.steps.map((_,i)=><button key={i} onClick={()=>setStep(i)} className={step===i?"active":step>i?"done":""}>{step>i?"✓":i+1}</button>)}</div>
    <Visual kind={s.visual} index={step}/>
    <div className="tutorial-copy-grid">
      <section><span>APA YANG DILAKUKAN</span><h3>{s.title}</h3><p>{s.what}</p></section>
      <section><span>KENAPA</span><p>{s.why}</p></section>
      <section><span>HASIL YANG DIHARAPKAN</span><p>{s.result}</p></section>
    </div>
    <footer><button disabled={step===0} onClick={()=>setStep(x=>Math.max(0,x-1))}>← Sebelumnya</button><div><b>{step+1}</b> / {active.steps.length}</div>{step<active.steps.length-1?<button className="primary" onClick={()=>setStep(x=>Math.min(active.steps.length-1,x+1))}>Berikutnya →</button>:<button className="primary" onClick={()=>navigateToSection(active.route)}>Praktikkan sekarang →</button>}</footer>
   </article>
  </div>
  {dbRows.length>0&&<div className="tutorial-admin-material"><div><span>MATERI TAMBAHAN</span><h2>Dari Admin Lumaway</h2></div><div className="tutorial-admin-grid">{dbRows.map((r:any)=><article key={r.id}><div className="tutorial-admin-cover">{r.cover_image_url?<img src={r.cover_image_url} alt={r.title||""}/>:<span>{String(r.category||"Tutorial").slice(0,1)}</span>}</div><div><small>{r.category||"Tutorial"}</small><strong>{r.title}</strong><p>{r.description}</p>{r.youtube_url&&<a href={r.youtube_url} target="_blank" rel="noreferrer">Lihat video</a>}</div></article>)}</div></div>}
 </section>
}
