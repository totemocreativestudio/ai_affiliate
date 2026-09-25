import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getServerSecret} from "../../../../../lib/server-secrets";

export const runtime="nodejs";
export const maxDuration=60;

const esc=(value:any)=>String(value??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const money=(value:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(value||0));
function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)throw new Error("Supabase server environment incomplete.");
  return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
function iso(date:Date){return date.toISOString().slice(0,10)}
function previousWeek(){
  const now=new Date();
  const day=now.getUTCDay();
  const thisMonday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  const back=(day+6)%7;
  thisMonday.setUTCDate(thisMonday.getUTCDate()-back);
  const start=new Date(thisMonday);start.setUTCDate(start.getUTCDate()-7);
  const end=new Date(thisMonday);end.setUTCDate(end.getUTCDate()-1);
  return {start:iso(start),end:iso(end)};
}

export async function GET(req:NextRequest){
  const expected=String(process.env.CRON_SECRET||"");
  if(!expected||req.headers.get("authorization")!==`Bearer ${expected}`)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
  const admin=adminClient();
  try{
    const resendKey=await getServerSecret(admin,"luma_resend_api_key");
    const {data:fromSetting}=await admin.from("luma_platform_settings").select("setting_value").eq("setting_key","email_from").maybeSingle();
    const from=String(process.env.LUMA_EMAIL_FROM||fromSetting?.setting_value||"").trim();
    if(!resendKey||!from)return NextResponse.json({ok:false,error:"Email provider belum dikonfigurasi."},{status:503});

    const {start,end}=previousWeek();
    const [{data:profiles,error:profileError},{data:promos}]=await Promise.all([
      admin.from("profiles").select("id,email,full_name,weekly_email_enabled,role,active").eq("active",true).eq("weekly_email_enabled",true).neq("role","admin"),
      admin.from("luma_promo_codes").select("code,title,promo_type,value,starts_at,ends_at").eq("active",true).order("created_at",{ascending:false}).limit(20)
    ]);
    if(profileError)throw profileError;
    const recipients=(profiles||[]).filter((p:any)=>String(p.email||"").includes("@"));
    const userIds=recipients.map((p:any)=>p.id);
    const {data:members,error:memberError}=userIds.length
      ? await admin.from("workspace_members").select("user_id,workspace_id,workspaces(name)").in("user_id",userIds)
      : {data:[],error:null} as any;
    if(memberError)throw memberError;

    const currentPromos=(promos||[]).filter((p:any)=>{
      const s=p.starts_at?new Date(p.starts_at).getTime():0;
      const e=p.ends_at?new Date(p.ends_at).getTime():Number.MAX_SAFE_INTEGER;
      const now=Date.now();return s<=now&&e>=now;
    });
    const promo=currentPromos[0]||null;
    const profileMap=new Map(recipients.map((p:any)=>[p.id,p]));
    const digestCache=new Map<string,any>();
    let sent=0,skipped=0,errors=0;

    for(const member of members||[]){
      const user:any=profileMap.get(member.user_id);if(!user)continue;
      const workspaceId=String(member.workspace_id);
      const {data:existing}=await admin.from("luma_weekly_email_deliveries")
        .select("id,status").eq("user_id",user.id).eq("workspace_id",workspaceId).eq("week_start",start).maybeSingle();
      if(existing?.status==="sent"){skipped++;continue}

      let context=digestCache.get(workspaceId);
      if(!context){
        const {data,error}=await admin.rpc("luma_ai_period_context",{p_workspace_id:workspaceId,p_start_date:start,p_end_date:end,p_focus:"performance"});
        if(error){errors++;continue}
        context=data||{};digestCache.set(workspaceId,context);
      }
      const kpi=context.kpi||{};
      const top=(context.top_creators||[])[0]||null;
      const workspaceName=String((member as any).workspaces?.name||"Workspace Lumaway");
      const action=(process.env.NEXT_PUBLIC_APP_URL||"https://lumaway.online").replace(/\/$/,"")+"/app.lumaway/dashboard";

      const delivery={user_id:user.id,workspace_id:workspaceId,week_start:start,status:"sending",provider:"resend",error_message:null};
      const {data:deliveryRow,error:deliveryError}=await admin.from("luma_weekly_email_deliveries")
        .upsert(delivery,{onConflict:"user_id,workspace_id,week_start"}).select("id").single();
      if(deliveryError){errors++;continue}

      const promoHtml=promo?`<div style="margin:18px 0;padding:14px;border-radius:12px;background:#f5f3ff"><b>Promo minggu ini · ${esc(promo.code)}</b><p style="margin:6px 0 0">${esc(promo.title||"Promo Lumaway aktif")}</p></div>`:"";
      const creatorHtml=top?`<p><b>Top creator:</b> ${esc(top.creator||top.username||"Creator")} · GMV ${esc(money(top.gmv))} · ${esc(top.orders||0)} order.</p>`:"<p>Belum ada creator dengan transaksi pada periode ini.</p>";
      const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#101828">
        <p style="font-size:12px;letter-spacing:.08em;color:#635bff;font-weight:700">LUMAWAY WEEKLY</p>
        <h2 style="margin:4px 0 8px">Ringkasan ${esc(workspaceName)}</h2>
        <p>Halo ${esc(user.full_name||"Lumaway User")}, ini ringkasan ${esc(start)} sampai ${esc(end)}.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0">
          <div style="padding:12px;border:1px solid #e5e7eb;border-radius:10px"><small>GMV</small><br><b>${esc(money(kpi.gmv))}</b></div>
          <div style="padding:12px;border:1px solid #e5e7eb;border-radius:10px"><small>Orders</small><br><b>${esc(kpi.orders||0)}</b></div>
          <div style="padding:12px;border:1px solid #e5e7eb;border-radius:10px"><small>Qty</small><br><b>${esc(kpi.qty||0)}</b></div>
          <div style="padding:12px;border:1px solid #e5e7eb;border-radius:10px"><small>Creator aktif</small><br><b>${esc(kpi.active_creators||0)}</b></div>
        </div>
        ${creatorHtml}${promoHtml}
        <p><a href="${esc(action)}" style="display:inline-block;background:#635bff;color:#fff;text-decoration:none;padding:11px 16px;border-radius:10px">Buka Dashboard Lumaway</a></p>
        <p style="font-size:11px;color:#667085;margin-top:28px">Email mingguan dapat dinonaktifkan dari Account → My Profile.</p>
      </div>`;
      try{
        const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[user.email],subject:`Lumaway Weekly · ${workspaceName} · ${start}–${end}`,html})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(`Resend ${response.status}`);
        await Promise.all([
          admin.from("luma_weekly_email_deliveries").update({status:"sent",provider_message_id:String(data?.id||"")||null,sent_at:new Date().toISOString(),error_message:null}).eq("id",deliveryRow.id),
          admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:user.id,provider:"resend",service:"weekly_insight",request_type:"weekly_sales_creator_promo",status:"success",reference:String(deliveryRow.id),metadata:{week_start:start,week_end:end}})
        ]);
        sent++;
      }catch(error:any){
        await Promise.all([
          admin.from("luma_weekly_email_deliveries").update({status:"error",error_message:String(error?.message||"unknown").slice(0,300)}).eq("id",deliveryRow.id),
          admin.from("luma_api_usage_events").insert({workspace_id:workspaceId,user_id:user.id,provider:"resend",service:"weekly_insight",request_type:"weekly_sales_creator_promo",status:"error",reference:String(deliveryRow.id),metadata:{week_start:start,week_end:end,error:String(error?.message||"unknown").slice(0,180)}})
        ]);
        errors++;
      }
    }
    return NextResponse.json({ok:true,week_start:start,week_end:end,sent,skipped,errors});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Weekly email failed."},{status:500});
  }
}
