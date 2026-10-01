"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";

const no=(v:any)=>Number(v||0).toLocaleString("id-ID");

export default function ListingFollowupInsights({workspaceId,startDate,endDate}:{workspaceId:string;startDate?:string;endDate?:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [data,setData]=useState<any>({}),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;(async()=>{setLoading(true);const x=await supabase.rpc("luma_listing_followup_intelligence_v1",{p_workspace_id:workspaceId,p_start_date:startDate||null,p_end_date:endDate||null});if(active){setData(x.data||{});setLoading(false)}})();return()=>{active=false}},[workspaceId,startDate,endDate]);
 const channels=data.channels||[],totals=data.totals||{};
 const top=channels.filter((x:any)=>x.channel!=="Belum ditentukan").slice(0,6);
 if(loading)return <div className="listing-followup-insights loading">Menghitung follow-up channel...</div>;
 return <section className="listing-followup-insights">
  <header><div><span>FOLLOW-UP INTELLIGENCE</span><h3>Channel komunikasi creator</h3><p>Association signal berdasarkan channel terakhir/listing dan histori aktivitas. Bukan klaim sebab-akibat konversi.</p></div></header>
  <div className="listing-followup-summary">
   <article><span>Listings</span><strong>{no(totals.listings)}</strong></article>
   <article><span>Follow-up Activity</span><strong>{no(totals.followup_activities)}</strong></article>
   <article><span>No Response</span><strong>{no(totals.no_response)}</strong></article>
   <article><span>Won / Active</span><strong>{no(totals.won_active)}</strong></article>
  </div>
  <div className="listing-followup-channels">{top.map((x:any)=>{const max=Math.max(...top.map((z:any)=>Number(z.listings||0)),1);return <article key={x.channel}><div className="lfc-head"><div><strong>{x.channel}</strong><small>{no(x.followup_activities)} aktivitas · {no(x.no_response)} no response</small></div><b>{Number(x.association_rate||0).toFixed(1)}%</b></div><div className="lfc-track"><i style={{width:(Number(x.listings||0)/max*100)+"%"}}/></div><footer><span>{no(x.listings)} listing</span><span>{no(x.won_active)} Won / Active</span></footer></article>})}{!top.length&&<div className="listing-v2-empty small">Belum ada channel follow-up yang dapat dianalisis.</div>}</div>
 </section>
}
