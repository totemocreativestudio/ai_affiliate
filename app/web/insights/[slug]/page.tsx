import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import PublicContentTracker from "../../../components/PublicContentTracker";
import {getPublicBlog,getStaticInsight,getPublicBlogs,STATIC_INSIGHTS,PUBLIC_SITE_ORIGIN,sanitizeBlogHtml,youtubeEmbed} from "../../../../lib/public-insights";

export const dynamic="force-dynamic";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const post=await getPublicBlog(slug);
  if(post)return {title:post.seo_title||post.title,description:post.seo_description||post.excerpt||"",alternates:{canonical:PUBLIC_SITE_ORIGIN+"/web/insights/"+post.slug},openGraph:{type:"article",title:post.title,description:post.excerpt||"",url:PUBLIC_SITE_ORIGIN+"/web/insights/"+post.slug,publishedTime:post.published_at||undefined,modifiedTime:post.updated_at,images:post.cover_image_url?[post.cover_image_url]:undefined}};
  const fallback=getStaticInsight(slug);if(!fallback)return {};
  return {title:fallback.title,description:fallback.description,alternates:{canonical:PUBLIC_SITE_ORIGIN+"/web/insights/"+fallback.slug}};
}
function safeJson(value:unknown){return JSON.stringify(value).replace(/<\/script/gi,"<\\/script")}
function stageFor(title:string,category:string,slug:string){
 const text=(title+" "+category+" "+slug).toLowerCase();
 if(/cara|panduan|framework|evaluasi|analisis|strategi|eksperimen/.test(text))return "MOFU";
 if(/mulai|coba|implementasi|workflow|automation|target|report/.test(text))return "BOFU";
 return "TOFU";
}
function headings(html:string){const out:string[]=[];const re=/<h2[^>]*>(.*?)<\/h2>/gi;let m;while((m=re.exec(html))&&out.length<8)out.push(String(m[1]).replace(/<[^>]+>/g,"").trim());return out}

