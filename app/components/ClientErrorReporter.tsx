"use client";

import { useEffect } from "react";

export default function ClientErrorReporter({workspaceId}:{workspaceId:string}){
  useEffect(()=>{
    const sent=new Set<string>();
    function report(title:string,details:string,severity="medium"){
      const key=`${title}|${details}`.slice(0,1000);if(sent.has(key))return;sent.add(key);
      void fetch("/api/issues",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace_id:workspaceId,category:"client_error",severity,title,details,page_path:window.location.pathname+window.location.hash})}).catch(()=>{});
    }
    const onError=(e:ErrorEvent)=>report(e.message||"Window error",`${e.filename||""}:${e.lineno||0}:${e.colno||0}\n${e.error?.stack||e.error||""}`,"high");
    const onReject=(e:PromiseRejectionEvent)=>{const reason=e.reason;report("Unhandled promise rejection",reason?.stack||reason?.message||String(reason),"high")};
    window.addEventListener("error",onError);window.addEventListener("unhandledrejection",onReject);
    return()=>{window.removeEventListener("error",onError);window.removeEventListener("unhandledrejection",onReject)};
  },[workspaceId]);
  return null;
}
