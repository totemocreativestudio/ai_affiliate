import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";
import {getPaymentProviderStatus} from "../../../../lib/payment-gateway";
import {getServerSecretSource,hasServerSecret} from "../../../../lib/server-secrets";
export const runtime="nodejs";

export async function GET(req:NextRequest){
  try{
    const workspaceId=new URL(req.url).searchParams.get("workspace_id")||"";
    const ctx=await getServerContext(workspaceId);
    const status=await getPaymentProviderStatus(ctx.admin);
    const midtransConfigured=await hasServerSecret(ctx.admin,"luma_midtrans_server_key");
    if(!ctx.platformAdmin){
      return NextResponse.json({
        ok:true,
        mode:status.mode,
        available:status.available,
        providers:(status.providers||[]).map((row:any)=>({
          provider:row.provider,
          enabled:Boolean(row.enabled),
          configured:Boolean(row.configured),
          priority:Number(row.priority||999)
        }))
      });
    }
    return NextResponse.json({ok:true,...status,can_configure:true,midtrans:{configured:midtransConfigured,source:midtransConfigured?getServerSecretSource("luma_midtrans_server_key"):"none"}});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Gagal membaca payment gateway."},{status:400})}
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();const workspaceId=String(body.workspace_id||"");const ctx=await getServerContext(workspaceId);
    if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Hanya platform admin yang dapat mengubah routing payment gateway."},{status:403});
    if(body.mode){
      if(!["priority_fallback","weighted"].includes(String(body.mode)))return NextResponse.json({ok:false,error:"Mode routing tidak valid."},{status:400});
      const {error}=await ctx.admin.from("luma_payment_routing").update({mode:String(body.mode),updated_at:new Date().toISOString(),updated_by:ctx.user.id}).eq("id",1);if(error)throw error;
    }
    if(Array.isArray(body.providers)){
      for(const row of body.providers){
        const provider=String(row.provider||"").toLowerCase();if(!["mayar","xendit","midtrans"].includes(provider))continue;
        const {error}=await ctx.admin.from("luma_payment_provider_settings").update({
          enabled:Boolean(row.enabled),priority:Math.max(1,Math.min(999,Number(row.priority||100))),weight:Math.max(1,Math.min(100,Number(row.weight||1))),updated_at:new Date().toISOString(),updated_by:ctx.user.id
        }).eq("provider",provider);if(error)throw error;
      }
    }
    const serverKey=String(body.midtrans_server_key||"").trim(),clientKey=String(body.midtrans_client_key||"").trim();
    if(serverKey){
      const {error}=await ctx.admin.rpc("luma_set_server_secret",{p_name:"luma_midtrans_server_key",p_secret:serverKey,p_description:"Lumaway Midtrans production server key"});if(error)throw error;
    }
    if(clientKey){
      const {error}=await ctx.admin.rpc("luma_set_server_secret",{p_name:"luma_midtrans_client_key",p_secret:clientKey,p_description:"Lumaway Midtrans production client key"});if(error)throw error;
    }
    const status=await getPaymentProviderStatus(ctx.admin);
    return NextResponse.json({ok:true,...status});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Gagal menyimpan routing payment gateway."},{status:400})}
}
