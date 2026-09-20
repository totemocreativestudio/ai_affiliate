'use client';
import {useEffect} from 'react';
export default function MarketingContentTracker({contentId,contentType='blog'}:{contentId:number;contentType?:'blog'|'tutorial'|'marketing'}){
 useEffect(()=>{try{
  if(localStorage.getItem('lumaway-consent-v1')!=='accepted')return;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';if(!url||!key)return;
  let visitor=localStorage.getItem('lumaway-visitor-v1');if(!visitor){visitor=crypto.randomUUID();localStorage.setItem('lumaway-visitor-v1',visitor)}
  let session=sessionStorage.getItem('lumaway-session-v1');if(!session){session=crypto.randomUUID();sessionStorage.setItem('lumaway-session-v1',session)}
  const q=new URLSearchParams(location.search);const utm:Record<string,string>={};for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const v=q.get(k);if(v)utm[k]=v.slice(0,150)}
  fetch(url.replace(/\/$/,'')+'/rest/v1/luma_content_events',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({content_type:contentType,content_id:contentId,event_type:'page_view',session_id:session,visitor_id:visitor,path:location.pathname,referrer:document.referrer||null,utm,metadata:{source:'lumaway_marketing'}})}).catch(()=>undefined);
 }catch{}},[contentId,contentType]);
 return null;
}
