-- PR81J: Production release gate

create table if not exists public.luma_release_gate_snapshots (
  id bigserial primary key,
  release_label text,
  gate_status text not null check(gate_status in ('READY','REVIEW','BLOCKED')),
  summary jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists luma_release_gate_snapshots_created_idx
  on public.luma_release_gate_snapshots(created_at desc);

alter table public.luma_release_gate_snapshots enable row level security;

drop policy if exists luma_release_gate_snapshots_admin_select on public.luma_release_gate_snapshots;
create policy luma_release_gate_snapshots_admin_select on public.luma_release_gate_snapshots
for select to authenticated using(public.luma_is_admin());

create or replace function public.luma_owner_release_gate_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  latest_qa public.luma_qa_runs%rowtype;
  perf jsonb;
  backup jsonb;
  security_inventory jsonb;
  critical_incidents bigint:=0;
  critical_alerts bigint:=0;
  critical_qa_fails bigint:=0;
  perf_fails bigint:=0;
  security_review bigint:=0;
  blockers jsonb:='[]'::jsonb;
  reviews jsonb:='[]'::jsonb;
  gate text:='READY';
begin
  if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;

  select * into latest_qa from public.luma_qa_runs order by started_at desc limit 1;

  if latest_qa.id is not null then
    select count(*) into critical_qa_fails
    from public.luma_qa_results qr
    join public.luma_qa_definitions qd on qd.id=qr.definition_id
    where qr.run_id=latest_qa.id and qr.status='fail' and qd.severity='critical';
  end if;

  select count(*) into critical_incidents
  from public.luma_incidents where status<>'resolved' and severity='critical';

  select count(*) into critical_alerts
  from public.luma_operational_alert_events where status='open' and severity='critical';

  perf:=public.luma_owner_performance_budget_v1();
  select count(*) into perf_fails
  from jsonb_array_elements(coalesce(perf->'checks','[]'::jsonb)) x
  where x->>'status'='fail';

  backup:=public.luma_owner_backup_dr_status_v2();
  security_inventory:=public.luma_owner_rpc_security_inventory_v1();
  security_review:=coalesce((security_inventory->'summary'->>'needs_review')::bigint,0);

  if latest_qa.id is null then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('key','qa_missing','message','Production QA belum pernah dijalankan.'));
  else
    if critical_qa_fails>0 then
      blockers:=blockers||jsonb_build_array(jsonb_build_object('key','critical_qa_fail','count',critical_qa_fails,'message','Ada critical QA check yang gagal.'));
    end if;
    if latest_qa.pending_count>0 then
      reviews:=reviews||jsonb_build_array(jsonb_build_object('key','qa_pending','count',latest_qa.pending_count,'message','Masih ada QA manual yang pending.'));
    end if;
    if latest_qa.fail_count>critical_qa_fails then
      reviews:=reviews||jsonb_build_array(jsonb_build_object('key','qa_noncritical_fail','count',latest_qa.fail_count-critical_qa_fails,'message','Ada QA non-critical yang gagal.'));
    end if;
  end if;

  if critical_incidents>0 then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('key','critical_incidents','count',critical_incidents,'message','Masih ada critical incident yang belum resolved.'));
  end if;

  if critical_alerts>0 then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('key','critical_alerts','count',critical_alerts,'message','Masih ada critical operational alert yang open.'));
  end if;

  if perf_fails>0 then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('key','performance_budget','count',perf_fails,'message','Ada performance budget yang fail.'));
  end if;

  if coalesce((backup->>'checkpoint_fresh')::boolean,false)=false then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('key','backup_checkpoint','message','Backup readiness checkpoint belum ada atau lebih dari 24 jam.'));
  end if;

  if security_review>0 then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('key','rpc_security_review','count',security_review,'message','Masih ada SECURITY DEFINER RPC yang perlu review.'));
  end if;

  gate:=case when jsonb_array_length(blockers)>0 then 'BLOCKED'
             when jsonb_array_length(reviews)>0 then 'REVIEW'
             else 'READY' end;

  return jsonb_build_object(
    'generated_at',now(),
    'gate_status',gate,
    'blockers',blockers,
    'review_items',reviews,
    'latest_qa',case when latest_qa.id is null then null else jsonb_build_object(
      'id',latest_qa.id,'pass_count',latest_qa.pass_count,'fail_count',latest_qa.fail_count,
      'pending_count',latest_qa.pending_count,'started_at',latest_qa.started_at
    ) end,
    'performance',perf,
    'backup',jsonb_build_object(
      'checkpoint_fresh',backup->'checkpoint_fresh',
      'checkpoint_age_hours',backup->'checkpoint_age_hours',
      'recommended_rpo_hours',backup->'recommended_rpo_hours',
      'recommended_rto_hours',backup->'recommended_rto_hours'
    ),
    'security',security_inventory->'summary',
    'incidents',jsonb_build_object('critical_open',critical_incidents),
    'alerts',jsonb_build_object('critical_open',critical_alerts)
  );
end
$$;

revoke all on function public.luma_owner_release_gate_v1() from public,anon;
grant execute on function public.luma_owner_release_gate_v1() to authenticated;

create or replace function public.luma_owner_snapshot_release_gate_v1(
  p_release_label text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  gate jsonb;
  sid bigint;
begin
  if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;

  gate:=public.luma_owner_release_gate_v1();

  insert into public.luma_release_gate_snapshots(release_label,gate_status,summary,notes,created_by)
  values(nullif(trim(coalesce(p_release_label,'')),''),gate->>'gate_status',gate,nullif(trim(coalesce(p_notes,'')),''),auth.uid())
  returning id into sid;

  return jsonb_build_object('id',sid,'gate_status',gate->>'gate_status','created_at',now());
end
$$;

revoke all on function public.luma_owner_snapshot_release_gate_v1(text,text) from public,anon;
grant execute on function public.luma_owner_snapshot_release_gate_v1(text,text) to authenticated;
