"use client";
import {useEffect} from "react";
import {createClient} from "../../lib/supabase-browser";

export default function PublicContentTracker({contentId}:{contentId:number}){
  useEffect(()=>{
    try{
      if(window.localStorage.getItem("lumaway-consent-v1")!=="accepted")return;
      const supabase=createClient();
      let visitor=window.localStorage.getItem("lumaway-visitor-v1");
      if(!visitor){visitor=crypto.randomUUID();window.localStorage.setItem("lumaway-visitor-v1",visitor)}
      let session=window.sessionStorage.getItem("lumaway-session-v1");
      if(!session){session=crypto.randomUUID();window.sessionStorage.setItem("lumaway-session-v1",session)}
      const query=new URLSearchParams(window.location.search);
      const utm:Record<string,string>={};
      for(const key of ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"]){const value=query.get(key);if(value)utm[key]=value.slice(0,150)}
      void supabase.from("luma_content_events").insert({
        content_type:"blog",
        content_id:contentId,
        event_type:"page_view",
        session_id:session,
        visitor_id:visitor,
        path:window.location.pathname,
        referrer:document.referrer||null,
        utm,
        metadata:{source:"lumaway_public_web"}
      });
    }catch{}
  },[contentId]);
  return null;
}
