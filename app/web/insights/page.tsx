import Link from "next/link";
import {getPublicBlogs,STATIC_INSIGHTS} from "../../../lib/public-insights";

export const dynamic="force-dynamic";
export const metadata={
  title:"Lumaway Insights — Data, Affiliate, Marketing & AI",
  description:"Insight Lumaway untuk business intelligence, affiliate, marketing, produk, AI, dan pengambilan keputusan.",
  alternates:{canonical:"https://www.lumaway.online/web/insights"}
};

export default async function PublicInsightsPage(){
  const dynamicPosts=await getPublicBlogs(100);
  const dynamicSlugs=new Set(dynamicPosts.map((post)=>post.slug));
  const staticPosts=STATIC_INSIGHTS.filter((post)=>!dynamicSlugs.has(post.slug));

  return <main>
    <header className="public-insights-nav">
      <Link href="/web/home" className="public-insights-brand"><img src="/luma-mark.png" alt=""/><strong>LUMAWAY<span>.</span></strong></Link>
      <nav><Link href="/web/home">Home</Link><Link href="/web/insights" className="active">Insights</Link><Link href="/app.lumaway/login">Login</Link><Link className="primary-link" href="/app.lumaway/register">Buat Akun</Link></nav>
    </header>

    <section className="public-insights-hero">
      <span className="public-eyebrow">LUMAWAY INSIGHTS</span>
      <h1>Perspektif yang lebih jelas<br/>untuk keputusan berikutnya.</h1>
      <p>Artikel tentang data bisnis, affiliate, marketing, produk, AI, dan cara mengubah informasi menjadi tindakan yang bisa dievaluasi.</p>
    </section>

    <section className="public-insights-grid" aria-label="Lumaway Insights">
      {dynamicPosts.map((post,index)=><Link className="public-article-card featured" href={`/web/insights/${post.slug}`} key={`db-${post.id}`}>
        <div className="public-article-art">{post.cover_image_url?<img src={post.cover_image_url} alt={post.image_alt||post.title}/>:<div className="public-art-fallback"><span>{String(index+1).padStart(2,"0")}</span><b>LUMAWAY</b></div>}</div>
        <div className="public-article-copy"><small>{post.category||"Insight"} · Posted by {post.author_name||"Lumaway"}</small><h2>{post.title}</h2><p>{post.excerpt||"Insight terbaru dari Lumaway."}</p><span>Baca insight →</span></div>
      </Link>)}
      {staticPosts.map((post,index)=><Link className="public-article-card" href={`/web/insights/${post.slug}`} key={post.slug}>
        <div className="public-article-art"><div className="public-art-fallback"><span>{String(dynamicPosts.length+index+1).padStart(2,"0")}</span><b>{post.category}</b></div></div>
        <div className="public-article-copy"><small>{post.category} · {post.readTime} · Posted by Lumaway</small><h2>{post.title}</h2><p>{post.description}</p><span>Baca insight →</span></div>
      </Link>)}
    </section>

    <section className="public-insights-note">
      <div><span className="public-eyebrow">FROM DATA TO DIRECTION</span><h2>Insight bukan akhir dari analisis.</h2><p>Gunakan temuan sebagai bahan untuk menentukan tindakan, pemilik pekerjaan, dan indikator evaluasi.</p></div>
      <Link href="/app.lumaway/register">Mulai dengan Lumaway →</Link>
    </section>

    <footer className="public-insights-footer"><span>© {new Date().getFullYear()} Lumaway · Light Up Your Potential.</span><Link href="/web/home">Kembali ke Lumaway</Link></footer>
  </main>;
}
