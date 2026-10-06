import Link from "next/link";
import {getPublicBlogs,STATIC_INSIGHTS} from "../../../lib/public-insights";

export const dynamic="force-dynamic";
export const metadata={
  title:"Lumaway Insights — Data, Affiliate, Marketing & AI",
  description:"Insight Lumaway untuk business intelligence, affiliate, marketing, produk, AI, dan pengambilan keputusan.",
  alternates:{canonical:"https://www.lumaway.online/web/insights"}
};

function stageFor(post:{slug:string;title:string;category?:string|null}){
  const text=(post.slug+" "+post.title+" "+(post.category||"")).toLowerCase();
  if(/cara|panduan|framework|evaluasi|analisis|strategi|eksperimen/.test(text))return "MOFU";
  if(/mulai|coba|implementasi|workflow|automation|target|report/.test(text))return "BOFU";
  return "TOFU";
}
function StageCard({stage}:{stage:string}){
  const copy:any={TOFU:["KENALI MASALAH","Mulai dari konteks dan pertanyaan yang tepat."],MOFU:["PAHAMI CARANYA","Pelajari framework, metrik, dan langkah teknis."],BOFU:["AMBIL TINDAKAN","Ubah insight menjadi workflow yang bisa dijalankan."]};
  const x=copy[stage]||copy.TOFU;
  return <span className={"public-stage stage-"+stage.toLowerCase()}><b>{stage}</b><em>{x[0]}</em><small>{x[1]}</small></span>;
}

export default async function PublicInsightsPage(){
  const {posts: dynamicPosts} = await getPublicBlogs(100);
  const dynamicSlugs=new Set(dynamicPosts.map((post)=>post.slug));
  const all=[...dynamicPosts.map((p:any)=>({...p,description:p.excerpt||"Insight terbaru dari Lumaway.",readTime:"Insight",dynamic:true})),...STATIC_INSIGHTS.filter((post)=>!dynamicSlugs.has(post.slug)).map((p:any)=>({...p,dynamic:false}))];
  const groups=["TOFU","MOFU","BOFU"].map(stage=>({stage,items:all.filter((p:any)=>stageFor(p)===stage)}));

  return <main id="main-content" tabIndex={-1}>
    <header className="public-insights-nav">
      <Link href="/web/home" className="public-insights-brand"><img src="/luma-mark.png" alt="" width={30} height={30} decoding="async"/><strong>LUMAWAY<span aria-hidden="true">.</span></strong></Link>
      <nav aria-label="Navigasi utama"><Link href="/web/home">Home</Link><Link href="/web/insights" className="active" aria-current="page">Insights</Link><Link href="/app.lumaway/login">Login</Link><Link className="primary-link" href="/app.lumaway/register">Buat Akun</Link></nav>
    </header>

    <section className="public-insights-hero redesigned">
      <div>
        <span className="public-eyebrow">LUMAWAY INSIGHTS</span>
        <h1>Bukan sekadar baca.<br/>Pahami, lalu gunakan.</h1>
        <p>Konten Lumaway disusun dari awareness sampai action: kenali masalah, pahami cara membacanya, lalu ubah insight menjadi keputusan dan workflow.</p>
      </div>
      <div className="public-funnel-visual" aria-label="TOFU MOFU BOFU">
        <div><b>01</b><span>TOFU</span><small>Kenali problem</small></div><i aria-hidden="true">→</i>
        <div><b>02</b><span>MOFU</span><small>Pahami framework</small></div><i aria-hidden="true">→</i>
        <div><b>03</b><span>BOFU</span><small>Jalankan action</small></div>
      </div>
    </section>

    <section className="public-topic-strip">
      <span>Business Intelligence</span><span>Affiliate</span><span>Live Streaming</span><span>Marketing R&D</span><span>Profitability</span><span>Workflow</span>
    </section>

    {groups.map(group=>group.items.length?<section className={"public-stage-section stage-section-"+group.stage.toLowerCase()} key={group.stage}>
      <header><StageCard stage={group.stage}/><div><h2>{group.stage==="TOFU"?"Mulai dari masalah yang sedang Anda hadapi":group.stage==="MOFU"?"Masuk ke cara kerja dan analisis":"Ubah insight menjadi tindakan"}</h2><p>{group.stage==="TOFU"?"Konten awareness untuk membantu melihat problem dengan lebih jelas.":group.stage==="MOFU"?"Framework, langkah teknis, dan cara membaca data.":"Checklist, workflow, dan fitur yang bisa langsung dipakai."}</p></div></header>
      <div className="public-insights-grid staged">
        {group.items.map((post:any,index:number)=><Link className={"public-article-card "+(index===0?"featured":"")} href={"/web/insights/"+post.slug} key={post.slug}>
          <div className="public-article-art">{post.cover_image_url?<img src={post.cover_image_url} alt={post.image_alt||post.title} loading="lazy" decoding="async"/>:<div className={"public-art-fallback art-"+group.stage.toLowerCase()}><span>{String(index+1).padStart(2,"0")}</span><b>{post.category||"Insight"}</b><small>{group.stage}</small></div>}</div>
          <div className="public-article-copy"><small>{post.category||"Insight"} · {post.readTime||"Insight"} · Posted by {post.author_name||"Lumaway"}</small><h3>{post.title}</h3><p>{post.description||post.excerpt||"Insight terbaru dari Lumaway."}</p><span>{group.stage==="BOFU"?"Lihat langkahnya →":"Baca insight →"}</span></div>
        </Link>)}
      </div>
    </section>:null)}

    <section className="public-insights-note action">
      <div><span className="public-eyebrow">FROM INSIGHT TO ACTION</span><h2>Jangan berhenti di artikel.</h2><p>Bawa pertanyaan bisnis ke workspace, hubungkan dengan data, target, automation, dan action center.</p></div>
      <div className="public-note-actions"><Link href="/app.lumaway/register">Mulai dengan Lumaway →</Link><Link href="/tutorial">Lihat Tutorial</Link></div>
    </section>

    <footer className="public-insights-footer"><span>© {new Date().getFullYear()} Lumaway · Light Up Your Potential.</span><Link href="/web/home">Kembali ke Lumaway</Link></footer>
  </main>;
}
