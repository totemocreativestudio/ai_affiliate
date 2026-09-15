"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type FeedRow={id:number;user_id:string;body:string|null;image_url:string|null;created_at:string;social_alias:string;social_avatar_key:string;like_count:number;liked_by_me:boolean;subscribed_by_me:boolean};
type Archive={id:number;image_url:string;created_at:string};

const mascotEmoji=(key:string)=>key.startsWith("nailong")?"🐲":key.startsWith("dragon")?"🐉":key.startsWith("gecko")?"🦎":"🦖";
const colorKey=(key:string)=>key.split("-")[1]||"emerald";

export default function SocialLumaway({workspaceId,userId}:{workspaceId:string;userId:string}){
  const supabase=createClient();
  const [feed,setFeed]=useState<FeedRow[]>([]);
  const [archives,setArchives]=useState<Archive[]>([]);
  const [identity,setIdentity]=useState({social_alias:"LumaUser",social_avatar_key:"dino-emerald-happy"});
  const [body,setBody]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [sort,setSort]=useState<"latest"|"popular">("latest");

  async function load(){
    const [f,a,i]=await Promise.all([
      supabase.rpc("luma_get_social_feed",{p_limit:60,p_offset:0}),
      supabase.from("luma_social_archives").select("id,image_url,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(6),
      supabase.rpc("luma_get_my_social_identity"),
    ]);
    setFeed((f.data||[]) as FeedRow[]);setArchives((a.data||[]) as Archive[]);const me=(i.data||[])[0];if(me)setIdentity(me);
  }
  useEffect(()=>{void load()},[workspaceId,userId]);

  const sorted=useMemo(()=>[...feed].sort((a,b)=>sort==="popular"?Number(b.like_count)-Number(a.like_count):new Date(b.created_at).getTime()-new Date(a.created_at).getTime()),[feed,sort]);

  async function publish(){
    if(!body.trim()&&!file)return setStatus("Tulis sesuatu atau pilih foto terlebih dahulu.");
    if(file&&file.size>1024*1024)return setStatus("Foto maksimal 1 MB.");
    setBusy(true);setStatus("Memeriksa keamanan konten...");
    try{
      const fd=new FormData();fd.set("workspace_id",workspaceId);fd.set("body",body.trim());if(file)fd.set("image",file);
      const r=await fetch("/api/social/publish",{method:"POST",body:fd});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Gagal mempublikasikan post.");
      setBody("");setFile(null);setStatus("Post dipublikasikan tanpa menampilkan identitas pribadi Anda.");await load();
    }catch(e:any){setStatus(e?.message||"Gagal mempublikasikan post.");}finally{setBusy(false)}
  }

  async function toggleLike(row:FeedRow){
    if(row.liked_by_me)await supabase.from("luma_community_likes").delete().eq("post_id",row.id).eq("user_id",userId);
    else await supabase.from("luma_community_likes").insert({post_id:row.id,user_id:userId});
    setFeed(xs=>xs.map(x=>x.id===row.id?{...x,liked_by_me:!row.liked_by_me,like_count:Number(x.like_count)+(row.liked_by_me?-1:1)}:x));
  }

  async function toggleSubscribe(row:FeedRow){
    if(row.user_id===userId)return;
    if(row.subscribed_by_me)await supabase.from("luma_community_subscriptions").delete().eq("user_id",userId).eq("subscribed_user_id",row.user_id);
    else await supabase.from("luma_community_subscriptions").insert({user_id:userId,subscribed_user_id:row.user_id});
    setFeed(xs=>xs.map(x=>x.user_id===row.user_id?{...x,subscribed_by_me:!row.subscribed_by_me}:x));
  }

  async function share(row:FeedRow){
    const text=`${row.social_alias} di Lumaway Community: ${row.body||"Lihat post terbaru"}`;
    if(navigator.share){try{await navigator.share({title:"Lumaway Community",text,url:window.location.origin+"/#social-lumaway"});return}catch{}}
    await navigator.clipboard.writeText(`${text}\n${window.location.origin}/#social-lumaway`);setStatus("Link komunitas disalin.");
  }

  return <section id="social-lumaway" className="legacy-page-anchor social-page">
    <div className="eyebrow">LUMAWAY SOCIAL</div><h1>Community</h1><p className="muted">Ruang interaksi terbatas: Like, Share, dan Subscribe tanpa komentar. Identitas pribadi, email, nomor telepon, dan URL eksternal tidak ditampilkan.</p>
    <div className="social-layout">
      <div>
        <div className="card social-composer"><div className={`social-mascot c-${colorKey(identity.social_avatar_key)}`}><span>{mascotEmoji(identity.social_avatar_key)}</span></div><div className="social-compose-main"><div className="social-compose-name"><b>{identity.social_alias}</b><small>Nama samaran permanen dari sistem</small></div><textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Bagikan insight, pengalaman, atau pertanyaan tanpa data kontak..." maxLength={1200}/><div className="social-compose-actions"><label className="social-image-button">▧ Add photo ≤ 1 MB<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>{file&&<span className="social-file-name">{file.name}</span>}<button className="primary" disabled={busy} onClick={publish}>{busy?"Checking...":"Post"}</button></div>{status&&<small className="social-status">{status}</small>}</div></div>
        <div className="social-feed-head"><h2>Feed</h2><label>Sortir <select value={sort} onChange={e=>setSort(e.target.value as any)}><option value="latest">Terbaru</option><option value="popular">Terpopuler</option></select></label></div>
        <div className="social-feed">{sorted.map(row=><article className="social-post" key={row.id}><div className="social-post-head"><div className={`social-mascot small c-${colorKey(row.social_avatar_key)}`}><span>{mascotEmoji(row.social_avatar_key)}</span></div><div><b>{row.social_alias}</b><small>{new Date(row.created_at).toLocaleString("id-ID")}</small></div>{row.user_id!==userId&&<button className={row.subscribed_by_me?"subscribed":""} onClick={()=>toggleSubscribe(row)}>{row.subscribed_by_me?"Subscribed":"Subscribe"}</button>}</div>{row.body&&<p className="social-post-body">{row.body}</p>}{row.image_url&&<img className="social-post-image" src={row.image_url} alt="Community upload"/>}<div className="social-post-actions"><button className={row.liked_by_me?"active":""} onClick={()=>toggleLike(row)}>♡ <span>{Number(row.like_count)||0}</span> Like</button><button onClick={()=>share(row)}>↗ Share</button><span className="no-comments">Comments disabled</span></div></article>)}{!sorted.length&&<div className="empty-state"><strong>Belum ada post komunitas.</strong></div>}</div>
      </div>
      <aside className="social-archive card"><div className="section-head"><div><h3>My Archive</h3><p className="muted">Hanya Anda yang bisa melihat bagian ini. Maksimal 6 foto terakhir.</p></div></div><div className="archive-grid">{archives.map(x=><img key={x.id} src={x.image_url} alt="My archive"/>)}{!archives.length&&<div className="empty-state"><strong>Belum ada foto.</strong></div>}</div><div className="social-safety-note"><b>Community Safety</b><p>Nomor telepon, email, link web, dan data kontak dilarang dalam teks maupun gambar. Foto melalui pemeriksaan sebelum dipublikasi.</p></div></aside>
    </div>
  </section>;
}
