"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Row=Record<string,any>;

export default function AdminSocialModeration(){
  const supabase=createClient();const [posts,setPosts]=useState<Row[]>([]);const [profiles,setProfiles]=useState<Row[]>([]);const [status,setStatus]=useState("");
  async function load(){const [p,u]=await Promise.all([supabase.from("luma_community_posts").select("id,user_id,body,image_url,status,created_at").order("created_at",{ascending:false}).limit(200),supabase.from("profiles").select("id,social_alias,social_avatar_key")]);setPosts((p.data||[]) as Row[]);setProfiles((u.data||[]) as Row[])}useEffect(()=>{void load()},[]);
  const identities=useMemo(()=>new Map(profiles.map(x=>[x.id,x])),[profiles]);
  async function setPost(id:number,next:string){const {error}=await supabase.from("luma_community_posts").update({status:next,updated_at:new Date().toISOString()}).eq("id",id);if(error)return setStatus(error.message);setStatus(`Post #${id} → ${next}`);await load()}
  async function remove(id:number){if(!window.confirm("Hapus post community ini?"))return;const {error}=await supabase.from("luma_community_posts").delete().eq("id",id);if(error)return setStatus(error.message);setStatus(`Post #${id} dihapus.`);await load()}
  return <div className="card"><div className="section-head"><div><h3>Social Lumaway Moderation</h3><p className="muted">Tidak ada komentar. Owner dapat hide, restore, atau delete post. Identitas yang tampil hanya alias komunitas.</p></div><button onClick={()=>load()}>Refresh</button></div>{status&&<div className="flash success">{status}</div>}<div className="scroll"><table><thead><tr><th>Alias</th><th>Post</th><th>Image</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>{posts.map(x=>{const me=identities.get(x.user_id);return <tr key={x.id}><td>{me?.social_alias||"Anonymous"}</td><td style={{maxWidth:420,whiteSpace:"normal"}}>{x.body||"(image only)"}</td><td>{x.image_url?<a href={x.image_url} target="_blank" rel="noreferrer">View</a>:"-"}</td><td>{x.status}</td><td>{new Date(x.created_at).toLocaleString("id-ID")}</td><td><div className="button-row"><button disabled={x.status==="hidden"} onClick={()=>setPost(x.id,"hidden")}>Hide</button><button disabled={x.status==="published"} onClick={()=>setPost(x.id,"published")}>Restore</button><button onClick={()=>remove(x.id)}>Delete</button></div></td></tr>})}</tbody></table></div></div>;
}
