import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";
import {getServerSecretSource,hasServerSecret} from "../../../../lib/server-secrets";

export const runtime="nodejs";

export async function GET(req:NextRequest){
  try{
    const workspaceId=String(new URL(req.url).searchParams.get("workspace_id")||"");
    const ctx=await getServerContext(workspaceId);
    if(!ctx.platformAdmin)return NextResponse.json({ok:false,error:"Owner access required."},{status:403});

    const [resendConfigured,{data:setting},{data:usage}]=await Promise.all([
      hasServerSecret(ctx.admin,"luma_resend_api_key"),
      ctx.admin.from("luma_platform_settings").select("setting_value").eq("setting_key","email_from").maybeSingle(),
      ctx.admin.from("luma_api_usage_events")
        .select("provider,service,status,created_at,metadata")
        .eq("provider","resend")
        .order("created_at",{ascending:false})
        .limit(25)
    ]);
    const from=String(process.env.LUMA_EMAIL_FROM||setting?.setting_value||"").trim();
    const last=(usage||[])[0]||null;
    const weekly=(usage||[]).find((x:any)=>x.service==="weekly_insight")||null;
    const transactional=(usage||[]).find((x:any)=>x.service==="transactional_notice")||null;
    return NextResponse.json({
      ok:true,
      email:{
        configured:Boolean(resendConfigured&&from),
        provider:"Resend",
        api_key_configured:Boolean(resendConfigured),
        secret_source:resendConfigured?getServerSecretSource("luma_resend_api_key"):"missing",
        from_configured:Boolean(from),
        from_address:from||null,
        last_status:last?.status||null,
        last_at:last?.created_at||null,
        weekly_last_status:weekly?.status||null,
        weekly_last_at:weekly?.created_at||null,
        transactional_last_status:transactional?.status||null,
        transactional_last_at:transactional?.created_at||null
      }
    });
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Email status unavailable."},{status:400});
  }
}
