import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";

export const runtime="nodejs";
function outputText(data:any){if(typeof data?.output_text==="string")return data.output_text;for(const item of data?.output||[])for(const c of item?.content||[])if(c?.type==="output_text"&&c?.text)return c.text;return ""}

export async function POST(req:NextRequest){
  try{
    const b=await req.json();const workspaceId=String(b.workspace_id||"");const action=String(b.action||"generate_copy");const ctx=await getServerContext(workspaceId);
    if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Owner access required."},{status:403});
    const key=await getServerSecret(ctx.admin,"luma_openai_api_key");

    if(action==="publish"){
      if(!b.title||!b.body)return NextResponse.json({ok:false,error:"Title dan body wajib diisi."},{status:400});
      const {data,error}=await ctx.admin.from("luma_notifications").insert({workspace_id:b.scope==="workspace"?workspaceId:null,title:String(b.title),body:String(b.body),category:String(b.category||"info"),action_url:b.action_url||null,action_label:b.action_label||null,image_url:b.image_url||null,audience:"all",status:"published",created_by:ctx.user.id,published_at:new Date().toISOString()}).select("id").single();
      if(error)throw error;return NextResponse.json({ok:true,id:data.id});
    }

    if(!key)return NextResponse.json({ok:false,error:"OpenAI integration belum aktif."},{status:503});

    if(action==="generate_copy"){
      const schema={type:"object",additionalProperties:false,properties:{title:{type:"string"},body:{type:"string"},action_label:{type:"string"},image_prompt:{type:"string"}},required:["title","body","action_label","image_prompt"]};
      const model=process.env.OPENAI_MODEL||"gpt-5-mini";
      const input={category:b.category||"education",concept:b.concept||"",goal:b.goal||"",action_url:b.action_url||"",brand:"Lumaway / LUMA"};
      const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,instructions:"Anda adalah editor broadcast Lumaway. Tulis notifikasi singkat berkualitas tinggi dalam Bahasa Indonesia. Judul maksimal 65 karakter. Body 1-3 kalimat, jelas, tidak spammy, tidak membuat klaim yang tidak diberikan. CTA singkat. Buat image_prompt yang visual, modern, tanpa text/logo/watermark agar aman dipakai sebagai banner aplikasi.",input:JSON.stringify(input),text:{format:{type:"json_schema",name:"lumaway_broadcast",schema,strict:true}},store:false})});
      const raw=await r.json();if(!r.ok)throw new Error(raw?.error?.message||"OpenAI request failed");const text=outputText(raw);if(!text)throw new Error("Respons AI kosong.");return NextResponse.json({ok:true,result:JSON.parse(text)});
    }

    if(action==="generate_image"){
      const prompt=String(b.image_prompt||"").trim();if(!prompt)return NextResponse.json({ok:false,error:"Image prompt required."},{status:400});
      const model=process.env.OPENAI_IMAGE_MODEL||"gpt-image-2.5-flare";
      const r=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,prompt:`Lumaway in-app broadcast artwork. ${prompt}. Minimal modern SaaS editorial visual, clean composition, no readable text, no logos, no watermark.`,size:"1536x1024",quality:"medium"})});
      const raw=await r.json();if(!r.ok)throw new Error(raw?.error?.message||"Image generation failed");const b64=raw?.data?.[0]?.b64_json;if(!b64)throw new Error("Image API tidak mengembalikan b64 image.");const bytes=Buffer.from(b64,"base64");const path=`broadcast/${Date.now()}-${randomUUID().slice(0,8)}.png`;const {error}=await ctx.admin.storage.from("luma-public").upload(path,bytes,{contentType:"image/png",upsert:false});if(error)throw error;const {data:url}=ctx.admin.storage.from("luma-public").getPublicUrl(path);return NextResponse.json({ok:true,image_url:url.publicUrl});
    }

    return NextResponse.json({ok:false,error:"Unknown action"},{status:400});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Broadcast request failed."},{status:400})}
}
