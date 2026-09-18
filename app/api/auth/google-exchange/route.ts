import { NextRequest, NextResponse } from "next/server";

export const runtime="nodejs";

export async function POST(req:NextRequest){
  try{
    const {code}=await req.json();
    const clientId=String(process.env.GOOGLE_CLIENT_ID||process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID||"").trim();
    const clientSecret=String(process.env.GOOGLE_CLIENT_SECRET||"").trim();
    if(!code||!clientId||!clientSecret)return NextResponse.json({ok:false,error:"error, terjadi kesalahan."},{status:503});
    const body=new URLSearchParams({
      code:String(code),
      client_id:clientId,
      client_secret:clientSecret,
      redirect_uri:"postmessage",
      grant_type:"authorization_code",
    });
    const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body,cache:"no-store"});
    const data=await response.json();
    if(!response.ok||!data.id_token)return NextResponse.json({ok:false,error:"error, terjadi kesalahan."},{status:400});
    return NextResponse.json({ok:true,id_token:data.id_token});
  }catch{
    return NextResponse.json({ok:false,error:"error, terjadi kesalahan."},{status:400});
  }
}
