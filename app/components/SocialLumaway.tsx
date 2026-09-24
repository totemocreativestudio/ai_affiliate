"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

type FeedRow={
  id:number;user_id:string;body:string|null;image_url:string|null;image_urls:any;created_at:string;
  social_alias:string;social_avatar_key:string;social_avatar_url:string|null;
  like_count:number;save_count:number;liked_by_me:boolean;saved_by_me:boolean;subscribed_by_me:boolean;subscriber_count:number;
};
type Archive={id:number;image_url:string;created_at:string};
type Identity={social_alias:string;social_avatar_key:string;social_avatar_url:string|null};

const mascotEmoji=(key:string)=>key.startsWith("nailong")?"🐲":key.startsWith("dragon")?"🐉":key.startsWith("gecko")?"🦎":"🦖";
const colorKey=(key:string)=>key.split("-")[1]||"emerald";
const imageList=(row:FeedRow)=>{
  if(Array.isArray(row.image_urls)&&row.image_urls.length)return row.image_urls.filter(Boolean).map(String);
  return row.image_url?[row.image_url]:[];
};

function SocialAvatar({alias,avatarUrl,avatarKey,size="normal"}:{alias:string;avatarUrl?:string|null;avatarKey:string;size?:"normal"|"small"|"large"}){
  return <div className={`social-lemon-avatar ${size} c-${colorKey(avatarKey)}`}>
    {avatarUrl?<img src={avatarUrl} alt={alias}/>:<span>{mascotEmoji(avatarKey)}</span>}
  </div>;
}