export default async function PublicInsightDetail({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const post=await getPublicBlog(slug);const fallback=post?null:getStaticInsight(slug);if(!post&&!fallback)notFound();
 const title=post?.title||fallback!.title,description=post?.excerpt||fallback!.description,category=post?.category||fallback!.category,author=post?.author_name||"Lumaway",date=post?.published_at||fallback!.date;
 const embed=youtubeEmbed(post?.video_embed_url||null),articleUrl=PUBLIC_SITE_ORIGIN+"/web/insights/"+slug,stage=stageFor(title,category,slug);
 const sanitized=post?sanitizeBlogHtml(post.content_html||""):"";
 const toc=post?headings(sanitized):fallback!.sections.map(x=>x.title);
 const dynamicRelated=await getPublicBlogs(10);const related=[...dynamicRelated.filter(x=>x.slug!==slug).slice(0,3),...STATIC_INSIGHTS.filter(x=>x.slug!==slug).slice(0,3)].slice(0,3);
 const jsonLd={"@context":"https://schema.org","@type":"Article",headline:title,description:description||"",datePublished:date,dateModified:post?.updated_at||date,author:{"@type":"Organization",name:author},publisher:{"@type":"Organization",name:"Lumaway"},mainEntityOfPage:articleUrl,image:post?.cover_image_url||PUBLIC_SITE_ORIGIN+"/luma-mark.png"};
 const faqItems=Array.isArray(post?.faq_json)?post!.faq_json!.filter((item:any)=>String(item?.question||"").trim()&&String(item?.answer||"").trim()).slice(0,12):[];
 const faqJsonLd=faqItems.length?{"@context":"https://schema.org","@type":"FAQPage",mainEntity:faqItems.map((item:any)=>({"@type":"Question",name:String(item.question),acceptedAnswer:{"@type":"Answer",text:String(item.answer)}}))}:null;

 return <main id="main-content" tabIndex={-1}>
  {post&&<PublicContentTracker contentId={post.id}/>}
  <header className="public-insights-nav"><Link href="/web/home" className="public-insights-brand"><img src="/luma-mark.png" alt="" width={30} height={30} decoding="async"/><strong>LUMAWAY<span aria-hidden="true">.</span></strong></Link><nav aria-label="Navigasi utama"><Link href="/web/home">Home</Link><Link href="/web/insights" className="active" aria-current="page">Insights</Link><Link href="/app.lumaway/login">Login</Link></nav></header>
  <article className="public-article redesigned">
   <header className="public-article-head">
    <nav className="public-breadcrumb" aria-label="Breadcrumb"><Link href="/web/home">Home</Link><span aria-hidden="true">/</span><Link href="/web/insights">Insights</Link><span aria-hidden="true">/</span><span aria-current="page">{stage}</span></nav>
    <div className={"public-article-stage stage-"+stage.toLowerCase()}><b>{stage}</b><span>{stage==="TOFU"?"Kenali masalah":stage==="MOFU"?"Pahami caranya":"Ambil tindakan"}</span></div>
    <span className="public-eyebrow">{category}</span><h1>{title}</h1><p>{description}</p>
    <div className="public-article-meta"><span>Posted by {author}</span><time dateTime={date||undefined}>{date?new Date(date).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}):""}</time>{fallback&&<span>{fallback.readTime} baca</span>}</div>
    {post?.cover_image_url?<img className="public-article-cover" src={post.cover_image_url} alt={post.image_alt||title} loading="lazy" decoding="async"/>:<div className="public-article-cover fallback-cover"><span>LUMAWAY INSIGHT</span><strong>{category}</strong><small>{stage} · Data → Understand → Decide → Act</small></div>}
   </header>

   <div className="public-article-layout">
    <div className="public-article-body">
      <div className="public-reading-map" aria-hidden="true"><div><b>01</b><span>Problem</span></div><i>→</i><div><b>02</b><span>Framework</span></div><i>→</i><div><b>03</b><span>Action</span></div></div>
      {post?<div dangerouslySetInnerHTML={{__html:sanitized}}/>:fallback!.sections.map((section)=><section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph)=><p key={paragraph}>{paragraph}</p>)}</section>)}
      {embed&&<div className="public-video"><iframe src={embed} title={title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></div>}
      {post?.video_embed_url&&!embed&&<p className="public-source-link"><a href={post.video_embed_url} target="_blank" rel="noopener noreferrer">Lihat video terkait ↗</a></p>}
      {post?.external_dofollow_url&&<aside className="public-reference"><strong>Referensi terkait</strong><a href={post.external_dofollow_url} target="_blank" rel="noopener noreferrer">{post.external_dofollow_url}</a></aside>}
      <aside className="public-action-checklist"><span>BOFU · NEXT ACTION</span><h3>Setelah membaca, lakukan ini</h3><ol><li><span aria-hidden="true">1</span><p>Tentukan satu metrik atau masalah yang ingin dievaluasi.</p></li><li><span aria-hidden="true">2</span><p>Buka data terkait di Lumaway dan samakan periode.</p></li><li><span aria-hidden="true">3</span><p>Buat action, target, atau automation untuk tindak lanjut.</p></li></ol><Link href="/app.lumaway/register">Praktikkan di Lumaway →</Link></aside>
    </div>
    <aside className="public-article-side enhanced">
      <span>DALAM ARTIKEL INI</span>{toc.length?<ol>{toc.map((x,i)=><li key={i}>{x}</li>)}</ol>:<small>Problem → Framework → Action</small>}
      <div className="public-side-divider"/>
      <span>ARTIKEL LUMAWAY</span><strong>{category}</strong><small>Posted by {author}</small><Link href="/web/insights">← Semua Insights</Link><Link className="side-primary" href="/app.lumaway/register">Coba Lumaway →</Link>
    </aside>
   </div>
  </article>

  {related.length>0&&<section className="public-related"><header><span className="public-eyebrow">LANJUTKAN BELAJAR</span><h2>Insight terkait</h2></header><div>{related.map((x:any)=><Link href={"/web/insights/"+x.slug} key={x.slug}><small>{x.category}</small><strong>{x.title}</strong><span>Baca →</span></Link>)}</div></section>}
  <section className="public-insights-note compact"><div><span className="public-eyebrow">LANGKAH BERIKUTNYA</span><h2>Insight harus berakhir menjadi tindakan.</h2><p>Hubungkan data, target, automation, dan tindak lanjut di workspace Lumaway.</p></div><Link href="/app.lumaway/register">Buat akun Lumaway →</Link></section>
  <footer className="public-insights-footer"><span>© {new Date().getFullYear()} Lumaway · Light Up Your Potential.</span><Link href="/web/home">Lumaway Home</Link></footer>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(jsonLd)}}/>{faqJsonLd&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(faqJsonLd)}}/>}
 </main>
}
