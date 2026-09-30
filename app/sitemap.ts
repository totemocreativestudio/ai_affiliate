import type {MetadataRoute} from "next";
import {getPublicBlogs,STATIC_INSIGHTS,PUBLIC_SITE_ORIGIN} from "../lib/public-insights";

export const dynamic="force-dynamic";

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const db=await getPublicBlogs(200);
  const seen=new Set(db.map(x=>x.slug));
  const fallback=STATIC_INSIGHTS.filter(x=>!seen.has(x.slug));
  const now=new Date();
  const base:MetadataRoute.Sitemap=[
    {url:`${PUBLIC_SITE_ORIGIN}/insights`,lastModified:now,changeFrequency:"daily",priority:.9},
  ];
  const dbRows=db.map(post=>({
    url:`${PUBLIC_SITE_ORIGIN}/insights/${post.slug}`,
    lastModified:post.updated_at?new Date(post.updated_at):post.published_at?new Date(post.published_at):now,
    changeFrequency:"monthly" as const,
    priority:.75,
  }));
  const fallbackRows=fallback.map(post=>({
    url:`${PUBLIC_SITE_ORIGIN}/insights/${post.slug}`,
    lastModified:new Date(post.date),
    changeFrequency:"monthly" as const,
    priority:.65,
  }));
  return [...base,...dbRows,...fallbackRows];
}
