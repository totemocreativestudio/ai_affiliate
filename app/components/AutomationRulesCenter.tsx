"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Rule={id:string;name:string;description:string|null;trigger_type:string;condition_config:any;action_type:string;action_config:any;active:boolean;updated_at:string};
type Run={id:number;rule_id:string;status:string;matched_count:number;action_count:number;reason:string|null;created_at:string};

const templates=[
  {name:"Campaign mendekati deadline",kind:"campaign_due",days:3,route:"campaign-tracker",severity:"high"},
  {name:"Sample belum follow up",kind:"sample_followup",days:3,route:"creator-samples",severity:"high"},
  {name:"Shipping belum punya resi",kind:"shipping_missing_tracking",route:"shipping",severity:"high"},
  {name:"Produk belum punya HPP",kind:"missing_hpp",route:"product-master",severity:"normal"},
];

export default function AutomationRulesCenter({workspaceId}:{workspaceId:string}){
  const supabase=useMemo(()=>createClient(),[]);
  const [rules,setRules]=useState<Rule[]>([]);
  const [runs,setRuns]=useState<Run[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [draft,setDraft]=useState({name:"",kind:"campaign_due",days:"3",severity:"high"});

  async function load(){
    setLoading(true);setMessage("");
    const results=await Promise.all([
      supabase.from("luma_automation_rules").select("id,name,description,trigger_type,condition_config,action_type,action_config,active,updated_at").eq("workspace_id",workspaceId).order("updated_at",{ascending:false}),
      supabase.from("luma_automation_runs").select("id,rule_id,status,matched_count,action_count,reason,created_at").eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(20)
    ]);
    if(results[0].error||results[1].error)setMessage("Automation belum dapat dimuat. Coba refresh.");
    setRules((results[0].data||[]) as Rule[]);setRuns((results[1].data||[]) as Run[]);setLoading(false);
  }
  useEffect(()=>{void load()},[workspaceId]);

  async function createRule(template?:typeof templates[number]){
    const t=template||templates.find(x=>x.kind===draft.kind)||templates[0];
    const name=(template?.name||draft.name||t.name).trim();
    const payload={
      workspace_id:workspaceId,name,description:"Dibuat dari Lumaway Rules Builder",trigger_type:"record_state",
      condition_config:{kind:t.kind,days:Number((template as any)?.days||draft.days||3)},
      action_type:"create_action",action_config:{title:name,severity:(template as any)?.severity||draft.severity,route:(template as any)?.route||t.route},active:true
    };
    const result=await supabase.from("luma_automation_rules").insert(payload);
    if(result.error){setMessage(result.error.message);return}
    setDraft({...draft,name:""});setMessage("Rule berhasil dibuat.");await load();
  }

  async function toggle(rule:Rule){
    await supabase.from("luma_automation_rules").update({active:!rule.active,updated_at:new Date().toISOString()}).eq("id",rule.id).eq("workspace_id",workspaceId);
    await load();
  }

  async function run(rule:Rule){
    setMessage("Menjalankan rule...");
    const result=await supabase.rpc("luma_run_automation_rule_v1",{p_workspace_id:workspaceId,p_rule_id:rule.id});
    if(result.error){setMessage(result.error.message);return}
    const data:any=result.data||{};
    setMessage(data.matched?("Rule terpenuhi: "+data.reason):("Rule selesai: "+(data.reason||"tidak ada kondisi yang cocok")));
    await load();
  }

  return <section id="automation-rules" className="legacy-page-anchor automation-rules-page">
    <div className="eyebrow">GROWTH & WORKFLOW</div>
    <div className="automation-hero">
      <div><span className="automation-kicker">Automation / Rules Engine</span><h1>Kalau ini terjadi, Lumaway siapkan tindak lanjutnya.</h1><p>Buat workflow sederhana dengan pola <b>KETIKA → JIKA → LAKUKAN</b>. Semua rule transparan, bisa dijeda, dan punya riwayat eksekusi.</p></div>
      <div className="automation-health"><b>{rules.filter(r=>r.active).length}</b><span>Rule aktif</span><small>{runs.length} eksekusi terakhir tersimpan</small></div>
    </div>
    <div className="automation-templates">
      {templates.map(t=><button key={t.kind} onClick={()=>void createRule(t)}><strong>{t.name}</strong><span>Gunakan template</span></button>)}
    </div>
    <div className="automation-builder">
      <div className="builder-step"><span>1</span><label>KETIKA<small>Trigger</small></label><select value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value})}>{templates.map(t=><option value={t.kind} key={t.kind}>{t.name}</option>)}</select></div>
      <div className="builder-step"><span>2</span><label>JIKA<small>Kondisi</small></label><input value={draft.days} onChange={e=>setDraft({...draft,days:e.target.value})} inputMode="numeric" placeholder="3"/><em>hari / ambang</em></div>
      <div className="builder-step"><span>3</span><label>LAKUKAN<small>Action</small></label><select value={draft.severity} onChange={e=>setDraft({...draft,severity:e.target.value})}><option value="normal">Buat action normal</option><option value="high">Buat action prioritas</option><option value="urgent">Buat action urgent</option></select></div>
      <div className="builder-create"><input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Nama rule, contoh: Follow up sample H+3"/><button onClick={()=>void createRule()}>Buat rule</button></div>
    </div>
    {message&&<div className="automation-message">{message}</div>}
    <div className="automation-grid">
      <section className="automation-panel"><header><div><span>Rules</span><h2>Workflow aktif</h2></div><button onClick={()=>void load()}>Refresh</button></header>
        {loading?<div className="automation-skeleton">Memuat rules...</div>:rules.length===0?<div className="automation-empty"><b>Belum ada automation.</b><span>Pilih template di atas supaya rule pertama langsung terbentuk.</span></div>:
        <div className="automation-rule-list">{rules.map(rule=><article key={rule.id} className={rule.active?"is-active":"is-paused"}>
          <div><i/><strong>{rule.name}</strong><span>{String(rule.condition_config?.kind||"").replaceAll("_"," ")} · {rule.action_type.replaceAll("_"," ")}</span></div>
          <div className="rule-actions"><button onClick={()=>void run(rule)}>Run now</button><button onClick={()=>void toggle(rule)}>{rule.active?"Pause":"Activate"}</button></div>
        </article>)}</div>}
      </section>
      <section className="automation-panel"><header><div><span>Run history</span><h2>Apa yang terjadi</h2></div></header>
        {runs.length===0?<div className="automation-empty"><b>Belum ada eksekusi.</b><span>Jalankan rule untuk melihat alasan dan hasilnya.</span></div>:
        <div className="automation-run-list">{runs.map(run=><article key={run.id}><span className={run.matched_count>0?"matched":"skipped"}>{run.matched_count>0?"MATCH":"NO MATCH"}</span><div><strong>{rules.find(r=>r.id===run.rule_id)?.name||"Automation"}</strong><p>{run.reason||"Selesai"}</p><small>{new Date(run.created_at).toLocaleString("id-ID")} · {run.action_count} action</small></div></article>)}</div>}
      </section>
    </div>
  </section>
}
