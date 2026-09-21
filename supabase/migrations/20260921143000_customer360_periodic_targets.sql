-- Customer 360 month/year targets
create table if not exists public.creator_360_targets (
  id bigserial primary key,
  workspace_id uuid not null,
  creator_id bigint not null references public.creators(id) on delete cascade,
  target_year integer not null check (target_year between 2020 and 2100),
  target_month smallint not null default 0 check (target_month between 0 and 12),
  target_sales numeric not null default 0 check (target_sales >= 0),
  target_live numeric not null default 0 check (target_live >= 0),
  target_video numeric not null default 0 check (target_video >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,creator_id,target_year,target_month)
);

create index if not exists creator_360_targets_lookup_idx
  on public.creator_360_targets(workspace_id,creator_id,target_year,target_month);

alter table public.creator_360_targets enable row level security;

drop policy if exists creator_360_targets_select on public.creator_360_targets;
create policy creator_360_targets_select
on public.creator_360_targets
for select to authenticated
using (public.luma_has_workspace(workspace_id));

drop policy if exists creator_360_targets_write on public.creator_360_targets;
create policy creator_360_targets_write
on public.creator_360_targets
for all to authenticated
using (public.luma_has_workspace(workspace_id))
with check (public.luma_has_workspace(workspace_id));
