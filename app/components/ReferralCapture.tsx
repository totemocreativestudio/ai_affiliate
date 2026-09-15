"use client";

import { useEffect } from "react";
import { createClient } from "../../lib/supabase-browser";

const STORAGE_KEY="lumaway_referral_code";

export default function ReferralCapture(){
  useEffect(()=>{
    let cancelled=false;
    const supabase=createClient();
    async function sync(){
      const params=new URLSearchParams(window.location.search);
      const incoming=(params.get("ref")||"").trim().toUpperCase();
      if(incoming&&/^[A-Z0-9]{12}$/.test(incoming))localStorage.setItem(STORAGE_KEY,incoming);
      const code=(incoming||localStorage.getItem(STORAGE_KEY)||"").trim().toUpperCase();
      if(!code)return;
      const {data:{user}}=await supabase.auth.getUser();
      if(cancelled||!user)return;
      const {data,error}=await supabase.rpc("luma_apply_my_referral",{p_code:code});
      if(!error&&data)localStorage.removeItem(STORAGE_KEY);
    }
    void sync();
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>void sync(),0)});
    return()=>{cancelled=true;subscription.unsubscribe()};
  },[]);
  return null;
}
