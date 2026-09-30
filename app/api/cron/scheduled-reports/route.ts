import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const maxDuration=60;

function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)throw new Error("Supabase server environment incomplete.");
  return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
function money(v:any){return "Rp "+Math.round(Number(v||0)).toLocaleString("id-ID")}
function reportHtml(name:string,type:string,payload:any){
  if(type==="goal_forecast"){
    return "<div style=\"font-family:Arial,sans-serif;max-width:680px;margin:auto\"><h2>"+name+"</h2><p>Ringkasan Goal & Forecast Lumaway</p><table style=\"width:100%;border-collapse:collapse\"><tr><td>Actual GMV</td><td><b>"+money(payload?.actual?.gmv)+"</b></td></tr><tr><td>Target GMV</td><td><b>"+money(payload?.target?.gmv)+"</b></td></tr><tr><td>Forecast GMV</td><td><b>"+money(payload?.forecast?.gmv)+"</b></td></tr><tr><td>Contribution Margin</td><td><b>"+money(payload?.actual?.contribution_margin)+"</b></td></tr></table><p style=\"color:#777\">Dikirim otomatis oleh Lumaway.</p></div>";
  }
  const perf=payload?.performance||{},attention=payload?.attention||{};
  return "<div style=\"font-family:Arial,sans-serif;max-width:680px;margin:auto\"><h2>"+name+"</h2><p>Daily Brief Lumaway</p><p><b>GMV:</b> "+money(perf.gmv)+" &nbsp; <b>Orders:</b> "+Number(perf.orders||0).toLocaleString("id-ID")+"</p><p><b>Campaign due:</b> "+(attention.campaign_due||0)+" · <b>Sample follow-up:</b> "+(attention.samples_followup||0)+" · <b>Shipping:</b> "+(attention.shipping_attention||0)+"</p><p style=\"color:#777\">Dikirim otomatis oleh Lumaway.</p></div>";
}
async function sendEmail(to:string[],subject:string,html:string){
  const key=process.env.RESEND_API_KEY;
  if(!key)throw new Error("RESEND_API_KEY belum tersedia.");
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from:"Lumaway <marketing@lumaway.online>",to,subject,html})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(String(body?.message||"Resend delivery failed."));
  return body;
}

export async function GET(req:NextRequest){
  const expected=String(process.env.CRON_SECRET||"");
  if(!expected||req.headers.get("authorization")!=="Bearer "+expected)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
  const admin=adminClient();
  try{
    const claimed=await admin.rpc("luma_claim_due_scheduled_reports_v1",{p_limit:20});
    if(claimed.error)throw claimed.error;
    const items=Array.isArray(claimed.data)?claimed.data:[];
    const results:any[]=[];
    for(const item of items){
      try{
        let payload:any={};
        if(item.report_type==="daily_brief"){
          const r=await admin.rpc("luma_daily_brief_service_v1",{p_workspace_id:item.workspace_id});
          if(r.error)throw r.error; payload=r.data;
        }else{
          const now=new Date();
          const start=String(item.configuration?.period_start||new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10));
          const end=String(item.configuration?.period_end||new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().slice(0,10));
          const r=await admin.rpc("luma_goal_forecast_service_v1",{p_workspace_id:item.workspace_id,p_period_start:start,p_period_end:end});
          if(r.error)throw r.error; payload=r.data;
        }
        if(Array.isArray(item.recipients)&&item.recipients.length)await sendEmail(item.recipients,"Lumaway · "+item.name,reportHtml(item.name,item.report_type,payload));
        await admin.from("luma_scheduled_report_runs").update({status:"delivered",payload,completed_at:new Date().toISOString()}).eq("id",item.run_id);
        results.push({id:item.schedule_id,status:"delivered"});
      }catch(error:any){
        await admin.from("luma_scheduled_report_runs").update({status:"failed",error_message:String(error?.message||"Report failed"),completed_at:new Date().toISOString()}).eq("id",item.run_id);
        results.push({id:item.schedule_id,status:"failed",error:String(error?.message||"Report failed")});
      }
    }
    return NextResponse.json({ok:true,count:items.length,results});
  }catch(error:any){
    return NextResponse.json({ok:false,error:String(error?.message||"Scheduled report cron failed.")},{status:500});
  }
}
