import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { getServerSecret } from "../../../../lib/server-secrets";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = String(body.workspace_id || "");
    const packageId = Number(body.package_id || 0);
    if (!workspaceId || !packageId) return NextResponse.json({ ok:false,error:"Workspace dan package wajib diisi." },{status:400});

    const ctx = await getServerContext(workspaceId);
    const key = await getServerSecret(ctx.admin,"luma_xendit_secret_key");
    if (!key) return NextResponse.json({ ok:false,error:"Payment gateway belum aktif. Admin perlu menghubungkan Xendit terlebih dahulu." },{status:503});

    const {data:pkg,error:pkgError}=await ctx.admin.from("luma_token_packages").select("id,label,tokens,price,status").eq("id",packageId).single();
    if(pkgError)throw pkgError;
    if(pkg.status!=="active"||Number(pkg.price||0)<=0) return NextResponse.json({ok:false,error:"Paket token belum aktif atau harga belum ditetapkan admin."},{status:400});

    const orderCode=`TOPUP-${randomUUID().replace(/-/g,"").slice(0,12).toUpperCase()}`;
    const origin=(process.env.NEXT_PUBLIC_APP_URL||new URL(req.url).origin).replace(/\/$/,"");
    const customer:any={reference_id:`luma-${ctx.user.id}-${Date.now()}`,type:"INDIVIDUAL",email:ctx.user.email||undefined};
    const payload:any={
      reference_id:orderCode,
      session_type:"PAY",
      mode:"PAYMENT_LINK",
      amount:Number(pkg.price),
      currency:"IDR",
      country:"ID",
      locale:"id",
      description:`LUMA ${pkg.label} - ${pkg.tokens} token`,
      customer,
      items:[{reference_id:`token-${pkg.tokens}`,name:`LUMA ${pkg.tokens} Token`,description:"LUMA AI token top up",type:"DIGITAL_SERVICE",category:"SOFTWARE",net_unit_amount:Number(pkg.price),quantity:1,currency:"IDR"}],
      metadata:{workspace_id:workspaceId,user_id:ctx.user.id,package_tokens:String(pkg.tokens)},
    };
    if(origin.startsWith("https://")){
      payload.success_return_url=`${origin}/#billing`;
      payload.cancel_return_url=`${origin}/#billing`;
    }

    const response=await fetch("https://api.xendit.co/sessions",{
      method:"POST",
      headers:{Authorization:`Basic ${Buffer.from(`${key}:`).toString("base64")}`,"Content-Type":"application/json"},
      body:JSON.stringify(payload),
    });
    const x=await response.json();
    if(!response.ok)throw new Error(x?.message||x?.error_code||`Xendit error ${response.status}`);

    const {error:orderError}=await ctx.admin.from("luma_topup_orders").insert({
      workspace_id:workspaceId,user_id:ctx.user.id,order_code:orderCode,package_tokens:pkg.tokens,amount:pkg.price,status:"pending",payment_provider:"Xendit",payment_method:"Hosted Checkout",payment_session_id:x.payment_session_id||null,payment_url:x.payment_link_url||null,expires_at:x.expires_at||null,provider_payload:{status:x.status,allowed_payment_channels:x.allowed_payment_channels||[]}
    });
    if(orderError)throw orderError;

    return NextResponse.json({ok:true,order_code:orderCode,payment_url:x.payment_link_url,payment_session_id:x.payment_session_id,expires_at:x.expires_at,channels:x.allowed_payment_channels||[]});
  } catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Gagal membuat checkout."},{status:400});
  }
}
