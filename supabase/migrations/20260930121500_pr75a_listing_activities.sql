-- PR75A: Listings Experience V2 activity timeline
create table if not exists public.listing_activities (
  id bigserial primary key,
  workspace_id uuid not null,
  listing_id bigint not null references public.listings(id) on delete cascade,
  creator_id bigint null,
  activity_date date not null default current_date,
  activity_type text not null,
  result text null,
  note text null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_listing_activities_workspace_listing
  on public.listing_activities(workspace_id, listing_id, activity_date desc, id desc);

create index if not exists idx_listing_activities_workspace_creator
  on public.listing_activities(workspace_id, creator_id, activity_date desc)
  where creator_id is not null;

alter table public.listing_activities enable row level security;

drop policy if exists pr75a_listing_activities_select_auth on public.listing_activities;
create policy pr75a_listing_activities_select_auth
on public.listing_activities
for select
to authenticated
using (public.luma_has_workspace(workspace_id));

drop policy if exists pr75a_listing_activities_insert_auth on public.listing_activities;
create policy pr75a_listing_activities_insert_auth
on public.listing_activities
for insert
to authenticated
with check (public.luma_has_workspace(workspace_id));

drop policy if exists pr75a_listing_activities_update_auth on public.listing_activities;
create policy pr75a_listing_activities_update_auth
on public.listing_activities
for update
to authenticated
using (public.luma_has_workspace(workspace_id))
with check (public.luma_has_workspace(workspace_id));

drop policy if exists pr75a_listing_activities_delete_auth on public.listing_activities;
create policy pr75a_listing_activities_delete_auth
on public.listing_activities
for delete
to authenticated
using (public.luma_has_workspace(workspace_id));

insert into public.listing_activities (
  workspace_id, listing_id, creator_id, activity_date, activity_type, result, note
)
select
  l.workspace_id,
  l.id,
  l.creator_id,
  coalesce(l.data_date, l.created_at::date, current_date),
  'Listing dibuat',
  nullif(l.stage,''),
  nullif(l.notes,'')
from public.listings l
where not exists (
  select 1
  from public.listing_activities a
  where a.workspace_id=l.workspace_id
    and a.listing_id=l.id
);

comment on table public.listing_activities is
'Workspace-scoped creator listing activity timeline: follow-up, sample, content, live, deal, and related outcomes.';
