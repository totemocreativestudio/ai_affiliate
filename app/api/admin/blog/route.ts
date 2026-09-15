import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";

export const runtime="nodejs";
function outputText(data:any){if(typeof data?.output_text==="string")return data.output_text;for(const item of data?.output||[])for(const c of item?.content||[])if(c?.type==="output_text"&&c?.text)return c.text;return ""}
const slugify=(s:string)=>s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g,"").trim().replace(/\s+/g,"-").replace(/-+/g,"-").slice(0,90)||`article-${Date.now()}`;

export async function POST(req:NextRequest){
  try{
    const b=await req.json();const workspaceId=String(b.workspace_id||"");const action=String(b.action||"generate");const ctx=await getServerContext(workspaceId);if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Owner access required."},{status:403});
    if(action==="publish"){
      const title=String(b.title||"").trim();if(!title)return NextResponse.json({ok:false,error:"Title wajib diisi."},{status:400});
      let slug=slugify(String(b.slug||title));let attempt=0;while(true){const {data}=await ctx.admin.from("luma_blog_posts").select("id").eq("slug",slug).maybeSingle();if(!data)break;attempt++;slug=`${slugify(title)}-${attempt+1}`;}
      const {data,error}=await ctx.admin.from("luma_blog_posts").insert({workspace_id:workspaceId,slug,title,excerpt:b.excerpt||null,content_html:b.content_html||null,category:b.category||"Insight",cover_image_url:b.cover_image_url||null,seo_title:b.seo_title||title,seo_description:b.seo_description||b.excerpt||null,seo_keywords:Array.isArray(b.seo_keywords)?b.seo_keywords:[],external_dofollow_url:b.external_dofollow_url||null,status:"published",created_by:ctx.user.id,published_at:new Date().toISOString(),updated_at:new Date().toISOString()}).select("id,slug").single();if(error)throw error;return NextResponse.json({ok:true,...data});
    }
    const key=await getServerSecret(ctx.admin,"luma_openai_api_key");if(!key)return NextResponse.json({ok:false,error:"OpenAI integration belum aktif."},{status:503});
    const schema={type:"object",additionalProperties:false,properties:{title:{type:"string"},slug:{type:"string"},excerpt:{type:"string"},category:{type:"string"},seo_title:{type:"string"},seo_description:{type:"string"},seo_keywords:{type:"array",items:{type:"string"}},content_html:{type:"string"},image_prompt:{type:"string"}},required:["title","slug","excerpt","category","seo_title","seo_description","seo_keywords","content_html","image_prompt"]};
    const model=process.env.OPENAI_MODEL||"gpt-5-mini";const input={topic:b.topic||"",audience:b.audience||"pemilik bisnis dan marketer Indonesia",category:b.category||"Insight",objective:b.objective||"edukasi",notes:b.notes||"",external_reference:b.external_dofollow_url||""};
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,instructions:"Anda adalah SEO editor Lumaway. Buat artikel Bahasa Indonesia berkualitas tinggi, informatif, original, natural, tidak keyword stuffing. Struktur content_html hanya memakai h2,h3,p,ul,li,strong,blockquote. Jangan masukkan script/style/form. SEO title maksimal 60 karakter dan meta description sekitar 140-160 karakter. Jangan mengarang data/statistik. Jika external_reference tersedia, sebut secara natural sebagai referensi tetapi jangan membuat klaim yang tidak diberikan. Image prompt tanpa text/logo/watermark.",input:JSON.stringify(input),text:{format:{type:"json_schema",name:"lumaway_seo_article",schema,strict:true}},store:false})});const raw=await r.json();if(!r.ok)throw new Error(raw?.error?.message||"OpenAI request failed");const text=outputText(raw);if(!text)throw new Error("Respons AI kosong.");const result=JSON.parse(text);result.slug=slugify(result.slug||result.title);return NextResponse.json({ok:true,result});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Blog request failed."},{status:400})}
}
