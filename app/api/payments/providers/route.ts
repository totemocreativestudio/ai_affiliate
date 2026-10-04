import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";
import {getPaymentProviderStatus} from "../../../../lib/payment-gateway";
export const runtime="nodejs";

export async function GET(req:NextRequest){
  try{
    const workspaceId=new URL(req.url).searchParams.get("workspace_id")||"";
    const ctx=await getServerContext(workspaceId);
    const status=await getPaymentProviderStatus(ctx.admin);
    const mayar=(status.providers||[]).find((row:any)=>row.provider==="mayar")||null;
    const safeMayar=mayar ? ctx.canManage ? mayar : (({provider,enabled,priority,health_status,configured})=>({provider,enabled,priority,health_status,configured}))(mayar) : null;
    return NextResponse.json({
      ok:true,
      mode:"mayar_only",
      available:Boolean(mayar?.enabled&&mayar?.configured),
      providers:safeMayar?[safeMayar]:[],
      can_configure:Boolean(ctx.platformAdmin)
    });
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Gagal membaca payment gateway."},{status:400});
  }
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const workspaceId=String(body.workspace_id||"");
    const ctx=await getServerContext(workspaceId);
    if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Hanya platform admin yang dapat mengubah payment gateway."},{status:403});

    const {error}=await ctx.admin.from("luma_payment_provider_settings")
      .update({enabled:false,updated_at:new Date().toISOString(),updated_by:ctx.user.id})
      .in("provider",["xendit","midtrans"]);
    if(error)throw error;

    const {error:mayarError}=await ctx.admin.from("luma_payment_provider_settings")
      .update({enabled:true,priority:1,updated_at:new Date().toISOString(),updated_by:ctx.user.id})
      .eq("provider","mayar");
    if(mayarError)throw mayarError;

    await ctx.admin.from("luma_payment_routing").update({mode:"priority_fallback",updated_at:new Date().toISOString(),updated_by:ctx.user.id}).eq("id",1);

    const status=await getPaymentProviderStatus(ctx.admin);
    return NextResponse.json({ok:true,mode:"mayar_only",providers:status.providers,available:status.available});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Gagal menyimpan payment gateway."},{status:400});
  }
}
