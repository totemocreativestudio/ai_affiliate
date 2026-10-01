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
async function sendEmail(to:string[],subject:string,html:string){
  const key=process.env.RESEND_API_KEY;
  if(!key||!to.length)return {skipped:true};
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from:"Lumaway Alerts <marketing@lumaway.online>",to,subject,html})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(String(body?.message||"Resend delivery failed."));
  return body;
}
export async function GET(req:NextRequest){
  const expected=String(process.env.CRON_SECRET||"");
  if(!expected||req.headers.get("authorization")!=="Bearer "+expected)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
  try{
    const admin=adminClient();
    const result=await admin.rpc("luma_evaluate_operational_alerts_v1");
    if(result.error)throw result.error;
    const events=Array.isArray(result.data?.new_events)?result.data.new_events:[];
    const delivered:any[]=[];
    for(const event of events){
      if(event.notify_email&&Array.isArray(event.email_recipients)&&event.email_recipients.length){
        try{
          await sendEmail(event.email_recipients,"Lumaway Alert · "+event.name,
            "<div style=\"font-family:Arial,sans-serif;max-width:640px;margin:auto\"><h2>Lumaway Operational Alert</h2><p><b>"+event.name+"</b></p><p>"+event.message+"</p><p>Severity: "+event.severity+"</p><p style=\"color:#777\">Buka Owner Platform Health untuk detail.</p></div>");
          await admin.from("luma_operational_alert_events").update({last_notified_at:new Date().toISOString()}).eq("id",event.event_id);
          delivered.push({event_id:event.event_id,email:true});
        }catch(error:any){delivered.push({event_id:event.event_id,email:false,error:String(error?.message||"email failed")})}
      }
    }
    return NextResponse.json({ok:true,new_events:events.length,delivered});
  }catch(error:any){
    return NextResponse.json({ok:false,error:String(error?.message||"Operational alert cron failed.")},{status:500});
  }
}
