-- PR80A: Live Streaming Intelligence Foundation
-- IMPORTANT: live streaming operational data is intentionally isolated from affiliate sales.

create table if not exists public.live_hosts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  username text,
  platform text,
  host_type text not null default 'inhouse' check(host_type in ('inhouse','outhouse')),
  status text not null default 'active',
  ratecard numeric not null default 0,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists live_hosts_workspace_username_uq on public.live_hosts(workspace_id,lower(coalesce(username,name)));

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  host_id uuid references public.live_hosts(id) on delete set null,
  title text not null,
  platform text not null default 'TikTok',
  campaign_name text,
  gimmick text,
  session_date date not null,
  start_at timestamptz,
  end_at timestamptz,
  status text not null default 'planned' check(status in ('planned','scheduled','ready','live','completed','cancelled')),
  target_gmv numeric not null default 0,
  target_orders numeric not null default 0,
  target_viewers numeric not null default 0,
  ads_budget numeric not null default 0,
  host_cost numeric not null default 0,
  studio_cost numeric not null default 0,
  production_cost numeric not null default 0,
  other_cost numeric not null default 0,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_sessions_workspace_date_idx on public.live_sessions(workspace_id,session_date,start_at);

create table if not exists public.live_session_performance (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  metric_at timestamptz,
  metric_date date not null,
  hour_bucket smallint,
  gmv numeric not null default 0,
  orders numeric not null default 0,
  qty numeric not null default 0,
  active_viewers numeric not null default 0,
  peak_viewers numeric not null default 0,
  avg_viewers numeric not null default 0,
  clicks numeric not null default 0,
  impressions numeric not null default 0,
  ctr numeric not null default 0,
  cvr numeric not null default 0,
  duration_minutes numeric not null default 0,
  source_import_id text,
  created_at timestamptz not null default now()
);
create index if not exists live_perf_workspace_session_idx on public.live_session_performance(workspace_id,session_id,metric_date,metric_at);

create table if not exists public.live_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  target_gmv numeric not null default 0,
  target_orders numeric not null default 0,
  budget numeric not null default 0,
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.live_hosts enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_session_performance enable row level security;
alter table public.live_campaigns enable row level security;

do $$
declare t text;
begin
  foreach t in array array['live_hosts','live_sessions','live_session_performance','live_campaigns']
  loop
    execute format('drop policy if exists %I_select on public.%I',t,t);
    execute format('create policy %I_select on public.%I for select to authenticated using(public.luma_has_workspace(workspace_id))',t,t);
    execute format('drop policy if exists %I_insert on public.%I',t,t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check(public.luma_has_workspace(workspace_id))',t,t);
    execute format('drop policy if exists %I_update on public.%I',t,t);
    execute format('create policy %I_update on public.%I for update to authenticated using(public.luma_has_workspace(workspace_id)) with check(public.luma_has_workspace(workspace_id))',t,t);
    execute format('drop policy if exists %I_delete on public.%I',t,t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using(public.luma_has_workspace(workspace_id))',t,t);
  end loop;
end $$;

create or replace function public.luma_live_overview_v1(p_workspace_id uuid,p_start date,p_end date)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) then raise exception 'Workspace access denied' using errcode='42501'; end if;

  with perf as (
    select p.*,s.host_id,s.title,s.gimmick,s.platform,s.target_gmv,s.target_orders,s.target_viewers,
      s.ads_budget,s.host_cost,s.studio_cost,s.production_cost,s.other_cost
    from public.live_session_performance p
    join public.live_sessions s on s.id=p.session_id and s.workspace_id=p.workspace_id
    where p.workspace_id=p_workspace_id and p.metric_date between p_start and p_end
  ), totals as (
    select coalesce(sum(gmv),0) gmv,coalesce(sum(orders),0) orders,coalesce(sum(qty),0) qty,
      coalesce(max(peak_viewers),0) peak_viewers,coalesce(avg(nullif(avg_viewers,0)),0) avg_viewers,
      coalesce(sum(duration_minutes),0) duration_minutes,coalesce(sum(clicks),0) clicks,coalesce(sum(impressions),0) impressions
    from perf
  ), costs as (
    select coalesce(sum(ads_budget+host_cost+studio_cost+production_cost+other_cost),0) total_cost
    from public.live_sessions where workspace_id=p_workspace_id and session_date between p_start and p_end
  ), sessions as (
    select count(*) total_sessions,count(*) filter(where status='completed') completed_sessions
    from public.live_sessions where workspace_id=p_workspace_id and session_date between p_start and p_end
  ), daily as (
    select metric_date,coalesce(sum(gmv),0) gmv,coalesce(sum(orders),0) orders,coalesce(avg(avg_viewers),0) avg_viewers
    from perf group by metric_date order by metric_date
  ), hosts as (
    select h.id,h.name,h.username,h.host_type,coalesce(sum(p.gmv),0) gmv,coalesce(sum(p.orders),0) orders,
      coalesce(sum(p.duration_minutes),0) duration_minutes
    from public.live_hosts h left join perf p on p.host_id=h.id
    where h.workspace_id=p_workspace_id group by h.id,h.name,h.username,h.host_type order by gmv desc limit 10
  )
  select jsonb_build_object(
    'totals',jsonb_build_object(
      'gmv',t.gmv,'orders',t.orders,'qty',t.qty,'peak_viewers',t.peak_viewers,'avg_viewers',round(t.avg_viewers,2),
      'duration_minutes',t.duration_minutes,'revenue_per_hour',case when t.duration_minutes>0 then round(t.gmv/(t.duration_minutes/60),2) else 0 end,
      'orders_per_hour',case when t.duration_minutes>0 then round(t.orders/(t.duration_minutes/60),2) else 0 end,
      'ctr',case when t.impressions>0 then round(t.clicks/t.impressions*100,2) else 0 end,
      'total_cost',c.total_cost,'contribution_margin',t.gmv-c.total_cost
    ),
    'sessions',jsonb_build_object('total',s.total_sessions,'completed',s.completed_sessions),
    'daily',coalesce((select jsonb_agg(to_jsonb(d)) from daily d),'[]'::jsonb),
    'hosts',coalesce((select jsonb_agg(to_jsonb(h)) from hosts h),'[]'::jsonb)
  ) into v from totals t cross join costs c cross join sessions s;
  return coalesce(v,'{}'::jsonb);
end $$;

revoke all on function public.luma_live_overview_v1(uuid,date,date) from public,anon;
grant execute on function public.luma_live_overview_v1(uuid,date,date) to authenticated,service_role;
