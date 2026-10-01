"use client";

import {useEffect,useRef,useState} from "react";

export default function PerformanceExperienceLayer(){
  const [routeBusy,setRouteBusy]=useState(false);
  const clearTimer=useRef<number|null>(null);

  useEffect(()=>{
    const emit=(name:string,value:number,extra:Record<string,any>={})=>{
      window.dispatchEvent(new CustomEvent("lumaway-performance-metric",{detail:{name,value,...extra,at:new Date().toISOString()}}));
    };

    const onRoute=()=>{
      const start=performance.now();
      setRouteBusy(true);
      if(clearTimer.current)window.clearTimeout(clearTimer.current);
      clearTimer.current=window.setTimeout(()=>{
        setRouteBusy(false);
        emit("route_transition_feedback_ms",performance.now()-start);
      },180);
    };
    window.addEventListener("lumaway-routechange",onRoute as EventListener);

    const enhanceImages=()=>{
      document.querySelectorAll<HTMLImageElement>("img:not([data-lw-media-ready])").forEach(img=>{
        img.dataset.lwMediaReady="1";
        const critical=img.closest(".lumaway-lockup,.lw-boot-brand,.auth")||img.getAttribute("fetchpriority")==="high";
        if(!critical){
          img.loading="lazy";
          img.decoding="async";
        }
      });
    };
    enhanceImages();
    const mo=new MutationObserver(enhanceImages);
    mo.observe(document.body,{childList:true,subtree:true});

    let po:PerformanceObserver|null=null;
    if("PerformanceObserver" in window){
      try{
        po=new PerformanceObserver(list=>{
          for(const entry of list.getEntries()){
            if(entry.entryType==="largest-contentful-paint")emit("lcp_ms",entry.startTime);
            if(entry.entryType==="longtask")emit("long_task_ms",entry.duration);
          }
        });
        try{po.observe({type:"largest-contentful-paint",buffered:true} as any)}catch{}
        try{po.observe({type:"longtask",buffered:true} as any)}catch{}
      }catch{}
    }
    const nav=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined;
    if(nav)emit("navigation_dom_interactive_ms",nav.domInteractive);

    return()=>{
      window.removeEventListener("lumaway-routechange",onRoute as EventListener);
      if(clearTimer.current)window.clearTimeout(clearTimer.current);
      mo.disconnect();po?.disconnect();
    };
  },[]);

  return <div className={"lw-route-progress "+(routeBusy?"active":"")} aria-hidden="true"><i/></div>;
}
