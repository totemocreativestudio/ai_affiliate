"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import SmartEmptyState from "./SmartEmptyState";
import {navigateToSection} from "../../lib/luma-navigation";

type Row=Record<string,any>;
const rp=(v:any)=>v===null||v===undefined?"-":"Rp "+Math.round(Number(v||0)).toLocaleString("id-ID");
const no=(v:any)=>Math.round(Number(v||0)).toLocaleString("id-ID");
const norm=(v:any)=>String(v||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"");
const tokens=(v:any)=>new Set(norm(v).split(/(?=[a-z])|[^a-z0-9]+/).filter((x:string)=>x.length>2&&!["gascomp","official","store","produk","terbaik","aman","hemat","garansi","sni"].includes(x)));
function similarity(a:any,b:any){
 const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;
 let inter=0;for(const x of A)if(B.has(x))inter++;
 return inter/Math.max(A.size,B.size);
}
const month=()=>{const d=new Date(),y=d.getFullYear(),m=d.getMonth();return{start:new Date(y,m,1).toISOString().slice(0,10),end:new Date(y,m+1,0).toISOString().slice(0,10)}};

export default function LiveProductIntelligence({workspaceId,start,end}:{workspaceId:string;start:string;end:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [platform,setPlatform]=useState(""),[search,setSearch]=useState("");
 const [data,setData]=useState<Row>({}),[products,setProducts]=useState<Row[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 const [mapping,setMapping]=useState<Row|null>(null),[selectedMaster,setSelectedMaster]=useState("");

 async function load(){
  const [x,p]=await Promise.all([
   supabase.rpc("luma_live_product_intelligence_v1",{p_workspace_id:workspaceId,p_start:start,p_end:end,p_platform:platform||null,p_search:search||null}),
   supabase.from("product_master").select("id,sku,product_name,category,cost_price,image_url").eq("workspace_id",workspaceId).order("sku").limit(2000)
  ]);
  if(x.error){setMsg(x.error.message);setData({})}else{setData(x.data||{});setMsg("")}
  if(!p.error)setProducts(p.data||[]);
 }

 useEffect(()=>{void load()},[workspaceId,start,end,platform]);

 async function autoMap(){
  setBusy(true);setMsg("Mencocokkan produk Live dengan Product Master...");
  try{
   const [live,master]=await Promise.all([
    supabase.from("live_product_performance").select("id,source_sku,product_name_raw").eq("workspace_id",workspaceId).is("product_master_id",null).limit(3000),
    supabase.from("product_master").select("id,sku,product_name").eq("workspace_id",workspaceId).limit(3000)
   ]);
   if(live.error)throw live.error;if(master.error)throw master.error;
   const masters=(master.data||[]);
   const bySku=new Map(masters.filter((x:any)=>x.sku).map((x:any)=>[norm(x.sku),x]));
   const byName=new Map(masters.filter((x:any)=>x.product_name).map((x:any)=>[norm(x.product_name),x]));
   let mapped=0,review=0;
   for(const row of live.data||[]){
    let pm:any=(row.source_sku&&bySku.get(norm(row.source_sku)))||byName.get(norm(row.product_name_raw));
    let method="exact_name",confidence=.98;
    if(row.source_sku&&pm&&norm(row.source_sku)===norm(pm.sku)){method="exact_sku";confidence=1}
    if(!pm){
      const ranked=masters.map((x:any)=>({pm:x,score:similarity(row.product_name_raw,x.product_name)})).sort((a:any,b:any)=>b.score-a.score);
      const best=ranked[0],second=ranked[1];
      if(best&&best.score>=.78&&best.score-Number(second?.score||0)>=.08){pm=best.pm;method="fuzzy_name";confidence=Math.min(.95,best.score)}
      else{review++;continue}
    }
    const u=await supabase.from("live_product_performance").update({product_master_id:pm.id,mapped_sku:pm.sku,mapped_product_name:pm.product_name,mapping_method:method,mapping_confidence:confidence,mapped_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",row.id);
    if(!u.error)mapped++;
   }
   setMsg(mapped+" row Live berhasil dihubungkan ke Product Master"+(review?" · "+review+" row sengaja ditahan untuk review karena kecocokan belum cukup aman.":"")+". Data Affiliate tidak diubah.");
   await load();window.dispatchEvent(new CustomEvent("lumaway-live-updated"));
  }catch(e:any){setMsg(e?.message||"Auto mapping gagal.")}finally{setBusy(false)}
 }

 async function manualMap(){
  if(!mapping||!selectedMaster)return;
  const pm=products.find(x=>String(x.id)===selectedMaster);if(!pm)return;
  setBusy(true);
  try{
   let q=supabase.from("live_product_performance").update({product_master_id:pm.id,mapped_sku:pm.sku,mapped_product_name:pm.product_name,mapping_method:"manual",mapping_confidence:1,mapped_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("platform",mapping.platform);
   if(mapping.product_master_id)q=q.eq("product_master_id",mapping.product_master_id);
   else q=q.eq("product_name_raw",mapping.product_name);
   const u=await q;if(u.error)throw u.error;
   setMapping(null);setSelectedMaster("");setMsg("Mapping Live Product diperbarui. Data Affiliate tetap terpisah.");await load();window.dispatchEvent(new CustomEvent("lumaway-live-updated"));
  }catch(e:any){setMsg(e?.message||"Mapping gagal.")}finally{setBusy(false)}
 }

 const s=data.summary||{},rows=data.products||[];
 const mappingRate=Number(s.product_count||0)>0?Number(s.mapped_products||0)/Number(s.product_count||0)*100:0;
 const contributionKnown=s.contribution_margin!==null&&s.contribution_margin!==undefined;
 return <section className="live-product-intel">
  <header className="lpi-head">
   <div><div className="eyebrow">LIVE PRODUCT INTELLIGENCE</div><h2>Product Performance</h2><p>Analisis produk Live dengan source yang tetap terpisah dari Affiliate. Product Master hanya menjadi referensi identitas dan HPP.</p></div>
   <div className="lpi-head-side"><span className="lpi-domain-badge">LIVE DATA ONLY</span><div className="lpi-period-chip"><span>Periode</span><b>{start} → {end}</b></div></div>
  </header>

  <div className="lpi-separation"><b>Domain terpisah.</b><span>Mapping Product Master hanya digunakan untuk SKU, nama, gambar, kategori dan HPP. GMV, Qty, Click, Add to Cart dan attribution tetap berasal dari Live Streaming.</span></div>
  <div className="lpi-overview-strip">
   <article><span>Mapping Coverage</span><strong>{mappingRate.toFixed(1)}%</strong><div><i style={{width:String(Math.min(100,mappingRate))+"%"}}/></div><small>{no(s.mapped_products)} mapped · {no(s.unmapped_products)} belum mapped</small></article>
   <article><span>Source Scope</span><strong>{platform||"Semua Platform"}</strong><small>{no(s.product_count)} produk pada periode aktif</small></article>
   <article><span>HPP Status</span><strong>{s.hpp_cost===null||s.hpp_cost===undefined?"Belum Lengkap":"Terbaca"}</strong><small>{s.hpp_cost===null||s.hpp_cost===undefined?"Map produk ke Product Master agar margin terbaca":"HPP "+rp(s.hpp_cost)}</small></article>
  </div>

  <div className="lpi-toolbar"><select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="">Semua Platform</option><option value="Shopee">Shopee</option><option value="TikTok">TikTok</option></select><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void load()} placeholder="Cari SKU / nama produk"/><button onClick={()=>void load()}>Cari</button><button className="secondary" disabled={busy} onClick={()=>void autoMap()}>{busy?"Memproses...":"Auto Map Product"}</button></div>
  {msg&&<div className="live-upload-msg">{msg}</div>}

  <div className="lpi-kpis">{[
   ["Live GMV",rp(s.gmv_created),"Nilai transaksi pesanan dibuat","primary"],
   ["Ready GMV",rp(s.gmv_ready),"Nilai siap dikirim",""],
   ["Live Qty",no(s.qty_created),"Produk terjual",""],
   ["Product Clicks",no(s.product_clicks),"Klik produk teratribusi",""],
   ["Add to Cart",no(s.add_to_cart),"Tambah ke keranjang",""],
   ["Live HPP",rp(s.hpp_cost),s.hpp_cost==null?"Belum seluruh produk punya HPP":"HPP dari Product Master",""],
   ["Contribution Margin",contributionKnown?rp(s.contribution_margin):"-",contributionKnown?"GMV dikurangi HPP yang tersedia":"Menunggu HPP","accent"]
  ].map(([l,v,sub,tone])=><article key={l} className={tone||""}><span>{l}</span><strong>{v}</strong><small>{sub}</small></article>)}</div>

  {rows.length?<div className="lpi-table-section"><header><div><span>PRODUCT BREAKDOWN</span><h3>Performa produk Live</h3><p>Gunakan mapping untuk menghubungkan identity/HPP tanpa mencampur metrik Affiliate.</p></div><b>{rows.length} produk tampil</b></header><div className="lpi-table-wrap"><table><thead><tr><th>Produk</th><th>Platform</th><th>Mapping</th><th>Live GMV</th><th>Ready GMV</th><th>Qty</th><th>Clicks</th><th>Add to Cart</th><th>Product Order Attribution</th><th>HPP</th><th>Contribution</th><th>Action</th></tr></thead><tbody>
   {rows.map((x:Row,i:number)=><tr key={String(x.platform)+"-"+String(x.product_master_id||x.product_name)+"-"+i}>
    <td><div className="lpi-product">{x.image_url&&<img src={x.image_url} alt=""/>}<span><strong>{x.product_name||"-"}</strong><small>{x.sku||"SKU belum terhubung"}</small></span></div></td>
    <td>{x.platform}</td>
    <td>{x.product_master_id?<><b className="lpi-map-ok">Mapped</b><small>{x.mapping_method||"linked"} · {Math.round(Number(x.mapping_confidence||0)*100)}%</small></>:<b className="lpi-map-missing">Belum mapped</b>}</td>
    <td>{rp(x.gmv_created)}</td><td>{rp(x.gmv_ready)}</td><td>{no(x.qty_created)}</td><td>{no(x.product_clicks)}</td><td>{no(x.add_to_cart)}</td>
    <td><b>{no(x.product_order_attribution_created)}</b><small>attribution row, bukan total order</small></td>
    <td>{rp(x.hpp_cost)}</td><td>{rp(x.contribution_margin)}</td>
    <td><button onClick={()=>{setMapping(x);setSelectedMaster(x.product_master_id?String(x.product_master_id):"")}}>Map Product</button></td>
   </tr>)}
  </tbody></table></div></div>:<SmartEmptyState eyebrow="LIVE PRODUCT" title="Belum ada performa produk Live" description="Upload data Shopee/TikTok Live terlebih dahulu. Setelah data masuk, GMV, Qty, Click, HPP dan contribution margin akan tampil di sini." primaryLabel="Buka Upload Center" onPrimary={()=>navigateToSection("live-streaming")} secondaryLabel="Refresh" onSecondary={()=>void load()} icon="product" checklist={["Upload data Live","Cek auto-detect & preview","Import lalu kembali ke Product Intelligence"]}/>}

  {mapping&&<div className="lpi-modal"><div><header><div><span>LIVE PRODUCT MAPPING</span><h3>{mapping.product_name}</h3></div><button onClick={()=>setMapping(null)}>×</button></header><p>Pilih Product Master yang mewakili produk fisik yang sama. Hanya identity/HPP yang direferensikan; data Affiliate tidak ikut digunakan.</p><label>Product Master<select value={selectedMaster} onChange={e=>setSelectedMaster(e.target.value)}><option value="">Pilih produk</option>{products.map(x=><option key={x.id} value={x.id}>{x.sku} · {x.product_name}</option>)}</select></label><footer><button onClick={()=>setMapping(null)}>Batal</button><button className="primary" disabled={busy||!selectedMaster} onClick={()=>void manualMap()}>Simpan Mapping</button></footer></div></div>}
 </section>
}
