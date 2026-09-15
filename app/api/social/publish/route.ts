import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";

export const runtime="nodejs";

const contactPattern=/(https?:\/\/|www\.|[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}|(?:\+?62|0)[ .\-]?[0-9]{2,4}(?:[ .\-]?[0-9]){6,12})/i;
function outputText(data:any){if(typeof data?.output_text==="string")return data.output_text;for(const item of data?.output||[])for(const c of item?.content||[])if(c?.type==="output_text"&&c?.text)return c.text;return ""}

async function scanImage(bytes:Buffer,mime:string,admin:any){
  const key=await getServerSecret(admin,"luma_openai_api_key");
  if(!key)throw new Error("Publikasi foto membutuhkan AI moderation aktif. Hubungi admin Lumaway.");
  const model=process.env.OPENAI_VISION_MODEL||process.env.OPENAI_MODEL||"gpt-5-mini";
  const schema={type:"object",additionalProperties:false,properties:{blocked:{type:"boolean"},reason:{type:"string"}},required:["blocked","reason"]};
  const dataUrl=`data:${mime};base64,${bytes.toString("base64")}`;
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,instructions:"Anda adalah moderator privasi Lumaway. Periksa gambar komunitas. BLOCK jika terlihat nomor telepon/WhatsApp, alamat email, URL/domain/link, QR code yang mengarah ke kontak/link, username sosial yang jelas dimaksudkan sebagai kontak, atau data pribadi sensitif. Jangan block hanya karena ada logo atau teks umum. Jawab JSON saja.",input:[{role:"user",content:[{type:"input_text",text:"Periksa gambar ini untuk data kontak/link yang dilarang."},{type:"input_image",image_url:dataUrl}]}],text:{format:{type:"json_schema",name:"social_image_moderation",schema,strict:true}},store:false})});
  const raw=await r.json();if(!r.ok)throw new Error(raw?.error?.message||"AI image moderation gagal.");const text=outputText(raw);if(!text)throw new Error("AI moderation tidak mengembalikan hasil.");return JSON.parse(text) as {blocked:boolean;reason:string};
}

export async function POST(req:NextRequest){
  try{
    const fd=await req.formData();
    const workspaceId=String(fd.get("workspace_id")||"");
    const body=String(fd.get("body")||"").trim();
    const image=fd.get("image");
    if(!workspaceId)return NextResponse.json({ok:false,error:"workspace_id required"},{status:400});
    const ctx=await getServerContext(workspaceId);
    if(contactPattern.test(body))return NextResponse.json({ok:false,error:"Post ditolak: nomor telepon, email, atau link web tidak diperbolehkan di Lumaway Community."},{status:400});
    if(!body&&!(image instanceof File))return NextResponse.json({ok:false,error:"Post harus berisi teks atau foto."},{status:400});

    let imageUrl:string|null=null;let storagePath:string|null=null;
    if(image instanceof File&&image.size>0){
      if(image.size>1024*1024)return NextResponse.json({ok:false,error:"Foto maksimal 1 MB."},{status:400});
      if(!["image/jpeg","image/png","image/webp"].includes(image.type))return NextResponse.json({ok:false,error:"Format foto hanya JPG, PNG, atau WEBP."},{status:400});
      const bytes=Buffer.from(await image.arrayBuffer());
      const scan=await scanImage(bytes,image.type,ctx.admin);
      if(scan.blocked)return NextResponse.json({ok:false,error:`Foto ditolak oleh privacy check: ${scan.reason}`},{status:400});
      const ext=image.type==="image/png"?"png":image.type==="image/webp"?"webp":"jpg";
      storagePath=`community/${ctx.user.id}/${Date.now()}-${randomUUID().slice(0,8)}.${ext}`;
      const {error:upError}=await ctx.admin.storage.from("luma-public").upload(storagePath,bytes,{contentType:image.type,upsert:false});
      if(upError)throw upError;
      const {data:urlData}=ctx.admin.storage.from("luma-public").getPublicUrl(storagePath);imageUrl=urlData.publicUrl;
    }

    const {data:post,error}=await ctx.admin.from("luma_community_posts").insert({user_id:ctx.user.id,body:body||null,image_url:imageUrl,image_storage_path:storagePath,status:"published"}).select("id").single();
    if(error)throw error;
    if(imageUrl){await ctx.admin.from("luma_social_archives").insert({user_id:ctx.user.id,community_post_id:post.id,image_url:imageUrl,image_storage_path:storagePath});}
    return NextResponse.json({ok:true,id:post.id});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Social publish failed."},{status:400})}
}
