import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../../lib/server-auth";

export const runtime = "nodejs";
const PAGE_W=595.28,PAGE_H=841.89,LEFT=43,RIGHT=552;
type A=Record<string,any>;
const clean=(x:unknown)=>String(x??"").replace(/[\r\n\t]+/g," ").replace(/\s+/g," ").trim().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7e\u00a0-\u00ff]/g,"");
const pdfEsc=(x:unknown)=>clean(x).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
const cash=(v:any)=>"Rp "+Number(v||0).toLocaleString("id-ID",{maximumFractionDigits:0});
const showDate=(v:any)=>{if(!v)return "-";const d=new Date(v);return Number.isNaN(d.getTime())?clean(v):d.toLocaleDateString("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"long",year:"numeric"})};
const small=(s:any,max=76)=>{const t=clean(s);return t.length>max?t.slice(0,max-1)+"...":t||"-"};
function lines(text:unknown,maxChars=72){
 const out:string[]=[];let line="";
 for(const word of clean(text).split(/\s+/)){
   if(!word)continue;
   const next=line?line+" "+word:word;
   if(next.length>maxChars&&line){out.push(line);line=word;}
   else line=next;
   if(line.length>maxChars){out.push(line.slice(0,maxChars));line=line.slice(maxChars)}
 }
 if(line)out.push(line);
 return out.length?out:["-"];
}
function makeAgreementPDF(a:A){
 let page=1,y=PAGE_H-130,commands:string[]=[];
 const pages:string[]=[];
 const setColor=(r:number,g:number,b:number)=>commands.push(r.toFixed(3)+" "+g.toFixed(3)+" "+b.toFixed(3)+" rg");
 const shape=(x:number,bottom:number,w:number,h:number,r:number,g:number,b:number)=>{
   setColor(r,g,b);commands.push(x+" "+bottom+" "+w+" "+h+" re f");
 };
 const write=(x:number,top:number,text:any,fontsize=10,bold=false,r=.16,g=.20,b=.32)=>{
   setColor(r,g,b);
   commands.push("BT /"+(bold?"F2":"F1")+" "+fontsize+" Tf 1 0 0 1 "+x+" "+top+" Tm ("+pdfEsc(text)+") Tj ET");
 };
 const footer=()=>{
   shape(LEFT,44,RIGHT-LEFT,1,.89,.90,.94);
   write(LEFT,29,"LUMAWAY  /  INTERNAL CREATOR AGREEMENT",8,true,.42,.46,.58);
   write(RIGHT-66,29,"Page "+page,8,false,.42,.46,.58);
 };
 const header=()=>{
   shape(0,PAGE_H-99,PAGE_W,99,.065,.089,.20);
   shape(0,PAGE_H-102,PAGE_W,3,.41,.31,.96);
   write(LEFT,PAGE_H-36,"LUMAWAY",16,true,1,1,1);
   write(LEFT,PAGE_H-56,"BUSINESS INTELLIGENCE WORKSPACE",8,false,.71,.75,.95);
   write(LEFT,PAGE_H-80,"CREATOR PARTNERSHIP  /  AGREEMENT RECORD",9,true,.83,.86,.97);
   footer();
 };
 const flush=()=>{
   pages.push(commands.join("\n")+"\n");
   commands=[];page++;y=PAGE_H-130;header();
 };
 header();
 const ensure=(space:number)=>{if(y-space<86)flush()};
 const section=(title:string,subtitle?:string)=>{
   ensure(48);
   shape(LEFT,y-11,RIGHT-LEFT,29,.95,.95,.985);
   shape(LEFT,y-11,4,29,.41,.31,.96);
   write(LEFT+14,y+7,title.toUpperCase(),10,true,.12,.15,.32);
   y-=39;
   if(subtitle){write(LEFT,y+9,subtitle,8,false,.46,.50,.64);y-=17;}
 };
 const field=(label:string,value:any)=>{
   const list=lines(value,69);
   const blockHeight=Math.max(29,15*list.length+11);
   ensure(blockHeight+5);
   shape(LEFT,y-blockHeight+10,RIGHT-LEFT,blockHeight,.987,.989,.997);
   write(LEFT+11,y+1,label.toUpperCase(),7.8,true,.49,.52,.64);
   for(let i=0;i<list.length;i++)write(LEFT+160,y+1-15*i,list[i],9.5,false,.14,.19,.32);
   y-=blockHeight+5;
 };
 const block=(title:string,value:any)=>{
   const all=lines(value,90);
   ensure(all.length*16+37);
   write(LEFT+3,y,title.toUpperCase(),8.2,true,.42,.46,.61);
   y-=16;
   all.forEach(line=>{write(LEFT+3,y,line,9.4);y-=15});
   y-=13;
 };
 const pair=(leftTitle:string,leftValue:any,rightTitle:string,rightValue:any)=>{
   ensure(54);
   shape(LEFT,y-39,248,57,.977,.980,.997);
   shape(LEFT+260,y-39,249,57,.977,.980,.997);
   write(LEFT+12,y+3,leftTitle.toUpperCase(),8,true,.53,.57,.68);
   write(LEFT+12,y-20,small(leftValue,31),11,true,.16,.19,.34);
   write(LEFT+272,y+3,rightTitle.toUpperCase(),8,true,.53,.57,.68);
   write(LEFT+272,y-20,small(rightValue,31),11,true,.16,.19,.34);
   y-=69;
 };
 const status=clean(a.document_status||"Pending").toLowerCase();
 const approved=status==="approved";
 pair("Agreement ID",a.agreement_id||"-","Document Status",approved?"APPROVED":status.toUpperCase());
 section("01  -  Identitas kerja sama");
 field("Creator",a.creator_name||"-");
 field("Platform",a.platform||"-");
 field("Brand / Kategori",[a.brand,a.category].filter(Boolean).join("  /  ")||"-");
 field("Toko",a.store_name||a.store_id||"-");
 section("02  -  Detail program dan nilai");
 block("Produk",a.product_name||"Tidak ditentukan");
 pair("Ratecard",cash(a.ratecard),"Support / Insentif",cash(a.support_value));
 field("Bentuk support",(a.support_type||"-")+"  /  "+(a.deal_type||"-"));
 field("Periode",showDate(a.start_date)+"  -  "+showDate(a.end_date));
 field("Status support",a.support_status||"-");
 if(a.notes)block("Catatan agreement",a.notes);
 section("03  -  Verifikasi dan persetujuan");
 ensure(128);
 shape(LEFT,y-89,RIGHT-LEFT,109,.94,.95,.995);
 write(LEFT+14,y+2,"DIGITAL SEAL ID  /  INTERNAL VERIFICATION",8.7,true,.39,.34,.78);
 write(LEFT+14,y-30,a.e_stamp_id||"-",16,true,.12,.18,.37);
 write(LEFT+14,y-55,"Identitas dokumen unik internal Lumaway - bukan e-Meterai resmi.",8.6,false,.42,.45,.59);
 y-=125;
 ensure(88);
 shape(LEFT,y-56,RIGHT-LEFT,76,.99,.99,1);
 write(LEFT+13,y+3,"NAMA PENANDA TANGAN",8,true,.52,.55,.65);
 write(LEFT+13,y-20,a.signed_by_name||a.creator_name||"-",11,true,.16,.20,.32);
 write(LEFT+270,y+3,"WAKTU TERCATAT",8,true,.52,.55,.65);
 write(LEFT+270,y-20,showDate(a.signed_at),9.5,false,.16,.20,.32);
 y-=93;
 if(a.terms_accepted){
  block("Persetujuan kebijakan","Term of Policy disetujui oleh akun workspace. Versi: "+clean(a.terms_version||"-")+". Persetujuan dicatat saat Agreement disimpan.");
 }else{
  block("Persetujuan kebijakan","Belum tercatat pada formulir lama (legacy).");
 }
 ensure(62);
 write(LEFT,y,"IMPORTANT INFORMATION",8.7,true,.55,.37,.69);y-=20;
 lines("Dokumen ini merupakan ringkasan Agreement internal Lumaway. Digital Seal ID bukan e-Meterai, sertifikat tanda tangan elektronik, atau pengganti tanda tangan yang diwajibkan menurut ketentuan hukum.",100).forEach(l=>{ensure(16);write(LEFT,y,l,8.6,false,.48,.52,.63);y-=14});
 pages.push(commands.join("\n")+"\n");

 // Every page owns one independent stream; dynamic xref offsets keep PDF valid.
 const objs:string[]=[""];
 const pageIds:number[]=[];
 for(let i=0;i<pages.length;i++)pageIds.push(5+i*2);
 objs[1]="<< /Type /Catalog /Pages 2 0 R >>";
 objs[2]="<< /Type /Pages /Kids ["+pageIds.map(id=>id+" 0 R").join(" ")+"] /Count "+pages.length+" >>";
 objs[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
 objs[4]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
 for(let i=0;i<pages.length;i++){
   const pageId=pageIds[i],streamId=pageId+1,stream=pages[i];
   objs[pageId]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+PAGE_W+" "+PAGE_H+"] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents "+streamId+" 0 R >>";
   objs[streamId]="<< /Length "+Buffer.byteLength(stream,"latin1")+" >>\nstream\n"+stream+"endstream";
 }
 let data="%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";const offsets:number[]=[0];
 for(let i=1;i<objs.length;i++){offsets[i]=Buffer.byteLength(data,"latin1");data+=i+" 0 obj\n"+objs[i]+"\nendobj\n"}
 const xref=Buffer.byteLength(data,"latin1");
 data+="xref\n0 "+objs.length+"\n0000000000 65535 f \n";
 for(let i=1;i<objs.length;i++)data+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
 data+="trailer\n<< /Size "+objs.length+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n";
 return Buffer.from(data,"latin1");
}
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;
  const workspaceId=new URL(req.url).searchParams.get("workspace_id")||"";
  const ctx=await getServerContext(workspaceId);
  if(!/^\d+$/.test(id))return NextResponse.json({ok:false,error:"Invalid Agreement ID"},{status:400});
  const {data,error}=await ctx.admin.from("agreements").select("*")
   .eq("workspace_id",workspaceId).eq("id",Number(id)).maybeSingle();
  if(error)throw error;
  if(!data)return NextResponse.json({ok:false,error:"Agreement tidak ditemukan."},{status:404});
  if(!data.e_stamp_id||!data.signed_by_name)return NextResponse.json({ok:false,error:"Agreement belum memiliki Digital Seal ID dan nama tanda tangan."},{status:422});
  const pdf=makeAgreementPDF(data);
  // Viewing/downloading must never silently change approval state.
  await ctx.admin.from("agreements").update({pdf_generated_at:new Date().toISOString()})
   .eq("workspace_id",workspaceId).eq("id",Number(id));
  return new NextResponse(pdf,{status:200,headers:{
    "Content-Type":"application/pdf",
    "Content-Disposition":'attachment; filename="Agreement-'+clean(data.agreement_id||id)+'.pdf"',
    "Cache-Control":"private, no-store"
  }});
 }catch(error:any){
  return NextResponse.json({ok:false,error:error?.message||"Gagal membuat PDF Agreement."},{status:400});
 }
}
