export type MarketingBlogPost={
 id:number;slug:string;title:string;excerpt:string|null;content_html:string|null;category:string;
 cover_image_url:string|null;seo_title:string|null;seo_description:string|null;seo_keywords:string[]|null;
 external_dofollow_url:string|null;video_embed_url:string|null;image_alt:string|null;author_name:string|null;
 published_at:string|null;updated_at:string;
};
function config(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||"";
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"";
 return {url:url.replace(/\/$/,""),key};
}
export async function getPublishedBlogs(limit=100):Promise<MarketingBlogPost[]>{
 const {url,key}=config();if(!url||!key)return [];
 const q=new URLSearchParams({select:"id,slug,title,excerpt,content_html,category,cover_image_url,seo_title,seo_description,seo_keywords,external_dofollow_url,video_embed_url,image_alt,author_name,published_at,updated_at",status:"eq.published",order:"published_at.desc",limit:String(limit)});
 try{const r=await fetch(`${url}/rest/v1/luma_blog_posts?${q.toString()}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},next:{revalidate:60}});if(!r.ok)return [];return await r.json()}catch{return []}
}
export async function getPublishedBlog(slug:string):Promise<MarketingBlogPost|null>{
 const rows=await getPublishedBlogs(200);return rows.find(x=>x.slug===slug)||null;
}
