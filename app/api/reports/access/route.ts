import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { getServerContext } from "../../../../lib/server-auth";

export const runtime="nodejs";

const esc=(v:any)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
function logoData(){try{return `data:image/png;base64,${readFileSync(path.join(process.cwd(),"public","luma-mark.png")).toString("base64")}`}catch{return ""}}
function renderHtml(report:any){
  const doc=report.document_json||{};const pages=(doc.pages||[]).slice(0,20);const watermark=!report.watermark_removed_at;const logo=logoData();
  const pageHtml=pages.map((p:any,i:number)=>`<section class="page ${i===0?"cover":""}">${watermark?`<div class="watermark">LUMAWAY</div>`:""}<header><div class="brand">${logo?`<img src="${logo}"/>`:""}<b>LUMAWAY</b></div><span>LUMA AFFILIATE INTELLIGENCE</span></header><main>${i===0?`<div class="cover-block"><small>AI ANALYTICS REPORT</small><h1>${esc(p.title||doc.document_title)}</h1><p>${esc(p.subtitle)}</p><div class="cover-rule"></div><em>${esc(report.period_start||"ALL DATA")} — ${esc(report.period_end||"ALL DATA")}</em></div>`:`<div class="page-number">${String(p.page_number||i+1).padStart(2,"0")}</div><h1>${esc(p.title)}</h1><p class="subtitle">${esc(p.subtitle)}</p>${(p.sections||[]).map((s:any)=>`<article><h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p></article>`).join("")}${(p.bullets||[]).length?`<ul>${p.bullets.map((x:string)=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}${p.callout?`<aside>${esc(p.callout)}</aside>`:""}`}</main><footer><span>© ${new Date().getFullYear()} Lumaway. All rights reserved.</span><b>${esc(doc.document_title||report.title)}</b></footer></section>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#d9d9d9;color:#111;font-family:Arial,Helvetica,sans-serif}.page{width:210mm;height:297mm;margin:10mm auto;background:#fff;padding:18mm 17mm 15mm;position:relative;overflow:hidden;page-break-after:always;box-shadow:0 6px 24px rgba(0,0,0,.14)}header{height:16mm;border-bottom:1px solid #111;display:flex;align-items:center;justify-content:space-between;font-size:8px;letter-spacing:.16em}header .brand{display:flex;align-items:center;gap:7px;letter-spacing:.12em}header img{width:22px;height:22px;object-fit:contain;filter:grayscale(1)}main{position:relative;z-index:2;padding-top:14mm}.page-number{font-size:10px;letter-spacing:.12em;margin-bottom:7mm}h1{font-size:26px;line-height:1.12;margin:0 0 4mm;letter-spacing:-.03em}p.subtitle{color:#555;font-size:12px;margin:0 0 9mm}article{border-top:1px solid #ddd;padding:6mm 0 2mm}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 2mm}p,li{font-size:11px;line-height:1.65}ul{padding-left:5mm}aside{margin-top:6mm;border:1px solid #111;padding:4mm;font-size:11px;font-weight:700}footer{position:absolute;left:17mm;right:17mm;bottom:8mm;border-top:1px solid #ddd;padding-top:3mm;display:flex;justify-content:space-between;font-size:7px;color:#555;z-index:2}.watermark{position:absolute;top:45%;left:10%;font-size:55px;font-weight:900;letter-spacing:.16em;color:rgba(0,0,0,.045);transform:rotate(-31deg);z-index:1;user-select:none}.cover main{height:230mm;display:flex;align-items:center}.cover-block{max-width:150mm}.cover-block small{font-size:9px;letter-spacing:.18em}.cover-block h1{font-size:40px;margin-top:5mm}.cover-block p{font-size:15px;color:#555}.cover-rule{width:36mm;height:4px;background:#111;margin:12mm 0 6mm}.cover-block em{font-size:10px;font-style:normal}.page,.page *{-webkit-user-select:none;user-select:none}@media print{body{background:#fff}.page{margin:0;box-shadow:none}}</style></head><body oncontextmenu="return false">${pageHtml}<script>document.addEventListener('copy',e=>e.preventDefault());document.addEventListener('cut',e=>e.preventDefault());document.addEventListener('selectstart',e=>e.preventDefault());</script></body></html>`;
}

export async function POST(req:NextRequest){
  try{
    const b=await req.json();const workspaceId=String(b.workspace_id||"");const reportId=Number(b.report_id||0);const action=String(b.action||"preview");const ctx=await getServerContext(workspaceId);
    const {data:report,error}=await ctx.admin.from("luma_pdf_reports").select("*").eq("id",reportId).eq("workspace_id",workspaceId).eq("user_id",ctx.user.id).maybeSingle();if(error)throw error;if(!report)return NextResponse.json({ok:false,error:"Report tidak ditemukan."},{status:404});
    if(action==="preview"){
      const {data:charge,error:chargeError}=await ctx.admin.rpc("luma_report_preview",{p_report_id:reportId,p_user_id:ctx.user.id,p_workspace_id:workspaceId});if(chargeError)throw chargeError;
      const {data:fresh,error:freshError}=await ctx.admin.from("luma_pdf_reports").select("id,title,period_start,period_end,document_json,previewed_at,downloaded_at,download_count,watermark_removed_at,page_count,created_at").eq("id",reportId).single();if(freshError)throw freshError;
      return NextResponse.json({ok:true,report:fresh,charge});
    }
    if(action==="remove_watermark"){
      const {data:charge,error:chargeError}=await ctx.admin.rpc("luma_report_remove_watermark",{p_report_id:reportId,p_user_id:ctx.user.id,p_workspace_id:workspaceId});if(chargeError)throw chargeError;return NextResponse.json({ok:true,charge});
    }
    if(action==="download"){
      const {data:charge,error:chargeError}=await ctx.admin.rpc("luma_report_download",{p_report_id:reportId,p_user_id:ctx.user.id,p_workspace_id:workspaceId});if(chargeError)throw chargeError;
      const {data:fresh,error:freshError}=await ctx.admin.from("luma_pdf_reports").select("*").eq("id",reportId).single();if(freshError)throw freshError;const html=renderHtml(fresh);const safe=(fresh.file_name||`lumaway-report-${reportId}.html`).replace(/[^a-zA-Z0-9._-]/g,"-");
      return new Response(html,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Content-Disposition":`attachment; filename="${safe}"`,"X-Luma-Token-Cost":String(charge?.cost||10)}});
    }
    return NextResponse.json({ok:false,error:"Action tidak dikenal."},{status:400});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Report access failed."},{status:400});}
}
