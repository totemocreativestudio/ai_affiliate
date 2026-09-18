import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";

export const runtime = "nodejs";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    whatsapp_variants: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          contact_name: { type: "string" },
          messages: {
            type: "array",
            minItems: 6,
            maxItems: 14,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                side: { type: "string", enum: ["incoming","outgoing"] },
                text: { type: "string" },
              },
              required: ["side","text"],
            },
          },
        },
        required: ["title","contact_name","messages"],
      },
    },
    review_variants: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          username: { type: "string" },
          rating: { type: "integer", minimum: 1, maximum: 5 },
          review: { type: "string" },
          avatar_style: { type: "string" },
        },
        required: ["username","rating","review","avatar_style"],
      },
    },
  },
  required: ["whatsapp_variants","review_variants"],
};

function outputText(data:any){
  if(typeof data?.output_text==="string") return data.output_text;
  for(const item of data?.output||[]) for(const c of item?.content||[]) if(c?.type==="output_text"&&c?.text) return c.text;
  return "";
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const workspaceId=String(body.workspace_id||"");
    if(!workspaceId) return NextResponse.json({ok:false,error:"error, terjadi kesalahan."},{status:400});
    const ctx=await getServerContext(workspaceId);
    const apiKey=await getServerSecret(ctx.admin,"luma_openai_api_key");
    if(!apiKey) return NextResponse.json({ok:false,error:"error, terjadi kesalahan."},{status:503});

    const brief={
      product:String(body.product||"").slice(0,180),
      context:String(body.context||"").slice(0,1200),
      audience:String(body.audience||"").slice(0,300),
      tone:String(body.tone||"friendly").slice(0,80),
      rating:Math.max(1,Math.min(5,Number(body.rating||5))),
    };
    if(!brief.product||!brief.context) return NextResponse.json({ok:false,error:"Produk/layanan dan konteks wajib diisi."},{status:400});

    const model=process.env.OPENAI_MODEL||"gpt-5.6-sol";
    const instructions=`Anda adalah creative mockup writer Lumaway. Buat 5 variasi SIMULASI percakapan WhatsApp dan 5 variasi MOCKUP ulasan untuk kebutuhan desain, demo, training, atau materi konsep. Bahasa Indonesia harus natural, manusiawi, tidak kaku, dan konsisten dengan brief. Jangan mengklaim bahwa output adalah testimoni pelanggan nyata, transaksi nyata, atau pengalaman nyata. Jangan menciptakan klaim medis/keuangan/fakta produk yang tidak diberikan. Semua output akan ditampilkan dengan label "Simulasi / Mockup" di UI. Gunakan username fiktif yang tidak menyerupai identitas orang nyata. Percakapan harus masuk akal, ringkas, tidak berlebihan, dan tidak memuat data pribadi.`;

    const r=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model,
        instructions,
        input:JSON.stringify(brief),
        text:{format:{type:"json_schema",name:"lumaway_affiliate_mockups",schema,strict:true}},
        store:false,
      }),
    });
    const raw=await r.json();
    if(!r.ok) throw new Error(raw?.error?.message||"AI error");
    const text=outputText(raw);
    if(!text) throw new Error("Empty AI response");
    const result=JSON.parse(text);

    try {
      await ctx.admin.from("luma_api_usage_events").insert({
        workspace_id:workspaceId,user_id:ctx.user.id,provider:"openai",service:"affiliate_mockup_generator",
        request_type:"free_creative_mockup",model,status:"success",
        input_tokens:Number(raw?.usage?.input_tokens||0),output_tokens:Number(raw?.usage?.output_tokens||0),total_tokens:Number(raw?.usage?.total_tokens||0),
        metadata:{free_for_user:true,product:brief.product},
      });
    } catch {
      // Usage telemetry must never block a free generator result.
    }

    return NextResponse.json({ok:true,free:true,result});
  }catch{
    return NextResponse.json({ok:false,error:"error, terjadi kesalahan."},{status:400});
  }
}
