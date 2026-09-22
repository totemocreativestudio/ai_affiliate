import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../lib/server-auth";

export const runtime = "nodejs";
type Row = Record<string, any>;
const PARSER_VERSION = "universal-v7-20260922";

const clean = (v: any) => (v === null || v === undefined ? "" : String(v).trim());
type NumericKind = "money" | "count" | "percent" | "decimal";

function num(v: any, kind: NumericKind = "decimal") {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  let raw = clean(v).replace(/\u00a0/g, " ").trim();
  if (!raw) return 0;

  // Preserve scientific notation from exports such as 1.3E+06.
  const scientific = raw
    .replace(/Rp|IDR|USD/gi, "")
    .replace(/%/g, "")
    .replace(/\s+/g, "")
    .replace(",", ".");
  if (/^[+\-]?\d+(?:\.\d+)?[eE][+\-]?\d+$/.test(scientific)) {
    const n = Number(scientific);
    return Number.isFinite(n) ? n : 0;
  }

  const negative = /^\s*\(.*\)\s*$/.test(raw);
  let s = raw
    .replace(/[()]/g, "")
    .replace(/Rp|IDR|USD/gi, "")
    .replace(/%/g, "")
    .replace(/[\s']/g, "")
    .replace(/[^0-9,.+\-]/g, "");
  if (!s) return 0;

  const sign = s.startsWith("-") ? -1 : 1;
  s = s.replace(/^[+\-]/, "");

  if (kind === "count") {
    // Counts are whole units. Both Indonesian and English thousands separators
    // are removed: 1.300, 1,300, 12.000 -> 1300 / 1300 / 12000.
    const digits = s.replace(/[.,]/g, "");
    const n = Number(digits);
    return Number.isFinite(n) ? (negative ? -Math.abs(n) : sign * n) : 0;
  }

  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");
  const normalizeSingle = (separator: "," | ".") => {
    const parts = s.split(separator);
    if (parts.length > 2) {
      const allGroups = parts.slice(1).every((part) => part.length === 3);
      if (allGroups) return parts.join("");
      const decimal = parts.pop() || "";
      return parts.join("") + (decimal ? "." + decimal : "");
    }
    const left = parts[0] || "0";
    const right = parts[1] || "";
    if (!right) return left;

    if (kind === "money") {
      // IDR exports frequently use either 1.300 or 1,300 as thousands.
      // A final 1-2 digit group is treated as decimal cents; 3 digits is grouping.
      if (right.length === 3) {
        if (/Rp|IDR|USD/i.test(raw) || left.length <= 3) return left + right;
        return left + "." + right;
      }
      if (right.length <= 2) return left + "." + right;
      return left + right;
    }

    // Percent / generic decimal: one separator is decimal unless it is a
    // clear 3-digit thousands group with a short integer prefix.
    if (right.length === 3 && left.length <= 3) return left + right;
    return left + "." + right;
  };

  let normalized = s;
  if (comma >= 0 && dot >= 0) {
    // When both separators exist, the final separator is decimal only when
    // its suffix is 1-2 digits. Otherwise both are thousands separators.
    const last = Math.max(comma, dot);
    const suffix = s.slice(last + 1);
    if (suffix.length > 0 && suffix.length <= 2) {
      const decimalSep = comma > dot ? "," : ".";
      const groupSep = decimalSep === "," ? "." : ",";
      normalized = s.split(groupSep).join("").replace(decimalSep, ".");
    } else {
      normalized = s.replace(/[.,]/g, "");
    }
  } else if (comma >= 0) {
    normalized = normalizeSingle(",");
  } else if (dot >= 0) {
    normalized = normalizeSingle(".");
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  const signed = sign * n;
  return negative ? -Math.abs(signed) : signed;
}

const moneyNum = (v:any) => num(v, "money");
const countNum = (v:any) => num(v, "count");
const percentNum = (v:any) => num(v, "percent");

type MoneyStyle = "decimal-dot" | "decimal-comma" | "grouped";

function inferMoneyStyle(rows:Row[],header:string):MoneyStyle{
  if(!header)return "grouped";
  let dotDecimal=0,commaDecimal=0,grouped=0;
  for(const row of rows.slice(0,500)){
    const value=row?.[header];
    if(value===null||value===undefined||value===""||typeof value==="number")continue;
    const raw=String(value).trim();
    const hasCurrency=/Rp|IDR|USD/i.test(raw);
    const s=raw.replace(/Rp|IDR|USD/gi,"").replace(/\s+/g,"").replace(/[^0-9,.+\-]/g,"").replace(/^[+\-]/,"");
    if(!s)continue;
    const dots=(s.match(/\./g)||[]).length,commas=(s.match(/,/g)||[]).length;
    if(dots&&commas){
      const lastDot=s.lastIndexOf("."),lastComma=s.lastIndexOf(",");
      const last=Math.max(lastDot,lastComma),suffix=s.slice(last+1);
      if(suffix.length<=2){if(lastDot>lastComma)dotDecimal+=4;else commaDecimal+=4}else grouped+=3;
      continue;
    }
    const sep=dots?".":commas?",":"";
    if(!sep)continue;
    const parts=s.split(sep);
    if(parts.length>2){if(parts.slice(1).every(part=>part.length===3))grouped+=4;continue}
    const left=(parts[0]||"").replace(/^[-+]/,""),right=parts[1]||"";
    if(hasCurrency&&right.length===3){grouped+=3;continue}
    if(right.length<=2&&right.length>0){if(sep===".")dotDecimal+=2;else commaDecimal+=2;continue}
    if(right.length===3){
      // Three trailing digits are ambiguous. Treat short prefixes as a clear
      // thousands group, but do not infer a decimal convention from this case
      // alone. Decimal style requires stronger evidence (1-2 decimal digits).
      if(left.length<=3)grouped+=2;
    }
  }
  if(dotDecimal>=commaDecimal&&dotDecimal>grouped)return "decimal-dot";
  if(commaDecimal>dotDecimal&&commaDecimal>grouped)return "decimal-comma";
  return "grouped";
}

function moneyValue(v:any,style:MoneyStyle){
  if(typeof v==="number")return Number.isFinite(v)?v:0;
  const raw=clean(v);
  if(!raw)return 0;
  const hasCurrency=/Rp|IDR|USD/i.test(raw);
  let s=raw.replace(/[()]/g,"").replace(/Rp|IDR|USD/gi,"").replace(/\s+/g,"").replace(/[^0-9,.+\-]/g,"");
  const negative=/^\s*\(.*\)\s*$/.test(raw)||s.startsWith("-");
  s=s.replace(/^[+\-]/,"");
  const dots=(s.match(/\./g)||[]).length,commas=(s.match(/,/g)||[]).length;
  let normalized=s;
  if(dots&&commas){
    const lastDot=s.lastIndexOf("."),lastComma=s.lastIndexOf(",");
    const last=Math.max(lastDot,lastComma),suffix=s.slice(last+1);
    if(suffix.length>0&&suffix.length<=2){
      const decimalSep=lastDot>lastComma?".":",",groupSep=decimalSep==="."?",":".";
      normalized=s.split(groupSep).join("").replace(decimalSep,".");
    }else normalized=s.replace(/[.,]/g,"");
  }else if(dots||commas){
    const sep=dots?".":",",parts=s.split(sep);
    if(parts.length>2)normalized=parts.join("");
    else{
      const left=parts[0]||"0",right=parts[1]||"";
      if(right.length===3){
        const definitelyGrouped=hasCurrency||left.length<=3||style==="grouped";
        normalized=definitelyGrouped?left+right:left+"."+right;
      }else if(right.length>0&&right.length<=2)normalized=left+"."+right;
      else normalized=left+right;
    }
  }
  const n=Number(normalized);
  if(!Number.isFinite(n))return 0;
  return negative?-Math.abs(n):n;
}
const norm = (v: any) => clean(v).toLowerCase().replace(/[^a-z0-9]+/g, "");
function key(row: Row, candidates: string[], fuzzy = true) {
  const keys = Object.keys(row || {});
  for (const c of candidates) { const hit = keys.find((k) => norm(k) === norm(c)); if (hit) return hit; }
  if (fuzzy) for (const k of keys) { const nk = norm(k); const hit = candidates.some((c) => nk.includes(norm(c)) || norm(c).includes(nk)); if (hit) return k; }
  return "";
}
function value(row: Row, candidates: string[], fuzzy = true) { const k = key(row, candidates, fuzzy); return k ? row[k] : ""; }
function dateValue(v: any, fallback: string) { if (!v) return fallback; const d = new Date(v); return Number.isNaN(d.getTime()) ? fallback : d.toISOString().slice(0, 10); }
const creatorCode = () => `CR-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
const money=(v:any)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const iso=(d:Date)=>d.toISOString().slice(0,10);

async function notifyTopCreators(admin:any,workspaceId:string,userId:string){
  const {data:latest}=await admin.from("sales").select("data_date").eq("workspace_id",workspaceId).not("data_date","is",null).order("data_date",{ascending:false}).limit(1).maybeSingle();
  if(!latest?.data_date)return;
  const end=new Date(`${latest.data_date}T00:00:00Z`);
  const weekStart=new Date(end);weekStart.setUTCDate(weekStart.getUTCDate()-6);
  const monthStart=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),1));
  const periods=[
    {key:"daily",label:"Hari",start:iso(end),end:iso(end)},
    {key:"weekly",label:"7 Hari",start:iso(weekStart),end:iso(end)},
    {key:"monthly",label:"Bulan",start:iso(monthStart),end:iso(end)},
  ];
  for(const period of periods){
    const {data}=await admin.rpc("get_creator_ranking",{p_workspace_id:workspaceId,p_start_date:period.start,p_end_date:period.end,p_platform:null,p_creator_id:null,p_search:null,p_page:1,p_page_size:3});
    const top=(data||[]).slice(0,3);
    if(!top.length)continue;
    const body=top.map((x:any,i:number)=>`${i+1}. ${x.creator_name||x.username||"Creator"} · ${x.platform||"-"} · ${money(x.gmv)} · ${Number(x.orders||0).toLocaleString("id-ID")} order`).join("\n");
    await admin.from("user_notifications").insert({
      user_id:userId,workspace_id:workspaceId,
      title:`🔥 Top 3 Creator On Fire · ${period.label}`,
      message:`Periode ${period.start} s.d. ${period.end}\n${body}`,
      kind:`creator_on_fire_${period.key}`,is_read:false,action_url:"#dashboard"
    });
  }
}

function detectedPlatform(rows: Row[], requested: string) {
  const headers = Object.keys(rows[0] || {}).map(norm);
  const has = (...terms:string[]) => terms.some(term => headers.some(header => header.includes(norm(term))));
  if (has("GMV dari kreator","Pesanan teratribusi","Perkiraan komisi","GMV dari LIVE kreator","GMV dari video afiliasi","Product ID","LIVE streams","Refunded GMV","Refunded items sold")) return "TikTok";
  if (has("Omzet Penjualan","Estimasi Komisi","ID Affiliates","Nama Affiliate","Affiliate ID","Affiliate Name","Affiliate Username","Sales(Rp)","Item Sold","Est.Commission(Rp)","Total Buyers","Kode Item","Nama Item","Item id","Item Name","Price(Rp)","Produk Terjual")) return "Shopee";
  return requested || "Other";
}

type PerformanceMapping = {
  creatorName:string; username:string; affiliateId:string;
  gmv:string; qty:string; orders:string; commission:string; refund:string;
  clicks:string; buyers:string; newBuyers:string; liveGmv:string; videoGmv:string; showcaseGmv:string;
  ctr:string; ctor:string; liveCount:string; videoCount:string; sampleContent:string; sampleSent:string; impressions:string; videoViews:string; refundQty:string;
};

function findHeader(row:Row,candidates:string[],exclude:string[]=[]){
  const headers=Object.keys(row||{});
  const excluded=exclude.map(norm).filter(Boolean);
  const allowed=(header:string)=>!excluded.some(token=>norm(header).includes(token));
  for(const candidate of candidates){
    const exact=headers.find(header=>allowed(header)&&norm(header)===norm(candidate));
    if(exact)return exact;
  }
  for(const candidate of candidates){
    const nc=norm(candidate);
    if(nc.length<3)continue;
    const loose=headers.find(header=>{
      if(!allowed(header))return false;
      const nh=norm(header);
      return nh.includes(nc)||nc.includes(nh);
    });
    if(loose)return loose;
  }
  return "";
}

function performanceMapping(row:Row,platform:string):PerformanceMapping{
  const common={
    creatorName:findHeader(row,["Nama Affiliate","Nama Afiliasi","Affiliate Name","Creator Name","Nama Creator","Creator","Username Affiliate","Username"]),
    username:findHeader(row,["Username Affiliate","Username","Affiliate Username","Nama Pengguna","Creator Username"]),
    affiliateId:findHeader(row,["ID Affiliates","Affiliate ID","ID Affiliate","Creator ID"]),
    gmv:findHeader(row,["GMV dari kreator","GMV Kreator","Creator GMV","Omzet Penjualan(Rp)","Omzet Penjualan","Sales(Rp)","Sales Rp","Sales","Total GMV","GMV","Total Penjualan","Nilai Penjualan","Sales Amount","Revenue"],["rate","persentase","growth"]),
    qty:findHeader(row,["Produk yang terjual dari kreator","Produk Terjual","Jumlah Produk Terjual","Unit Terjual","Item Terjual","Item Sold","Items Sold","Qty Paid","Qty","Quantity","Units Sold"]),
    orders:findHeader(row,["Pesanan teratribusi","Pesanan","Jumlah Pesanan","Total Pesanan","Attributed Orders","Orders","Order Count"],["id","rate"]),
    commission:findHeader(row,["Perkiraan komisi","Estimasi Komisi(Rp)","Estimasi Komisi","Est.Commission(Rp)","Est. Commission(Rp)","Est Commission(Rp)","Est.Commission","Estimated Commission(Rp)","Estimated Commission","Komisi Affiliate","Komisi Afiliasi","Total Komisi","Commission","Komisi"],["rate","tingkat","persentase","percentage"]),
    refund:findHeader(row,["Pengembalian dana","Refund","Refund Amount","Nilai Refund"]),
    clicks:findHeader(row,["Clicks","Klik Produk","Product Clicks","Klik"]),
    buyers:findHeader(row,["Total Pembeli","Pembeli","Buyers","Jumlah Pembeli"],["baru","new"]),
    newBuyers:findHeader(row,["Pembeli Baru","New Buyers","New Buyer"]),
    liveGmv:findHeader(row,["GMV dari LIVE kreator","GMV LIVE kreator","LIVE GMV","Live GMV"]),
    videoGmv:findHeader(row,["GMV dari video afiliasi","GMV Video Afiliasi","Video GMV"]),
    showcaseGmv:findHeader(row,["GMV dari kartu produk afiliasi","Showcase GMV","Product Card GMV"]),
    ctr:findHeader(row,["CTR","Click Through Rate"]),
    ctor:findHeader(row,["CTOR","Click To Order Rate"]),
    liveCount:findHeader(row,["Siaran LIVE","Jumlah LIVE","Live Count","LIVE"]),
    videoCount:findHeader(row,["Jumlah Video","Video Count","Video"],["gmv","view","tayangan"]),
    sampleContent:findHeader(row,["Jumlah konten sampel","Sample Content","Konten Sampel"]),
    sampleSent:findHeader(row,["Sampel terkirim","Sample Sent","Samples Sent"]),
    impressions:findHeader(row,["Impresi produk","Product Impressions","Impressions","Impresi"]),
    videoViews:findHeader(row,["Tayangan video","Video Views","Views Video"]),
    refundQty:findHeader(row,["Produk yang dikembalikan dananya","Refunded items sold","Refunded Items","Item Refund","Produk Refund"])
  };
  if(platform.toLowerCase()==="shopee"){
    common.gmv=common.gmv||findHeader(row,["Sales(Rp)","Sales Rp","Penjualan Affiliate","Penjualan Afiliasi","Sales"]);
    common.orders=common.orders||findHeader(row,["Orders","Pesanan dari Affiliate","Pesanan Afiliasi"]);
    common.qty=common.qty||findHeader(row,["Item Sold","Items Sold","Produk Terjual dari Affiliate","Produk dari Affiliate"]);
    common.commission=common.commission||findHeader(row,["Est.Commission(Rp)","Est. Commission(Rp)","Est Commission(Rp)","Estimated Commission(Rp)","Estimated Commission"]);
    common.clicks=common.clicks||findHeader(row,["Clicks"]);
    common.buyers=common.buyers||findHeader(row,["Total Buyers"]);
    common.newBuyers=common.newBuyers||findHeader(row,["New Buyers"]);
  }
  return common;
}

function mappedRaw(row:Row,keyName:string){return keyName?row[keyName]:""}

function mappingSummary(mapping:PerformanceMapping){
  return Object.fromEntries(Object.entries(mapping).filter(([,header])=>Boolean(header)));
}

type ProductPerformanceMapping={
  sku:string; productName:string; price:string; gmv:string; qty:string; orders:string; clicks:string;
  commission:string; buyers:string; newBuyers:string; samples:string; salesCreator:string; liveCount:string;
  videoCount:string; refund:string; refundQty:string; flatFee:string; roi:string;
};
function productPerformanceMapping(row:Row,platform:string):ProductPerformanceMapping{
  const common={
    sku:findHeader(row,["Kode Item","Product ID","Item ID","Kode Produk","SKU"]),
    productName:findHeader(row,["Nama Item","Item Name","Product name","Product Name","Nama Produk","Produk"]),
    price:findHeader(row,["Harga(Rp)","Harga","Price(Rp)","Price"]),
    gmv:findHeader(row,["Omzet Penjualan(Rp)","Omzet Penjualan","GMV","Sales(Rp)","Sales"]),
    qty:findHeader(row,["Produk Terjual","Items sold","Item Sold","Qty","Quantity"]),
    orders:findHeader(row,["Pesanan","Orders","Order Count"]),
    clicks:findHeader(row,["Clicks","Klik"]),
    commission:findHeader(row,["Estimasi Komisi(Rp)","Est. commission","Est.Commission(Rp)","Estimated Commission","Commission"]),
    buyers:findHeader(row,["Total Pembeli","Total Buyers","Buyers"]),
    newBuyers:findHeader(row,["Pembeli Baru","New Buyers"]),
    samples:findHeader(row,["Samples","Sampel"]),
    salesCreator:findHeader(row,["Sales creator","Sales Creator","Creator Sales"]),
    liveCount:findHeader(row,["LIVE streams","Live streams","LIVE Streams","Siaran LIVE"]),
    videoCount:findHeader(row,["Videos","Video","Jumlah Video"]),
    refund:findHeader(row,["Refunded GMV","Pengembalian dana","Refund GMV"]),
    refundQty:findHeader(row,["Refunded items sold","Refunded Items Sold","Produk yang dikembalikan dananya","Item Refund"]),
    flatFee:findHeader(row,["Est. flat fee","Estimated flat fee","Flat fee"]),
    roi:findHeader(row,["ROI"])
  };
  return common;
}
function productMappingSummary(mapping:ProductPerformanceMapping){
  return Object.fromEntries(Object.entries(mapping).filter(([,header])=>Boolean(header)));
}

function creatorKeys(row: Row) {
  const name = clean(value(row, ["Creator name","Creator Name","Nama Affiliate","Nama Afiliasi","Affiliate Name","Creator","Nama Creator","Username Affiliate","Username"]));
  const username = clean(value(row, ["Username Affiliate","Username","Affiliate Username","Creator Username","Nama Pengguna"]));
  const affiliateId = clean(value(row, ["ID Affiliates","Affiliate ID","ID Affiliate","Creator ID"]));
  return {
    name,
    username,
    affiliateId,
    keys: [
      username ? `u:${username.toLowerCase()}` : "",
      affiliateId ? `a:${affiliateId.toLowerCase()}` : "",
      name ? `n:${name.toLowerCase()}` : "",
    ].filter(Boolean),
  };
}

async function resolveCreatorIds(admin:any,workspaceId:string,rows:Row[],platform:string,importId:string){
  const {data:existing,error}=await admin.from("creators").select("id,name,username,affiliate_id").eq("workspace_id",workspaceId).ilike("platform",platform).limit(10000);
  if(error)throw error;
  const map=new Map<string,number>();
  const register=(row:any)=>{
    const id=Number(row.id);
    const keys=[
      row.username?`u:${String(row.username).toLowerCase()}`:"",
      row.affiliate_id?`a:${String(row.affiliate_id).toLowerCase()}`:"",
      row.name?`n:${String(row.name).toLowerCase()}`:"",
    ].filter(Boolean);
    for(const k of keys)map.set(k,id);
  };
  for(const row of existing||[])register(row);

  const missing=new Map<string,any>();
  for(const row of rows){
    const identity=creatorKeys(row);
    if(!identity.keys.length)continue;
    if(identity.keys.some((k)=>map.has(k)))continue;
    const canonical=identity.keys[0];
    if(!missing.has(canonical))missing.set(canonical,{
      workspace_id:workspaceId,creator_code:creatorCode(),name:identity.name||identity.username,
      username:identity.username||identity.name,platform,affiliate_id:identity.affiliateId||null,
      status:"Active",source_import_id:importId,updated_at:new Date().toISOString()
    });
  }

  const pending=[...missing.values()];
  for(let i=0;i<pending.length;i+=500){
    const part=pending.slice(i,i+500);
    const {data:created,error:createError}=await admin.from("creators").insert(part).select("id,name,username,affiliate_id");
    if(createError)throw createError;
    for(const row of created||[])register(row);
  }

  return (row:Row)=>{
    const identity=creatorKeys(row);
    for(const k of identity.keys){const id=map.get(k);if(id)return id}
    return null;
  };
}

async function ensureCreator(admin: any, workspaceId: string, row: Row, platform: string, importId: string) {
  const name = clean(value(row, ["Creator name", "Nama Affiliate", "Creator", "Nama Creator"]));
  const username = clean(value(row, ["Username Affiliate", "Username", "Affiliate Username"]));
  const affiliateId = clean(value(row, ["ID Affiliates", "Affiliate ID"]));
  if (!name && !username) return null;
  let q = admin.from("creators").select("id").eq("workspace_id", workspaceId).ilike("platform", platform).limit(1);
  if (username) q = q.ilike("username", username); else if (affiliateId) q = q.eq("affiliate_id", affiliateId); else q = q.ilike("name", name);
  const { data: existing } = await q.maybeSingle(); if (existing?.id) return existing.id;
  const { data, error } = await admin.from("creators").insert({ workspace_id:workspaceId,creator_code:creatorCode(),name:name||username,username:username||name,platform,affiliate_id:affiliateId||null,status:"Active",source_import_id:importId,updated_at:new Date().toISOString() }).select("id").single();
  if (error) throw error; return data.id;
}

export async function POST(req: NextRequest) {
  try {
    const b=await req.json(); const workspaceId=clean(b.workspace_id); const dataType=clean(b.data_type); const requestedPlatform=clean(b.platform)||"Other"; const start=clean(b.start_date); const end=clean(b.end_date); const filename=clean(b.filename)||"upload"; const fileHash=clean(b.file_hash); const importId=clean(b.import_id)||`IMP-${randomUUID().replace(/-/g,"").slice(0,8).toUpperCase()}`; const rows:Row[]=Array.isArray(b.rows)?b.rows:[]; const platform=(dataType==="performance"||dataType==="product_performance")?detectedPlatform(rows,requestedPlatform):requestedPlatform; const batchIndex=Number(b.batch_index||0); const totalBatches=Math.max(1,Number(b.total_batches||1)); const force=Boolean(b.force_reimport);
    if(!workspaceId||!dataType||!rows.length)return NextResponse.json({ok:false,error:"Workspace, jenis data, dan rows wajib diisi."},{status:400});
    const ctx=await getServerContext(workspaceId); if(!ctx.canManage)return NextResponse.json({ok:false,error:"Role Anda tidak dapat melakukan import."},{status:403}); const {admin}=ctx;
    if(batchIndex===0&&fileHash){
      const {data:dup,error:dupError}=await admin.from("imports").select("import_id,status,message").eq("workspace_id",workspaceId).eq("file_hash",fileHash);
      if(dupError)throw dupError;
      const prior=(dup||[]) as any[];
      const oldParser=prior.some(item=>{try{return JSON.parse(item.message||"{}").parser_version!==PARSER_VERSION}catch{return true}});
      if(prior.length&&!force&&!oldParser){
        const states=[...new Set(prior.map((x:any)=>x.status).filter(Boolean))].join(", ");
        return NextResponse.json({ok:false,error:`File identik sudah pernah diproses${states?" ("+states+")":""}. Aktifkan Re-import jika memang ingin mengganti data.`},{status:409});
      }
      if(prior.length&&(force||oldParser)){
        const old=prior.map((x:any)=>x.import_id).filter(Boolean);
        if(old.length){
          await admin.from("sales").delete().eq("workspace_id",workspaceId).in("import_id",old);
          await admin.from("imports").delete().eq("workspace_id",workspaceId).in("import_id",old);
        }
      }
    }
    let inserted=0,updated=0,skipped=0,duplicates=0;

    if(batchIndex===0&&(dataType==="performance"||dataType==="product_performance")){
      // Affiliate Performance is a period snapshot. Keep exactly one snapshot
      // per workspace + platform + period, regardless of filename/hash.
      let cleanup=admin.from("sales").delete()
        .eq("workspace_id",workspaceId)
        .eq("data_type",dataType)
        .ilike("platform",platform);
      if(start)cleanup=cleanup.eq("data_date",start);
      if(end)cleanup=cleanup.eq("end_date",end);
      const {error:cleanupError}=await cleanup;
      if(cleanupError)throw cleanupError;

      let supersede=admin.from("imports").update({
        status:"Superseded",
        message:JSON.stringify({parser_version:PARSER_VERSION,note:"Replaced by a newer upload for the same platform and period."})
      })
        .eq("workspace_id",workspaceId)
        .eq("data_type","performance")
        .ilike("platform",platform);
      if(start)supersede=supersede.eq("start_date",start);
      if(end)supersede=supersede.eq("end_date",end);
      const {error:supersedeError}=await supersede.neq("import_id",importId);
      if(supersedeError)throw supersedeError;
    }

    if(dataType==="creators"){
      for(const row of rows){const name=clean(value(row,["Nama Affiliate","Creator Name","Creator"]));const username=clean(value(row,["Username Affiliate","Username"]));if(!name&&!username){skipped++;continue}const p=clean(value(row,["Platform"],false))||platform;let q=admin.from("creators").select("id,creator_code").eq("workspace_id",workspaceId).eq("platform",p).limit(1);q=username?q.ilike("username",username):q.ilike("name",name);const {data:ex}=await q.maybeSingle();const payload={workspace_id:workspaceId,creator_code:clean(value(row,["Creator Code"],false))||ex?.creator_code||creatorCode(),name:name||username,username:username||name,platform:p,affiliate_id:clean(value(row,["ID Affiliates","Affiliate ID"]))||null,phone:clean(value(row,["Phone","No HP","WhatsApp"]))||null,address:clean(value(row,["Address","Alamat"]))||null,payment_type:clean(value(row,["Payment/Barter","Payment Type"]))||null,ratecard:moneyNum(value(row,["Ratecard"])),profile_url:clean(value(row,["Profile URL","Social Media","Profile Link"]))||null,status:clean(value(row,["Status"]))||"Active",notes:clean(value(row,["Notes","Note","Catatan"]))||null,source_import_id:importId,updated_at:new Date().toISOString()};if(ex?.id){const {error}=await admin.from("creators").update(payload).eq("id",ex.id);if(error)throw error;updated++}else{const {error}=await admin.from("creators").insert(payload);if(error)throw error;inserted++}}
    }else if(dataType==="products"){
      for(const row of rows){const sku=clean(value(row,["SKU","Kode SKU"],false));if(!sku){skipped++;continue}const skuNorm=sku.toLowerCase();const payload={workspace_id:workspaceId,sku,sku_normalized:skuNorm,product_name:clean(value(row,["Product Name","Nama Produk"]))||sku,category:clean(value(row,["Category","Kategori"]))||null,selling_price:moneyNum(value(row,["Selling Price","Harga Jual"])),cost_price:moneyNum(value(row,["Cost Price","HPP"])),point_per_unit:num(value(row,["Point per Unit","Point"])),status:clean(value(row,["Status"]))||"Active",source_import_id:importId,updated_at:new Date().toISOString()};const {data:ex}=await admin.from("product_master").select("id").eq("workspace_id",workspaceId).eq("sku_normalized",skuNorm).maybeSingle();if(ex?.id){const {error}=await admin.from("product_master").update(payload).eq("id",ex.id);if(error)throw error;updated++}else{const {error}=await admin.from("product_master").insert(payload);if(error)throw error;inserted++}}
    }else if(dataType==="creator_samples"){
      const payloads=rows.map(row=>({workspace_id:workspaceId,creator_id:countNum(value(row,["creator_id","Creator ID"]))||null,creator_name:clean(value(row,["creator_name","Creator Name"]))||null,platform:clean(value(row,["platform","Platform"]))||platform,sku:clean(value(row,["sku","SKU"]))||null,product_name:clean(value(row,["product_name","Product Name"]))||null,sample_status:clean(value(row,["sample_status","Sample Status"]))||"sent",sent_date:clean(value(row,["sent_date","Sent Date"]))||null,return_date:clean(value(row,["return_date","Return Date"]))||null,qty:countNum(value(row,["qty","Qty"]))||1,product_value:moneyNum(value(row,["product_value","Product Value"])),tracking:clean(value(row,["tracking","Tracking"]))||null,notes:clean(value(row,["notes","Notes"]))||null,source:"upload",source_import_id:importId,updated_at:new Date().toISOString()})).filter(x=>x.creator_id||x.creator_name);if(payloads.length){const {error}=await admin.from("creator_samples").insert(payloads);if(error)throw error;inserted+=payloads.length}skipped+=rows.length-payloads.length;
    }else if(dataType==="shipping"){
      const payloads=rows.map(row=>{
        const rawDate=clean(value(row,["data_date","Data Date","Date","Tanggal","Tanggal Kirim","Shipping Date"]));
        return {
          workspace_id:workspaceId,
          data_date:rawDate?(dateValue(rawDate,"")||null):null,
          creator_id:countNum(value(row,["creator_id","Creator ID"]))||null,
          creator_name:clean(value(row,["creator_name","Creator Name","Nama Creator","Nama Affiliate","Creator"]))||null,
          platform:clean(value(row,["platform","Platform"]))||platform,
          product_master_id:countNum(value(row,["product_master_id","Product Master ID"]))||null,
          sku:clean(value(row,["sku","SKU","Kode SKU"]))||null,
          product_name:clean(value(row,["product_name","Product Name","Nama Produk","Produk"]))||null,
          qty:countNum(value(row,["qty","Qty","Quantity","Jumlah"]))||0,
          product_cost:moneyNum(value(row,["product_cost","Product Cost","HPP","Harga Modal"])),
          shipping_cost:moneyNum(value(row,["shipping_cost","Shipping Cost","Ongkir","Biaya Ongkir"])),
          courier:clean(value(row,["courier","Courier","Kurir","Ekspedisi"]))||null,
          tracking:clean(value(row,["tracking","Tracking","Resi","Nomor Resi","No Resi"]))||null,
          status:clean(value(row,["status","Status","Shipping Status"]))||"Pending",
          updated_at:new Date().toISOString(),
        };
      }).filter(x=>x.creator_id||x.creator_name||x.tracking||x.sku||x.product_name);
      if(payloads.length){const {error}=await admin.from("shipping").insert(payloads);if(error)throw error;inserted+=payloads.length}
      skipped+=rows.length-payloads.length;
    }else if(dataType==="product_hpp"){
      for(const row of rows){
        const sku=clean(value(row,["sku","SKU","Kode SKU"]));
        if(!sku){skipped++;continue}
        const period=clean(value(row,["period","Period","Periode"]))||"MASTER";
        const productName=clean(value(row,["product_name","Product Name","Nama Produk"]))||null;
        const hpp=moneyNum(value(row,["hpp","HPP","Cost Price","Harga Modal"]));
        const sellingRaw=value(row,["selling_price","Selling Price","Harga Jual"]);
        const sellingPrice=moneyNum(sellingRaw);
        const now=new Date().toISOString();
        const payload={workspace_id:workspaceId,sku,period,product_id:num(value(row,["product_id","Product ID","Item ID"]))||null,product_name:productName,hpp,selling_price:sellingPrice,notes:clean(value(row,["notes","Notes","Catatan"]))||null,source_import_id:importId,updated_at:now};
        const {data:ex}=await admin.from("product_hpp_history").select("id").eq("workspace_id",workspaceId).eq("sku",sku).eq("period",period).maybeSingle();
        if(ex?.id){
          const {error}=await admin.from("product_hpp_history").update(payload).eq("id",ex.id);
          if(error)throw error;
          updated++;
        }else{
          const {error}=await admin.from("product_hpp_history").insert(payload);
          if(error)throw error;
          inserted++;
        }

        const skuNorm=sku.toLowerCase();
        const {data:master,error:masterFindError}=await admin.from("product_master")
          .select("id,product_name,selling_price")
          .eq("workspace_id",workspaceId)
          .eq("sku_normalized",skuNorm)
          .maybeSingle();
        if(masterFindError)throw masterFindError;
        if(master?.id){
          const masterPatch:Row={cost_price:hpp,source_import_id:importId,updated_at:now};
          if(productName)masterPatch.product_name=productName;
          if(clean(sellingRaw))masterPatch.selling_price=sellingPrice;
          const {error:masterError}=await admin.from("product_master").update(masterPatch).eq("id",master.id);
          if(masterError)throw masterError;
        }else{
          const {error:masterError}=await admin.from("product_master").insert({
            workspace_id:workspaceId,sku,sku_normalized:skuNorm,product_name:productName||sku,
            selling_price:clean(sellingRaw)?sellingPrice:0,cost_price:hpp,point_per_unit:0,
            status:"Active",source_import_id:importId,updated_at:now
          });
          if(masterError)throw masterError;
        }
      }
    }else if(dataType==="product_performance"){
      const mapping=productPerformanceMapping(rows[0]||{},platform);
      if(!mapping.sku||!mapping.productName||!mapping.gmv){
        return NextResponse.json({ok:false,error:"Format Product Performance belum dikenali. Kode Item/Product ID, Nama Produk, dan GMV/Omzet wajib tersedia.",detected_platform:platform,headers:Object.keys(rows[0]||{}),mapping:productMappingSummary(mapping)},{status:422});
      }
      const styles={
        price:inferMoneyStyle(rows,mapping.price),gmv:inferMoneyStyle(rows,mapping.gmv),
        commission:inferMoneyStyle(rows,mapping.commission),refund:inferMoneyStyle(rows,mapping.refund),
        flatFee:inferMoneyStyle(rows,mapping.flatFee)
      };
      const payloads:Row[]=[];
      const productMasterPayloads:Row[]=[];
      for(let i=0;i<rows.length;i++){
        const row=rows[i];
        const sku=clean(mappedRaw(row,mapping.sku));
        const productName=clean(mappedRaw(row,mapping.productName));
        if(!sku&&!productName){skipped++;continue}
        const keySku=sku||`product-${norm(productName)}`;
        const gmv=moneyValue(mappedRaw(row,mapping.gmv),styles.gmv);
        const qty=countNum(mappedRaw(row,mapping.qty));
        const orders=countNum(mappedRaw(row,mapping.orders));
        const commission=moneyValue(mappedRaw(row,mapping.commission),styles.commission);
        const refund=moneyValue(mappedRaw(row,mapping.refund),styles.refund);
        const refundQty=countNum(mappedRaw(row,mapping.refundQty));
        const clicks=countNum(mappedRaw(row,mapping.clicks));
        const buyers=countNum(mappedRaw(row,mapping.buyers));
        const newBuyers=countNum(mappedRaw(row,mapping.newBuyers));
        const sampleSent=countNum(mappedRaw(row,mapping.samples));
        const salesCreator=countNum(mappedRaw(row,mapping.salesCreator));
        const liveCount=countNum(mappedRaw(row,mapping.liveCount));
        const videoCount=countNum(mappedRaw(row,mapping.videoCount));
        const flatFee=moneyValue(mappedRaw(row,mapping.flatFee),styles.flatFee);
        const roi=num(mappedRaw(row,mapping.roi),"decimal");
        const sellingPrice=moneyValue(mappedRaw(row,mapping.price),styles.price);
        const dataDate=start||null;
        const recordKey=`product_performance|${workspaceId}|${platform}|${start||"all"}|${end||start||"all"}|${keySku.toLowerCase()}`;
        payloads.push({workspace_id:workspaceId,record_key:recordKey,data_type:"product_performance",data_date:dataDate,end_date:end||dataDate,creator_id:null,creator_name:null,username:null,platform,channel:"Product Performance",sku:keySku,product_name:productName||keySku,qty,orders,gmv,refund,refund_qty:refundQty,commission,clicks,buyers,new_buyers:newBuyers,live_count:liveCount,video_count:videoCount,sample_sent:sampleSent,sales_creator:salesCreator,flat_fee:flatFee,roi,source_file:filename,imported_at:new Date().toISOString(),import_id:importId,updated_at:new Date().toISOString()});
        const skuNorm=keySku.toLowerCase();
        productMasterPayloads.push({workspace_id:workspaceId,sku:keySku,sku_normalized:skuNorm,product_name:productName||keySku,selling_price:sellingPrice,status:"Active",source_import_id:importId,updated_at:new Date().toISOString()});
      }
      const byKey=new Map<string,Row>();for(const payload of payloads){if(byKey.has(payload.record_key))duplicates++;byKey.set(payload.record_key,payload)}
      const deduped=[...byKey.values()];
      const productsBySku=new Map<string,Row>();for(const payload of productMasterPayloads)productsBySku.set(String(payload.sku_normalized),payload);
      const productRows=[...productsBySku.values()];
      for(let i=0;i<productRows.length;i+=500){
        const part=productRows.slice(i,i+500);
        const {error:productError}=await admin.from("product_master").upsert(part,{onConflict:"workspace_id,sku_normalized"});
        if(productError)throw productError;
      }
      if(deduped.length){const {data:saved,error}=await admin.from("sales").upsert(deduped,{onConflict:"record_key"}).select("id");if(error)throw error;inserted+=saved?.length||deduped.length}
    }else if(dataType==="performance"||dataType==="sales"){
      const payloads:Row[]=[];
      const perfMap=dataType==="performance"?performanceMapping(rows[0]||{},platform):null;
      if(dataType==="performance"&&perfMap){
        const creatorMapped=Boolean(perfMap.creatorName||perfMap.username||perfMap.affiliateId);
        const metricMapped=Boolean(perfMap.gmv||perfMap.qty||perfMap.orders||perfMap.commission);
        if(!creatorMapped||!metricMapped){
          return NextResponse.json({
            ok:false,
            error:"Format Affiliate Performance belum dikenali. Minimal kolom creator dan salah satu GMV/Qty/Orders/Commission harus tersedia.",
            detected_platform:platform,
            headers:Object.keys(rows[0]||{}),
            mapping:mappingSummary(perfMap)
          },{status:422});
        }
      }
      const moneyStyles=perfMap?{
        gmv:inferMoneyStyle(rows,perfMap.gmv),commission:inferMoneyStyle(rows,perfMap.commission),
        refund:inferMoneyStyle(rows,perfMap.refund),liveGmv:inferMoneyStyle(rows,perfMap.liveGmv),
        videoGmv:inferMoneyStyle(rows,perfMap.videoGmv),showcaseGmv:inferMoneyStyle(rows,perfMap.showcaseGmv)
      }:null;
      const resolveCreator=await resolveCreatorIds(admin,workspaceId,rows,platform,importId);
      for(let i=0;i<rows.length;i++){
        const row=rows[i];const creatorId=resolveCreator(row);if(!creatorId){skipped++;continue}
        const creatorName=dataType==="performance"&&perfMap
          ? clean(mappedRaw(row,perfMap.creatorName))||clean(mappedRaw(row,perfMap.username))
          : clean(value(row,["Creator name","Nama Affiliate","Creator","Nama Creator"]))||clean(value(row,["Username Affiliate","Username"]));
        const username=dataType==="performance"&&perfMap
          ? clean(mappedRaw(row,perfMap.username))||creatorName
          : clean(value(row,["Username Affiliate","Username"]))||creatorName;
        let gmv=0,qty=0,orders=0,commission=0,refund=0,refundQty=0,clicks=0,buyers=0,newBuyers=0,liveGmv=0,videoGmv=0,showcaseGmv=0,ctr=0,ctor=0,liveCount=0,videoCount=0,sampleContent=0,sampleSent=0,impressions=0,videoViews=0;
        if(dataType==="performance"&&perfMap&&moneyStyles){
          gmv=moneyValue(mappedRaw(row,perfMap.gmv),moneyStyles.gmv);
          qty=countNum(mappedRaw(row,perfMap.qty));
          orders=countNum(mappedRaw(row,perfMap.orders));
          commission=moneyValue(mappedRaw(row,perfMap.commission),moneyStyles.commission);
          refund=moneyValue(mappedRaw(row,perfMap.refund),moneyStyles.refund);
          clicks=countNum(mappedRaw(row,perfMap.clicks));
          buyers=countNum(mappedRaw(row,perfMap.buyers));
          newBuyers=countNum(mappedRaw(row,perfMap.newBuyers));
          liveGmv=moneyValue(mappedRaw(row,perfMap.liveGmv),moneyStyles.liveGmv);
          videoGmv=moneyValue(mappedRaw(row,perfMap.videoGmv),moneyStyles.videoGmv);
          showcaseGmv=moneyValue(mappedRaw(row,perfMap.showcaseGmv),moneyStyles.showcaseGmv);
          ctr=percentNum(mappedRaw(row,perfMap.ctr));
          ctor=percentNum(mappedRaw(row,perfMap.ctor));
          liveCount=countNum(mappedRaw(row,perfMap.liveCount));
          videoCount=countNum(mappedRaw(row,perfMap.videoCount));
          sampleContent=countNum(mappedRaw(row,perfMap.sampleContent));
          sampleSent=countNum(mappedRaw(row,perfMap.sampleSent));
          impressions=countNum(mappedRaw(row,perfMap.impressions));
          videoViews=countNum(mappedRaw(row,perfMap.videoViews));
          refundQty=countNum(mappedRaw(row,perfMap.refundQty));
        }else{
          gmv=moneyNum(value(row,["GMV","Omzet Penjualan(Rp)","Omzet Penjualan"]));
          qty=countNum(value(row,["Qty Paid","Quantity","Qty","Produk Terjual"]));
          orders=countNum(value(row,["Orders","Order","Pesanan"]));
          commission=moneyNum(value(row,["Commission","Estimasi Komisi(Rp)","Perkiraan Komisi","Komisi"]));
          refund=moneyNum(value(row,["Refund","Pengembalian dana"]));
          clicks=countNum(value(row,["Clicks","Klik"]));
          buyers=countNum(value(row,["Buyers","Pembeli","Total Pembeli"]));
          newBuyers=countNum(value(row,["New Buyers","Pembeli Baru"]));
          liveCount=countNum(value(row,["Siaran LIVE","Live Count"]));
          videoCount=countNum(value(row,["Video","Video Count"]));
        }
        const orderId=clean(value(row,["Order ID","OrderID","ID Pesanan"]));const itemId=clean(value(row,["Item ID","ItemID","ID Item"]));const tx=clean(value(row,["Transaction ID","TransactionID","ID Transaksi"]));const sku=dataType==="sales"?clean(value(row,["SKU","Kode SKU"],false)):"";const product=dataType==="sales"?clean(value(row,["Product Name","Nama Produk","Produk"],false)):"";const dataDate=dataType==="sales"?dateValue(value(row,["Transaction Date","Tanggal Transaksi","Tanggal","Date","Data Date"]),start):start;const unique=dataType==="performance"?`creator:${creatorId}|start:${start||"all"}|end:${end||start||"all"}`:tx||[orderId,itemId].filter(Boolean).join("|")||`${fileHash||importId}|${batchIndex}-${i}`;
        const storeName=clean(value(row,["Store Name","Shop Name","Nama Toko","Toko","Seller Name","Store","Shop"],false));const storeId=clean(value(row,["Store ID","Shop ID","Seller ID","ID Toko"],false));const costProduct=moneyNum(value(row,["HPP","Cost Product","Product Cost","Harga Modal"],false));const shippingCost=moneyNum(value(row,["Shipping Cost","Ongkir","Biaya Ongkir"],false));const adsSpend=moneyNum(value(row,["Ads Spend","Ad Spend","Biaya Ads","Iklan"],false));const points=num(value(row,["Points","Point","Poin"],false));
        payloads.push({workspace_id:workspaceId,record_key:`${dataType}|${workspaceId}|${platform}|${unique}`,data_type:dataType,transaction_id:tx||null,order_id:orderId||null,item_id:itemId||null,data_date:dataDate||null,end_date:end||dataDate||null,creator_id:creatorId,creator_name:creatorName,username,platform,channel:dataType==="performance"?"Affiliate Performance":clean(value(row,["Channel","Saluran"]))||"Affiliate",store_name:storeName||null,store_id:storeId||null,sku:sku||null,product_name:product||null,category:dataType==="sales"?clean(value(row,["Category","Kategori"],false))||null:null,qty,orders:orders||(orderId?1:0),gmv,refund,refund_qty:refundQty,commission,cost_product:costProduct,shipping_cost:shippingCost,ads_spend:adsSpend,points,clicks,buyers,new_buyers:newBuyers,live_gmv:liveGmv,video_gmv:videoGmv,showcase_gmv:showcaseGmv,ctr,ctor,live_count:liveCount,video_count:videoCount,sample_content:sampleContent,sample_sent:sampleSent,impressions,video_views:videoViews,source_file:filename,imported_at:new Date().toISOString(),import_id:importId,updated_at:new Date().toISOString()});
      }
      if(payloads.length){
        const byKey=new Map<string,Row>();
        for(const payload of payloads){
          const key=String(payload.record_key||"");
          if(byKey.has(key))duplicates++;
          byKey.set(key,payload);
        }
        const deduped=[...byKey.values()];
        const {data:saved,error}=await admin.from("sales").upsert(deduped,{onConflict:"record_key"}).select("id");
        if(error)throw error;
        inserted+=saved?.length||deduped.length;
      }
    }else return NextResponse.json({ok:false,error:"Jenis Data tidak valid."},{status:400});

    const {data:existing}=await admin.from("imports").select("id,rows_imported,message").eq("workspace_id",workspaceId).eq("import_id",importId).maybeSingle();
    let prev:any={};try{prev=JSON.parse(existing?.message||"{}")}catch{}
    const stats={detected:Number(prev.detected||0)+rows.length,inserted:Number(prev.inserted||0)+inserted,updated:Number(prev.updated||0)+updated,skipped:Number(prev.skipped||0)+skipped,duplicates:Number(prev.duplicates||0)+duplicates,errors:Number(prev.errors||0)};
    const currentMapping=dataType==="performance"?mappingSummary(performanceMapping(rows[0]||{},platform)):dataType==="product_performance"?productMappingSummary(productPerformanceMapping(rows[0]||{},platform)):undefined;
    const message={...stats,parser_version:PARSER_VERSION,mapping:currentMapping||prev.mapping||null};
    const meta={workspace_id:workspaceId,import_id:importId,filename,data_type:dataType,platform,start_date:start||null,end_date:end||null,rows_imported:Number(existing?.rows_imported||0)+inserted+updated,status:batchIndex+1>=totalBatches?"Success":"Processing",imported_at:new Date().toISOString(),message:JSON.stringify(message),file_hash:fileHash||null};
    if(existing?.id){const {error}=await admin.from("imports").update(meta).eq("id",existing.id);if(error)throw error}else{const {error}=await admin.from("imports").insert(meta);if(error)throw error}
    const complete=batchIndex+1>=totalBatches;
    let persistedRows:number|null=null;
    if(complete&&(dataType==="performance"||dataType==="sales"||dataType==="product_performance")){
      const {count,error:countError}=await admin.from("sales").select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).eq("import_id",importId);
      if(countError)throw countError;
      persistedRows=Number(count||0);
      if(persistedRows<=0)throw new Error("Import selesai diproses tetapi tidak ada row yang tersimpan ke database.");
      await notifyTopCreators(admin,workspaceId,ctx.user.id).catch(()=>undefined);
    }
    return NextResponse.json({ok:true,import_id:importId,stats,complete,persisted_rows:persistedRows,detected_platform:platform,parser_version:PARSER_VERSION,mapping:dataType==="performance"?mappingSummary(performanceMapping(rows[0]||{},platform)):dataType==="product_performance"?productMappingSummary(productPerformanceMapping(rows[0]||{},platform)):null});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Import failed."},{status:400})}
}
