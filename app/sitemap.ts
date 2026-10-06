import type {MetadataRoute} from "next";
import {getPublicBlogs,STATIC_INSIGHTS,PUBLIC_SITE_ORIGIN} from "../lib/public-insights";

export const dynamic="force-dynamic";

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const {posts: db} = await getPublicBlogs(200);
  const seen=new Set(db.map(x=>x.slug));
  const fallback=STATIC_INSIGHTS.filter(x=>!seen.has(x.slug));
  const now=new Date();
  const base:MetadataRoute.Sitemap=[
    {url:`${PUBLIC_SITE_ORIGIN}/web/home`,lastModified:now,changeFrequency:"weekly",priority:1},
    {url:`${PUBLIC_SITE_ORIGIN}/web/insights`,lastModified:now,changeFrequency:"daily",priority:.9},
    {url:`${PUBLIC_SITE_ORIGIN}/web/pricing`,lastModified:now,changeFrequency:"weekly",priority:.8},
    {url:`${PUBLIC_SITE_ORIGIN}/web/about`,lastModified:now,changeFrequency:"monthly",priority:.7},
    {url:`${PUBLIC_SITE_ORIGIN}/web/security`,lastModified:now,changeFrequency:"monthly",priority:.6},
    {url:`${PUBLIC_SITE_ORIGIN}/web/privacy`,lastModified:now,changeFrequency:"monthly",priority:.4},
    {url:`${PUBLIC_SITE_ORIGIN}/web/terms`,lastModified:now,changeFrequency:"monthly",priority:.4},
  ];
  const dbRows=db.map(post=>({
    url:`${PUBLIC_SITE_ORIGIN}/web/insights/${post.slug}`,
    lastModified:post.updated_at?new Date(post.updated_at):post.published_at?new Date(post.published_at):now,
    changeFrequency:"monthly" as const,
    priority:.75,
  }));
  const fallbackRows=fallback.map(post=>({
    url:`${PUBLIC_SITE_ORIGIN}/web/insights/${post.slug}`,
    lastModified:new Date(post.date),
    changeFrequency:"monthly" as const,
    priority:.65,
  }));
  return [...base,...dbRows,...fallbackRows];
}
