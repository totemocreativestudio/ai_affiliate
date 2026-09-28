"use client";
import {useEffect} from "react";
import {LumaErrorMotion} from "./components/LumaMotionState";

export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  useEffect(()=>{
    const message=String(error?.message||"");
    const stack=String(error?.stack||"");
    const staleChunk=/ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch module|Cannot find module/i.test(message+"\n"+stack);
    if(staleChunk){
      const key="lumaway_chunk_recovery_once";
      if(!window.sessionStorage.getItem(key)){
        window.sessionStorage.setItem(key,"1");
        window.location.reload();
        return;
      }
    }
    const workspaceId=String(window.localStorage.getItem("luma_active_workspace")||"");
    if(workspaceId){
      void fetch("/api/issues",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          workspace_id:workspaceId,
          category:"client_error",
          severity:"critical",
          title:"Global UI runtime error",
          details:(message+"\n"+stack+"\nDigest: "+String(error?.digest||"")).slice(0,5000),
          page_path:window.location.pathname+window.location.search
        })
      }).catch(()=>undefined);
    }
  },[error]);

  const detail=error?.digest?"Reference: "+error.digest:undefined;
  return <html lang="id"><body><main className="runtime-error-page"><LumaErrorMotion code={500} title="Lumaway mengalami kendala sistem" message="Aplikasi tidak dapat memuat antarmuka utama. Data Anda tidak terhapus; sistem akan mencoba memulihkan tampilan terbaru." detail={detail} onRetry={()=>{window.sessionStorage.removeItem("lumaway_chunk_recovery_once");reset()}}/></main></body></html>;
}
