"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

export default function WhatsAppOnboarding({userId}:{userId:string}){
  const supabase=createClient();const [url,setUrl]=useState("");const [joined,setJoined]=useState(true);const [saving,setSaving]=useState(false);
  async function load(){const [p,s]=await Promise.all([supabase.from("profiles").select("whatsapp_channel_joined_at").eq("id",userId).single(),supabase.from("luma_platform_settings").select("setting_value").eq("setting_key","whatsapp_channel_url").maybeSingle()]);setUrl(s.data?.setting_value||"");setJoined(Boolean(p.data?.whatsapp_channel_joined_at)||!s.data?.setting_value)}
  useEffect(()=>{void load()},[userId]);
  async function confirm(){setSaving(true);const now=new Date().toISOString();const {error}=await supabase.from("profiles").update({whatsapp_channel_joined_at:now,updated_at:now}).eq("id",userId);setSaving(false);if(!error)setJoined(true)}
  if(joined||!url)return null;
  return <div className="whatsapp-onboarding"><div><b>Join Lumaway WhatsApp Channel</b><span>Terima pengumuman, edukasi, promo, dan update fitur langsung di WhatsApp.</span></div><div><a href={url} target="_blank" rel="noreferrer">Open Channel</a><button disabled={saving} onClick={confirm}>{saving?"Saving...":"Saya sudah bergabung"}</button></div></div>;
}
