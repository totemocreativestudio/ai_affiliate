"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import { navigateToSection } from "../../lib/luma-navigation";

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
  const [tutorialDetail,setTutorialDetail]=useState<Row|null>(null);
  const [steps,setSteps]=useState<Row[]>([]);
  const [promoMessage,setPromoMessage]=useState("");

  async function load(){
    const [b,t,p,w,progress]=await Promise.all([
      supabase.from("luma_blog_posts").select("id,slug,title,excerpt,category,cover_image_url,published_at,created_at,author_name,video_embed_url").eq("status","published").order("published_at",{ascending:false}).limit(60),
      supabase.from("tutorials").select("id,title,slug,description,category,youtube_url,embed_url,cover_image_url,cover_gif_url,short_video_url,instagram_url,tiktok_url,status,created_at,is_featured,difficulty,estimated_minutes,feature_route,author_name,published_at,is_global").or(`is_global.eq.true,workspace_id.eq.${workspaceId}`).eq("status","Published").order("is_featured",{ascending:false}).order("sort_order",{ascending:true}).limit(150),
      supabase.rpc("luma_active_promotions_v1"),
      supabase.from("luma_platform_settings").select("setting_value").eq("setting_key","whatsapp_channel_url").maybeSingle(),
      supabase.from("luma_tutorial_progress").select("tutorial_id").eq("user_id",userId).eq("completed",true),
    ]);
    setBlogs((b.data||[]) as Row[]);setTutorials((t.data||[]) as Row[]);setPromos((p.data||[]) as Row[]);setChannelUrl(w.data?.setting_value||"");setWatched(new Set((progress.data||[]).map((x:any)=>Number(x.tutorial_id))));
  }
  useEffect(()=>{void load()},[workspaceId,userId]);

  async function track(contentType:"blog"|"tutorial",contentId:number,eventType:string,metadata:Row={}){
    try{await supabase.from("luma_content_events").insert({content_type:contentType,content_id:contentId,event_type:eventType,user_id:userId,workspace_id:workspaceId,path:window.location.pathname,referrer:document.referrer||null,metadata})}catch{}
  }
  async function openTutorial(row:Row){
    setTutorialDetail(row);setSteps([]);
    await track("tutorial",Number(row.id),"open_tutorial",{title:row.title,slug:row.slug});
    const {data}=await supabase.from("luma_tutorial_steps").select("*").eq("tutorial_id",row.id).order("step_no");
    setSteps((data||[]) as Row[]);
  }
  async function completeTutorial(row:Row){
    await supabase.from("luma_tutorial_progress").upsert({user_id:userId,workspace_id:workspaceId,tutorial_id:Number(row.id),completed:true,watched_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"user_id,tutorial_id"});
    setWatched(prev=>new Set([...prev,Number(row.id)]));
    await track("tutorial",Number(row.id),"completed",{title:row.title});
  }
  async function usePromo(row:Row){
    const code=String(row.code||"").toUpperCase();
    localStorage.setItem("lumaway_promo_code",code);
    window.dispatchEvent(new CustomEvent("lumaway-promo-code",{detail:{code}}));
    setPromoMessage("Kode "+code+" disiapkan di Billing.");
    await track("promotion",Number(row.id),"promo_use_click",{code,promo_type:row.promo_type});
    navigateToSection("billing");
  }
  async function copyPromo(row:Row){
    const code=String(row.code||"").toUpperCase();
    try{await navigator.clipboard.writeText(code);setPromoMessage("Kode "+code+" disalin.")}catch{setPromoMessage("Kode promo: "+code)}
    await track("promotion",Number(row.id),"promo_copy",{code});
  }

  const filteredBlogs=blogs.filter(x=>`${x.title} ${x.excerpt} ${x.category}`.toLowerCase().includes(q.toLowerCase()));
  const filteredTutorials=tutorials.filter(x=>`${x.title} ${x.description} ${x.category}`.toLowerCase().includes(q.toLowerCase()));

  return <section id="content-hub" className="legacy-page-anchor content-hub-page">
    <div className="eyebrow">INSIGHT · LEARNING · PROMOTION</div><h1>Insight & Blog</h1><p className="muted">Artikel, tutorial penggunaan LUMA, edukasi bisnis, dan promosi terbaru dari Lumaway.</p>
    {channelUrl&&<div className="content-whatsapp-cta"><div><b>Lumaway WhatsApp Channel</b><span>Dapatkan update fitur, edukasi, dan promo terbaru.</span></div><a href={channelUrl} target="_blank" rel="noreferrer">Join Channel →</a></div>}
    <div className="content-hub-tabs"><button className={tab==="blog"?"active":""} onClick={()=>setTab("blog")}>Blog</button><button className={tab==="tutorial"?"active":""} onClick={()=>setTab("tutorial")}>Tutorial</button><button className={tab==="promotion"?"active":""} onClick={()=>setTab("promotion")}>Promotion</button></div>
    {tab!=="promotion"&&<div className="content-search"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder={`Cari ${tab==="blog"?"artikel":"tutorial"}...`}/></div>}

    {tab==="blog"&&<div className="content-card-grid">{filteredBlogs.map(x=><article className="content-card" key={x.id}>{x.cover_image_url?<img src={x.cover_image_url} alt=""/>:<div className="content-card-placeholder">LUMA</div>}<div className="content-card-body"><small>{x.category||"Insight"} · {x.published_at?new Date(x.published_at).toLocaleDateString("id-ID"):""} · Posted by {x.author_name||"Lumaway"}</small><h3>{x.title}</h3><p>{x.excerpt||"Baca insight terbaru dari Lumaway."}</p><a href={`https://lumaway.online/insights/${x.slug}`} target="_blank" rel="noreferrer" onClick={()=>void track("blog",Number(x.id),"content_click",{slug:x.slug})}>Read More <span>→</span></a></div></article>)}{!filteredBlogs.length&&<div className="empty-state"><strong>Belum ada artikel dipublikasikan.</strong></div>}</div>}

    {tab==="tutorial"&&<div className="content-card-grid">{filteredTutorials.map(x=><article className={`content-card tutorial-card ${watched.has(Number(x.id))?"tutorial-watched":""}`} key={x.id}><div className="tutorial-cover"><span>▶</span><b>{x.category||"Tutorial"}</b>{watched.has(Number(x.id))&&<em>Sudah ditonton ✓</em>}</div><div className="content-card-body"><small>{x.category||"Tutorial"}</small><h3>{x.title}</h3><p>{x.description||"Panduan penggunaan fitur LUMA."}</p>{x.youtube_url?<a href={x.youtube_url} target="_blank" rel="noreferrer" onClick={()=>void openTutorial(x)}>{watched.has(Number(x.id))?"Tonton Lagi":"Watch Tutorial"} <span>→</span></a>:<span className="muted">Video segera tersedia</span>}</div></article>)}{!filteredTutorials.length&&<div className="empty-state"><strong>Belum ada tutorial.</strong></div>}</div>}

    {tab==="promotion"&&<div className="content-card-grid">{promos.map(x=><article className="content-card promo-content-card" key={x.id}>{x.image_url?<img src={x.image_url} alt=""/>:<div className="content-card-placeholder">PROMO</div>}<div className="content-card-body"><small>PROMOTION · {x.published_at?new Date(x.published_at).toLocaleDateString("id-ID"):""}</small><h3>{x.title}</h3><p>{x.body}</p>{x.action_url&&<a href={x.action_url}>{x.action_label||"Lihat Promo"} <span>→</span></a>}</div></article>)}{!promos.length&&<div className="empty-state"><strong>Belum ada promo aktif.</strong></div>}</div>}
  </section>;
}
