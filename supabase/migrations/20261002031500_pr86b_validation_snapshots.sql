-- PR86B Production Validation Snapshot & Sign-off
create table if not exists public.luma_production_validation_snapshots(
  id bigserial primary key,
  release_label text not null,
  status text not null check(status in ('READY','REVIEW','BLOCKED')),
  blocker_count int not null default 0,
  review_count int not null default 0,
  summary jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists luma_validation_snapshots_created_idx on public.luma_production_validation_snapshots(created_at desc);
alter table public.luma_production_validation_snapshots enable row level security;
drop policy if exists luma_validation_snapshots_admin_select on public.luma_production_validation_snapshots;
create policy luma_validation_snapshots_admin_select on public.luma_production_validation_snapshots
for select to authenticated using(public.luma_is_admin());

create or replace function public.luma_owner_snapshot_production_validation_v1(
  p_release_label text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  validation jsonb;
  snapshot_id bigint;
begin
  if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
  if nullif(trim(coalesce(p_release_label,'')),'') is null then raise exception 'Release label required'; end if;

  validation:=public.luma_owner_production_validation_v1();

  insert into public.luma_production_validation_snapshots(
    release_label,status,blocker_count,review_count,summary,notes,created_by
  )
  values(
    left(trim(p_release_label),120),
    coalesce(validation->>'status','REVIEW'),
    jsonb_array_length(coalesce(validation->'blockers','[]'::jsonb)),
    jsonb_array_length(coalesce(validation->'review_items','[]'::jsonb)),
    jsonb_build_object(
      'checked_at',validation->'checked_at',
      'product_experience',validation->'product_experience',
      'imports',validation->'imports',
      'live',validation->'live',
      'isolation',validation->'isolation',
      'performance',validation->'performance'
    ),
    nullif(trim(coalesce(p_notes,'')),''),
    auth.uid()
  )
  returning id into snapshot_id;

  return jsonb_build_object(
    'ok',true,
    'snapshot_id',snapshot_id,
    'status',validation->>'status',
    'blocker_count',jsonb_array_length(coalesce(validation->'blockers','[]'::jsonb)),
    'review_count',jsonb_array_length(coalesce(validation->'review_items','[]'::jsonb))
  );
end
$$;

revoke all on function public.luma_owner_snapshot_production_validation_v1(text,text) from public,anon;
grant execute on function public.luma_owner_snapshot_production_validation_v1(text,text) to authenticated,service_role;
