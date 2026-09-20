"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Row=Record<string,any>;

export default function ContentHub({workspaceId,userId}:{workspaceId:string;userId:string}){
  const supabase=createClient();
  const [tab,setTab]=useState<"blog"|"tutorial"|"promotion">("blog");
  const [blogs,setBlogs]=useState<Row[]>([]);
  const [tutorials,setTutorials]=useState<Row[]>([]);
  const [promos,setPromos]=useState<Row[]>([]);
  const [channelUrl,setChannelUrl]=useState("");
  const [watched,setWatched]=useState<Set<number>>(new Set());
  const [q,setQ]=useState("");

  async function load(){
    const [b,t,p,w,progress]=await Promise.all([
      supabase.from("luma_blog_posts").select("id,slug,title,excerpt,category,cover_image_url,published_at,created_at,author_name,video_embed_url").eq("status","published").order("published_at",{ascending:false}).limit(60),
      supabase.from("tutorials").select("id,title,description,category,youtube_url,embed_url,status,created_at").eq("workspace_id",workspaceId).order("sort_order",{ascending:true}).limit(100),
      supabase.from("luma_notifications").select("id,title,body,image_url,action_url,action_label,published_at").eq("category","promo").order("published_at",{ascending:false}).limit(30),
      supabase.from("luma_platform_settings").select("setting_value").eq("setting_key","whatsapp_channel_url").maybeSingle(),
      supabase.from("luma_tutorial_progress").select("tutorial_id").eq("user_id",userId).eq("completed",true),
    ]);
    setBlogs((b.data||[]) as Row[]);setTutorials((t.data||[]) as Row[]);setPromos((p.data||[]) as Row[]);setChannelUrl(w.data?.setting_value||"");setWatched(new Set((progress.data||[]).map((x:any)=>Number(x.tutorial_id)));
  }
  useEffect(()=>{void load()},[workspaceId,userId]);

  async function track(contentType:"blog"|"tutorial",contentId:number,eventType:string,metadata:Row={}){
    try{await supabase.from("luma_content_events").insert({content_type:contentType,content_id:contentId,event_type:eventType,user_id:userId,workspace_id:workspaceId,path:window.location.pathname,referrer:document.referrer||null,metadata})}catch{}
  }
  async function openTutorial(row:Row){
    await supabase.from("luma_tutorial_progress").upsert({user_id:userId,workspace_id:workspaceId,tutorial_id:Number(row.id),completed:true,watched_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"user_id,tutorial_id"});
    setWatched(prev=>new Set([...prev,Number(row.id)]));
    await track("tutorial",Number(row.id),"watched",{title:row.title,platform:"youtube"});
  }

  const filteredBlogs=blogs.filter(x=>`${x.title} ${x.excerpt} ${x.category}`.toLowerCase().includes(q.toLowerCase()));
  const filteredTutorials=tutorials.filter(x=>`${x.title} ${x.description} ${x.category}`.toLowerCase().includes(q.toLowerCase()));

  return <section id="content-hub" className="legacy-page-anchor content-hub-page">
    <div className="eyebrow">INSIGHT · LEARNING · PROMOTION</div><h1>Insight & Blog</h1><p className="muted">Artikel, tutorial penggunaan LUMA, edukasi bisnis, dan promosi terbaru dari Lumaway.</p>
    {channelUrl&&<div className="content-whatsapp-cta"><div><b>Lumaway WhatsApp Channel</b><span>Dapatkan update fitur, edukasi, dan promo terbaru.</span></div><a href={channelUrl} target="_blank" rel="noreferrer">Join Channel →</a></div>}
    <div className="content-hub-tabs"><button className={tab==="blog"?"active":""} onClick={()=>setTab("blog")}>Blog</button><button className={tab==="tutorial"?"active":""} onClick={()=>setTab("tutorial")}>Tutorial</button><button className={tab==="promotion"?"active":""} onClick={()=>setTab("promotion")}>Promotion</button></div>
    {tab!=="promotion"&&<div className="content-search"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder={`Cari ${tab==="blog"?"artikel":"tutorial"}...`}/></div>}

    {tab==="blog"&&<div className="content-card-grid">{filteredBlogs.map(x=><article className="content-card" key={x.id}>{x.cover_image_url?<img src={x.cover_image_url} alt=""/>:<div className="content-card-placeholder">LUMA</div>}<div className="content-card-body"><small>{x.category||"Insight"} · {x.published_at?new Date(x.published_at).toLocaleDateString("id-ID"):""} · Posted by {x.author_name||"Lumaway"}</small><h3>{x.title}</h3><p>{x.excerpt||"Baca insight terbaru dari Lumaway."}</p><a href={`/blog/${x.slug}`} onClick={()=>void track("blog",Number(x.id),"content_click",{slug:x.slug})}>Read More <span>→</span></a></div></article>)}{!filteredBlogs.length&&<div className="empty-state"><strong>Belum ada artikel dipublikasikan.</strong></div>}</div>}

    {tab==="tutorial"&&<div className="content-card-grid">{filteredTutorials.map(x=><article className={`content-card tutorial-card ${watched.has(Number(x.id))?"tutorial-watched":""}`} key={x.id}><div className="tutorial-cover"><span>▶</span><b>{x.category||"Tutorial"}</b>{watched.has(Number(x.id))&&<em>Sudah ditonton ✓</em>}</div><div className="content-card-body"><small>{x.category||"Tutorial"}</small><h3>{x.title}</h3><p>{x.description||"Panduan penggunaan fitur LUMA."}</p>{x.youtube_url?<a href={x.youtube_url} target="_blank" rel="noreferrer" onClick={()=>void openTutorial(x)}>{watched.has(Number(x.id))?"Tonton Lagi":"Watch Tutorial"} <span>→</span></a>:<span className="muted">Video segera tersedia</span>}</div></article>)}{!filteredTutorials.length&&<div className="empty-state"><strong>Belum ada tutorial.</strong></div>}</div>}

    {tab==="promotion"&&<div className="content-card-grid">{promos.map(x=><article className="content-card promo-content-card" key={x.id}>{x.image_url?<img src={x.image_url} alt=""/>:<div className="content-card-placeholder">PROMO</div>}<div className="content-card-body"><small>PROMOTION · {x.published_at?new Date(x.published_at).toLocaleDateString("id-ID"):""}</small><h3>{x.title}</h3><p>{x.body}</p>{x.action_url&&<a href={x.action_url}>{x.action_label||"Lihat Promo"} <span>→</span></a>}</div></article>)}{!promos.length&&<div className="empty-state"><strong>Belum ada promo aktif.</strong></div>}</div>}
  </section>;
}
