import type {NextRequest} from "next/server";
import {NextResponse} from "next/server";

const APP_HOST="app.lumaway.online";
const PUBLIC_HOSTS=new Set(["lumaway.online","www.lumaway.online"]);
const APP_SEGMENTS=new Set([
  "login","register","dashboard","upload","tutorial","excel-sync","database","agreements",
  "affiliate-support","ai-analytics","promo-studio","kanban","support-tickets","billing",
  "luma-affiliate","content-hub","social-lumaway","product-master","listings","shipping",
  "creator-samples","ratecard","profile","administration"
]);

function cleanHost(value:string){
  return value.toLowerCase().split(":")[0];
}
function appUrl(request:NextRequest,path:string){
  const url=request.nextUrl.clone();
  url.protocol="https:";
  url.host=APP_HOST;
  url.pathname=path;
  return url;
}
function isAssetOrService(pathname:string){
  return pathname.startsWith("/api/")
    || pathname==="/api"
    || pathname.startsWith("/auth/")
    || pathname.startsWith("/_next/")
    || pathname==="/sw.js"
    || pathname==="/manifest.webmanifest"
    || /\.[a-z0-9]{2,8}$/i.test(pathname);
}

export function proxy(request:NextRequest){
  const host=cleanHost(request.headers.get("host")||request.nextUrl.hostname);
  const pathname=request.nextUrl.pathname;

  if(pathname==="/app.lumaway"||pathname.startsWith("/app.lumaway/")){
    const clean=pathname.replace(/^\/app\.lumaway/,"")||"/";
    return NextResponse.redirect(appUrl(request,clean==="/"?"/login":clean),308);
  }

  if(host===APP_HOST){
    if(pathname.startsWith("/web")){
      const url=request.nextUrl.clone();
      url.protocol="https:";
      url.host="www.lumaway.online";
      return NextResponse.redirect(url,308);
    }
    if(isAssetOrService(pathname))return NextResponse.next();

    const internal=request.nextUrl.clone();
    internal.pathname=pathname==="/"?"/app.lumaway/login":`/app.lumaway${pathname}`;
    return NextResponse.rewrite(internal);
  }

  if(PUBLIC_HOSTS.has(host)){
    const first=pathname.replace(/^\/+/, "").split("/")[0];
    if(APP_SEGMENTS.has(first)){
      return NextResponse.redirect(appUrl(request,pathname),308);
    }
  }

  return NextResponse.next();
}

export const config={
  matcher:["/((?!_next/static|_next/image|favicon.ico).*)"],
};
