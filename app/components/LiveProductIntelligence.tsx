"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import SmartEmptyState from "./SmartEmptyState";
import {navigateToSection} from "../../lib/luma-navigation";

type Row=Record<string,any>;
const rp=(v:any)=>v===null||v===undefined?"-":"Rp "+Math.round(Number(v||0)).toLocaleString("id-ID");
const no=(v:any)=>Math.round(Number(v||0)).toLocaleString("id-ID");
const norm=(v:any)=>String(v||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"");
const month=()=>{const d=new Date(),y=d.getFullYear(),m=d.getMonth();return{start:new Date(y,m,1).toISOString().slice(0,10),end:new Date(y,m+1,0).toISOString().slice(0,10)}};

export default function LiveProductIntelligence({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]),r=month();
 const [start,setStart]=useState(r.start),[end,setEnd]=useState(r.end),[platform,setPlatform]=useState(""),[search,setSearch]=useState("");
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
   const bySku=new Map((master.data||[]).filter((x:any)=>x.sku).map((x:any)=>[norm(x.sku),x]));
   const byName=new Map((master.data||[]).filter((x:any)=>x.product_name).map((x:any)=>[norm(x.product_name),x]));
   let mapped=0;
   for(const row of live.data||[]){
    const pm=(row.source_sku&&bySku.get(norm(row.source_sku)))||byName.get(norm(row.product_name_raw));
    if(!pm)continue;
    const method=row.source_sku&&norm(row.source_sku)===norm(pm.sku)?"exact_sku":"exact_name";
    const u=await supabase.from("live_product_performance").update({product_master_id:pm.id,mapped_sku:pm.sku,mapped_product_name:pm.product_name,mapping_method:method,mapping_confidence:method==="exact_sku"?1:.98,mapped_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",row.id);
    if(!u.error)mapped++;
   }
   setMsg(mapped+" row Live berhasil dihubungkan ke Product Master. Data Affiliate tidak diubah.");
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
 return <section className="live-product-intel">
  <header className="lpi-head"><div><div className="eyebrow">LIVE PRODUCT INTELLIGENCE</div><h2>Product Performance</h2><p>SKU dan nama produk boleh sama dengan Product Master, tetapi seluruh metrik di halaman ini hanya berasal dari Live Streaming.</p></div><span className="lpi-domain-badge">LIVE DATA ONLY</span></header>

  <div className="lpi-separation"><b>Domain terpisah.</b> Mapping Product Master hanya digunakan untuk SKU, nama, gambar, kategori dan HPP. GMV, Qty, Click, Add to Cart dan attribution di bawah ini tidak masuk ke dashboard Affiliate.</div>

  <div className="lpi-toolbar"><input type="date" value={start} onChange={e=>setStart(e.target.value)}/><span>→</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/><select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="">Semua Platform</option><option value="Shopee">Shopee</option><option value="TikTok">TikTok</option></select><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void load()} placeholder="Cari SKU / nama produk"/><button onClick={()=>void load()}>Cari</button><button className="secondary" disabled={busy} onClick={()=>void autoMap()}>{busy?"Memproses...":"Auto Map Product"}</button></div>
  {msg&&<div className="live-upload-msg">{msg}</div>}

  <div className="lpi-kpis">{[
   ["Produk Live",no(s.product_count)],["Mapped",no(s.mapped_products)],["Belum Mapped",no(s.unmapped_products)],
   ["Live GMV",rp(s.gmv_created)],["Ready GMV",rp(s.gmv_ready)],["Live Qty",no(s.qty_created)],
   ["Product Clicks",no(s.product_clicks)],["Add to Cart",no(s.add_to_cart)],["Live HPP",rp(s.hpp_cost)],["Contribution Margin",rp(s.contribution_margin)]
  ].map(([l,v])=><article key={l}><span>{l}</span><strong>{v}</strong></article>)}</div>

  {rows.length?<div className="lpi-table-wrap"><table><thead><tr><th>Produk</th><th>Platform</th><th>Mapping</th><th>Live GMV</th><th>Ready GMV</th><th>Qty</th><th>Clicks</th><th>Add to Cart</th><th>Product Order Attribution</th><th>HPP</th><th>Contribution</th><th>Action</th></tr></thead><tbody>
   {rows.map((x:Row,i:number)=><tr key={String(x.platform)+"-"+String(x.product_master_id||x.product_name)+"-"+i}>
    <td><div className="lpi-product">{x.image_url&&<img src={x.image_url} alt=""/>}<span><strong>{x.product_name||"-"}</strong><small>{x.sku||"SKU belum terhubung"}</small></span></div></td>
    <td>{x.platform}</td>
    <td>{x.product_master_id?<><b className="lpi-map-ok">Mapped</b><small>{x.mapping_method||"linked"} · {Math.round(Number(x.mapping_confidence||0)*100)}%</small></>:<b className="lpi-map-missing">Belum mapped</b>}</td>
    <td>{rp(x.gmv_created)}</td><td>{rp(x.gmv_ready)}</td><td>{no(x.qty_created)}</td><td>{no(x.product_clicks)}</td><td>{no(x.add_to_cart)}</td>
    <td><b>{no(x.product_order_attribution_created)}</b><small>attribution row, bukan total order</small></td>
    <td>{rp(x.hpp_cost)}</td><td>{rp(x.contribution_margin)}</td>
    <td><button onClick={()=>{setMapping(x);setSelectedMaster(x.product_master_id?String(x.product_master_id):"")}}>Map Product</button></td>
   </tr>)}
  </tbody></table></div>:<SmartEmptyState eyebrow="LIVE PRODUCT" title="Belum ada performa produk Live" description="Upload data Shopee/TikTok Live terlebih dahulu. Setelah data masuk, GMV, Qty, Click, HPP dan contribution margin akan tampil di sini." primaryLabel="Buka Upload Center" onPrimary={()=>navigateToSection("live-streaming")} secondaryLabel="Refresh" onSecondary={()=>void load()} icon="product" checklist={["Upload data Live","Cek auto-detect & preview","Import lalu kembali ke Product Intelligence"]}/>}

  {mapping&&<div className="lpi-modal"><div><header><div><span>LIVE PRODUCT MAPPING</span><h3>{mapping.product_name}</h3></div><button onClick={()=>setMapping(null)}>×</button></header><p>Pilih Product Master yang mewakili produk fisik yang sama. Hanya identity/HPP yang direferensikan; data Affiliate tidak ikut digunakan.</p><label>Product Master<select value={selectedMaster} onChange={e=>setSelectedMaster(e.target.value)}><option value="">Pilih produk</option>{products.map(x=><option key={x.id} value={x.id}>{x.sku} · {x.product_name}</option>)}</select></label><footer><button onClick={()=>setMapping(null)}>Batal</button><button className="primary" disabled={busy||!selectedMaster} onClick={()=>void manualMap()}>Simpan Mapping</button></footer></div></div>}
 </section>
}
