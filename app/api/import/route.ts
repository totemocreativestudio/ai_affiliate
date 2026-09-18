import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../lib/server-auth";

export const runtime = "nodejs";
type Row = Record<string, any>;

const clean = (v: any) => (v === null || v === undefined ? "" : String(v).trim());
function num(v: any) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = clean(v).replace(/Rp/gi, "").replace(/%/g, "").replace(/\s+/g, "");
  if (!s) return 0;
  const n = Number(s.includes(",") && !s.includes(".") ? s.replace(",", ".") : s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
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
    const b=await req.json(); const workspaceId=clean(b.workspace_id); const dataType=clean(b.data_type); const platform=clean(b.platform)||"Other"; const start=clean(b.start_date); const end=clean(b.end_date); const filename=clean(b.filename)||"upload"; const fileHash=clean(b.file_hash); const importId=clean(b.import_id)||`IMP-${randomUUID().replace(/-/g,"").slice(0,8).toUpperCase()}`; const rows:Row[]=Array.isArray(b.rows)?b.rows:[]; const batchIndex=Number(b.batch_index||0); const totalBatches=Math.max(1,Number(b.total_batches||1)); const force=Boolean(b.force_reimport);
    if(!workspaceId||!dataType||!rows.length)return NextResponse.json({ok:false,error:"Workspace, jenis data, dan rows wajib diisi."},{status:400});
    const ctx=await getServerContext(workspaceId); if(!ctx.canManage)return NextResponse.json({ok:false,error:"Role Anda tidak dapat melakukan import."},{status:403}); const {admin}=ctx;
    if(batchIndex===0&&fileHash){const {data:dup}=await admin.from("imports").select("import_id").eq("workspace_id",workspaceId).eq("file_hash",fileHash).eq("status","Success");if((dup||[]).length&&!force)return NextResponse.json({ok:false,error:"File identik sudah pernah diimport. Aktifkan Re-import untuk mengganti hasil sebelumnya."},{status:409});if((dup||[]).length&&force){const old=(dup||[]).map((x:any)=>x.import_id);await admin.from("sales").delete().eq("workspace_id",workspaceId).in("import_id",old);await admin.from("imports").delete().eq("workspace_id",workspaceId).in("import_id",old)}}
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
          data_date:rawDate?dateValue(rawDate,""):null,
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
      for(let i=0;i<rows.length;i++){
        const row=rows[i];const creatorId=await ensureCreator(admin,workspaceId,row,platform,importId);if(!creatorId){skipped++;continue}const creatorName=clean(value(row,["Creator name","Nama Affiliate","Creator","Nama Creator"]))||clean(value(row,["Username Affiliate","Username"]));const username=clean(value(row,["Username Affiliate","Username"]))||creatorName;
        let gmv=0,qty=0,orders=0,commission=0,refund=0,clicks=0,buyers=0,newBuyers=0,liveGmv=0,videoGmv=0,showcaseGmv=0;
        if(dataType==="performance"&&platform==="TikTok"){gmv=num(value(row,["GMV dari kreator"],false));qty=num(value(row,["Produk yang terjual dari kreator"],false));orders=num(value(row,["Pesanan teratribusi"],false));commission=num(value(row,["Perkiraan komisi"],false));refund=num(value(row,["Pengembalian dana"],false));buyers=num(value(row,["Pembeli"],false));liveGmv=num(value(row,["GMV dari LIVE kreator"],false));videoGmv=num(value(row,["GMV dari video afiliasi"],false));showcaseGmv=num(value(row,["GMV dari kartu produk afiliasi"],false))}
        else if(dataType==="performance"&&platform==="Shopee"){gmv=num(value(row,["Omzet Penjualan(Rp)"],false));qty=num(value(row,["Produk Terjual"],false));orders=num(value(row,["Pesanan"],false));commission=num(value(row,["Estimasi Komisi(Rp)"],false));clicks=num(value(row,["Clicks"],false));buyers=num(value(row,["Total Pembeli"],false));newBuyers=num(value(row,["Pembeli Baru"],false))}
        else{gmv=num(value(row,["GMV","Omzet Penjualan(Rp)","Omzet Penjualan"]));qty=num(value(row,["Qty Paid","Quantity","Qty","Produk Terjual"]));orders=num(value(row,["Orders","Order","Pesanan"]));commission=num(value(row,["Commission","Estimasi Komisi(Rp)","Perkiraan Komisi","Komisi"]));refund=num(value(row,["Refund","Pengembalian dana"]))}
        const orderId=clean(value(row,["Order ID","OrderID","ID Pesanan"]));const itemId=clean(value(row,["Item ID","ItemID","ID Item"]));const tx=clean(value(row,["Transaction ID","TransactionID","ID Transaksi"]));const sku=dataType==="sales"?clean(value(row,["SKU","Kode SKU"],false)):"";const product=dataType==="sales"?clean(value(row,["Product Name","Nama Produk","Produk"],false)):"";const dataDate=dataType==="sales"?dateValue(value(row,["Transaction Date","Tanggal Transaksi","Tanggal","Date","Data Date"]),start):start;const unique=tx||[orderId,itemId].filter(Boolean).join("|")||`${fileHash||importId}|${batchIndex}-${i}`;
        const storeName=clean(value(row,["Store Name","Shop Name","Nama Toko","Toko","Seller Name","Store","Shop"],false));const storeId=clean(value(row,["Store ID","Shop ID","Seller ID","ID Toko"],false));const costProduct=num(value(row,["HPP","Cost Product","Product Cost","Harga Modal"],false));const shippingCost=num(value(row,["Shipping Cost","Ongkir","Biaya Ongkir"],false));const adsSpend=num(value(row,["Ads Spend","Ad Spend","Biaya Ads","Iklan"],false));const points=num(value(row,["Points","Point","Poin"],false));
        payloads.push({workspace_id:workspaceId,record_key:`sales|${workspaceId}|${platform}|${unique}`,data_type:dataType,transaction_id:tx||null,order_id:orderId||null,item_id:itemId||null,data_date:dataDate||null,end_date:end||dataDate||null,creator_id:creatorId,creator_name:creatorName,username,platform,channel:dataType==="performance"?"Affiliate Performance":clean(value(row,["Channel","Saluran"]))||"Affiliate",store_name:storeName||null,store_id:storeId||null,sku:sku||null,product_name:product||null,category:dataType==="sales"?clean(value(row,["Category","Kategori"],false))||null:null,qty,orders:orders||(orderId?1:0),gmv,refund,commission,cost_product:costProduct,shipping_cost:shippingCost,ads_spend:adsSpend,points,clicks,buyers,new_buyers:newBuyers,live_gmv:liveGmv,video_gmv:videoGmv,showcase_gmv:showcaseGmv,source_file:filename,imported_at:new Date().toISOString(),import_id:importId,updated_at:new Date().toISOString()});
      }
      if(payloads.length){const {error}=await admin.from("sales").upsert(payloads,{onConflict:"record_key",ignoreDuplicates:true});if(error)throw error;inserted+=payloads.length}
    }else return NextResponse.json({ok:false,error:"Jenis Data tidak valid."},{status:400});

    const {data:existing}=await admin.from("imports").select("id,rows_imported,message").eq("workspace_id",workspaceId).eq("import_id",importId).maybeSingle();let prev:any={};try{prev=JSON.parse(existing?.message||"{}")}catch{}const stats={detected:Number(prev.detected||0)+rows.length,inserted:Number(prev.inserted||0)+inserted,updated:Number(prev.updated||0)+updated,skipped:Number(prev.skipped||0)+skipped,duplicates:Number(prev.duplicates||0),errors:Number(prev.errors||0)};const meta={workspace_id:workspaceId,import_id:importId,filename,data_type:dataType,platform,start_date:start||null,end_date:end||null,rows_imported:Number(existing?.rows_imported||0)+inserted+updated,status:batchIndex+1>=totalBatches?"Success":"Processing",imported_at:new Date().toISOString(),message:JSON.stringify(stats),file_hash:fileHash||null};if(existing?.id){const {error}=await admin.from("imports").update(meta).eq("id",existing.id);if(error)throw error}else{const {error}=await admin.from("imports").insert(meta);if(error)throw error}
    return NextResponse.json({ok:true,import_id:importId,stats,complete:batchIndex+1>=totalBatches});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Import failed."},{status:400})}
}
