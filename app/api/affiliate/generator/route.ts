import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";
import { openAIResponsesWithFailover } from "../../../../lib/openai-router";

export const runtime="nodejs";

const schema={
  type:"object",
  additionalProperties:false,
  properties:{
    whatsapp_variants:{
      type:"array",minItems:5,maxItems:5,
      items:{
        type:"object",additionalProperties:false,
        properties:{
          title:{type:"string"},
          contact_name:{type:"string"},
          messages:{
            type:"array",minItems:4,maxItems:8,
            items:{
              type:"object",additionalProperties:false,
              properties:{side:{type:"string",enum:["incoming","outgoing"]},text:{type:"string"}},
              required:["side","text"]
            }
          }
        },
        required:["title","contact_name","messages"]
      }
    },
    review_variants:{
      type:"array",minItems:5,maxItems:5,
      items:{
        type:"object",additionalProperties:false,
        properties:{
          username:{type:"string"},
          rating:{type:"integer",minimum:1,maximum:5},
          review:{type:"string"},
          avatar_style:{type:"string"}
        },
        required:["username","rating","review","avatar_style"]
      }
    }
  },
  required:["whatsapp_variants","review_variants"]
};

function outputText(data:any){
  if(typeof data?.output_text==="string")return data.output_text;
  for(const item of data?.output||[])for(const c of item?.content||[])if(c?.type==="output_text"&&c?.text)return c.text;
  return "";
}

export async function POST(req:NextRequest){
  const started=Date.now();
  let ctx:Awaited<ReturnType<typeof getServerContext>>|null=null;
  let workspaceId="";
  try{
    const body=await req.json();
    workspaceId=String(body.workspace_id||"");
    if(!workspaceId)return NextResponse.json({ok:false,error:"Workspace tidak valid."},{status:400});
    ctx=await getServerContext(workspaceId);

    const apiKey=await getServerSecret(ctx.admin,"luma_openai_api_key");
    if(!apiKey)throw new Error("OPENAI_NOT_CONFIGURED");

    const brief={
      product:String(body.product||"").slice(0,180),
      context:String(body.context||"").slice(0,900),
      audience:String(body.audience||"").slice(0,220),
      tone:String(body.tone||"friendly").slice(0,80),
      rating:Math.max(1,Math.min(5,Number(body.rating||5)))
    };
    if(!brief.product||!brief.context)return NextResponse.json({ok:false,error:"Produk/layanan dan konteks wajib diisi."},{status:400});

    const preferredModel=process.env.OPENAI_FAST_MODEL||"gpt-5.6-luna";
    const instructions=`Anda adalah creative mockup writer Lumaway. Buat tepat 5 variasi SIMULASI percakapan WhatsApp dan tepat 5 variasi MOCKUP ulasan. Bahasa Indonesia natural, manusiawi, ringkas, dan konsisten dengan brief. Percakapan cukup 4-8 bubble agar proses cepat. Jangan mengklaim output sebagai testimoni pelanggan nyata, transaksi nyata, atau pengalaman nyata. Jangan menciptakan klaim medis/keuangan/fakta produk yang tidak diberikan. Gunakan username fiktif, tanpa data pribadi. Semua output akan diberi label "Simulasi / Mockup".`;

    const routed=await openAIResponsesWithFailover(ctx.admin,apiKey,{
      instructions,
      input:JSON.stringify(brief),
      text:{format:{type:"json_schema",name:"lumaway_affiliate_mockups",schema,strict:true}},
      max_output_tokens:2600,
      store:false
    },preferredModel,35000);

    const text=outputText(routed.raw);
    if(!text)throw new Error("EMPTY_AI_RESPONSE");
    const result=JSON.parse(text);
    const usage=routed.raw?.usage||{};

    try{
      await ctx.admin.from("luma_api_usage_events").insert({
        workspace_id:workspaceId,user_id:ctx.user.id,provider:"openai",service:"affiliate_mockup_generator",
        request_type:"free_creative_mockup",model:routed.model,status:"success",
        input_tokens:Number(usage.input_tokens||0),output_tokens:Number(usage.output_tokens||0),total_tokens:Number(usage.total_tokens||0),
        cost_usd:routed.cost.cost_usd,cost_idr:routed.cost.cost_idr,
        metadata:{free_for_user:true,product:brief.product,duration_ms:Date.now()-started,fallback_used:routed.fallback_used}
      });
    }catch{}

    return NextResponse.json({ok:true,free:true,model:routed.model,fallback_used:routed.fallback_used,result});
  }catch(error:any){
    const rawMessage=String(error?.message||"affiliate generator failed");
    if(ctx){
      try{
        await ctx.admin.from("luma_api_usage_events").insert({
          workspace_id:workspaceId,user_id:ctx.user.id,provider:"openai",service:"affiliate_mockup_generator",
          request_type:"free_creative_mockup",status:"error",
          metadata:{error:rawMessage,duration_ms:Date.now()-started}
        });
      }catch{}
    }
    const notConfigured=rawMessage==="OPENAI_NOT_CONFIGURED";
    return NextResponse.json({
      ok:false,
      code:notConfigured?"AI_NOT_CONFIGURED":"AI_GENERATION_ERROR",
      error:notConfigured?"AI Lumaway belum terhubung ke provider. Administrator sedang melakukan konfigurasi.":"Generator AI sementara tidak dapat diproses. Silakan coba kembali beberapa saat."
    },{status:notConfigured?503:502});
  }
}
