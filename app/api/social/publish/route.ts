import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";

export const runtime="nodejs";
const contactPattern=/(https?:\/\/|www\.|[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}|(?:\+?62|0)[ .\-]?[0-9]{2,4}(?:[ .\-]?[0-9]){6,12})/i;
function outputText(data:any){if(typeof data?.output_text==="string")return data.output_text;for(const item of data?.output||[])for(const c of item?.content||[])if(c?.type==="output_text"&&c?.text)return c.text;return ""}

async function scanImages(files:{bytes:Buffer;mime:string}[],admin:any){
  if(!files.length)return {blocked:false,reason:""};
  const key=await getServerSecret(admin,"luma_openai_api_key");if(!key)throw new Error("AI moderation unavailable");
  const model=process.env.OPENAI_VISION_MODEL||process.env.OPENAI_MODEL||"gpt-5.6-sol";
  const schema={type:"object",additionalProperties:false,properties:{blocked:{type:"boolean"},reason:{type:"string"}},required:["blocked","reason"]};
  const content:any[]=[{type:"input_text",text:"Periksa seluruh gambar komunitas berikut. BLOCK jika salah satu gambar berisi data kontak/link yang dilarang."}];
  for(const file of files)content.push({type:"input_image",image_url:`data:${file.mime};base64,${file.bytes.toString("base64")}`});
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({
    model,
    instructions:"Anda moderator privasi Lumaway. Periksa seluruh gambar komunitas. BLOCK jika terlihat nomor telepon/WhatsApp, alamat email, URL/domain/link, QR code yang mengarah ke kontak/link, username sosial yang jelas dimaksudkan sebagai kontak, atau data pribadi sensitif. Jangan block hanya karena logo atau teks umum. Jawab JSON saja.",
    input:[{role:"user",content}],
    text:{format:{type:"json_schema",name:"social_image_moderation",schema,strict:true}},
    store:false
  })});
  const raw=await r.json();if(!r.ok)throw new Error(raw?.error?.message||"AI image moderation failed");
  const text=outputText(raw);if(!text)throw new Error("Empty moderation result");
  return JSON.parse(text) as {blocked:boolean;reason:string};
}

export async function POST(req:NextRequest){
  try{
    const fd=await req.formData();
    const workspaceId=String(fd.get("workspace_id")||"");
    const body=String(fd.get("body")||"").trim();
    if(!workspaceId)return NextResponse.json({ok:false,error:"error, terjadi kesalahan."},{status:400});
    const ctx=await getServerContext(workspaceId);

    if(contactPattern.test(body))return NextResponse.json({ok:false,error:"Post ditolak: nomor telepon, email, atau link web tidak diperbolehkan di Lumaway Community."},{status:400});

    const rawImages=[...fd.getAll("images"),fd.get("image")].filter((x):x is File=>x instanceof File&&x.size>0);
    const uniqueImages=rawImages.filter((file,index)=>rawImages.findIndex(other=>other===file)===index);
    if(!body&&!uniqueImages.length)return NextResponse.json({ok:false,error:"Post harus berisi teks atau foto."},{status:400});
    if(uniqueImages.length>9)return NextResponse.json({ok:false,error:"Maksimal 9 foto dalam satu post."},{status:400});

    const prepared:{file:File;bytes:Buffer;mime:string}[]=[];
    for(const image of uniqueImages){
      if(image.size>3*1024*1024)return NextResponse.json({ok:false,error:"Setiap foto maksimal 3 MB."},{status:400});
      if(!["image/jpeg","image/png","image/webp"].includes(image.type))return NextResponse.json({ok:false,error:"Format foto hanya JPG, PNG, atau WEBP."},{status:400});
      prepared.push({file:image,bytes:Buffer.from(await image.arrayBuffer()),mime:image.type});
    }

    const scan=await scanImages(prepared.map(x=>({bytes:x.bytes,mime:x.mime})),ctx.admin);
    if(scan.blocked)return NextResponse.json({ok:false,error:"Foto tidak dapat dipublikasikan karena tidak memenuhi aturan privasi komunitas."},{status:400});

    const imageUrls:string[]=[];const storagePaths:string[]=[];
    for(const item of prepared){
      const ext=item.mime==="image/png"?"png":item.mime==="image/webp"?"webp":"jpg";
      const storagePath=`community/${ctx.user.id}/${Date.now()}-${randomUUID().slice(0,8)}.${ext}`;
      const {error:upError}=await ctx.admin.storage.from("luma-public").upload(storagePath,item.bytes,{contentType:item.mime,upsert:false});
      if(upError)throw upError;
      const {data:urlData}=ctx.admin.storage.from("luma-public").getPublicUrl(storagePath);
      imageUrls.push(urlData.publicUrl);storagePaths.push(storagePath);
    }

    const {data:post,error}=await ctx.admin.from("luma_community_posts").insert({
      user_id:ctx.user.id,
      body:body||null,
      image_url:imageUrls[0]||null,
      image_storage_path:storagePaths[0]||null,
      image_urls:imageUrls,
      image_storage_paths:storagePaths,
      status:"published"
    }).select("id").single();
    if(error)throw error;

    if(imageUrls.length){
      const archiveRows=imageUrls.map((imageUrl,index)=>({
        user_id:ctx.user.id,community_post_id:post.id,image_url:imageUrl,image_storage_path:storagePaths[index]
      }));
      const {error:archiveError}=await ctx.admin.from("luma_social_archives").insert(archiveRows);
      if(archiveError)throw archiveError;
    }

    return NextResponse.json({ok:true,id:post.id,image_count:imageUrls.length});
  }catch{
    return NextResponse.json({ok:false,error:"error, terjadi kesalahan."},{status:400});
  }
}
