import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";
import {getServerSecret} from "../../../../lib/server-secrets";
import {openAIResponsesWithFailover} from "../../../../lib/openai-router";

export const runtime="nodejs";

function outputText(data:any){
  if(typeof data?.output_text==="string")return data.output_text;
  for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==="output_text"&&part?.text)return part.text;
  return "";
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const workspaceId=String(body.workspace_id||"");
    const listingId=Number(body.listing_id||0);
    if(!workspaceId||!listingId)return NextResponse.json({ok:false,error:"workspace_id dan listing_id wajib diisi."},{status:400});

    const ctx=await getServerContext(workspaceId);

    const [{data:listing,error:listErr},{data:activities,error:actErr}]=await Promise.all([
      ctx.admin.from("listings").select("id,workspace_id,creator_id,creator_name,platform,product_name,sku,stage,payment_type,posting_date,post_link,next_action,follow_up_channel,next_follow_up_at,follow_up_priority,notes").eq("workspace_id",workspaceId).eq("id",listingId).maybeSingle(),
      ctx.admin.from("listing_activities").select("activity_date,activity_type,follow_up_channel,result,note,created_at").eq("workspace_id",workspaceId).eq("listing_id",listingId).order("activity_date",{ascending:true}).order("id",{ascending:true}).limit(60)
    ]);
    if(listErr)throw listErr;if(actErr)throw actErr;
    if(!listing)return NextResponse.json({ok:false,error:"Listing tidak ditemukan."},{status:404});

    let creator:any=null;
    if(listing.creator_id){
      const r=await ctx.admin.from("creators").select("id,name,username,platform,phone,profile_url,social_links").eq("workspace_id",workspaceId).eq("id",listing.creator_id).maybeSingle();
      if(!r.error)creator=r.data;
    }

    const meaningful=(activities||[]).filter((x:any)=>String(x.activity_type||"")!=="Listing dibuat");
    const mode=meaningful.length?"follow_up":"first_contact";
    const key=await getServerSecret(ctx.admin,"luma_openai_api_key");
    if(!key)return NextResponse.json({ok:false,error:"AI follow-up belum tersedia karena konfigurasi model belum aktif."},{status:503});

    const schema={type:"object",additionalProperties:false,properties:{
      draft:{type:"string"},
      rationale:{type:"string"},
      suggested_channel:{type:"string"},
      tone:{type:"string"}
    },required:["draft","rationale","suggested_channel","tone"]};

    const context={
      mode,
      listing:{
        creator_name:listing.creator_name,
        creator_username:creator?.username||null,
        platform:listing.platform||creator?.platform||null,
        product_name:listing.product_name,
        sku:listing.sku,
        stage:listing.stage,
        payment_type:listing.payment_type,
        posting_date:listing.posting_date,
        next_action:listing.next_action,
        follow_up_channel:listing.follow_up_channel,
        next_follow_up_at:listing.next_follow_up_at,
        notes:listing.notes
      },
      activity_history:meaningful.map((x:any)=>({
        date:x.activity_date,type:x.activity_type,channel:x.follow_up_channel,result:x.result,note:x.note
      })).slice(-20)
    };

    const instruction=mode==="first_contact"
      ? "Tulis pesan sambutan pertama dari tim brand kepada affiliate/creator. Bahasa Indonesia natural, ramah, profesional, singkat. Tujuan utamanya membuka komunikasi dan memperkenalkan konteks produk/listing yang memang tersedia pada input. Jangan mengarang diskon, nominal, deadline, status sample, atau janji komersial. Jangan menyebut nama owner/admin atau detail internal platform. Hindari gaya robotik dan emoji berlebihan."
      : "Tulis pesan follow-up berdasarkan riwayat tindakan sebelumnya. Bahasa Indonesia natural, ramah, profesional, singkat. Rujuk progres terakhir secara relevan, lalu arahkan ke next action yang logis dari data input. Jangan mengarang diskon, nominal, deadline, status sample, atau janji komersial. Jangan menyebut nama owner/admin atau detail internal platform. Hindari gaya robotik dan emoji berlebihan.";

    const routed=await openAIResponsesWithFailover(ctx.admin,key,{
      instructions:instruction,
      input:JSON.stringify(context),
      text:{format:{type:"json_schema",name:"listing_followup_draft",schema,strict:true}},
      store:false
    },"gpt-5.6-sol");

    const parsed=JSON.parse(outputText(routed.raw));
    const usage=routed.raw?.usage||{};
    await ctx.admin.from("luma_api_usage_events").insert({
      workspace_id:workspaceId,user_id:ctx.user.id,provider:"openai",service:"listing_followup",
      request_type:mode,model:routed.model,input_tokens:Number(usage.input_tokens||0),
      output_tokens:Number(usage.output_tokens||0),total_tokens:Number(usage.total_tokens||0),
      cost_usd:routed.cost.cost_usd,cost_idr:routed.cost.cost_idr,status:"success",
      reference:String(listingId),metadata:{mode,history_count:meaningful.length,fallback_used:routed.fallback_used}
    });

    return NextResponse.json({ok:true,mode,history_count:meaningful.length,draft:parsed.draft,rationale:parsed.rationale,suggested_channel:parsed.suggested_channel,tone:parsed.tone});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Gagal membuat draft follow-up."},{status:400});
  }
}
