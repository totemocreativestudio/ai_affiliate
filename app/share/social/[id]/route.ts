import { NextRequest } from "next/server";

export const runtime="nodejs";

type SharePost={id:number;body:string|null;image_url:string|null;created_at:string};
function esc(value:string){return value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}

async function getPost(id:number):Promise<SharePost|null>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||"";
  if(!url||!key)return null;
  try{
    const r=await fetch(`${url}/rest/v1/rpc/luma_get_public_share_post`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({p_post_id:id}),next:{revalidate:300}});
    if(!r.ok)return null;const data=await r.json();return Array.isArray(data)&&data.length?data[0] as SharePost:null;
  }catch{return null;}
}

export async function GET(req:NextRequest){
  const parts=req.nextUrl.pathname.split("/").filter(Boolean);const id=Number(parts[parts.length-1]);
  const base=process.env.NEXT_PUBLIC_APP_URL||req.nextUrl.origin||"https://www.lumaway.online";
  const post=Number.isFinite(id)&&id>0?await getPost(id):null;
  const description=(post?.body||"Lihat post terbaru dari Lumaway Community.").replace(/\s+/g," ").slice(0,180);
  const image=post?.image_url||`${base}/luma-logo.png`;
  const canonical=`${base}/share/social/${Number.isFinite(id)?id:""}`;
  const ref=req.nextUrl.searchParams.get("ref")||"";
  const openUrl=`${base}/?social_post=${encodeURIComponent(String(id||""))}${ref?`&ref=${encodeURIComponent(ref)}`:""}#social-lumaway`;
  const html=`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumaway Community</title><meta name="description" content="${esc(description)}"><meta property="og:type" content="article"><meta property="og:site_name" content="Lumaway"><meta property="og:title" content="Lumaway Community"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Lumaway Community"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#f6f7fb;color:#172033;font-family:Arial,Helvetica,sans-serif;display:grid;place-items:center;padding:24px}.card{width:min(680px,100%);background:#fff;border:1px solid #e4e7ec;border-radius:22px;overflow:hidden;box-shadow:0 24px 70px rgba(15,23,42,.12)}.hero{display:block;width:100%;max-height:460px;object-fit:cover}.body{padding:26px}.brand{display:flex;align-items:center;gap:10px;margin-bottom:18px}.brand img{width:34px;height:34px}.brand b{display:block;letter-spacing:.08em}.brand small{color:#98a2b3}.copy{font-size:18px;line-height:1.65}.cta{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:11px;background:#635bff;color:#fff;text-decoration:none;font-weight:700}</style></head><body><article class="card">${post?.image_url?`<img class="hero" src="${esc(post.image_url)}" alt="Lumaway Community post">`:""}<div class="body"><div class="brand"><img src="/luma-mark.png" alt="Lumaway"><div><b>LUMAWAY</b><small>Community</small></div></div><p class="copy">${esc(description)}</p><a class="cta" href="${esc(openUrl)}">Buka di Lumaway</a></div></article></body></html>`;
  return new Response(html,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, s-maxage=300, stale-while-revalidate=600"}});
}
