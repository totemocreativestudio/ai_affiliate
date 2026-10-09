"use client";

import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-browser";
import {CreatorAutocomplete,CreatorSearchResult,ProductAutocomplete,ProductSearchResult} from "./SmartAutocomplete";
import AffiliateProgramImporter from "./AffiliateProgramImporter";

type Row=Record<string,any>;
type Tier={tier:string;target:number;reward_value:number};
type Form={
 program_name:string;kind:string;theme:string;platform:string;channel:string;store_name:string;store_id:string;
 product_master_id:string;metric:string;target_value:string;reward_type:string;reward_value:string;reward_product_master_id:string;
 extra_incentive_per_unit:string;claim_limit:string;start_date:string;end_date:string;claim_deadline:string;
 status:string;description:string;
};
const today=()=>new Date().toISOString().slice(0,10);
const INITIAL:Form={program_name:"",kind:"reward",theme:"Custom",platform:"TikTok",channel:"all",store_name:"",store_id:"",
 product_master_id:"",metric:"qty_net",target_value:"0",reward_type:"cash",reward_value:"0",reward_product_master_id:"",
 extra_incentive_per_unit:"0",claim_limit:"1",start_date:today(),end_date:"",claim_deadline:"",status:"draft",description:""};
const TYPES=[["reward","Reward Bertingkat"],["incentive","Insentif Tambahan"],["challenge","Affiliate Challenge"],["spark_ads","Spark Ads Support"],["sampling","Sample Produk"]];
const METRICS=[["qty_net","Qty Bersih (PCS)"],["gmv_net","Sales / GMV Bersih (Rp)"],["orders","Jumlah Order"],["videos","Konten Video"],["live_count","Jumlah LIVE"],["views","Total Tayangan"],["ads_spend","Biaya Spark Ads (Rp)"]];
const THEMES=["Custom","Payday / Gajian","10.10 Marketplace","11.11 Marketplace","Harbolnas 12.12","Ramadan","Idulfitri","Iduladha","Hari Kartini · 21 April","Hari Kemerdekaan · 17 Agustus","Hari Batik · 2 Oktober","Hari Sumpah Pemuda · 28 Oktober","Back to School","Produk Baru / Launching","LIVE Marathon","Video Review Challenge"];
const rupiah=(x:any)=>"Rp "+Number(x||0).toLocaleString("id-ID",{maximumFractionDigits:0});
const num=(x:any)=>Number(x||0).toLocaleString("id-ID",{maximumFractionDigits:2});
const label=(row:Row)=>String(row.name||row.username||row.creator_code||"Creator "+row.id);
const clamp=(v:number)=>Math.min(100,Math.max(0,v));
function Status({value}:{value:string}){return <span className={"asp-status "+value}>{value==="qualified"?"Memenuhi target":value==="claim_expired"?"Klaim hangus":value==="not_qualified"?"Tidak memenuhi":value==="in_progress"?"Dalam proses":value}</span>}

