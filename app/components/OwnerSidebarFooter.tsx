"use client";
import LumaIcon from "./LumaIcon";

export default function OwnerSidebarFooter({profile,onOpenOwner,onLogout}:{profile:{email:string|null;full_name:string|null};onOpenOwner:(tab:string)=>void;onLogout:()=>void}){
 return <div className="sidebar-bottom">
  <a href="/administration/overview" className="user-chip sidebar-profile-link" onClick={e=>{e.preventDefault();onOpenOwner("overview")}}>
   <div className="avatar">{(profile.full_name||profile.email||"O").slice(0,1).toUpperCase()}</div>
   <div className="sidebar-user-copy"><strong>{profile.full_name||profile.email}</strong><small>Owner · Lumaway</small></div>
  </a>
  <button className="logout" onClick={onLogout}><LumaIcon name="logout" className="logout-icon"/><span className="nav-label">Logout</span></button>
 </div>
}
