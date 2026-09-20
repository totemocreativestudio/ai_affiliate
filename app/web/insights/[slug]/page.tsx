import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import PublicContentTracker from "../../../components/PublicContentTracker";
import {getPublicBlog,getStaticInsight,PUBLIC_SITE_ORIGIN,sanitizeBlogHtml,youtubeEmbed} from "../../../../lib/public-insights";

export const dynamic="force-dynamic";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const post=await getPublicBlog(slug);
  if(post)return {
    title:post.seo_title||post.title,
    description:post.seo_description||post.excerpt||"",
    alternates:{canonical:`${PUBLIC_SITE_ORIGIN}/web/insights/${post.slug}`},
    openGraph:{type:"article",title:post.title,description:post.excerpt||"",url:`${PUBLIC_SITE_ORIGIN}/web/insights/${post.slug}`,publishedTime:post.published_at||undefined,modifiedTime:post.updated_at,images:post.cover_image_url?[post.cover_image_url]:undefined}
  };
  const fallback=getStaticInsight(slug);
  if(!fallback)return {};
  return {title:fallback.title,description:fallback.description,alternates:{canonical:`${PUBLIC_SITE_ORIGIN}/web/insights/${fallback.slug}`}};
}

function safeJson(value:unknown){
  return JSON.stringify(value).replace(/<\/script/gi,"<\\/script");
}

export default async function PublicInsightDetail({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const post=await getPublicBlog(slug);
  const fallback=post?null:getStaticInsight(slug);
  if(!post&&!fallback)notFound();

  const title=post?.title||fallback!.title;
  const description=post?.excerpt||fallback!.description;
  const category=post?.category||fallback!.category;
  const author=post?.author_name||"Lumaway";
  const date=post?.published_at||fallback!.date;
  const embed=youtubeEmbed(post?.video_embed_url||null);
  const articleUrl=`${PUBLIC_SITE_ORIGIN}/web/insights/${slug}`;
  const jsonLd={"@context":"https://schema.org","@type":"Article",headline:title,description:description||"",datePublished:date,dateModified:post?.updated_at||date,author:{"@type":"Organization",name:author},publisher:{"@type":"Organization",name:"Lumaway"},mainEntityOfPage:articleUrl,image:post?.cover_image_url||`${PUBLIC_SITE_ORIGIN}/luma-mark.png`};

  return <main>
    {post&&<PublicContentTracker contentId={post.id}/>}
    <header className="public-insights-nav">
      <Link href="/web/home" className="public-insights-brand"><img src="/luma-mark.png" alt=""/><strong>LUMAWAY<span>.</span></strong></Link>
      <nav><Link href="/web/home">Home</Link><Link href="/web/insights" className="active">Insights</Link><Link href="/app.lumaway/login">Login</Link></nav>
    </header>

    <article className="public-article">
      <header className="public-article-head">
        <nav className="public-breadcrumb"><Link href="/web/home">Home</Link><span>/</span><Link href="/web/insights">Insights</Link></nav>
        <span className="public-eyebrow">{category}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="public-article-meta"><span>Posted by {author}</span><time dateTime={date||undefined}>{date?new Date(date).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}):""}</time>{fallback&&<span>{fallback.readTime} baca</span>}</div>
        {post?.cover_image_url&&<img className="public-article-cover" src={post.cover_image_url} alt={post.image_alt||title}/>}
      </header>

      <div className="public-article-layout">
        <div className="public-article-body">
          {post?<div dangerouslySetInnerHTML={{__html:sanitizeBlogHtml(post.content_html||"")}}/>:fallback!.sections.map((section)=><section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph)=><p key={paragraph}>{paragraph}</p>)}</section>)}
          {embed&&<div className="public-video"><iframe src={embed} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></div>}
          {post?.video_embed_url&&!embed&&<p className="public-source-link"><a href={post.video_embed_url} target="_blank" rel="noopener noreferrer">Lihat video terkait ↗</a></p>}
          {post?.external_dofollow_url&&<aside className="public-reference"><strong>Referensi terkait</strong><a href={post.external_dofollow_url} target="_blank" rel="noopener noreferrer">{post.external_dofollow_url}</a></aside>}
          <aside className="public-context-note"><strong>Gunakan insight sebagai bahan keputusan.</strong><p>Sesuaikan periode, sumber, dan indikator dengan kondisi bisnis Anda. Temuan data perlu dibaca bersama konteks operasional.</p></aside>
        </div>
        <aside className="public-article-side"><span>ARTIKEL LUMAWAY</span><strong>{category}</strong><small>Posted by {author}</small><Link href="/web/insights">← Semua Insights</Link><Link href="/app.lumaway/register">Coba Lumaway →</Link></aside>
      </div>
    </article>

    <section className="public-insights-note compact"><div><span className="public-eyebrow">LANGKAH BERIKUTNYA</span><h2>Data Anda punya potensi.</h2><p>Satukan konteks, analisis, dan tindak lanjut di Lumaway.</p></div><Link href="/app.lumaway/register">Buat akun Lumaway →</Link></section>
    <footer className="public-insights-footer"><span>© {new Date().getFullYear()} Lumaway · Light Up Your Potential.</span><Link href="/web/home">Lumaway Home</Link></footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(jsonLd)}}/>
  </main>;
}
