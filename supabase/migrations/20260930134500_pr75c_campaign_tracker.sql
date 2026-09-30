-- PR75C: Campaign Tracker for influencer / affiliate operations
create table if not exists public.campaign_trackers (
  id bigserial primary key,
  workspace_id uuid not null,
  name text not null,
  brand_name text null,
  campaign_type text not null default 'Affiliate',
  platform text null,
  start_date date null,
  end_date date null,
  status text not null default 'Draft',
  target_gmv numeric not null default 0,
  actual_gmv numeric not null default 0,
  target_orders numeric not null default 0,
  actual_orders numeric not null default 0,
  budget numeric not null default 0,
  notes text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_tracker_creators (
  id bigserial primary key,
  workspace_id uuid not null,
  campaign_id bigint not null references public.campaign_trackers(id) on delete cascade,
  creator_id bigint null references public.creators(id) on delete set null,
  creator_name text null,
  platform text null,
  product_id bigint null references public.product_master(id) on delete set null,
  product_name text null,
  sku text null,
  content_type text null,
  due_date date null,
  deliverable_status text not null default 'Brief Sent',
  orders numeric not null default 0,
  gmv numeric not null default 0,
  commission numeric not null default 0,
  sample_status text null,
  shipping_order_id bigint null references public.shipping(id) on delete set null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_campaign_trackers_workspace_status_dates
  on public.campaign_trackers(workspace_id,status,start_date,end_date);

create index if not exists idx_campaign_tracker_creators_campaign
  on public.campaign_tracker_creators(workspace_id,campaign_id,deliverable_status,due_date);

create index if not exists idx_campaign_tracker_creators_creator
  on public.campaign_tracker_creators(workspace_id,creator_id)
  where creator_id is not null;

alter table public.campaign_trackers enable row level security;
alter table public.campaign_tracker_creators enable row level security;

drop policy if exists pr75c_campaign_trackers_select on public.campaign_trackers;
create policy pr75c_campaign_trackers_select
on public.campaign_trackers for select to authenticated
using (public.luma_has_workspace(workspace_id));

drop policy if exists pr75c_campaign_trackers_insert on public.campaign_trackers;
create policy pr75c_campaign_trackers_insert
on public.campaign_trackers for insert to authenticated
with check (public.luma_has_workspace(workspace_id));

drop policy if exists pr75c_campaign_trackers_update on public.campaign_trackers;
create policy pr75c_campaign_trackers_update
on public.campaign_trackers for update to authenticated
using (public.luma_has_workspace(workspace_id))
with check (public.luma_has_workspace(workspace_id));

drop policy if exists pr75c_campaign_trackers_delete on public.campaign_trackers;
create policy pr75c_campaign_trackers_delete
on public.campaign_trackers for delete to authenticated
using (public.luma_has_workspace(workspace_id));

drop policy if exists pr75c_campaign_tracker_creators_select on public.campaign_tracker_creators;
create policy pr75c_campaign_tracker_creators_select
on public.campaign_tracker_creators for select to authenticated
using (public.luma_has_workspace(workspace_id));

drop policy if exists pr75c_campaign_tracker_creators_insert on public.campaign_tracker_creators;
create policy pr75c_campaign_tracker_creators_insert
on public.campaign_tracker_creators for insert to authenticated
with check (public.luma_has_workspace(workspace_id));

drop policy if exists pr75c_campaign_tracker_creators_update on public.campaign_tracker_creators;
create policy pr75c_campaign_tracker_creators_update
on public.campaign_tracker_creators for update to authenticated
using (public.luma_has_workspace(workspace_id))
with check (public.luma_has_workspace(workspace_id));

drop policy if exists pr75c_campaign_tracker_creators_delete on public.campaign_tracker_creators;
create policy pr75c_campaign_tracker_creators_delete
on public.campaign_tracker_creators for delete to authenticated
using (public.luma_has_workspace(workspace_id));

comment on table public.campaign_trackers is
'Workspace-scoped influencer / affiliate campaign tracker with campaign goals and performance totals.';

comment on table public.campaign_tracker_creators is
'Creator-level deliverables and performance rows connected to Lumaway Campaign Tracker.';