export default function AffiliateProgramWorkspace({workspaceId}:{workspaceId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [programs,setPrograms]=useState<Row[]>([]),[stores,setStores]=useState<Row[]>([]);
 const [selected,setSelected]=useState<Row|null>(null),[leaderboard,setLeaderboard]=useState<Row>({});
 const [participants,setParticipants]=useState<Row[]>([]),[imports,setImports]=useState<Row[]>([]);
 const [form,setForm]=useState<Form>({...INITIAL}),[tiers,setTiers]=useState<Tier[]>([]);
 const [formOpen,setFormOpen]=useState(false),[editingId,setEditingId]=useState(""),[mode,setMode]=useState("all");
 const [creatorName,setCreatorName]=useState(""),[creatorId,setCreatorId]=useState(""),[productLabel,setProductLabel]=useState(""),[rewardProductLabel,setRewardProductLabel]=useState("");
 const [saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[detailBusy,setDetailBusy]=useState(false);
 async function load(){
  const [pr,st]=await Promise.all([
   supabase.from("luma_affiliate_programs").select("*").eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(150),
   supabase.rpc("luma_workspace_store_options_v1",{p_workspace_id:workspaceId})
  ]);
  if(pr.error)setError(pr.error.message);else setPrograms(pr.data||[]);
  if(!st.error)setStores(st.data||[]);
  if(selected&&pr.data){
   const latest=pr.data.find((x:Row)=>x.id===selected.id);
   if(latest)setSelected(latest);
  }
 }
 async function loadDetail(id:string){
  setDetailBusy(true);
  const [rank,part,history]=await Promise.all([
   supabase.rpc("luma_affiliate_program_leaderboard_v1",{p_workspace_id:workspaceId,p_program_id:id}),
   supabase.from("luma_affiliate_program_participants").select("id,creator_id,status,enrolled_at").eq("workspace_id",workspaceId).eq("program_id",id),
   supabase.from("luma_affiliate_program_imports").select("id,filename,platform,rows_total,rows_imported,rows_rejected,status,created_at").eq("workspace_id",workspaceId).eq("program_id",id).order("created_at",{ascending:false}).limit(30)
  ]);
  if(rank.error)setError(rank.error.message);else setLeaderboard(rank.data||{});
  setParticipants(part.data||[]);setImports(history.data||[]);
  setDetailBusy(false);
 }
 useEffect(()=>{void load()},[workspaceId]);
 useEffect(()=>{if(selected?.id)void loadDetail(selected.id)},[selected?.id,workspaceId]);
 function newProgram(){
  setForm({...INITIAL});setTiers([]);setEditingId("");setProductLabel("");setRewardProductLabel("");setError("");setNotice("");setFormOpen(true);
 }
 function editProgram(p:Row){
  setEditingId(String(p.id));
  setForm(Object.fromEntries(Object.keys(INITIAL).map(k=>[k,p[k]===null||p[k]===undefined?"":String(p[k])])) as Form);
  setTiers(Array.isArray(p.tier_rules)?p.tier_rules.map((x:Row)=>({tier:String(x.tier),target:Number(x.target),reward_value:Number(x.reward_value)})):[]);setProductLabel(p.product_master_id?"SKU #"+p.product_master_id:"");setRewardProductLabel(p.reward_product_master_id?"Produk #"+p.reward_product_master_id:"");
  setFormOpen(true);setError("");
 }
 function change(field:keyof Form,value:string){setForm(p=>({...p,[field]:value}))}
 async function save(){
  if(!form.program_name.trim()||!form.start_date||!form.end_date){setError("Nama program, tanggal mulai, dan tanggal berakhir wajib diisi.");return}
  if(form.end_date<form.start_date){setError("Tanggal berakhir harus setelah tanggal mulai.");return}
  const invalidTier=tiers.some(x=>!x.tier.trim()||!Number.isFinite(x.target)||x.target<=0||x.reward_value<0);
  if(invalidTier){setError("Periksa nilai target/reward setiap tier.");return}
  setSaving(true);setError("");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setSaving(false);setError("Silakan login kembali.");return}
  const payload={
   workspace_id:workspaceId,program_name:form.program_name.trim(),kind:form.kind,theme:form.theme,
   platform:form.platform,channel:form.channel,store_name:form.store_name||null,store_id:form.store_id||null,
   product_master_id:form.product_master_id?Number(form.product_master_id):null,metric:form.metric,
   target_value:Math.max(0,Number(form.target_value)||0),reward_type:form.reward_type,
   reward_value:Math.max(0,Number(form.reward_value)||0),
   reward_product_master_id:form.reward_product_master_id?Number(form.reward_product_master_id):null,
   extra_incentive_per_unit:Math.max(0,Number(form.extra_incentive_per_unit)||0),
   claim_limit:Math.max(1,Math.min(24,Number(form.claim_limit)||1)),start_date:form.start_date,end_date:form.end_date,
   claim_deadline:form.claim_deadline||null,status:form.status,description:form.description||null,
   tier_rules:tiers.filter(x=>x.target>0).sort((a,b)=>a.target-b.target),updated_at:new Date().toISOString()
  };
  const result=editingId
    ?await supabase.from("luma_affiliate_programs").update(payload).eq("workspace_id",workspaceId).eq("id",editingId)
    :await supabase.from("luma_affiliate_programs").insert({...payload,created_by:user.id});
  setSaving(false);
  if(result.error){setError(result.error.message);return}
  setNotice(editingId?"Program diperbarui.":"Program dibuat. Selanjutnya tambahkan creator dan upload laporan performa.");
  setFormOpen(false);await load();
 }
 async function enroll(){
  if(!selected||!creatorId)return setError("Pilih creator dari Master Creator.");
  setSaving(true);setError("");
  const {data:{user}}=await supabase.auth.getUser();
  const {error:insertError}=await supabase.from("luma_affiliate_program_participants")
   .upsert({workspace_id:workspaceId,program_id:selected.id,creator_id:Number(creatorId),status:"active",created_by:user?.id||null},{onConflict:"program_id,creator_id"});
  if(insertError)setError(insertError.message);else{setCreatorName("");setCreatorId("");setNotice("Creator terhubung ke program.");await loadDetail(selected.id)}
  setSaving(false);
 }
 const filtered=programs.filter(p=>mode==="all"||p.kind===mode);
 const totals=programs.reduce((a,p)=>({total:a.total+1,active:a.active+(p.status==="active"?1:0),challenge:a.challenge+(p.kind==="challenge"?1:0)}),{total:0,active:0,challenge:0});
 const entries=(leaderboard.leaderboard||[]) as Row[];
 const summary=(leaderboard.summary||{}) as Row;
 const metricTitle=METRICS.find(x=>x[0]===selected?.metric)?.[1]||"Pencapaian";
 const detailCurrency=selected?.metric==="gmv_net"||selected?.metric==="ads_spend";
 return <section id="affiliate-support" className="legacy-page-anchor asp-workspace">
  <header className="asp-hero"><div><span>CREATOR GROWTH & INCENTIVE OPERATIONS</span><h2>Affiliate Support & Challenge</h2><p>Bangun program reward, target creator, Spark Ads, dan challenge dalam satu tracker terhubung dengan Creator Master, SKU, Agreement, dan toko.</p></div><button className="asp-primary" onClick={newProgram}>+ Buat Program</button></header>
  <div className="asp-top-stats"><article><span>Total program</span><b>{totals.total}</b><small>Semua jenis support</small></article><article><span>Program aktif</span><b>{totals.active}</b><small>Masa program berjalan</small></article><article><span>Affiliate challenge</span><b>{totals.challenge}</b><small>Campaign khusus creator</small></article><article><span>Perkiraan biaya bonus</span><b>{rupiah(Number(summary.estimated_bonus||0))}</b><small>Bukan anggaran disetujui / nilai pembayaran</small></article></div>
  {error&&<div role="alert" className="asp-message error">{error}</div>}{notice&&<div role="status" className="asp-message">{notice}</div>}
  <div className="asp-tabs"><button className={mode==="all"?"active":""} onClick={()=>setMode("all")}>Semua</button>{TYPES.map(([id,name])=><button key={id} className={mode===id?"active":""} onClick={()=>setMode(id)}>{name}</button>)}</div>
  <div className="asp-program-grid">{filtered.map(p=><article key={p.id} className={"asp-program-card "+(selected?.id===p.id?"selected":"")}><header><span>{TYPES.find(x=>x[0]===p.kind)?.[1]||p.kind}</span><Status value={p.status}/></header><h3>{p.program_name}</h3><p>{p.theme} · {p.platform} · {p.channel==="all"?"Video + LIVE + Produk":p.channel}</p><div className="asp-program-facts"><div><small>Periode</small><b>{p.start_date} — {p.end_date}</b></div><div><small>Target</small><b>{num(p.target_value)} {p.metric==="qty_net"?"pcs":p.metric}</b></div><div><small>Hadiah dasar</small><b>{p.reward_type==="cash"?rupiah(p.reward_value):p.reward_type+" · "+rupiah(p.reward_value)}</b></div></div><footer><button className="asp-primary" onClick={()=>{setSelected(p);setNotice("")}}>Buka Tracker</button><button onClick={()=>editProgram(p)}>Edit</button></footer></article>)}
   {!filtered.length&&<div className="asp-empty">Belum ada program pada kategori ini. Buat reward, challenge, atau Spark Ads pertama Anda.</div>}
  </div>
  {formOpen&&<section className="asp-builder"><header><div><span>PROGRAM BUILDER</span><h3>{editingId?"Edit Program":"Program Baru"}</h3><p>Semua input bersifat milik workspace ini; tidak ada contoh SKU/brand yang ditetapkan ke seluruh user.</p></div><button onClick={()=>setFormOpen(false)} aria-label="Tutup">×</button></header>
   <div className="asp-fields">
    <label>Nama Program<input value={form.program_name} onChange={e=>change("program_name",e.target.value)} placeholder="Contoh: Challenge Creator Oktober"/></label>
    <label>Jenis Program<select value={form.kind} onChange={e=>change("kind",e.target.value)}>{TYPES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label>Tema / Kalender Indonesia<select value={form.theme} onChange={e=>change("theme",e.target.value)}>{THEMES.map(x=><option key={x}>{x}</option>)}</select><small>Hari besar bergerak seperti Ramadan perlu penyesuaian tanggal tiap tahun.</small></label>
    <label>Platform<select value={form.platform} onChange={e=>change("platform",e.target.value)}>{["TikTok","Shopee","Tokopedia","Lazada","Blibli","Akulaku","Instagram","YouTube","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Fokus Challenge<select value={form.channel} onChange={e=>change("channel",e.target.value)}><option value="all">Semua Channel</option><option value="video">Video</option><option value="live">LIVE Streaming</option><option value="product">Peluncuran Produk / SKU</option><option value="ads">Spark Ads</option></select></label>
    <label>Store / Toko<select value={form.store_name} onChange={e=>{const s=stores.find(x=>x.store_name===e.target.value);setForm(p=>({...p,store_name:e.target.value,store_id:s?.store_id||""}))}}><option value="">Semua Toko</option>{stores.map(s=><option key={s.platform+"|"+s.store_name} value={s.store_name}>{s.store_name}{s.store_id?" · ID "+s.store_id:""}</option>)}</select></label>
    <label>SKU Produk Program<ProductAutocomplete workspaceId={workspaceId} selectedId={form.product_master_id} value={productLabel} onTextChange={value=>{setProductLabel(value);change("product_master_id","")}} onSelect={(x:ProductSearchResult)=>{change("product_master_id",String(x.id));setProductLabel(x.sku+" · "+(x.product_name||""))}}/><small>Kosongkan untuk semua SKU.</small></label>
    <label>Metric Pencapaian<select value={form.metric} onChange={e=>change("metric",e.target.value)}>{METRICS.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label>Target Minimal<input type="number" min="0" value={form.target_value} onChange={e=>change("target_value",e.target.value)}/></label>
    <label>Jenis Reward<select value={form.reward_type} onChange={e=>change("reward_type",e.target.value)}><option value="cash">Uang Tunai</option><option value="product">Barang / Produk</option><option value="ads_credit">Budget Ads / Spark Ads</option><option value="sample">Sample</option><option value="other">Reward Lainnya</option></select></label>
    <label>Nilai Reward Dasar (Rp)<input type="number" min="0" value={form.reward_value} onChange={e=>change("reward_value",e.target.value)}/></label>
    {(form.reward_type==="product"||form.reward_type==="sample")&&<label>Produk Hadiah / Sample<ProductAutocomplete workspaceId={workspaceId} selectedId={form.reward_product_master_id} value={rewardProductLabel} onTextChange={value=>{setRewardProductLabel(value);change("reward_product_master_id","")}} onSelect={(x:ProductSearchResult)=>{change("reward_product_master_id",String(x.id));setRewardProductLabel(x.sku+" · "+(x.product_name||""))}}/><small>Pilih barang/SKU hadiah dari Product Master workspace.</small></label>}
    <label>Tambahan Insentif per Qty (Rp)<input type="number" min="0" value={form.extra_incentive_per_unit} onChange={e=>change("extra_incentive_per_unit",e.target.value)}/></label>
    <label>Mulai Periode<input type="date" value={form.start_date} onChange={e=>change("start_date",e.target.value)}/></label>
    <label>Akhir Periode<input type="date" min={form.start_date} value={form.end_date} onChange={e=>change("end_date",e.target.value)}/></label>
    <label>Batas Klaim<input type="date" min={form.end_date||form.start_date} value={form.claim_deadline} onChange={e=>change("claim_deadline",e.target.value)}/><small>Jika kosong, batas klaim sama dengan akhir program.</small></label>
    <label>Maksimal Frekuensi Klaim / Creator<input type="number" min="1" max="24" value={form.claim_limit} onChange={e=>change("claim_limit",e.target.value)}/><small>Misalnya 1, 2, atau 3 kali dalam periode.</small></label>
    <label>Status Program<select value={form.status} onChange={e=>change("status",e.target.value)}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="closed">Closed</option></select></label>
    <label className="wide">Deskripsi, Syarat & Gimmick<textarea rows={3} value={form.description} onChange={e=>change("description",e.target.value)} placeholder="Syarat kelayakan, konten wajib, live/video, hashtag, persetujuan Spark Ads, pengecualian refund..."/></label>
   </div>
   <section className="asp-tier-builder"><header><div><h4>Reward Tier · Opsional</h4><p>Tambahkan target sesuai program (3, 5, atau 9 tier). Tier tertinggi yang tercapai dipakai untuk estimasi bonus; bukan akumulasi seluruh tier.</p></div><button onClick={()=>setTiers(rows=>[...rows,{tier:"Tier "+(rows.length+1),target:0,reward_value:0}])}>+ Tambah Tier</button></header>
    {tiers.map((tier,index)=><div key={index} className="asp-tier-row"><span>{index+1}</span><input aria-label="Nama Tier" value={tier.tier} onChange={e=>setTiers(list=>list.map((x,i)=>i===index?{...x,tier:e.target.value}:x))} placeholder="Nama Tier"/><input aria-label="Target Tier" type="number" min="0" value={tier.target} onChange={e=>setTiers(list=>list.map((x,i)=>i===index?{...x,target:Number(e.target.value)}:x))}/><input aria-label="Reward Tier" type="number" min="0" value={tier.reward_value} onChange={e=>setTiers(list=>list.map((x,i)=>i===index?{...x,reward_value:Number(e.target.value)}:x))}/><button onClick={()=>setTiers(list=>list.filter((_,i)=>i!==index))}>Hapus</button></div>)}
    {!tiers.length&&<p className="asp-empty-inline">Tanpa tier: gunakan Target Minimal + Reward Dasar. Untuk reward berdasarkan tier, klik Tambah Tier.</p>}
   </section>
   <footer><button onClick={()=>setFormOpen(false)}>Batal</button><button className="asp-primary" disabled={saving} onClick={()=>void save()}>{saving?"Menyimpan...":"Simpan Program"}</button></footer>
  </section>}
  {selected&&<section className="asp-tracker"><header><div><span>PROGRAM TRACKER · {selected.platform.toUpperCase()}</span><h3>{selected.program_name}</h3><p>{selected.start_date} — {selected.end_date} · {selected.theme} · {metricTitle}</p></div><div><button onClick={()=>void loadDetail(selected.id)}>{detailBusy?"Menghitung...":"Refresh"}</button><button onClick={()=>editProgram(selected)}>Edit Program</button><button onClick={()=>setSelected(null)}>Tutup</button></div></header>
   <div className="asp-tracker-stats"><article><span>Peserta Aktif</span><b>{num(summary.participants)}</b></article><article><span>Memenuhi Target</span><b>{num(summary.qualified)}</b></article><article><span>Klaim Hangus</span><b>{num(summary.expired)}</b></article><article><span>Estimasi Bonus</span><b>{rupiah(summary.estimated_bonus)}</b><small>Belum termasuk komisi marketplace</small></article></div>
   <section className="asp-participant"><div><h4>Tambahkan Creator dari Master Data</h4><p>Creator harus masuk peserta agar masuk leaderboard. Anda dapat menghubungkannya dengan Agreement.</p></div><CreatorAutocomplete workspaceId={workspaceId} value={creatorName} selectedId={creatorId} createPlatform={selected.platform} onTextChange={value=>{setCreatorName(value);setCreatorId("")}} onSelect={(x:CreatorSearchResult)=>{setCreatorId(String(x.id));setCreatorName(label(x))}}/><button disabled={saving||!creatorId} onClick={()=>void enroll()}>+ Tambah Peserta</button></section>
   <div className="asp-leaderboard"><header><h4>Leaderboard Creator</h4><span>Hanya data yang berada dalam periode. Status estimasi, bukan persetujuan pembayaran.</span></header><div className="asp-table-scroll"><table><thead><tr>{["Rank","Creator","Target & Achievement","Qty Bersih","Sales Bersih","Komisi Platform","Tier","Bonus Estimasi","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
    {entries.map((row,index)=><tr key={row.creator_id}><td><b>#{index+1}</b></td><td><strong>{row.creator_name}</strong></td><td><div className="asp-progress"><span>{detailCurrency?rupiah(row.actual):num(row.actual)} / {detailCurrency?rupiah(selected.target_value):num(selected.target_value)}</span><div><i style={{width:clamp(Number(row.actual)/Math.max(Number(selected.target_value),1)*100)+"%"}}/></div></div></td><td>{num(row.qty_net)} pcs</td><td>{rupiah(row.gmv_net)}</td><td>{rupiah(row.platform_commission)}</td><td>{row.tier_name||"—"}</td><td>{rupiah(row.estimated_reward)}</td><td><Status value={row.qualification}/></td></tr>)}
    {!entries.length&&<tr><td colSpan={9}>Belum ada peserta. Tambahkan creator, lalu upload laporan.</td></tr>}
   </tbody></table></div></div>
   <AffiliateProgramImporter workspaceId={workspaceId} program={selected} onImported={()=>void loadDetail(selected.id)}/>
   <section className="asp-import-history"><header><h4>Riwayat Import Program</h4><span>{imports.length} berkas</span></header><div>{imports.map(item=><article key={item.id}><div><b>{item.filename}</b><small>{item.created_at?.slice(0,10)} · {item.platform} · {item.status}</small></div><div>{item.rows_imported} baris masuk · {item.rows_rejected} ditolak</div></article>)}{!imports.length&&<p>Belum ada file performa program.</p>}</div></section>
  </section>}
 </section>;
}
