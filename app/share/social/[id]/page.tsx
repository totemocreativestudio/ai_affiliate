import type { Metadata } from "next";
import { createPublicClient } from "../../../../lib/public-supabase";

type Props={params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>};

type SharePost={id:number;body:string|null;image_url:string|null;created_at:string};

function appUrl(){return process.env.NEXT_PUBLIC_APP_URL||"https://www.lumaway.online";}

async function getPost(id:string):Promise<SharePost|null>{
  const postId=Number(id);if(!Number.isFinite(postId)||postId<=0)return null;
  const supabase=createPublicClient();
  const {data,error}=await supabase.rpc("luma_get_public_share_post",{p_post_id:postId});
  if(error||!Array.isArray(data)||!data.length)return null;
  return data[0] as SharePost;
}

export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {id}=await params;const post=await getPost(id);const base=appUrl();
  const description=(post?.body||"Lihat post terbaru dari Lumaway Community.").replace(/\s+/g," ").slice(0,180);
  const image=post?.image_url||`${base}/luma-logo.png`;
  const url=`${base}/share/social/${encodeURIComponent(id)}`;
  return {
    title:"Lumaway Community",
    description,
    alternates:{canonical:url},
    openGraph:{title:"Lumaway Community",description,url,type:"article",siteName:"Lumaway",images:[{url:image}]},
    twitter:{card:"summary_large_image",title:"Lumaway Community",description,images:[image]},
  };
}

export default async function SocialSharePage({params,searchParams}:Props){
  const {id}=await params;const query=await searchParams;const post=await getPost(id);const ref=typeof query.ref==="string"?query.ref:"";const base=appUrl();
  const openUrl=`${base}/?social_post=${encodeURIComponent(id)}${ref?`&ref=${encodeURIComponent(ref)}`:""}#social-lumaway`;
  return <main style={{minHeight:"100vh",background:"#f6f7fb",display:"grid",placeItems:"center",padding:24,fontFamily:'"DM Sans",Inter,Arial,sans-serif',color:"#172033"}}>
    <article style={{width:"min(680px,100%)",background:"#fff",border:"1px solid #e4e7ec",borderRadius:22,boxShadow:"0 24px 70px rgba(15,23,42,.12)",overflow:"hidden"}}>
      {post?.image_url&&<img src={post.image_url} alt="Lumaway Community post" style={{display:"block",width:"100%",maxHeight:460,objectFit:"cover"}}/>}
      <div style={{padding:26}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}><img src="/luma-mark.png" alt="Lumaway" style={{width:34,height:34}}/><div><b style={{display:"block",letterSpacing:".08em"}}>LUMAWAY</b><small style={{color:"#98a2b3"}}>Community</small></div></div>
        <p style={{fontSize:18,lineHeight:1.65,margin:"0 0 18px"}}>{post?.body||"Post Lumaway Community tersedia untuk dilihat di aplikasi."}</p>
        <small style={{display:"block",color:"#98a2b3",marginBottom:18}}>{post?.created_at?new Date(post.created_at).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"}):""}</small>
        <a href={openUrl} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minHeight:44,padding:"0 16px",borderRadius:11,background:"#635bff",color:"#fff",textDecoration:"none",fontWeight:700}}>Buka di Lumaway</a>
      </div>
    </article>
  </main>;
}
