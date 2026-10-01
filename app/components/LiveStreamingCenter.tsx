"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {Host360Panel,SessionPlannerPanel} from "./LiveHostSessionPanels";
import LiveUploadPanel from "./LiveUploadPanel";
import LiveCampaignPanel from "./LiveCampaignPanel";
import LiveAnalyticsPanel from "./LiveAnalyticsPanel";
import LiveDataHealthPanel from "./LiveDataHealthPanel";
const rp=(v:any)=>"Rp "+Math.round(Number(v||0)).toLocaleString("id-ID");
const no=(v:any)=>Math.round(Number(v||0)).toLocaleString("id-ID");
const month=()=>{const d=new Date(),y=d.getFullYear(),m=d.getMonth();return{start:new Date(y,m,1).toISOString().slice(0,10),end:new Date(y,m+1,0).toISOString().slice(0,10)}};

export default function LiveStreamingCenter({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]),initial=month();
 const [start,setStart]=useState(initial.start),[end,setEnd]=useState(initial.end),[data,setData]=useState<any>(null),[sourceData,setSourceData]=useState<any>({}),[loading,setLoading]=useState(true),[tab,setTab]=useState("overview");
 async function load(){setLoading(true);const [r,s]=await Promise.all([supabase.rpc("luma_live_overview_v1",{p_workspace_id:workspaceId,p_start:start,p_end:end}),supabase.rpc("luma_live_source_summary_v1",{p_workspace_id:workspaceId,p_start:start,p_end:end})]);setData(r.data||{});setSourceData(s.data||{});setLoading(false)}
 useEffect(()=>{void load()},[workspaceId,start,end]);
 const t=data?.totals||{}, daily=data?.daily||[], hosts=data?.hosts||[];
 const max=Math.max(...daily.map((x:any)=>Number(x.gmv||0)),1);
 const path=daily.length>1?daily.map((x:any,i:number)=>(i?"L":"M")+" "+i/(daily.length-1)*100+" "+(90-Number(x.gmv||0)/max*72)).join(" "):"";
 const cards=[["Live GMV",rp(t.gmv)],["Orders",no(t.orders)],["Qty",no(t.qty)],["Total Session",no(data?.sessions?.total)],["Peak Viewers",no(t.peak_viewers)],["Avg Viewers",no(t.avg_viewers)],["Revenue / Hour",rp(t.revenue_per_hour)],["Contribution Margin",rp(t.contribution_margin)]];
 return <section id="live-streaming" className="legacy-page-anchor live-intel-page">
  <div className="live-head"><div><div className="eyebrow">LIVE STREAMING INTELLIGENCE</div><h1>Live Streaming</h1><p>Operasional live in-house dan out-house dengan jalur data terpisah dari Affiliate Performance.</p></div><div className="live-filter"><input type="date" value={start} onChange={e=>setStart(e.target.value)}/><span>→</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></div></div>
  <div className="live-separation-note"><b>Data terpisah:</b> GMV, Orders, Viewer dan jumlah sesi pada modul ini tidak menambah total Affiliate Performance.</div>
  <div className="live-tabs">{[["overview","Overview"],["analytics","Analytics"],["health","Data Health"],["upload","Upload Center"],["sessions","Session Planner"],["hosts","Host 360"],["campaigns","Campaign Tracker"],["budget","Production & Budget"]].map(([k,l])=><button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}>{l}</button>)}</div>
  {loading?<div className="live-loading">Menyiapkan Live Streaming Intelligence...</div>:tab==="overview"?<>
   <div className="live-source-platforms">
    <article><header><span>TIKTOK LIVE SOURCE</span><b>Daily Core Stats</b></header><div><strong>{rp(sourceData?.tiktok?.gmv)}</strong><small>GMV attributed</small></div><footer><span>{no(sourceData?.tiktok?.orders)} SKU order</span><span>{no(sourceData?.tiktok?.qty)} produk</span><span>{no(sourceData?.tiktok?.live_streams)} siaran</span><span>{no(sourceData?.tiktok?.impressions)} tayangan</span></footer></article>
    <article><header><span>SHOPEE LIVE SOURCE</span><b>Session Export</b></header><div><strong>{rp(sourceData?.shopee?.gmv_created)}</strong><small>GMV pesanan dibuat</small></div><footer><span>{rp(sourceData?.shopee?.gmv_ready)} ready to ship</span><span>{no(sourceData?.shopee?.orders_created)} order</span><span>{no(sourceData?.shopee?.orders_ready)} ready</span><span>{no(sourceData?.shopee?.sessions)} sesi</span></footer></article>
   </div>
   <div className="live-kpis">{cards.map(([l,v])=><article key={l}><span>{l}</span><strong>{v}</strong></article>)}</div>
   <div className="live-grid">
    <article className="live-chart"><header><div><span>GMV TREND</span><h2>Performa per hari</h2></div><small>{daily.length} hari terdata</small></header><div>{daily.length>1?<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d={path} fill="none" vectorEffect="non-scaling-stroke"/><line x1="0" y1="94" x2="100" y2="94"/></svg>:<div className="live-empty">Belum cukup data. Upload performance live per sesi untuk membentuk trend.</div>}</div></article>
    <article className="live-ranking"><header><span>HOST RANKING</span><h2>Kontribusi GMV</h2></header>{hosts.length?hosts.map((h:any,i:number)=><div key={h.id}><b>#{i+1}</b><span><strong>{h.name}</strong><small>{h.username||h.host_type} · {no(h.duration_minutes)} menit</small></span><em>{rp(h.gmv)}</em></div>):<div className="live-empty">Belum ada host. Tambahkan host pada Host 360.</div>}</article>
   </div>
   <div className="live-insight-grid"><article><span>AUTO INSIGHT</span><h3>{Number(t.revenue_per_hour||0)>0?"Revenue per hour sudah terbaca":"Belum ada baseline live"}</h3><p>{Number(t.revenue_per_hour||0)>0?"Setiap jam live menghasilkan rata-rata "+rp(t.revenue_per_hour)+". Bandingkan antar host dan gimmick setelah beberapa sesi terkumpul.":"Mulai dari membuat Host dan Session. Insight akan muncul otomatis saat performance sesi tersedia."}</p></article><article><span>EFFICIENCY</span><h3>{no(t.orders_per_hour)} order / jam</h3><p>Gunakan metrik ini untuk membandingkan session yang durasinya berbeda.</p></article><article><span>VIEWER SIGNAL</span><h3>{no(t.peak_viewers)} peak viewers</h3><p>Peak dan average viewer akan dipakai untuk menemukan jam dan gimmick paling efektif.</p></article></div>
  </>:tab==="analytics"?<LiveAnalyticsPanel workspaceId={workspaceId}/>:tab==="health"?<LiveDataHealthPanel workspaceId={workspaceId}/>:tab==="upload"?<LiveUploadPanel workspaceId={workspaceId}/>:tab==="sessions"?<SessionPlannerPanel workspaceId={workspaceId}/>:tab==="hosts"?<Host360Panel workspaceId={workspaceId}/>:tab==="campaigns"?<LiveCampaignPanel workspaceId={workspaceId}/>:<LivePlaceholder tab={tab}/>}
 </section>
}

function LivePlaceholder({tab}:{tab:string}){
 const copy:any={sessions:["Session Planner","Buat sesi waktu live, target GMV/order/viewer, platform, gimmick, dan biaya produksi."],hosts:["Host 360","Search host, profile, inhouse/outhouse, ratecard, performance, best hour dan history."],campaigns:["Live Campaign Tracker","Kelompokkan sesi berdasarkan campaign, gimmick dan target vs achievement."],budget:["Production & Budget","Pantau ads budget, host cost, studio cost, production cost dan contribution margin."]};
 const x=copy[tab]||["Live Streaming","Modul berikutnya"];
 return <div className="live-placeholder"><span>FOUNDATION READY</span><h2>{x[0]}</h2><p>{x[1]}</p><div><i/><i/><i/></div><small>Data model sudah disiapkan terpisah dari Affiliate. UI operasional dilanjutkan pada PR berikutnya.</small></div>
}
