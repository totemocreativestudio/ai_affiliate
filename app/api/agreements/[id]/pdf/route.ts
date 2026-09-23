import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../../lib/server-auth";

export const runtime = "nodejs";

function clean(value:any){
  return String(value ?? "").replace(/[^ -~]/g," ").replace(/s+/g," ").trim();
}
function esc(value:string){return value.replace(/\\/g,"\\\\").replace(/(/g,"\\(").replace(/)/g,"\\)");}
function wrap(text:string,max=88){
  const words=clean(text).split(" ").filter(Boolean);const lines:string[]=[];let line="";
  for(const word of words){const next=line?line+" "+word:word;if(next.length>max){if(line)lines.push(line);line=word}else line=next}
  if(line)lines.push(line);return lines.length?lines:["-"];
}
function buildPdf(agreement:any){
  const lines:string[]=[
    "LUMAWAY - CREATOR AGREEMENT",
    "",
    `Agreement ID: ${clean(agreement.agreement_id)}`,
    `Creator: ${clean(agreement.creator_name)}`,
    `Platform: ${clean(agreement.platform)}`,
    `Brand: ${clean(agreement.brand)}`,
    `Category: ${clean(agreement.category)}`,
    `Product: ${clean(agreement.product_name)}`,
    `Deal Type: ${clean(agreement.deal_type)}`,
    `Ratecard: Rp ${Number(agreement.ratecard||0).toLocaleString("id-ID")}`,
    `Product HPP: Rp ${Number(agreement.product_hpp||0).toLocaleString("id-ID")}`,
    `Support: ${clean(agreement.support_type)} - Rp ${Number(agreement.support_value||0).toLocaleString("id-ID")}`,
    `Period: ${clean(agreement.start_date)} - ${clean(agreement.end_date)}`,
    `Document Status: ${clean(agreement.document_status)}`,
    `Support Status: ${clean(agreement.support_status)}`,
    `Notes: ${clean(agreement.notes)}`,
    "",
    "DIGITAL SEAL / MATERAI ONLINE ID (INTERNAL)",
    clean(agreement.e_stamp_id),
    "",
    `SIGNED BY NAME: ${clean(agreement.signed_by_name||agreement.creator_name)}`,
    `Signed At: ${agreement.signed_at?new Date(agreement.signed_at).toISOString():"-"}`,
    "",
    "Catatan: ID digital seal ini adalah identitas internal dokumen Lumaway.",
    "Untuk e-Meterai yang memiliki status hukum tertentu, gunakan penyedia e-Meterai resmi/berizin."
  ].flatMap(x=>x?wrap(x):[""]);

  let content="BT\n/F1 11 Tf\n50 790 Td\n";
  for(let i=0;i<lines.length;i++){
    if(i===0)content+="/F1 16 Tf\n";
    else if(i===1)content+="/F1 11 Tf\n";
    content+=`(${esc(lines[i])}) Tj\n0 -17 Td\n`;
  }
  content+="ET\n";
  content+="q\n0.82 g\nBT\n/F1 26 Tf\n120 90 Td\n";
  content+=`(SIGNED: ${esc(clean(agreement.signed_by_name||agreement.creator_name).slice(0,40))}) Tj\nET\nQ\n`;

  const objs:string[]=[];
  objs[1]="<< /Type /Catalog /Pages 2 0 R >>";
  objs[2]="<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objs[3]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>";
  objs[4]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objs[5]=`<< /Length ${Buffer.byteLength(content,"latin1")} >>\nstream\n${content}endstream`;

  let pdf="%PDF-1.4\n";
  const offsets=[0];
  for(let i=1;i<=5;i++){offsets[i]=Buffer.byteLength(pdf,"latin1");pdf+=`${i} 0 obj\n${objs[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf,"latin1");
  pdf+="xref\n0 6\n0000000000 65535 f \n";
  for(let i=1;i<=5;i++)pdf+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
  pdf+=`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf,"latin1");
}

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const workspaceId=new URL(req.url).searchParams.get("workspace_id")||"";
    const ctx=await getServerContext(workspaceId);
    const {data,error}=await ctx.admin.from("agreements").select("*").eq("workspace_id",workspaceId).eq("id",Number(id)).maybeSingle();
    if(error)throw error;
    if(!data)return NextResponse.json({ok:false,error:"Agreement tidak ditemukan."},{status:404});
    if(!data.e_stamp_id||!data.signed_by_name)return NextResponse.json({ok:false,error:"Agreement belum memiliki Digital Seal ID / nama tanda tangan."},{status:422});
    const pdf=buildPdf(data);
    await ctx.admin.from("agreements").update({pdf_generated_at:new Date().toISOString(),document_status:data.document_status||"Approved"}).eq("workspace_id",workspaceId).eq("id",Number(id));
    return new NextResponse(pdf,{status:200,headers:{
      "Content-Type":"application/pdf",
      "Content-Disposition":`attachment; filename="Agreement-${clean(data.agreement_id||id)}.pdf"`,
      "Cache-Control":"no-store"
    }});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Gagal membuat PDF Agreement."},{status:400});
  }
}