export default function SocialLumaway({workspaceId,userId}:{workspaceId:string;userId:string}){
  const supabase=createClient();
  const [feed,setFeed]=useState<FeedRow[]>([]);
  const [archives,setArchives]=useState<Archive[]>([]);
  const [identity,setIdentity]=useState<Identity>({social_alias:"LumaUser",social_avatar_key:"dino-emerald-happy",social_avatar_url:null});
  const [body,setBody]=useState("");
  const [files,setFiles]=useState<File[]>([]);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [tab,setTab]=useState<"for_you"|"following"|"popular">("for_you");
  const [detail,setDetail]=useState<FeedRow|null>(null);
  const [carouselIndex,setCarouselIndex]=useState(0);
  const [shareRow,setShareRow]=useState<FeedRow|null>(null);

  async function load(){
    const scope=tab==="following"?"following":"for_you";
    const [f,a,i]=await Promise.all([
      supabase.rpc("luma_get_social_feed_v2",{p_limit:80,p_offset:0,p_scope:scope}),
      supabase.from("luma_social_archives").select("id,image_url,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(9),
      supabase.rpc("luma_get_my_social_identity_v2")
    ]);
    setFeed((f.data||[]) as FeedRow[]);
    setArchives((a.data||[]) as Archive[]);
    const me=(i.data||[])[0] as Identity|undefined;if(me)setIdentity(me);
  }
  useEffect(()=>{void load()},[workspaceId,userId,tab]);

  const sorted=useMemo(()=>{
    const rows=[...feed];
    if(tab==="popular")rows.sort((a,b)=>(Number(b.like_count)+Number(b.save_count)*2)-(Number(a.like_count)+Number(a.save_count)*2));
    return rows;
  },[feed,tab]);

  const previewUrls=useMemo(()=>files.map(file=>URL.createObjectURL(file)),[files]);
  useEffect(()=>()=>previewUrls.forEach(url=>URL.revokeObjectURL(url)),[previewUrls]);

  async function publish(){
    if(!body.trim()&&!files.length)return setStatus("Tulis sesuatu atau pilih foto terlebih dahulu.");
    if(files.length>9)return setStatus("Maksimal 9 foto dalam satu post.");
    if(files.some(file=>file.size>3*1024*1024))return setStatus("Setiap foto maksimal 3 MB.");
    setBusy(true);setStatus("Memeriksa keamanan konten...");
    try{
      const fd=new FormData();fd.set("workspace_id",workspaceId);fd.set("body",body.trim());files.forEach(file=>fd.append("images",file));
      const r=await fetch("/api/social/publish",{method:"POST",body:fd});const d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.error||"error, terjadi kesalahan.");
      setBody("");setFiles([]);setStatus("Post berhasil dipublikasikan.");await load();
    }catch(e:any){setStatus(e?.message||"error, terjadi kesalahan.")}finally{setBusy(false)}
  }

  async function toggleLike(row:FeedRow){
    if(row.liked_by_me)await supabase.from("luma_community_likes").delete().eq("post_id",row.id).eq("user_id",userId);
    else await supabase.from("luma_community_likes").insert({post_id:row.id,user_id:userId});
    const next={...row,liked_by_me:!row.liked_by_me,like_count:Math.max(0,Number(row.like_count)+(row.liked_by_me?-1:1))};
    setFeed(xs=>xs.map(x=>x.id===row.id?next:x));if(detail?.id===row.id)setDetail(next);
  }
  async function toggleSave(row:FeedRow){
    if(row.saved_by_me)await supabase.from("luma_community_saves").delete().eq("post_id",row.id).eq("user_id",userId);
    else await supabase.from("luma_community_saves").insert({post_id:row.id,user_id:userId});
    const next={...row,saved_by_me:!row.saved_by_me,save_count:Math.max(0,Number(row.save_count)+(row.saved_by_me?-1:1))};
    setFeed(xs=>xs.map(x=>x.id===row.id?next:x));if(detail?.id===row.id)setDetail(next);
  }
  async function toggleSubscribe(row:FeedRow){
    if(row.user_id===userId)return;
    if(row.subscribed_by_me)await supabase.from("luma_community_subscriptions").delete().eq("user_id",userId).eq("subscribed_user_id",row.user_id);
    else await supabase.from("luma_community_subscriptions").insert({user_id:userId,subscribed_user_id:row.user_id});
    setFeed(xs=>xs.map(x=>x.user_id===row.user_id?{...x,subscribed_by_me:!row.subscribed_by_me,subscriber_count:Math.max(0,Number(x.subscriber_count)+(row.subscribed_by_me?-1:1))}:x));
    if(detail?.user_id===row.user_id)setDetail({...detail,subscribed_by_me:!row.subscribed_by_me,subscriber_count:Math.max(0,Number(detail.subscriber_count)+(row.subscribed_by_me?-1:1))});
  }

  function shareUrl(row:FeedRow){return `${window.location.origin}/share/social/${row.id}?ref=${encodeURIComponent(userId)}`}
  function shareText(row:FeedRow){return `${row.social_alias} di Lumaway Community: ${row.body||"Lihat post terbaru"}`}
  async function nativeShare(row:FeedRow){const url=shareUrl(row);const text=shareText(row);if(navigator.share){try{await navigator.share({title:"Lumaway Community",text,url});return}catch{}}await navigator.clipboard.writeText(`${text}\n${url}`);setStatus("Link post disalin.")}
  function openShare(network:string,row:FeedRow){const url=encodeURIComponent(shareUrl(row));const text=encodeURIComponent(shareText(row));let target="";if(network==="whatsapp")target=`https://wa.me/?text=${text}%0A${url}`;if(network==="linkedin")target=`https://www.linkedin.com/sharing/share-offsite/?url=${url}`;if(network==="threads")target=`https://www.threads.net/intent/post?text=${text}%20${url}`;if(network==="instagram"){void nativeShare(row);setStatus("Pilih Instagram/Story dari menu share perangkat Anda.");setShareRow(null);return}if(target)window.open(target,"_blank","noopener,noreferrer");setShareRow(null)}

  function openDetail(row:FeedRow){setDetail(row);setCarouselIndex(0)}

  return <section id="social-lumaway" className="legacy-page-anchor social-page social-lemon-page">
    <div className="social-lemon-header">
      <div><div className="eyebrow">LUMAWAY SOCIAL</div><h1>Community</h1><p>Temukan inspirasi, pengalaman, dan insight dari komunitas Lumaway.</p></div>
      <div className="social-lemon-me"><SocialAvatar alias={identity.social_alias} avatarUrl={identity.social_avatar_url} avatarKey={identity.social_avatar_key}/><div><b>{identity.social_alias}</b><small>Profil Community dapat diubah dari menu Profile</small></div></div>
    </div>

    <div className="social-lemon-composer">
      <div className="social-lemon-compose-row"><SocialAvatar alias={identity.social_alias} avatarUrl={identity.social_avatar_url} avatarKey={identity.social_avatar_key}/>
        <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Bagikan inspirasi, insight, pengalaman, atau referensi..." maxLength={1200}/>
      </div>
      {!!previewUrls.length&&<div className="social-compose-preview">{previewUrls.map((url,index)=><div key={url}><img src={url} alt={`Preview ${index+1}`}/><span>{index+1}/{previewUrls.length}</span></div>)}</div>}
      <div className="social-compose-actions lemon-actions">
        <label className="social-image-button">＋ Foto / Carousel<input multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFiles(Array.from(e.target.files||[]).slice(0,9))}/></label>
        <span className="social-file-name">{files.length?`${files.length} foto dipilih · maksimal 9`:"JPG, PNG, WEBP · maks 3 MB/foto"}</span>
        <button className="primary" disabled={busy} onClick={publish}>{busy?"Checking...":"Post"}</button>
      </div>
      {status&&<small className="social-status">{status}</small>}
    </div>

    <div className="social-lemon-tabs">
      <button className={tab==="for_you"?"active":""} onClick={()=>setTab("for_you")}>Untuk Anda</button>
      <button className={tab==="following"?"active":""} onClick={()=>setTab("following")}>Mengikuti</button>
      <button className={tab==="popular"?"active":""} onClick={()=>setTab("popular")}>Populer</button>
      <span>{sorted.length} post</span>
    </div>

    <div className="social-lemon-masonry">
      {sorted.map(row=>{const images=imageList(row);return <article className="social-lemon-card" key={row.id} onClick={()=>openDetail(row)}>
        {images[0]?<div className="social-lemon-cover"><img src={images[0]} alt="Community"/>{images.length>1&&<span className="social-carousel-count">▧ {images.length}</span>}</div>:<div className="social-lemon-text-cover"><p>{row.body}</p></div>}
        <div className="social-lemon-card-body">
          {row.body&&images[0]&&<h3>{row.body}</h3>}
          <div className="social-lemon-author"><SocialAvatar alias={row.social_alias} avatarUrl={row.social_avatar_url} avatarKey={row.social_avatar_key} size="small"/><span><b>{row.social_alias}</b><small>{new Date(row.created_at).toLocaleDateString("id-ID",{day:"numeric",month:"short"})}</small></span><button className={row.liked_by_me?"active":""} onClick={e=>{e.stopPropagation();void toggleLike(row)}}>♡ {Number(row.like_count)||0}</button></div>
        </div>
      </article>})}
      {!sorted.length&&<div className="empty-state social-lemon-empty"><strong>Belum ada post pada feed ini.</strong><span>Jadilah yang pertama berbagi inspirasi.</span></div>}
    </div>

    {!!archives.length&&<div className="social-lemon-archive-strip"><div><h3>Koleksi foto saya</h3><small>Foto terbaru yang pernah Anda post</small></div><div>{archives.map(x=><img key={x.id} src={x.image_url} alt="Archive"/>)}</div></div>}

    {detail&&<div className="social-detail-backdrop" onClick={()=>setDetail(null)}>
      <div className="social-detail-modal" onClick={e=>e.stopPropagation()}>
        <button className="social-detail-close" onClick={()=>setDetail(null)}>×</button>
        <div className="social-detail-media">
          {imageList(detail).length?<><img src={imageList(detail)[carouselIndex]} alt="Post detail"/>
            {imageList(detail).length>1&&<><button className="carousel-nav prev" onClick={()=>setCarouselIndex(i=>(i-1+imageList(detail).length)%imageList(detail).length)}>‹</button><button className="carousel-nav next" onClick={()=>setCarouselIndex(i=>(i+1)%imageList(detail).length)}>›</button><div className="carousel-dots">{imageList(detail).map((_,i)=><button key={i} className={i===carouselIndex?"active":""} onClick={()=>setCarouselIndex(i)}/>)}</div><span className="social-detail-counter">{carouselIndex+1}/{imageList(detail).length}</span></>}</>:<div className="social-detail-noimage">{detail.body}</div>}
        </div>
        <div className="social-detail-content">
          <div className="social-detail-author"><SocialAvatar alias={detail.social_alias} avatarUrl={detail.social_avatar_url} avatarKey={detail.social_avatar_key}/><div><b>{detail.social_alias}</b><small>{Number(detail.subscriber_count)||0} pengikut · {new Date(detail.created_at).toLocaleString("id-ID")}</small></div>{detail.user_id!==userId&&<button className={detail.subscribed_by_me?"subscribed":""} onClick={()=>void toggleSubscribe(detail)}>{detail.subscribed_by_me?"Mengikuti":"Ikuti"}</button>}</div>
          {detail.body&&<p className="social-detail-caption">{detail.body}</p>}
          <div className="social-detail-actions">
            <button className={detail.liked_by_me?"active":""} onClick={()=>void toggleLike(detail)}>♡ <b>{Number(detail.like_count)||0}</b> Suka</button>
            <button className={detail.saved_by_me?"active":""} onClick={()=>void toggleSave(detail)}>⌑ <b>{Number(detail.save_count)||0}</b> Simpan</button>
            <button onClick={()=>setShareRow(detail)}>↗ Bagikan</button>
          </div>
          <div className="social-detail-note">Lumaway Community tidak menyediakan komentar. Interaksi tersedia melalui Suka, Simpan, Bagikan, dan Ikuti.</div>
        </div>
      </div>
    </div>}

    {shareRow&&<div className="share-sheet-backdrop" onClick={()=>setShareRow(null)}><div className="share-sheet" onClick={e=>e.stopPropagation()}><div className="share-sheet-head"><div><b>Bagikan post</b><small>Post ID #{shareRow.id}</small></div><button onClick={()=>setShareRow(null)}>×</button></div>{imageList(shareRow)[0]&&<img src={imageList(shareRow)[0]} alt="Share preview" className="share-preview-image"/>}<p>{shareText(shareRow)}</p><div className="share-grid"><button onClick={()=>openShare("whatsapp",shareRow)}>WhatsApp</button><button onClick={()=>openShare("instagram",shareRow)}>Instagram</button><button onClick={()=>openShare("linkedin",shareRow)}>LinkedIn</button><button onClick={()=>openShare("threads",shareRow)}>Threads</button></div><button className="secondary share-copy" onClick={()=>nativeShare(shareRow)}>Share / Copy Link</button></div></div>}
  </section>;
}
