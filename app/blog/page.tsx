import Link from "next/link";
import { createPublicClient } from "../../lib/public-supabase";

export const revalidate=300;

export default async function BlogIndex(){
  const supabase=createPublicClient();
  const {data}=await supabase.from("luma_blog_posts").select("id,slug,title,excerpt,category,cover_image_url,published_at").eq("status","published").order("published_at",{ascending:false}).limit(60);
  const posts=data||[];
  return <main className="public-blog-shell"><header className="public-blog-header"><Link href="/" className="public-blog-brand"><img src="/luma-mark.png" alt="Lumaway"/><div><strong>LUMAWAY</strong><span>Insight & Blog</span></div></Link><Link href="/" className="public-blog-login">Open LUMA →</Link></header><section className="public-blog-hero"><span>INSIGHT · MARKETING · AI · AFFILIATE</span><h1>Ideas to make better digital decisions.</h1><p>Artikel praktis, insight bisnis, dan tutorial dari ekosistem Lumaway.</p></section><section className="public-blog-grid">{posts.map((p:any)=><article key={p.id} className="public-blog-card">{p.cover_image_url?<img src={p.cover_image_url} alt=""/>:<div className="public-blog-placeholder">LUMAWAY</div>}<div><small>{p.category} · {p.published_at?new Date(p.published_at).toLocaleDateString("id-ID"):""}</small><h2>{p.title}</h2><p>{p.excerpt}</p><Link href={`/blog/${p.slug}`}>Read More →</Link></div></article>)}{!posts.length&&<div className="empty-state"><strong>Artikel pertama sedang disiapkan.</strong></div>}</section><footer className="public-blog-footer">© {new Date().getFullYear()} Lumaway · Light Up Your Potential.</footer></main>;
}
