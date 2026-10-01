-- PR81E: Backup & Disaster Recovery readiness
-- Application-level logical checkpoints complement, but do not replace, provider backups/PITR.

create table if not exists public.luma_backup_readiness_snapshots (
  id bigserial primary key,
  checkpoint_type text not null default 'manual' check(checkpoint_type in ('manual','pre_restore','post_restore','scheduled')),
  database_bytes bigint not null default 0,
  critical_counts jsonb not null default '{}'::jsonb,
  latest_activity jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.luma_backup_readiness_snapshots enable row level security;

drop policy if exists luma_backup_readiness_admin_select on public.luma_backup_readiness_snapshots;
create policy luma_backup_readiness_admin_select on public.luma_backup_readiness_snapshots
for select to authenticated using(public.luma_is_admin());

revoke insert,update,delete on public.luma_backup_readiness_snapshots from anon,authenticated;

create index if not exists luma_backup_readiness_created_idx
  on public.luma_backup_readiness_snapshots(created_at desc);

create or replace function public.luma_owner_create_backup_checkpoint_v1(
  p_checkpoint_type text default 'manual',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  base jsonb;
  new_id bigint;
begin
  if not public.luma_is_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;

  if p_checkpoint_type not in ('manual','pre_restore','post_restore','scheduled') then
    raise exception 'Invalid checkpoint type';
  end if;

  base:=public.luma_owner_backup_readiness_v1();

  insert into public.luma_backup_readiness_snapshots(
    checkpoint_type,database_bytes,critical_counts,latest_activity,notes,created_by
  )
  values(
    p_checkpoint_type,
    coalesce((base->>'database_bytes')::bigint,0),
    coalesce(base->'critical_counts','{}'::jsonb),
    coalesce(base->'latest_activity','{}'::jsonb),
    nullif(trim(coalesce(p_notes,'')),''),
    auth.uid()
  )
  returning id into new_id;

  return jsonb_build_object(
    'id',new_id,
    'checkpoint_type',p_checkpoint_type,
    'captured_at',now(),
    'baseline',base
  );
end
$$;

revoke all on function public.luma_owner_create_backup_checkpoint_v1(text,text) from public,anon;
grant execute on function public.luma_owner_create_backup_checkpoint_v1(text,text) to authenticated,service_role;

create or replace function public.luma_owner_backup_dr_status_v2()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  current_state jsonb;
  latest_snapshot public.luma_backup_readiness_snapshots%rowtype;
  previous_snapshot public.luma_backup_readiness_snapshots%rowtype;
  latest_age_hours numeric;
begin
  if not public.luma_is_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;

  current_state:=public.luma_owner_backup_readiness_v1();

  select * into latest_snapshot
  from public.luma_backup_readiness_snapshots
  order by created_at desc limit 1;

  select * into previous_snapshot
  from public.luma_backup_readiness_snapshots
  where id<>coalesce(latest_snapshot.id,-1)
  order by created_at desc limit 1;

  latest_age_hours:=case when latest_snapshot.id is null then null
    else round(extract(epoch from (now()-latest_snapshot.created_at))::numeric/3600,2) end;

  return jsonb_build_object(
    'checked_at',now(),
    'provider_backup_status','verify_in_supabase',
    'provider_backup_note','Database checkpoints below are application-level verification markers and do not replace Supabase physical backups or PITR.',
    'recommended_rpo_hours',24,
    'recommended_rto_hours',4,
    'checkpoint_age_hours',latest_age_hours,
    'checkpoint_fresh',coalesce(latest_age_hours<=24,false),
    'current',current_state,
    'latest_checkpoint',case when latest_snapshot.id is null then null else jsonb_build_object(
      'id',latest_snapshot.id,
      'type',latest_snapshot.checkpoint_type,
      'database_bytes',latest_snapshot.database_bytes,
      'critical_counts',latest_snapshot.critical_counts,
      'latest_activity',latest_snapshot.latest_activity,
      'notes',latest_snapshot.notes,
      'created_at',latest_snapshot.created_at
    ) end,
    'previous_checkpoint',case when previous_snapshot.id is null then null else jsonb_build_object(
      'id',previous_snapshot.id,
      'type',previous_snapshot.checkpoint_type,
      'database_bytes',previous_snapshot.database_bytes,
      'critical_counts',previous_snapshot.critical_counts,
      'created_at',previous_snapshot.created_at
    ) end
  );
end
$$;

revoke all on function public.luma_owner_backup_dr_status_v2() from public,anon;
grant execute on function public.luma_owner_backup_dr_status_v2() to authenticated,service_role;

comment on table public.luma_backup_readiness_snapshots
is 'Logical DR verification checkpoints. These do not replace provider physical backups/PITR.';
