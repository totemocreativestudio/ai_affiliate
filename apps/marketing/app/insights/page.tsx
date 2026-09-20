import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {articles} from '@/content/articles';
import {getPublishedBlogs} from '@/lib/lumaway-data';
import {metadata as meta} from '@/lib/seo';
export const metadata=meta('Lumaway Insights','Artikel, tutorial, dan insight Lumaway untuk business intelligence, affiliate, marketing, produk, dan AI.');
export default async function Insights(){
 const db=await getPublishedBlogs(100);const existing=new Set(db.map(x=>x.slug));const fallback=articles.filter(x=>!existing.has(x.slug));
 return <section className="section container"><div className="inner-hero"><span className="eyebrow">LUMAWAY INSIGHTS</span><h1>Insight untuk keputusan yang lebih jelas.</h1><p>Artikel dari Lumaway tentang data, affiliate, marketing, produk, AI, dan praktik pengambilan keputusan.</p></div><div className="article-grid">{db.map((a,i)=><Link className="article-card" key={a.id} href={`/insights/${a.slug}`}><div className="article-art" aria-hidden="true">{a.cover_image_url?<img src={a.cover_image_url} alt=""/>:<><span className="art-index">{String(i+1).padStart(2,'0')}</span><span className="art-label">LUMAWAY INSIGHT</span></>}</div><span className="eyebrow">{a.category} <span>• Posted by {a.author_name||'Lumaway'}</span></span><h3>{a.title}</h3><p>{a.excerpt||'Baca insight terbaru dari Lumaway.'}</p><span className="text-link">Baca insight <ArrowUpRight size={17}/></span></Link>)}{fallback.map((a,i)=><Link className="article-card" key={a.slug} href={`/insights/${a.slug}`}><div className={`article-art art-${i%3}`}><span className="art-index">{String(db.length+i+1).padStart(2,'0')}</span><span className="art-label">LUMAWAY INSIGHT</span></div><span className="eyebrow">{a.category} <span>• Posted by Lumaway</span></span><h3>{a.title}</h3><p>{a.description}</p><span className="text-link">Baca insight <ArrowUpRight size={17}/></span></Link>)}</div></section>;
}
