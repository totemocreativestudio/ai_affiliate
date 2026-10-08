"use client";

import {useEffect,useState} from "react";

export default function PWAOperationalStatus(){
 const [online,setOnline]=useState(true),[updateReady,setUpdateReady]=useState(false);
 const [waiting,setWaiting]=useState<ServiceWorker|null>(null);

 useEffect(()=>{
  setOnline(navigator.onLine);
  const onOnline=()=>setOnline(true),onOffline=()=>setOnline(false);
  window.addEventListener("online",onOnline);window.addEventListener("offline",onOffline);

  if("serviceWorker" in navigator){
   const updateTimer=window.setInterval(()=>{navigator.serviceWorker.getRegistration().then(reg=>reg&&reg.update()).catch(()=>undefined)},60000);
   navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).then(reg=>{
    const capture=()=>{if(reg.waiting){setWaiting(reg.waiting);setUpdateReady(true)}};
    capture();
    reg.update().catch(()=>undefined);
    reg.addEventListener("updatefound",()=>{
      const worker=reg.installing;if(!worker)return;
      worker.addEventListener("statechange",()=>{if(worker.state==="installed"&&navigator.serviceWorker.controller){setWaiting(worker);setUpdateReady(true)}});
    });
   }).catch(()=>undefined);

   const controller=()=>window.location.reload();
   navigator.serviceWorker.addEventListener("controllerchange",controller);
   return()=>{
    window.clearInterval(updateTimer);
    window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline);
    navigator.serviceWorker.removeEventListener("controllerchange",controller);
   };
  }
  return()=>{window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline)};
 },[]);

 function reloadUpdate(){waiting?.postMessage({type:"SKIP_WAITING"});if(!waiting)window.location.reload()}

 return <>
  {!online&&<div className="pwa-operational-banner offline"><strong>Offline</strong><span>Data yang sudah terbuka tetap dapat dilihat. Upload dan penyimpanan membutuhkan koneksi.</span></div>}
  {updateReady&&<div className="pwa-operational-banner update"><strong>Versi baru tersedia</strong><span>Muat ulang untuk memakai pembaruan Lumaway.</span><button onClick={reloadUpdate}>Muat Ulang</button></div>}
 </>;
}
