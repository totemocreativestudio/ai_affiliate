import { NextRequest,NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";
import { resolvePromo,PromoTarget } from "../../../../lib/promo";
export const runtime="nodejs";
export async function POST(req:NextRequest){try{const body=await req.json();const workspaceId=String(body.workspace_id||"");const ctx=await getServerContext(workspaceId);const target=String(body.target_type||"generic") as PromoTarget;const r=await resolvePromo(ctx.admin,ctx.user.id,String(body.code||""),target,body.target_key??null,Number(body.base_amount||0));return NextResponse.json({ok:true,promo:{id:r.promo.id,code:r.promo.code,title:r.promo.title,promo_type:r.promo.promo_type,value:r.promo.value,ends_at:r.promo.ends_at},effect:r.effect});}catch{return NextResponse.json({ok:false,error:"Kode promo tidak dapat digunakan."},{status:400})}}
