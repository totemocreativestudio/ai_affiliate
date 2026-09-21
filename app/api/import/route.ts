import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../lib/server-auth";

export const runtime = "nodejs";
type Row = Record<string, any>;

const clean = (v: any) => (v === null || v === undefined ? "" : String(v).trim());
function num(v: any) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = clean(v)
    .replace(/\u00a0/g, "")
    .replace(/Rp|IDR|USD/gi, "")
    .replace(/%/g, "")
    .replace(/\s+/g, "")
    .replace(/[^0-9,().+\-]/g, "");
  if (!s) return 0;

  const negative = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "");
  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    // Whichever separator appears last is the decimal separator.
    if (comma > dot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (comma >= 0) {
    const parts = s.split(",");
    if (parts.length > 2 && parts.slice(1).every((part) => part.length === 3)) s = parts.join("");
    else if (parts.length === 2) {
      const [left, right] = parts;
      if (right.length === 3 && left.replace(/^[+\-]/, "").length <= 3) s = left + right;
      else if (right.length <= 2) s = left + "." + right;
      else s = left + right;
    } else s = s.replace(/,/g, "");
  } else if (dot >= 0) {
    const parts = s.split(".");
    if (parts.length > 2 && parts.slice(1).every((part) => part.length === 3)) s = parts.join("");
    else if (parts.length === 2) {
      const [left, right] = parts;
      // Indonesian formatted amounts such as 130.000 / 1.300 are thousands,
      // while API/CSV decimals such as 481641.6 or 367350.325 remain decimals.
      if (right.length === 3 && left.replace(/^[+\-]/, "").length <= 3) s = left + right;
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : 0;
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
  if (headers.includes(norm("GMV dari kreator")) || headers.includes(norm("Pesanan teratribusi")) || headers.includes(norm("Perkiraan komisi"))) return "TikTok";
  if (headers.includes(norm("Omzet Penjualan(Rp)")) || headers.includes(norm("Estimasi Komisi(Rp)")) || headers.includes(norm("ID Affiliates"))) return "Shopee";
  return requested || "Other";
}

function creatorKeys(row: Row) {
  const name = clean(value(row, ["Creator name", "Nama Affiliate", "Creator", "Nama Creator"]));
  const username = clean(value(row, ["Username Affiliate", "Username", "Affiliate Username"]));
  const affiliateId = clean(value(row, ["ID Affiliates", "Affiliate ID"]));
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
  const {data:existing,error}=await admin.from("creators").select("id,name,username,affiliate_id").eq("workspace_id",workspaceId).eq("platform",platform).limit(10000);
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
  let q = admin.from("creators").select("id").eq("workspace_id", workspaceId).eq("platform", platform).limit(1);
  if (username) q = q.ilike("username", username); else if (affiliateId) q = q.eq("affiliate_id", affiliateId); else q = q.ilike("name", name);
  const { data: existing } = await q.maybeSingle(); if (existing?.id) return existing.id;
  const { data, error } = await admin.from("creators").insert({ workspace_id:workspaceId,creator_code:creatorCode(),name:name||username,username:username||name,platform,affiliate_id:affiliateId||null,status:"Active",source_import_id:importId,updated_at:new Date().toISOString() }).select("id").single();
  if (error) throw error; return data.id;
}

export async function POST(req: NextRequest) {
  try {
    const b=await req.json(); const workspaceId=clean(b.workspace_id); const dataType=clean(b.data_type); const requestedPlatform=clean(b.platform)||"Other"; const start=clean(b.start_date); const end=clean(b.end_date); const filename=clean(b.filename)||"upload"; const fileHash=clean(b.file_hash); const importId=clean(b.import_id)||`IMP-${randomUUID().replace(/-/g,"").slice(0,8).toUpperCase()}`; const rows:Row[]=Array.isArray(b.rows)?b.rows:[]; const platform=dataType==="performance"?detectedPlatform(rows,requestedPlatform):requestedPlatform; const batchIndex=Number(b.batch_index||0); const totalBatches=Math.max(1,Number(b.total_batches||1)); const force=Boolean(b.force_reimport);
    if(!workspaceId||!dataType||!rows.length)return NextResponse.json({ok:false,error:"Workspace, jenis data, dan rows wajib diisi."},{status:400});
    const ctx=await getServerContext(workspaceId); if(!ctx.canManage)return NextResponse.json({ok:false,error:"Role Anda tidak dapat melakukan import."},{status:403}); const {admin}=ctx;
    if(batchIndex===0&&fileHash){const {data:dup,error:dupError}=await admin.from("imports").select("import_id,status").eq("workspace_id",workspaceId).eq("file_hash",fileHash);if(dupError)throw dupError;if((dup||[]).length&&!force){const states=[...new Set((dup||[]).map((x:any)=>x.status).filter(Boolean))].join(", ");return NextResponse.json({ok:false,error:`File identik sudah pernah diproses${states?" ("+states+")":""}. Aktifkan Re-import untuk membersihkan import lama/parsial lalu impor ulang.`},{status:409})}if((dup||[]).length&&force){const old=(dup||[]).map((x:any)=>x.import_id).filter(Boolean);if(old.length){await admin.from("sales").delete().eq("workspace_id",workspaceId).in("import_id",old);await admin.from("imports").delete().eq("workspace_id",workspaceId).in("import_id",old)}}}
    let inserted=0,updated=0,skipped=0;

    if(dataType==="creators"){
      for(const row of rows){const name=clean(value(row,["Nama Affiliate","Creator Name","Creator"]));const username=clean(value(row,["Username Affiliate","Username"]));if(!name&&!username){skipped++;continue}const p=clean(value(row,["Platform"],false))||platform;let q=admin.from("creators").select("id,creator_code").eq("workspace_id",workspaceId).eq("platform",p).limit(1);q=username?q.ilike("username",username):q.ilike("name",name);const {data:ex}=await q.maybeSingle();const payload={workspace_id:workspaceId,creator_code:clean(value(row,["Creator Code"],false))||ex?.creator_code||creatorCode(),name:name||username,username:username||name,platform:p,affiliate_id:clean(value(row,["ID Affiliates","Affiliate ID"]))||null,phone:clean(value(row,["Phone","No HP","WhatsApp"]))||null,address:clean(value(row,["Address","Alamat"]))||null,payment_type:clean(value(row,["Payment/Barter","Payment Type"]))||null,ratecard:num(value(row,["Ratecard"])),profile_url:clean(value(row,["Profile URL","Social Media","Profile Link"]))||null,status:clean(value(row,["Status"]))||"Active",notes:clean(value(row,["Notes","Note","Catatan"]))||null,source_import_id:importId,updated_at:new Date().toISOString()};if(ex?.id){const {error}=await admin.from("creators").update(payload).eq("id",ex.id);if(error)throw error;updated++}else{const {error}=await admin.from("creators").insert(payload);if(error)throw error;inserted++}}
    }else if(dataType==="products"){
      for(const row of rows){const sku=clean(value(row,["SKU","Kode SKU"],false));if(!sku){skipped++;continue}const skuNorm=sku.toLowerCase();const payload={workspace_id:workspaceId,sku,sku_normalized:skuNorm,product_name:clean(value(row,["Product Name","Nama Produk"]))||sku,category:clean(value(row,["Category","Kategori"]))||null,selling_price:num(value(row,["Selling Price","Harga Jual"])),cost_price:num(value(row,["Cost Price","HPP"])),point_per_unit:num(value(row,["Point per Unit","Point"])),status:clean(value(row,["Status"]))||"Active",source_import_id:importId,updated_at:new Date().toISOString()};const {data:ex}=await admin.from("product_master").select("id").eq("workspace_id",workspaceId).eq("sku_normalized",skuNorm).maybeSingle();if(ex?.id){const {error}=await admin.from("product_master").update(payload).eq("id",ex.id);if(error)throw error;updated++}else{const {error}=await admin.from("product_master").insert(payload);if(error)throw error;inserted++}}
    }else if(dataType==="creator_samples"){
      const payloads=rows.map(row=>({workspace_id:workspaceId,creator_id:num(value(row,["creator_id","Creator ID"]))||null,creator_name:clean(value(row,["creator_name","Creator Name"]))||null,platform:clean(value(row,["platform","Platform"]))||platform,sku:clean(value(row,["sku","SKU"]))||null,product_name:clean(value(row,["product_name","Product Name"]))||null,sample_status:clean(value(row,["sample_status","Sample Status"]))||"sent",sent_date:clean(value(row,["sent_date","Sent Date"]))||null,return_date:clean(value(row,["return_date","Return Date"]))||null,qty:num(value(row,["qty","Qty"]))||1,product_value:num(value(row,["product_value","Product Value"])),tracking:clean(value(row,["tracking","Tracking"]))||null,notes:clean(value(row,["notes","Notes"]))||null,source:"upload",source_import_id:importId,updated_at:new Date().toISOString()})).filter(x=>x.creator_id||x.creator_name);if(payloads.length){const {error}=await admin.from("creator_samples").insert(payloads);if(error)throw error;inserted+=payloads.length}skipped+=rows.length-payloads.length;
    }else if(dataType==="shipping"){
      const payloads=rows.map(row=>{
        const rawDate=clean(value(row,["data_date","Data Date","Date","Tanggal","Tanggal Kirim","Shipping Date"]));
        return {
          workspace_id:workspaceId,
          data_date:rawDate?(dateValue(rawDate,"")||null):null,
          creator_id:num(value(row,["creator_id","Creator ID"]))||null,
          creator_name:clean(value(row,["creator_name","Creator Name","Nama Creator","Nama Affiliate","Creator"]))||null,
          platform:clean(value(row,["platform","Platform"]))||platform,
          product_master_id:num(value(row,["product_master_id","Product Master ID"]))||null,
          sku:clean(value(row,["sku","SKU","Kode SKU"]))||null,
          product_name:clean(value(row,["product_name","Product Name","Nama Produk","Produk"]))||null,
          qty:num(value(row,["qty","Qty","Quantity","Jumlah"]))||0,
          product_cost:num(value(row,["product_cost","Product Cost","HPP","Harga Modal"])),
          shipping_cost:num(value(row,["shipping_cost","Shipping Cost","Ongkir","Biaya Ongkir"])),
          courier:clean(value(row,["courier","Courier","Kurir","Ekspedisi"]))||null,
          tracking:clean(value(row,["tracking","Tracking","Resi","Nomor Resi","No Resi"]))||null,
          status:clean(value(row,["status","Status","Shipping Status"]))||"Pending",
          updated_at:new Date().toISOString(),
        };
      }).filter(x=>x.creator_id||x.creator_name||x.tracking||x.sku||x.product_name);
      if(payloads.length){const {error}=await admin.from("shipping").insert(payloads);if(error)throw error;inserted+=payloads.length}
      skipped+=rows.length-payloads.length;
    }else if(dataType==="product_hpp"){
      for(const row of rows){const sku=clean(value(row,["sku","SKU"]));const period=clean(value(row,["period","Period"]));if(!sku||!period){skipped++;continue}const payload={workspace_id:workspaceId,sku,period,product_id:num(value(row,["product_id","Product ID"]))||null,product_name:clean(value(row,["product_name","Product Name"]))||null,hpp:num(value(row,["hpp","HPP"])),selling_price:num(value(row,["selling_price","Selling Price"])),notes:clean(value(row,["notes","Notes"]))||null,source_import_id:importId,updated_at:new Date().toISOString()};const {data:ex}=await admin.from("product_hpp_history").select("id").eq("workspace_id",workspaceId).eq("sku",sku).eq("period",period).maybeSingle();if(ex?.id){const {error}=await admin.from("product_hpp_history").update(payload).eq("id",ex.id);if(error)throw error;updated++}else{const {error}=await admin.from("product_hpp_history").insert(payload);if(error)throw error;inserted++}}
    }else if(dataType==="performance"||dataType==="sales"){
      const payloads:Row[]=[];
      const resolveCreator=await resolveCreatorIds(admin,workspaceId,rows,platform,importId);
      for(let i=0;i<rows.length;i++){
        const row=rows[i];const creatorId=resolveCreator(row);if(!creatorId){skipped++;continue}const creatorName=clean(value(row,["Creator name","Nama Affiliate","Creator","Nama Creator"]))||clean(value(row,["Username Affiliate","Username"]));const username=clean(value(row,["Username Affiliate","Username"]))||creatorName;
        let gmv=0,qty=0,orders=0,commission=0,refund=0,clicks=0,buyers=0,newBuyers=0,liveGmv=0,videoGmv=0,showcaseGmv=0,ctr=0,ctor=0,liveCount=0,videoCount=0,sampleContent=0,sampleSent=0,impressions=0,videoViews=0;
        if(dataType==="performance"&&platform.toLowerCase()==="tiktok"){
          gmv=num(value(row,["GMV dari kreator"],false));qty=num(value(row,["Produk yang terjual dari kreator"],false));orders=num(value(row,["Pesanan teratribusi"],false));commission=num(value(row,["Perkiraan komisi"],false));refund=num(value(row,["Pengembalian dana"],false));buyers=num(value(row,["Pembeli"],false));liveGmv=num(value(row,["GMV dari LIVE kreator"],false));videoGmv=num(value(row,["GMV dari video afiliasi"],false));showcaseGmv=num(value(row,["GMV dari kartu produk afiliasi"],false));ctr=num(value(row,["CTR"],false));ctor=num(value(row,["CTOR"],false));liveCount=num(value(row,["Siaran LIVE"],false));videoCount=num(value(row,["Video"],false));sampleContent=num(value(row,["Jumlah konten sampel"],false));sampleSent=num(value(row,["Sampel terkirim"],false));impressions=num(value(row,["Impresi produk"],false));videoViews=num(value(row,["Tayangan video"],false));
        }
        else if(dataType==="performance"&&platform.toLowerCase()==="shopee"){gmv=num(value(row,["Omzet Penjualan(Rp)"],false));qty=num(value(row,["Produk Terjual"],false));orders=num(value(row,["Pesanan"],false));commission=num(value(row,["Estimasi Komisi(Rp)"],false));clicks=num(value(row,["Clicks"],false));buyers=num(value(row,["Total Pembeli"],false));newBuyers=num(value(row,["Pembeli Baru"],false))}
        else{gmv=num(value(row,["GMV","Omzet Penjualan(Rp)","Omzet Penjualan"]));qty=num(value(row,["Qty Paid","Quantity","Qty","Produk Terjual"]));orders=num(value(row,["Orders","Order","Pesanan"]));commission=num(value(row,["Commission","Estimasi Komisi(Rp)","Perkiraan Komisi","Komisi"]));refund=num(value(row,["Refund","Pengembalian dana"]));clicks=num(value(row,["Clicks","Klik"]));buyers=num(value(row,["Buyers","Pembeli","Total Pembeli"]));newBuyers=num(value(row,["New Buyers","Pembeli Baru"]));liveCount=num(value(row,["Siaran LIVE","Live Count"]));videoCount=num(value(row,["Video","Video Count"]));}
        const orderId=clean(value(row,["Order ID","OrderID","ID Pesanan"]));const itemId=clean(value(row,["Item ID","ItemID","ID Item"]));const tx=clean(value(row,["Transaction ID","TransactionID","ID Transaksi"]));const sku=dataType==="sales"?clean(value(row,["SKU","Kode SKU"],false)):"";const product=dataType==="sales"?clean(value(row,["Product Name","Nama Produk","Produk"],false)):"";const dataDate=dataType==="sales"?dateValue(value(row,["Transaction Date","Tanggal Transaksi","Tanggal","Date","Data Date"]),start):start;const unique=tx||[orderId,itemId].filter(Boolean).join("|")||`${fileHash||importId}|${batchIndex}-${i}`;
        const storeName=clean(value(row,["Store Name","Shop Name","Nama Toko","Toko","Seller Name","Store","Shop"],false));const storeId=clean(value(row,["Store ID","Shop ID","Seller ID","ID Toko"],false));const costProduct=num(value(row,["HPP","Cost Product","Product Cost","Harga Modal"],false));const shippingCost=num(value(row,["Shipping Cost","Ongkir","Biaya Ongkir"],false));const adsSpend=num(value(row,["Ads Spend","Ad Spend","Biaya Ads","Iklan"],false));const points=num(value(row,["Points","Point","Poin"],false));
        payloads.push({workspace_id:workspaceId,record_key:`sales|${workspaceId}|${platform}|${unique}`,data_type:dataType,transaction_id:tx||null,order_id:orderId||null,item_id:itemId||null,data_date:dataDate||null,end_date:end||dataDate||null,creator_id:creatorId,creator_name:creatorName,username,platform,channel:dataType==="performance"?"Affiliate Performance":clean(value(row,["Channel","Saluran"]))||"Affiliate",store_name:storeName||null,store_id:storeId||null,sku:sku||null,product_name:product||null,category:dataType==="sales"?clean(value(row,["Category","Kategori"],false))||null:null,qty,orders:orders||(orderId?1:0),gmv,refund,commission,cost_product:costProduct,shipping_cost:shippingCost,ads_spend:adsSpend,points,clicks,buyers,new_buyers:newBuyers,live_gmv:liveGmv,video_gmv:videoGmv,showcase_gmv:showcaseGmv,ctr,ctor,live_count:liveCount,video_count:videoCount,sample_content:sampleContent,sample_sent:sampleSent,impressions,video_views:videoViews,source_file:filename,imported_at:new Date().toISOString(),import_id:importId,updated_at:new Date().toISOString()});
      }
      if(payloads.length){const {data:saved,error}=await admin.from("sales").upsert(payloads,{onConflict:"record_key"}).select("id");if(error)throw error;inserted+=saved?.length||payloads.length}
    }else return NextResponse.json({ok:false,error:"Jenis Data tidak valid."},{status:400});

    const {data:existing}=await admin.from("imports").select("id,rows_imported,message").eq("workspace_id",workspaceId).eq("import_id",importId).maybeSingle();let prev:any={};try{prev=JSON.parse(existing?.message||"{}")}catch{}const stats={detected:Number(prev.detected||0)+rows.length,inserted:Number(prev.inserted||0)+inserted,updated:Number(prev.updated||0)+updated,skipped:Number(prev.skipped||0)+skipped,duplicates:Number(prev.duplicates||0),errors:Number(prev.errors||0)};const meta={workspace_id:workspaceId,import_id:importId,filename,data_type:dataType,platform,start_date:start||null,end_date:end||null,rows_imported:Number(existing?.rows_imported||0)+inserted+updated,status:batchIndex+1>=totalBatches?"Success":"Processing",imported_at:new Date().toISOString(),message:JSON.stringify(stats),file_hash:fileHash||null};if(existing?.id){const {error}=await admin.from("imports").update(meta).eq("id",existing.id);if(error)throw error}else{const {error}=await admin.from("imports").insert(meta);if(error)throw error}
    const complete=batchIndex+1>=totalBatches;
    let persistedRows:number|null=null;
    if(complete&&(dataType==="performance"||dataType==="sales")){
      const {count,error:countError}=await admin.from("sales").select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).eq("import_id",importId);
      if(countError)throw countError;
      persistedRows=Number(count||0);
      if(persistedRows<=0)throw new Error("Import selesai diproses tetapi tidak ada row yang tersimpan ke database.");
      await notifyTopCreators(admin,workspaceId,ctx.user.id).catch(()=>undefined);
    }
    return NextResponse.json({ok:true,import_id:importId,stats,complete,persisted_rows:persistedRows,detected_platform:platform});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Import failed."},{status:400})}
}
