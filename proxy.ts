import type {NextRequest} from "next/server";
import {NextResponse} from "next/server";

const APP_HOST="app.lumaway.online";
const LOCAL_HOSTS=new Set(["localhost","127.0.0.1","0.0.0.0"]);
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
  // Drop any local dev port so cross-domain redirects never emit a broken
  // "app.lumaway.online:3000" origin.
  url.port="";
  url.pathname=path;
  return url;
}
function publicUrl(request:NextRequest,path:string){
  const url=request.nextUrl.clone();
  url.protocol="https:";
  url.host="www.lumaway.online";
  url.port="";
  url.pathname=path;
  return url;
}
function isWebPath(pathname:string){
  return pathname==="/web"||pathname.startsWith("/web/");
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
  const forwarded=String(request.headers.get("x-forwarded-host")||"").split(",")[0].trim();
  const host=cleanHost(forwarded||request.headers.get("host")||request.nextUrl.hostname);
  const pathname=request.nextUrl.pathname;
  // Localhost (npm run dev / start) behaves like the app host so login,
  // register, and dashboard can be tested without hitting production.
  const isLocal=LOCAL_HOSTS.has(host);

  if(host===APP_HOST||isLocal){
    // Internal rewrites use the legacy catch-all route. Let that target pass
    // through instead of redirecting it again and creating a rewrite loop.
    if(pathname==="/app.lumaway"||pathname.startsWith("/app.lumaway/")){
      return NextResponse.next();
    }
    // Public site is served by this app in dev; only cross-domain in production.
    if(isWebPath(pathname)&&!isLocal){
      return NextResponse.redirect(publicUrl(request,pathname),308);
    }
    if(isAssetOrService(pathname))return NextResponse.next();

    const internal=request.nextUrl.clone();
    internal.pathname=pathname==="/"?"/app.lumaway/login":`/app.lumaway${pathname}`;
    return NextResponse.rewrite(internal);
  }

  if(!isLocal&&(pathname==="/app.lumaway"||pathname.startsWith("/app.lumaway/"))){
    const clean=pathname.replace(/^\/app\.lumaway/,"")||"/";
    return NextResponse.redirect(appUrl(request,clean==="/"?"/login":clean),308);
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
