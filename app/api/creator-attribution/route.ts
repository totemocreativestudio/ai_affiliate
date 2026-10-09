import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../lib/server-auth";

export const runtime="nodejs";
type Source="shopee_creator"|"tiktok_video"|"tiktok_product"|"tiktok_live";
type Raw=Record<string,unknown>;
type Parsed=Record<string,unknown>;
const allowed:Record<Source,"Shopee"|"TikTok">={
 shopee_creator:"Shopee",tiktok_video:"TikTok",tiktok_product:"TikTok",tiktok_live:"TikTok"
};
const clean=(x:unknown)=>String(x??"").trim();
const normalized=(x:string)=>x.toLowerCase().replace(/[^a-z0-9]/g,"");
function get(row:Raw,name:string){const k=Object.keys(row).find(x=>normalized(x)===normalized(name));return k?row[k]:""}
function money(v:unknown){
 if(typeof v==="number")return Number.isFinite(v)?v:0;
 const source=clean(v);if(!source)return 0;
 const minus=/^\(.*\)$/.test(source)||source.startsWith("-");
 let x=source.replace(/Rp|IDR|\s/gi,"").replace(/[^0-9.,]/g,"");
 if(!x)return 0;
 const comma=x.lastIndexOf(","),dot=x.lastIndexOf(".");
 if(comma>=0&&dot>=0){const decimal=comma>dot?",":".";x=x.replace(decimal===","?/\./g:/,/g,"").replace(decimal,".")}
 else if(comma>=0||dot>=0){
  const separator=comma>=0?",":".",parts=x.split(separator);
  if(parts.length>2||parts.length===2&&parts[1].length===3)x=parts.join("");
  else x=x.replace(separator,".");
 }
 const n=Number(x);return Number.isFinite(n)?(minus?-n:n):0;
}
// Shopee AMS values are numeric decimal-dot exports. A trailing .275 means
// 275 thousandths of a rupiah, NOT an Indonesian thousands separator.
function shopeeAmount(v:unknown){
 if(typeof v==="number")return Number.isFinite(v)?v:0;
 const text=clean(v).replace(/Rp|IDR|\s/gi,"");
 if(/^[+-]?\d+(?:\.\d+)?$/.test(text)){const n=Number(text);return Number.isFinite(n)?n:0}
 if(/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text)){
   const n=Number(text.replace(/,/g,""));return Number.isFinite(n)?n:0;
 }
 return money(v);
}
function int(v:unknown){return Math.round(money(v))}
function date(v:unknown){
 const source=clean(v);if(!source)return null;
 const m=source.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
 if(m){const iso=m[3]+"-"+m[1].padStart(2,"0")+"-"+m[2].padStart(2,"0");
 return iso+"T"+(m[4]||"00").padStart(2,"0")+":"+(m[5]||"00")+":00Z"}
 const parsed=new Date(source);return Number.isNaN(parsed.getTime())?null:parsed.toISOString();
}
function parse(source:Source,row:Raw,index:number,workspace_id:string,import_id:string){
 const common={
  workspace_id,import_id,platform:allowed[source],source_type:source,
  creator_id:null as number|null,creator_name:null as string|null,creator_username:null as string|null,affiliate_id:null as string|null,
  attribution_level:"",source_key:"",
  asset_id:null as string|null,asset_url:null as string|null,content_posted_at:null as string|null,
  product_code:null as string|null,product_codes:[] as string[],product_name:null as string|null,
  session_start_at:null as string|null,session_end_at:null as string|null,
  gmv:0,qty:0,orders:0,commission:0,refund_gmv:0,refund_qty:0,clicks:0,views:0,buyers:0,
  source_metadata:{} as Record<string,unknown>
 };
 const nonempty=(value:unknown)=>clean(value)||null;
 if(source==="shopee_creator"){
  const affiliateId=clean(get(row,"ID Affiliates"));
  const username=clean(get(row,"Username Affiliate"));
  if(!affiliateId&&!username)return null;
  return {...common,source_key:"creator:"+(affiliateId||username.toLowerCase()),
   creator_name:nonempty(get(row,"Nama Affiliate")),creator_username:username||null,affiliate_id:affiliateId||null,
   attribution_level:"creator_summary",
   gmv:shopeeAmount(get(row,"Omzet Penjualan(Rp)")),qty:int(get(row,"Produk Terjual")),
   orders:int(get(row,"Pesanan")),commission:shopeeAmount(get(row,"Estimasi Komisi(Rp)")),
   clicks:int(get(row,"Clicks")),buyers:int(get(row,"Total Pembeli")),
   source_metadata:{new_buyers:int(get(row,"Pembeli Baru")),reported_roi:shopeeAmount(get(row,"ROI")),
    product_attribution:"unknown_without_order_or_product_source"}};
 }
 if(source==="tiktok_product"){
  const id=clean(get(row,"Product ID"));if(!/^\d{8,24}$/.test(id))return null;
  return {...common,source_key:"product:"+id,attribution_level:"product_summary",product_code:id,
   product_codes:[id],product_name:nonempty(get(row,"Product name")),
   gmv:money(get(row,"GMV dari kreator")),qty:int(get(row,"Produk yang terjual dari kreator")),
   orders:int(get(row,"Pesanan teratribusi")),commission:money(get(row,"Perkiraan komisi")),
   refund_gmv:money(get(row,"Pengembalian dana")),refund_qty:int(get(row,"Produk yang dikembalikan dananya")),
   buyers:int(get(row,"Pembeli")),
   source_metadata:{samples:int(get(row,"Sampel terkirim")),video_count:int(get(row,"Video")),
      live_count:int(get(row,"Siaran LIVE")),category:nonempty(get(row,"Product category"))}};
 }
 if(source==="tiktok_video"){
  const videoId=clean(get(row,"Video ID")),productId=clean(get(row,"Product ID"));
  const url=clean(get(row,"Video link"));
  if(!/^\d{8,24}$/.test(videoId)||!/^\d{8,24}$/.test(productId)||!/^https:\/\/(www\.)?tiktok\.com\//i.test(url))return null;
  const username=decodeURIComponent(url.match(/\/\@([^/?#]+)/)?.[1]||"").trim();
  if(!username)return null;
  return {...common,source_key:"video:"+videoId+":"+productId,attribution_level:"creator_video_product",
   creator_username:username,asset_id:videoId,asset_url:url,
   content_posted_at:date(get(row,"Post date")),product_code:productId,product_codes:[productId],
   gmv:money(get(row,"GMV dari video afiliasi")),
   qty:int(get(row,"Produk yang terjual melalui video")),orders:int(get(row,"Pesanan dari video")),
   commission:money(get(row,"Perkiraan komisi")),refund_gmv:money(get(row,"Pengembalian dana")),
   refund_qty:int(get(row,"Produk yang dikembalikan dananya")),
   views:int(get(row,"Tayangan video")),buyers:int(get(row,"Pembeli")),
   source_metadata:{title:nonempty(get(row,"Video title")),
    ctr:nonempty(get(row,"CTR")),likes:int(get(row,"Suka")),shares:int(get(row,"Dibagikan"))}};
 }
 if(source==="tiktok_live"){
  const liveId=clean(get(row,"LIVE ID"));if(!/^\d{8,24}$/.test(liveId))return null;
  const productCodes=clean(get(row,"Product ID")).split(",").map(x=>x.trim()).filter(x=>/^\d{8,24}$/.test(x));
  return {...common,source_key:"live:"+liveId,attribution_level:"live_session_unassigned",
   asset_id:liveId,product_codes:productCodes,
   session_start_at:date(get(row,"LIVE start time")),session_end_at:date(get(row,"LIVE end time")),
   gmv:money(get(row,"GMV dari LIVE kreator")),qty:int(get(row,"Produk yang terjual melalui LIVE")),
   orders:int(get(row,"Pesanan dari LIVE")),commission:money(get(row,"Perkiraan komisi")),
   refund_gmv:money(get(row,"Pengembalian dana")),
   refund_qty:int(get(row,"Produk yang dikembalikan dananya")),
   clicks:int(get(row,"Klik produk")),buyers:int(get(row,"Pembeli")),
   source_metadata:{live_title:nonempty(get(row,"LIVE title")),
    listed_product_count:int(get(row,"Produk terjual")),
    // 'Produk terjual' in this source counts unique products listed, NOT sold units.
    impressions:int(get(row,"Impresi")),likes:int(get(row,"Suka")),shares:int(get(row,"Dibagikan"))}};
 }
 return null;
}
function validateHeaders(source:Source,first:Raw){
 const headers=Object.keys(first).map(normalized);
 const needs:Record<Source,string[]>={
  shopee_creator:["ID Affiliates","Username Affiliate","Omzet Penjualan(Rp)","Produk Terjual","Estimasi Komisi(Rp)"],
  tiktok_product:["Product ID","Product name","GMV dari kreator","Produk yang terjual dari kreator"],
  tiktok_video:["Video ID","Video link","Product ID","GMV dari video afiliasi","Produk yang terjual melalui video"],
  tiktok_live:["LIVE ID","LIVE start time","Product ID","GMV dari LIVE kreator","Produk yang terjual melalui LIVE"]
 };
 return needs[source].filter(x=>!headers.includes(normalized(x)));
}
export async function POST(req:NextRequest){
 try{
  const body=await req.json();
  const source=clean(body.source_type) as Source;
  const workspaceId=clean(body.workspace_id),filename=clean(body.filename),hash=clean(body.file_hash);
  const start=clean(body.period_start),end=clean(body.period_end);
  const raw=body.rows as Raw[];
  if(!(source in allowed)||!workspaceId||!filename||!/^[a-f0-9]{64}$/i.test(hash)
    ||!/\d{4}-\d{2}-\d{2}/.test(start)||!/\d{4}-\d{2}-\d{2}/.test(end)||start>end
    ||!Array.isArray(raw)||raw.length<1||raw.length>1000)
   return NextResponse.json({ok:false,error:"Jenis laporan, periode, atau format file tidak valid."},{status:400});
  const ctx=await getServerContext(workspaceId);
  if(raw.some(x=>!x||typeof x!=="object"||Array.isArray(x)))
   return NextResponse.json({ok:false,error:"Baris laporan tidak valid."},{status:422});
  const missing=validateHeaders(source,raw[0]);
  if(missing.length)return NextResponse.json({ok:false,error:"Kolom sumber tidak lengkap: "+missing.join(", "),missing_headers:missing},{status:422});
  const storeName=clean(body.store_name)||null,storeId=clean(body.store_id)||null;
  const values=raw.map((r,i)=>parse(source,r,i,workspaceId,"")).filter(Boolean) as Parsed[];
  const rejected=raw.length-values.length;
  if(!values.length||rejected>0)return NextResponse.json({ok:false,error:rejected+" baris gagal validasi. Tidak ada data disimpan. Periksa identitas creator, Product ID, Video ID atau LIVE ID.",rejected},{status:422});
  const distinct=new Set(values.map(v=>v.source_key));
  if(distinct.size!==values.length)return NextResponse.json({ok:false,error:"File berisi ID sumber yang duplikat. Tidak ada data disimpan."},{status:422});
  const {data:exists,error:existError}=await ctx.admin.from("luma_creator_attribution_imports")
   .select("id").eq("workspace_id",workspaceId).eq("platform",allowed[source]).eq("source_type",source).eq("file_hash",hash).maybeSingle();
  if(existError)throw existError;
  if(exists)return NextResponse.json({ok:false,error:"File ini telah diimpor. Hapus import lama sebelum mengunggah file yang sama.",import_id:exists.id},{status:409});
  const {data:imp,error:impError}=await ctx.admin.from("luma_creator_attribution_imports")
   .insert({workspace_id:workspaceId,platform:allowed[source],source_type:source,file_name:filename,
    file_hash:hash,period_start:start,period_end:end,store_name:storeName,store_id:storeId,
    row_count:values.length,import_status:"processing",created_by:ctx.user.id})
   .select("id").single();
  if(impError)throw impError;
  try{
   const payloads=values.map(x=>({...x,import_id:imp.id}));
   for(let i=0;i<payloads.length;i+=150){
    const {error}=await ctx.admin.from("luma_creator_attribution_rows")
      .insert(payloads.slice(i,i+150));
    if(error)throw error;
   }
   const {error:doneError}=await ctx.admin.from("luma_creator_attribution_imports")
      .update({import_status:"completed"}).eq("id",imp.id).eq("workspace_id",workspaceId);
   if(doneError)throw doneError;
  }catch(error){
   await ctx.admin.from("luma_creator_attribution_imports").delete().eq("id",imp.id).eq("workspace_id",workspaceId);
   throw error;
  }
  const sum=(field:string)=>values.reduce((a,x)=>a+Number(x[field]||0),0);
  return NextResponse.json({ok:true,import_id:imp.id,source_type:source,
    imported:values.length,attribution_level:values[0].attribution_level,
    totals:{gmv:sum("gmv"),qty:sum("qty"),orders:sum("orders"),commission:sum("commission"),
      refund_gmv:sum("refund_gmv"),refund_qty:sum("refund_qty")},
    caveat:source==="shopee_creator"?"Creator total only. No product/order allocation in this export."
      :source==="tiktok_product"?"Product summary is NOT additive with video LIVE attribution."
      :source==="tiktok_video"?"Video content post date is NOT transaction date. Sales belong to selected report period."
      :"LIVE product ID lists are NOT per-product sales. Creator identity is not supplied."});
 }catch(error:any){
  const msg=error?.message||"Gagal memproses atribusi kreator.";
  return NextResponse.json({ok:false,error:msg},{status:500});
 }
}
export async function DELETE(req:NextRequest){
 try{
  const body=await req.json(),workspaceId=clean(body.workspace_id),id=clean(body.import_id);
  if(!workspaceId||!/^[a-f0-9-]{36}$/i.test(id))
   return NextResponse.json({ok:false,error:"ID import tidak valid."},{status:400});
  const ctx=await getServerContext(workspaceId);
  const {data:member,error:roleError}=await ctx.admin.from("workspace_members")
   .select("membership_role").eq("workspace_id",workspaceId).eq("user_id",ctx.user.id).maybeSingle();
  if(roleError||!["owner","admin"].includes(clean(member?.membership_role)))
   return NextResponse.json({ok:false,error:"Hanya owner/admin workspace yang dapat menghapus import."},{status:403});
  const {error}=await ctx.admin.from("luma_creator_attribution_imports").delete()
    .eq("workspace_id",workspaceId).eq("id",id);
  if(error)throw error;
  return NextResponse.json({ok:true});
 }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Gagal menghapus import."},{status:500})}
}
