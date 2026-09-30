import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";

export const runtime="nodejs";

const ALLOWED_HOSTS=[
  "instagram.com","www.instagram.com",
  "tiktok.com","www.tiktok.com","m.tiktok.com",
  "facebook.com","www.facebook.com",
  "lemon8-app.com","www.lemon8-app.com",
  "youtube.com","www.youtube.com",
  "threads.net","www.threads.net",
  "x.com","www.x.com","twitter.com","www.twitter.com"
];

function normalizeUrl(value:any){
  const raw=String(value||"").trim();
  if(!raw)return null;
  try{
    const url=new URL(/^https?:\/\//i.test(raw)?raw:"https://"+raw);
    if(url.protocol!=="https:")return null;
    if(!ALLOWED_HOSTS.includes(url.hostname.toLowerCase()))return null;
    return url.toString();
  }catch{return null}
}

function metaValue(html:string,names:string[]){
  const tags=html.match(/<meta\b[^>]*>/gi)||[];
  for(const tag of tags){
    const attrs:Record<string,string>={};
    for(const match of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*["']([^"']*)["']/g))attrs[match[1].toLowerCase()]=match[2];
    const key=String(attrs.property||attrs.name||"").toLowerCase();
    if(names.includes(key)&&attrs.content)return attrs.content;
  }
  return null;
}

async function readPublicProfile(url:string){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),6500);
  try{
    const response=await fetch(url,{
      signal:controller.signal,
      redirect:"follow",
      headers:{
        "User-Agent":"Mozilla/5.0 (compatible; LumawayProfilePreview/1.0; +https://lumaway.online)",
        "Accept":"text/html,application/xhtml+xml"
      },
      cache:"no-store"
    });
    const finalUrl=new URL(response.url||url);
    if(!ALLOWED_HOSTS.includes(finalUrl.hostname.toLowerCase()))return{url,image:null,title:null,available:false};
    if(!response.ok)return{url,image:null,title:null,available:false};
    const buffer=await response.arrayBuffer();
    const html=new TextDecoder("utf-8").decode(buffer.slice(0,700000));
    const rawImage=metaValue(html,["og:image","twitter:image","twitter:image:src"]);
    const rawTitle=metaValue(html,["og:title","twitter:title"]);
    let image:string|null=null;
    if(rawImage){
      try{
        const parsed=new URL(rawImage,finalUrl);
        if(parsed.protocol==="https:"||parsed.protocol==="http:")image=parsed.toString();
      }catch{}
    }
    return{url:finalUrl.toString(),image,title:rawTitle||null,available:true};
  }catch{
    return{url,image:null,title:null,available:false};
  }finally{clearTimeout(timeout)}
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const workspaceId=String(body.workspace_id||"").trim();
    const creatorId=Number(body.creator_id||0);
    const manualAvatar=String(body.avatar_url||"").trim();
    const inputLinks=body.links&&typeof body.links==="object"?body.links:{};
    if(!workspaceId||!creatorId)return NextResponse.json({ok:false,error:"workspace_id dan creator_id wajib diisi."},{status:400});

    const {admin}=await getServerContext(workspaceId);
    const {data:creator,error:creatorError}=await admin.from("creators")
      .select("id,profile_url,avatar_url,social_links")
      .eq("workspace_id",workspaceId).eq("id",creatorId).maybeSingle();
    if(creatorError)throw creatorError;
    if(!creator)return NextResponse.json({ok:false,error:"Creator tidak ditemukan."},{status:404});

    const normalizedLinks:Record<string,string>={};
    for(const [key,value] of Object.entries(inputLinks)){
      const normalized=normalizeUrl(value);
      if(normalized)normalizedLinks[String(key).toLowerCase()]=normalized;
    }

    const urls=Object.values(normalizedLinks).slice(0,8);
    const resolved=await Promise.all(urls.map(url=>readPublicProfile(url)));
    const firstImage=resolved.find(item=>item.image)?.image||null;
    let avatarUrl=manualAvatar||firstImage||String(creator.avatar_url||"").trim()||null;
    if(avatarUrl){
      try{
        const parsed=new URL(avatarUrl);
        if(!["http:","https:"].includes(parsed.protocol))avatarUrl=null;
      }catch{avatarUrl=null}
    }

    const profileUrl=normalizedLinks.tiktok||normalizedLinks.instagram||normalizedLinks.facebook||normalizedLinks.lemon8||urls[0]||creator.profile_url||null;
    const {data:updated,error:updateError}=await admin.from("creators").update({
      social_links:normalizedLinks,
      profile_url:profileUrl,
      avatar_url:avatarUrl,
      social_profile_updated_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }).eq("workspace_id",workspaceId).eq("id",creatorId)
      .select("id,profile_url,avatar_url,social_links,social_profile_updated_at").single();
    if(updateError)throw updateError;

    return NextResponse.json({
      ok:true,
      creator:updated,
      resolved,
      photo_source:firstImage?"public_metadata":manualAvatar?"manual":"existing",
      warning:firstImage?null:"Link tersimpan. Foto profil publik tidak tersedia dari metadata platform; Anda masih dapat menggunakan Avatar URL manual."
    });
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Gagal membaca profil sosial."},{status:400});
  }
}
