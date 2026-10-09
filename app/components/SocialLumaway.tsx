
"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

type FeedRow={
  id:number;user_id:string;body:string|null;image_url:string|null;image_urls:any;created_at:string;
  social_alias:string;social_avatar_key:string;social_avatar_url:string|null;
  like_count:number;save_count:number;liked_by_me:boolean;saved_by_me:boolean;subscribed_by_me:boolean;subscriber_count:number;
};
type Discover={posts:{id:number;author:string;summary:string;likes:number;saves:number;views:number;shares:number;score:number}[];keywords:{keyword:string;uses:number}[]};
type Archive={id:number;image_url:string;created_at:string};
type Identity={social_alias:string;social_avatar_key:string;social_avatar_url:string|null};
type SocialProfile={
  user_id:string;social_alias:string;social_avatar_key:string;social_avatar_url:string|null;bio:string|null;position_title:string|null;
  post_count:number;follower_count:number;following_count:number;like_count:number;save_count:number;subscribed_by_me:boolean;
};
type Tab="for_you"|"following"|"popular"|"saved";

const imageList=(row:FeedRow)=>{
  if(Array.isArray(row.image_urls)&&row.image_urls.length)return row.image_urls.filter(Boolean).map(String);
  return row.image_url?[row.image_url]:[];
};
const num=(value:any)=>Number(value||0).toLocaleString("id-ID");
const shortDate=(value:string)=>new Date(value).toLocaleDateString("id-ID",{day:"2-digit",month:"short"});
const longDate=(value:string)=>new Date(value).toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});

function SocialAvatar({alias,avatarUrl,size="normal"}:{alias:string;avatarUrl?:string|null;size?:"small"|"normal"|"large"|"xl"}){
  return <div className={"social-v3-avatar "+size}>
    {avatarUrl?<img src={avatarUrl} alt={alias}/>:<span>{String(alias||"L").slice(0,1).toUpperCase()}</span>}
  </div>;
}

