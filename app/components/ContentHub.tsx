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

  async function track(contentType:"blog"|"tutorial"|"promotion",contentId:number,eventType:string,metadata:Row={}){
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

    {tab==="tutorial"&&<div className="content-card-grid">{filteredTutorials.map(x=><article className={"content-card tutorial-card "+(watched.has(Number(x.id))?"tutorial-watched":"")} key={x.id}>{x.cover_gif_url||x.cover_image_url?<button className="tutorial-media-button" type="button" onClick={()=>void openTutorial(x)}><img src={x.cover_gif_url||x.cover_image_url} alt={x.title||""}/><span>▶</span>{watched.has(Number(x.id))&&<em>Sudah dipelajari ✓</em>}</button>:<div className="tutorial-cover"><span>▶</span><b>{x.category||"Tutorial"}</b></div>}<div className="content-card-body"><small>{x.category||"Tutorial"} · {x.difficulty||"Pemula"} · ± {x.estimated_minutes||5} menit</small><h3>{x.title}</h3><p>{x.description||"Panduan penggunaan fitur Lumaway."}</p><button className="content-card-link-button" type="button" onClick={()=>void openTutorial(x)}>{watched.has(Number(x.id))?"Pelajari Lagi":"Buka Tutorial"} <span>→</span></button></div></article>)}{!filteredTutorials.length&&<div className="empty-state"><strong>Belum ada tutorial.</strong></div>}</div>}

    {tab==="promotion"&&<><div className="promotion-hub-head"><div><h2>Promo Aktif</h2><p>Kuota, periode, minimum transaksi, dan limit per user divalidasi kembali ketika kode digunakan.</p></div>{promoMessage&&<span>{promoMessage}</span>}</div><div className="promotion-grid-v2">{promos.map(x=><article className={"promotion-card-v2 "+(x.is_featured?"featured":"")} key={x.id}>{x.banner_landscape_url?<img src={x.banner_landscape_url} alt={x.title||"Promo Lumaway"}/>:<div className="content-card-placeholder">PROMOTION</div>}<div className="promotion-card-copy"><small>{x.campaign_label||"LUMAWAY PROMOTION"}{x.ends_at?" · s/d "+new Date(x.ends_at).toLocaleDateString("id-ID"):""}</small><h3>{x.title}</h3><p>{x.description}</p><div className="promotion-code-row"><b>{x.code}</b><button type="button" onClick={()=>void copyPromo(x)}>Copy</button></div><small>{x.short_terms||"Syarat dan ketentuan berlaku."}</small><button className="primary" type="button" onClick={()=>void usePromo(x)}>Gunakan di Billing</button></div></article>)}{!promos.length&&<div className="empty-state"><strong>Belum ada promo aktif.</strong></div>}</div></>}
    {tutorialDetail&&<div className="learning-modal-backdrop" onMouseDown={()=>setTutorialDetail(null)}><section className="learning-modal" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true"><header><div><span>{tutorialDetail.category||"LEARNING"}</span><h2>{tutorialDetail.title}</h2><p>{tutorialDetail.description}</p></div><button type="button" onClick={()=>setTutorialDetail(null)}>×</button></header>{tutorialDetail.cover_gif_url||tutorialDetail.cover_image_url?<div className="learning-modal-cover"><img src={tutorialDetail.cover_gif_url||tutorialDetail.cover_image_url} alt={tutorialDetail.title||""}/></div>:null}<div className="learning-social-video-links">{tutorialDetail.youtube_url&&<a href={tutorialDetail.youtube_url} target="_blank" rel="noreferrer">YouTube ↗</a>}{tutorialDetail.instagram_url&&<a href={tutorialDetail.instagram_url} target="_blank" rel="noreferrer">Instagram ↗</a>}{tutorialDetail.tiktok_url&&<a href={tutorialDetail.tiktok_url} target="_blank" rel="noreferrer">TikTok ↗</a>}{tutorialDetail.short_video_url&&<a href={tutorialDetail.short_video_url} target="_blank" rel="noreferrer">Video Pendek ↗</a>}</div><div className="learning-step-list">{steps.map(step=><article key={step.id}><span>{String(step.step_no).padStart(2,"0")}</span><div><h3>{step.title}</h3><p>{step.description}</p>{step.gif_url&&<img src={step.gif_url} alt={step.title||""}/>} {step.cta_route&&<button type="button" onClick={()=>{setTutorialDetail(null);navigateToSection(step.cta_route)}}>{step.cta_label||"Coba Sekarang"} →</button>}</div></article>)}</div><footer><div><span>{tutorialDetail.difficulty||"Pemula"}</span><span>± {tutorialDetail.estimated_minutes||5} menit</span></div><button className="primary" type="button" onClick={()=>void completeTutorial(tutorialDetail)}>{watched.has(Number(tutorialDetail.id))?"Selesai ✓":"Tandai Selesai"}</button></footer></section></div>}
  </section>;
}
