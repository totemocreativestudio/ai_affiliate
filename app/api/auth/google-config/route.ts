import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function GET(){const clientId=String(process.env.GOOGLE_CLIENT_ID||process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID||"").trim();return NextResponse.json(clientId?{ok:true,client_id:clientId}:{ok:false,error:"error, terjadi kesalahan."},{status:clientId?200:503})}