export default function SocialLumaway({workspaceId,userId}:{workspaceId:string;userId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [feed,setFeed]=useState<FeedRow[]>([]);
  const [discovery,setDiscovery]=useState<Discover>({posts:[],keywords:[]});
  const [archives,setArchives]=useState<Archive[]>([]);
  const [identity,setIdentity]=useState<Identity>({social_alias:"LumaUser",social_avatar_key:"default",social_avatar_url:null});
  const [myProfile,setMyProfile]=useState<SocialProfile|null>(null);
  const [body,setBody]=useState("");
  const [files,setFiles]=useState<File[]>([]);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [tab,setTab]=useState<Tab>("for_you");
  const [detail,setDetail]=useState<FeedRow|null>(null);
  const [carouselIndex,setCarouselIndex]=useState(0);
  const [shareRow,setShareRow]=useState<FeedRow|null>(null);
  const [profile,setProfile]=useState<SocialProfile|null>(null);
  const [profilePosts,setProfilePosts]=useState<FeedRow[]>([]);
  const [profileBusy,setProfileBusy]=useState(false);

  async function load(){
    const scope=tab==="following"?"following":"for_you";
    const [feedResult,archiveResult,identityResult,profileResult,discoverResult]=await Promise.all([
      supabase.rpc("luma_get_social_feed_v2",{p_limit:100,p_offset:0,p_scope:scope}),
      supabase.from("luma_social_archives").select("id,image_url,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(12),
      supabase.rpc("luma_get_my_social_identity_v2"),
      supabase.rpc("luma_get_social_profile_v3",{p_user_id:userId}),
       supabase.rpc("luma_social_discover_v1")
    ]);
    setFeed((feedResult.data||[]) as FeedRow[]);
     if(!discoverResult.error)setDiscovery((discoverResult.data||{posts:[],keywords:[]}) as Discover);
     if(feedResult.error)setStatus("Feed belum dapat dimuat: "+feedResult.error.message);
    setArchives((archiveResult.data||[]) as Archive[]);
    const me=(identityResult.data||[])[0] as Identity|undefined;if(me)setIdentity(me);
    const mine=(profileResult.data||[])[0] as SocialProfile|undefined;if(mine)setMyProfile(mine);
  }

  useEffect(()=>{void load()},[workspaceId,userId,tab]);
  useEffect(()=>{
    let disposed=false;
    let refreshTimer:ReturnType<typeof setTimeout>|null=null;
    const refresh=()=>{
      if(disposed||refreshTimer)return;
      refreshTimer=setTimeout(()=>{refreshTimer=null;if(!disposed)void load()},220);
    };
    const channel=supabase.channel("luma-social-interactions-"+userId+"-"+tab)
      .on("postgres_changes",{event:"*",schema:"public",table:"luma_community_likes"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"luma_community_subscriptions"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"luma_community_posts"},refresh)
      .subscribe();
    const onFocus=()=>refresh();
    const onVisible=()=>{if(document.visibilityState==="visible")refresh()};
    window.addEventListener("lumaway-social-profile-updated",refresh);
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{
      disposed=true;
      if(refreshTimer)clearTimeout(refreshTimer);
      window.removeEventListener("lumaway-social-profile-updated",refresh);
      window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onVisible);
      void supabase.removeChannel(channel);
    };
  },[workspaceId,userId,tab,supabase]);

  useEffect(()=>{
    if(!profile&&!detail&&!shareRow)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKey=(event:KeyboardEvent)=>{
      if(event.key!=="Escape")return;
      if(shareRow)setShareRow(null);
      else if(detail)setDetail(null);
      else if(profile)setProfile(null);
    };
    window.addEventListener("keydown",onKey);
    return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",onKey)};
  },[profile,detail,shareRow]);

  const sorted=useMemo(()=>{
    let rows=[...feed];
    if(tab==="popular")rows.sort((a,b)=>(Number(b.like_count)+Number(b.save_count)*2+Number(b.subscriber_count))-(Number(a.like_count)+Number(a.save_count)*2+Number(a.subscriber_count)));
    if(tab==="saved")rows=rows.filter(row=>row.saved_by_me);
    return rows;
  },[feed,tab]);

  const ownPosts=useMemo(()=>feed.filter(row=>row.user_id===userId),[feed,userId]);
  const otherPosts=useMemo(()=>sorted.filter(row=>row.user_id!==userId),[sorted,userId]);
  const people=useMemo(()=>{
    const map=new Map<string,FeedRow>();
    for(const row of feed){
      const current=map.get(row.user_id);
      if(!current||Number(row.subscriber_count)>Number(current.subscriber_count))map.set(row.user_id,row);
    }
    return Array.from(map.values()).filter(row=>row.user_id!==userId).sort((a,b)=>Number(b.subscriber_count)-Number(a.subscriber_count)).slice(0,6);
  },[feed,userId]);

  const previewUrls=useMemo(()=>files.map(file=>URL.createObjectURL(file)),[files]);
  useEffect(()=>()=>previewUrls.forEach(url=>URL.revokeObjectURL(url)),[previewUrls]);

  async function publish(){
    if(!body.trim()&&!files.length){setStatus("Tulis sesuatu atau pilih foto terlebih dahulu.");return}
    if(files.length>9){setStatus("Maksimal 9 foto dalam satu post.");return}
    if(files.some(file=>file.size>3*1024*1024)){setStatus("Setiap foto maksimal 3 MB.");return}
    setBusy(true);setStatus("Memeriksa dan mempublikasikan...");
    try{
      const fd=new FormData();fd.set("workspace_id",workspaceId);fd.set("body",body.trim());files.forEach(file=>fd.append("images",file));
      const response=await fetch("/api/social/publish",{method:"POST",body:fd});const data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||"Post belum dapat dipublikasikan.");
      setBody("");setFiles([]);setTab("for_you");setStatus("Post berhasil dipublikasikan dan sudah tampil di feed.");await load();
    }catch(error:any){setStatus(error?.message||"Terjadi kesalahan saat mempublikasikan.")}finally{setBusy(false)}
  }

  function updateRow(next:FeedRow){
    setFeed(rows=>rows.map(row=>row.id===next.id?next:row));
    setProfilePosts(rows=>rows.map(row=>row.id===next.id?next:row));
    if(detail?.id===next.id)setDetail(next);
  }

  async function toggleLike(row:FeedRow){
    const next={...row,liked_by_me:!row.liked_by_me,like_count:Math.max(0,Number(row.like_count)+(row.liked_by_me?-1:1))};
    updateRow(next);
    if(row.user_id===userId)setMyProfile(p=>p?{...p,like_count:Math.max(0,Number(p.like_count)+(row.liked_by_me?-1:1))}:p);
    const result=row.liked_by_me
      ?await supabase.from("luma_community_likes").delete().eq("post_id",row.id).eq("user_id",userId)
      :await supabase.from("luma_community_likes").insert({post_id:row.id,user_id:userId});
    if(result.error){updateRow(row);setStatus("Like belum tersimpan: "+result.error.message);
      if(row.user_id===userId)setMyProfile(p=>p?{...p,like_count:Math.max(0,Number(p.like_count)+(row.liked_by_me?1:-1))}:p)}
  }

  async function toggleSave(row:FeedRow){
    const next={...row,saved_by_me:!row.saved_by_me,save_count:Math.max(0,Number(row.save_count)+(row.saved_by_me?-1:1))};
    updateRow(next);
    const result=row.saved_by_me
      ?await supabase.from("luma_community_saves").delete().eq("post_id",row.id).eq("user_id",userId)
      :await supabase.from("luma_community_saves").insert({post_id:row.id,user_id:userId});
    if(result.error){updateRow(row);setStatus("Simpan belum berhasil: "+result.error.message)}
  }

  async function toggleSubscribe(row:FeedRow){
    if(row.user_id===userId)return;
    const subscribed=!row.subscribed_by_me;
    setFeed(rows=>rows.map(item=>item.user_id===row.user_id?{...item,subscribed_by_me:subscribed,subscriber_count:Math.max(0,Number(item.subscriber_count)+(row.subscribed_by_me?-1:1))}:item));
    setProfilePosts(rows=>rows.map(item=>item.user_id===row.user_id?{...item,subscribed_by_me:subscribed,subscriber_count:Math.max(0,Number(item.subscriber_count)+(row.subscribed_by_me?-1:1))}:item));
    if(profile?.user_id===row.user_id)setProfile({...profile,subscribed_by_me:subscribed,follower_count:Math.max(0,Number(profile.follower_count)+(row.subscribed_by_me?-1:1))});
    if(detail?.user_id===row.user_id)setDetail({...detail,subscribed_by_me:subscribed,subscriber_count:Math.max(0,Number(detail.subscriber_count)+(row.subscribed_by_me?-1:1))});
    setMyProfile(p=>p?{...p,following_count:Math.max(0,Number(p.following_count)+(subscribed?1:-1))}:p);
    const result=row.subscribed_by_me
      ?await supabase.from("luma_community_subscriptions").delete().eq("user_id",userId).eq("subscribed_user_id",row.user_id)
      :await supabase.from("luma_community_subscriptions").insert({user_id:userId,subscribed_user_id:row.user_id});
    if(result.error){setStatus("Follow belum tersimpan: "+result.error.message);await load()}
  }

  async function openProfile(targetUserId:string){
    setProfileBusy(true);setStatus("");
    try{
      const [profileResult,postsResult]=await Promise.all([
        supabase.rpc("luma_get_social_profile_v3",{p_user_id:targetUserId}),
        supabase.rpc("luma_get_social_user_posts_v3",{p_user_id:targetUserId,p_limit:30,p_offset:0})
      ]);
      if(profileResult.error)throw profileResult.error;if(postsResult.error)throw postsResult.error;
      const row=(profileResult.data||[])[0] as SocialProfile|undefined;
      if(!row)throw new Error("Profil Community tidak ditemukan.");
      setProfile(row);setProfilePosts((postsResult.data||[]) as FeedRow[]);
    }catch(error:any){setStatus(error?.message||"Profil belum dapat dibuka.")}finally{setProfileBusy(false)}
  }

  function track(postId:number,eventType:"view"|"share"){
    void supabase.from("luma_community_post_events").insert({post_id:postId,user_id:userId,event_type:eventType}).then(()=>{});
  }
  async function deletePost(row:FeedRow){
    if(row.user_id!==userId)return;
    if(!window.confirm("Hapus post ini beserta foto dan interaksi yang terkait?"))return;
    setBusy(true);
    try{
      const response=await fetch("/api/social/delete",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({workspace_id:workspaceId,post_id:row.id})});
      const data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||"Gagal menghapus post.");
      setDetail(null);setProfile(null);setShareRow(null);
      setStatus(data.media_deleted?"Post dan media berhasil dihapus.":"Post terhapus dari feed, tetapi sebagian media perlu dibersihkan admin.");
      await load();
    }catch(error){setStatus(error instanceof Error?error.message:"Post belum dapat dihapus.")}
    finally{setBusy(false)}
  }
  function openDetail(row:FeedRow){setDetail(row);setCarouselIndex(0);track(row.id,"view")}
  function shareUrl(row:FeedRow){return window.location.origin+"/share/social/"+row.id+"?ref="+encodeURIComponent(userId)}
  function shareText(row:FeedRow){return row.social_alias+" di Lumaway Community: "+(row.body||"Lihat post terbaru")}
  async function nativeShare(row:FeedRow){
    const url=shareUrl(row),text=shareText(row);
    if(navigator.share){try{await navigator.share({title:"Lumaway Community",text,url});track(row.id,"share");return}catch{}}
    await navigator.clipboard.writeText(text+"\n"+url);track(row.id,"share");setStatus("Link post disalin.");
  }
  function openShare(network:string,row:FeedRow){
    const url=encodeURIComponent(shareUrl(row)),text=encodeURIComponent(shareText(row));let target="";
    if(network==="whatsapp")target="https://wa.me/?text="+text+"%0A"+url;
    if(network==="linkedin")target="https://www.linkedin.com/sharing/share-offsite/?url="+url;
    if(network==="threads")target="https://www.threads.net/intent/post?text="+text+"%20"+url;
    if(network==="instagram"){void nativeShare(row);setStatus("Pilih Instagram/Story dari menu share perangkat Anda.");setShareRow(null);return}
    if(target){window.open(target,"_blank","noopener,noreferrer");track(row.id,"share")}setShareRow(null);
  }

  function renderPost(row:FeedRow,compact=false){
    const images=imageList(row);
    return <article className={"social-v3-post "+(compact?"compact":"")} key={row.id}>
      <header>
        <button className="social-v3-author-button" onClick={()=>void openProfile(row.user_id)}>
          <SocialAvatar alias={row.social_alias} avatarUrl={row.social_avatar_url} size="small"/>
          <span><b>{row.social_alias}</b><small>{shortDate(row.created_at)}</small></span>
        </button>
        {row.user_id!==userId?<button className={"social-v3-follow-mini "+(row.subscribed_by_me?"active":"")} onClick={()=>void toggleSubscribe(row)}>{row.subscribed_by_me?"Mengikuti":"Ikuti"}</button>:<button className="social-v3-delete-post" disabled={busy} title="Hapus postingan Anda" onClick={()=>void deletePost(row)}>Hapus</button>}
      </header>
      <button className="social-v3-post-open" onClick={()=>openDetail(row)}>
        {images.length?<div className="social-v3-post-media"><img src={images[0]} alt="Community post"/>{images.length>1&&<span>{images.length} foto</span>}</div>:<div className="social-v3-text-post">{row.body}</div>}
        {row.body&&images.length>0&&<p>{row.body}</p>}
      </button>
      <footer>
        <button className={row.liked_by_me?"active":""} onClick={()=>void toggleLike(row)}>Suka <b>{num(row.like_count)}</b></button>
        <button className={row.saved_by_me?"active":""} onClick={()=>void toggleSave(row)}>Simpan <b>{num(row.save_count)}</b></button>
        <button onClick={()=>setShareRow(row)}>Bagikan</button>
      </footer>
    </article>;
  }

  const profileActionRow=profilePosts[0]||feed.find(row=>row.user_id===profile?.user_id)||null;

  return <section id="social-lumaway" className="legacy-page-anchor social-v3-page">
    <header className="social-v3-page-head">
      <div><div className="eyebrow">LUMAWAY SOCIAL</div><h1>Community</h1><p>Ruang berbagi insight, inspirasi, pengalaman, dan aktivitas creator di dalam ekosistem Lumaway.</p></div>
      <div className="social-v3-me-compact"><SocialAvatar alias={identity.social_alias} avatarUrl={identity.social_avatar_url}/><div><b>{identity.social_alias}</b><small>Identitas Community mengikuti menu Profile</small></div></div>
    </header>

    <div className="social-v3-shell">
      <aside className="social-v3-left">
        <div className="social-v3-brand"><span className="social-v3-brand-dot"/><div><b>Lumaway Social</b><small>Community workspace</small></div></div>
        <nav>
          <button className={tab==="for_you"?"active":""} onClick={()=>setTab("for_you")}><span>01</span>Community Home</button>
          <button onClick={()=>void openProfile(userId)}><span>02</span>My Profile</button>
          <button className={tab==="following"?"active":""} onClick={()=>setTab("following")}><span>03</span>Following</button>
          <button className={tab==="popular"?"active":""} onClick={()=>setTab("popular")}><span>04</span>Discover</button>
          <button className={tab==="saved"?"active":""} onClick={()=>setTab("saved")}><span>05</span>Saved</button>
        </nav>
        <div className="social-v3-left-section"><span>ACCOUNT</span><button onClick={()=>void openProfile(userId)}>Public Profile</button><a href="/profile">Edit Profile</a></div>
        <button className="social-v3-new-post" onClick={()=>document.getElementById("social-v3-composer")?.scrollIntoView({behavior:"smooth",block:"center"})}>+ New Post</button>
      </aside>

      <main className="social-v3-center">
        <section className="social-v3-profile-hero">
          <div className="social-v3-profile-primary">
            <SocialAvatar alias={identity.social_alias} avatarUrl={identity.social_avatar_url} size="large"/>
            <div><span>MY COMMUNITY PROFILE</span><h2>{identity.social_alias}</h2><p>{myProfile?.bio||"Bagikan apa yang sedang Anda kerjakan, pelajari, atau temukan bersama Community Lumaway."}</p><button onClick={()=>void openProfile(userId)}>Lihat Profil</button></div>
          </div>
          <div className="social-v3-stat-grid">
            <article><span>Post</span><b>{num(myProfile?.post_count)}</b><small>Total publikasi</small></article>
            <article><span>Followers</span><b>{num(myProfile?.follower_count)}</b><small>Community</small></article>
            <article><span>Following</span><b>{num(myProfile?.following_count)}</b><small>Profil diikuti</small></article>
            <article><span>Likes</span><b>{num(myProfile?.like_count)}</b><small>Interaksi post</small></article>
          </div>
        </section>

        <section id="social-v3-composer" className="social-v3-composer">
          <div className="social-v3-composer-head"><SocialAvatar alias={identity.social_alias} avatarUrl={identity.social_avatar_url}/><div><b>Buat post baru</b><small>Posting Anda langsung muncul di tengah feed setelah dipublikasikan.</small></div></div>
          <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Bagikan insight, pengalaman, progress campaign, referensi, atau inspirasi..." maxLength={1200}/>
          {!!previewUrls.length&&<div className="social-v3-compose-preview">{previewUrls.map((url,index)=><div key={url}><img src={url} alt={"Preview "+(index+1)}/><span>{index+1}/{previewUrls.length}</span></div>)}</div>}
          <footer><label>Tambah Foto<input multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFiles(Array.from(e.target.files||[]).slice(0,9))}/></label><span>{files.length?files.length+" foto dipilih":"JPG, PNG, WEBP · maks. 3 MB/foto"}</span><button className="primary" disabled={busy} onClick={()=>void publish()}>{busy?"Publishing...":"Post"}</button></footer>
          {status&&<div className="social-v3-status">{status}</div>}
        </section>

        <div className="social-v3-feed-tabs">
          <button className={tab==="for_you"?"active":""} onClick={()=>setTab("for_you")}>Untuk Anda</button>
          <button className={tab==="following"?"active":""} onClick={()=>setTab("following")}>Mengikuti</button>
          <button className={tab==="popular"?"active":""} onClick={()=>setTab("popular")}>Populer</button>
          <button className={tab==="saved"?"active":""} onClick={()=>setTab("saved")}>Tersimpan</button>
          <span>{sorted.length} post</span>
        </div>

        {tab==="for_you"&&ownPosts.length>0&&<section className="social-v3-own-strip">
          <div><h3>Postingan Saya</h3><span>Post terbaru Anda tampil paling awal di sini.</span></div>
          <div className="social-v3-own-grid">{ownPosts.slice(0,3).map(row=>renderPost(row,true))}</div>
        </section>}

        <section className="social-v3-feed">
          <div className="social-v3-section-title"><div><h3>{tab==="saved"?"Post Tersimpan":tab==="following"?"Dari Profil yang Anda Ikuti":tab==="popular"?"Sedang Populer":"Community Feed"}</h3><p>Klik nama profil untuk membuka profile stack, atau klik post untuk melihat detail.</p></div></div>
          <div className="social-v3-feed-grid">
            {sorted.map(row=>renderPost(row))}
          </div>
          {sorted.length===0&&<div className="social-v3-empty"><b>Belum ada post pada feed ini.</b><span>Coba tab lain atau buat post baru.</span></div>}
        </section>

        {!!archives.length&&<section className="social-v3-archive"><div><h3>Koleksi Saya</h3><span>Foto terbaru dari post Anda.</span></div><div>{archives.map(item=><img key={item.id} src={item.image_url} alt="Archive"/>)}</div></section>}
      </main>

      <aside className="social-v3-right">
        <section><header><h3>Aktivitas Terbaru</h3><span>{feed.length}</span></header><div className="social-v3-activity-list">{feed.slice(0,5).map(row=><button key={row.id} onClick={()=>openDetail(row)}><SocialAvatar alias={row.social_alias} avatarUrl={row.social_avatar_url} size="small"/><span><b>{row.social_alias}</b><small>{row.body||"Membagikan media baru"}</small></span><em>{shortDate(row.created_at)}</em></button>)}</div></section>
        <section><header><h3>Creator Populer</h3><span>{people.length}</span></header><div className="social-v3-people-list">{people.map(row=><div key={row.user_id}><button className="profile" onClick={()=>void openProfile(row.user_id)}><SocialAvatar alias={row.social_alias} avatarUrl={row.social_avatar_url} size="small"/><span><b>{row.social_alias}</b><small>{num(row.subscriber_count)} followers</small></span></button><button className={row.subscribed_by_me?"active":""} onClick={()=>void toggleSubscribe(row)}>{row.subscribed_by_me?"Following":"Follow"}</button></div>)}</div></section>
        <section className="social-v3-popular-posts"><header><h3>Trending Konten</h3><span>Top 5</span></header>
    <div className="social-v3-discovery-ranking">{discovery.posts.slice(0,5).map((item,i)=><button key={item.id} onClick={()=>{const post=feed.find(x=>x.id===item.id);if(post)openDetail(post)}}><b>{String(i+1).padStart(2,"0")}</b><span><strong>{item.author}</strong><small>{item.summary||"Postingan media"} · {item.views} view · {item.likes} suka · {item.shares} share</small></span></button>)}</div>
    {!discovery.posts.length&&<p>Ranking tersedia setelah ada postingan publik.</p>}
   </section>
   <section className="social-v3-keywords"><header><h3>Top Kata Kunci</h3><span>Top 5</span></header><div>{discovery.keywords.slice(0,5).map((item,i)=><div key={item.keyword}><b>#{i+1}</b><span>{item.keyword}</span><small>{item.uses} pemakaian</small></div>)}</div>{!discovery.keywords.length&&<p>Belum ada kata kunci yang cukup sering dipakai.</p>}</section>
   <section className="social-v3-community-note"><span>COMMUNITY</span><h3>Bagikan insight, temukan inspirasi.</h3><p>Setiap postingan publik dapat dilihat pengguna Lumaway lain. Anda bisa menghapus postingan sendiri dari menu Hapus.</p></section>
      </aside>
    </div>

    {profileBusy&&<div className="social-v3-loading-float">Membuka profil...</div>}

    {profile&&<div className="social-v3-stack-backdrop" onMouseDown={()=>setProfile(null)}>
      <div className="social-v3-stack-wrap" onMouseDown={event=>event.stopPropagation()}>
        <div className="social-v3-stack-layer layer-one"/>
        <div className="social-v3-stack-layer layer-two"/>
        <section className="social-v3-profile-stack">
          <button className="social-v3-stack-close" onClick={()=>setProfile(null)}>×</button>
          <header>
            <SocialAvatar alias={profile.social_alias} avatarUrl={profile.social_avatar_url} size="xl"/>
            <div><span>{profile.position_title||"Lumaway Community"}</span><h2>{profile.social_alias}</h2><p>{profile.bio||"Profil Community Lumaway."}</p></div>
            {profile.user_id!==userId&&profileActionRow&&<button className={profile.subscribed_by_me?"active":""} onClick={()=>void toggleSubscribe(profileActionRow)}>{profile.subscribed_by_me?"Mengikuti":"Ikuti Profil"}</button>}
          </header>
          <div className="social-v3-profile-stats">
            <article><span>Post</span><b>{num(profile.post_count)}</b></article>
            <article><span>Followers</span><b>{num(profile.follower_count)}</b></article>
            <article><span>Following</span><b>{num(profile.following_count)}</b></article>
            <article><span>Likes</span><b>{num(profile.like_count)}</b></article>
          </div>
          <div className="social-v3-profile-posts-head"><div><h3>Post Terbaru</h3><p>Post dari profil ini ditampilkan sebagai kumpulan visual di dalam profile stack.</p></div><span>{profilePosts.length} post</span></div>
          <div className="social-v3-profile-post-grid">{profilePosts.map(row=><button key={row.id} onClick={()=>openDetail(row)}>{imageList(row)[0]?<img src={imageList(row)[0]} alt="Post"/>:<div>{row.body}</div>}<span><b>{num(row.like_count)}</b> suka · {shortDate(row.created_at)}</span></button>)}</div>
          {!profilePosts.length&&<div className="social-v3-empty compact"><b>Belum ada post publik.</b></div>}
        </section>
      </div>
    </div>}

    {detail&&<div className="social-v3-detail-backdrop" onMouseDown={()=>setDetail(null)}>
      <div className="social-v3-detail-stack" onMouseDown={event=>event.stopPropagation()}>
        <div className="social-v3-detail-layer one"/><div className="social-v3-detail-layer two"/>
        <section className="social-v3-detail-panel">
          <button className="social-v3-stack-close" onClick={()=>setDetail(null)}>×</button>
          <div className="social-v3-detail-media">
            {imageList(detail).length?<><img src={imageList(detail)[carouselIndex]} alt="Post detail"/>{imageList(detail).length>1&&<><button className="social-v3-carousel prev" onClick={()=>setCarouselIndex(index=>(index-1+imageList(detail).length)%imageList(detail).length)}>‹</button><button className="social-v3-carousel next" onClick={()=>setCarouselIndex(index=>(index+1)%imageList(detail).length)}>›</button><div className="social-v3-carousel-dots">{imageList(detail).map((_,index)=><button key={index} className={carouselIndex===index?"active":""} onClick={()=>setCarouselIndex(index)}/>)}</div></>}</>:<div className="social-v3-detail-text">{detail.body}</div>}
          </div>
          <div className="social-v3-detail-content">
            <button className="social-v3-detail-author" onClick={()=>{setDetail(null);void openProfile(detail.user_id)}}><SocialAvatar alias={detail.social_alias} avatarUrl={detail.social_avatar_url}/><span><b>{detail.social_alias}</b><small>{num(detail.subscriber_count)} followers · {longDate(detail.created_at)}</small></span></button>
            {detail.user_id!==userId&&<button className={"social-v3-detail-follow "+(detail.subscribed_by_me?"active":"")} onClick={()=>void toggleSubscribe(detail)}>{detail.subscribed_by_me?"Mengikuti":"Ikuti"}</button>}
            {detail.body&&<p>{detail.body}</p>}
            <div className="social-v3-detail-actions"><button className={detail.liked_by_me?"active":""} onClick={()=>void toggleLike(detail)}>Suka <b>{num(detail.like_count)}</b></button><button className={detail.saved_by_me?"active":""} onClick={()=>void toggleSave(detail)}>Simpan <b>{num(detail.save_count)}</b></button><button onClick={()=>setShareRow(detail)}>Bagikan</button></div>
            <div className="social-v3-no-comments">Lumaway Community tidak menggunakan komentar publik.</div>
          </div>
        </section>
      </div>
    </div>}

    {shareRow&&<div className="social-v3-share-backdrop" onMouseDown={()=>setShareRow(null)}><section className="social-v3-share-sheet" onMouseDown={event=>event.stopPropagation()}><header><div><b>Bagikan post</b><small>{shareRow.social_alias}</small></div><button onClick={()=>setShareRow(null)}>×</button></header>{imageList(shareRow)[0]&&<img src={imageList(shareRow)[0]} alt="Share preview"/>}<p>{shareText(shareRow)}</p><div><button onClick={()=>openShare("whatsapp",shareRow)}>WhatsApp</button><button onClick={()=>openShare("instagram",shareRow)}>Instagram</button><button onClick={()=>openShare("linkedin",shareRow)}>LinkedIn</button><button onClick={()=>openShare("threads",shareRow)}>Threads</button></div><button className="secondary" onClick={()=>void nativeShare(shareRow)}>Share / Copy Link</button></section></div>}
  </section>;
}
