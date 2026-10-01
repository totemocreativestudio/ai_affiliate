-- PR80B: Host 360 + Session Planner

create table if not exists public.live_host_targets (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  host_id uuid not null references public.live_hosts(id) on delete cascade,
  target_year integer not null,
  target_month smallint not null check(target_month between 1 and 12),
  target_gmv numeric not null default 0,
  target_orders numeric not null default 0,
  target_hours numeric not null default 0,
  target_viewers numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,host_id,target_year,target_month)
);

create table if not exists public.live_session_products (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  product_master_id bigint references public.product_master(id) on delete set null,
  sku text,
  product_name text,
  target_qty numeric not null default 0,
  target_gmv numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists live_host_targets_ws_host_idx on public.live_host_targets(workspace_id,host_id,target_year,target_month);
create index if not exists live_session_products_ws_session_idx on public.live_session_products(workspace_id,session_id);

alter table public.live_host_targets enable row level security;
alter table public.live_session_products enable row level security;

do $$
declare t text;
begin
  foreach t in array array['live_host_targets','live_session_products']
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

create or replace function public.luma_live_host_360_v1(p_workspace_id uuid,p_host_id uuid,p_start date,p_end date)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) then raise exception 'Workspace access denied' using errcode='42501'; end if;

  with host as (
    select * from public.live_hosts where id=p_host_id and workspace_id=p_workspace_id
  ),
  sess as (
    select s.* from public.live_sessions s where s.workspace_id=p_workspace_id and s.host_id=p_host_id and s.session_date between p_start and p_end
  ),
  perf as (
    select p.* from public.live_session_performance p join sess s on s.id=p.session_id
  ),
  totals as (
    select coalesce(sum(gmv),0) gmv,coalesce(sum(orders),0) orders,coalesce(sum(qty),0) qty,
      coalesce(sum(duration_minutes),0) duration_minutes,coalesce(max(peak_viewers),0) peak_viewers,
      coalesce(avg(nullif(avg_viewers,0)),0) avg_viewers,coalesce(sum(clicks),0) clicks,coalesce(sum(impressions),0) impressions
    from perf
  ),
  best_hour as (
    select hour_bucket,coalesce(sum(gmv),0) gmv from perf where hour_bucket is not null
    group by hour_bucket order by gmv desc nulls last limit 1
  ),
  best_gimmick as (
    select s.gimmick,coalesce(sum(p.gmv),0) gmv from sess s
    left join public.live_session_performance p on p.session_id=s.id and p.workspace_id=s.workspace_id
    where nullif(trim(coalesce(s.gimmick,'')),'') is not null
    group by s.gimmick order by gmv desc nulls last limit 1
  ),
  history as (
    select s.id,s.title,s.platform,s.campaign_name,s.gimmick,s.session_date,s.start_at,s.end_at,s.status,
      s.target_gmv,s.target_orders,
      coalesce(sum(p.gmv),0) gmv,coalesce(sum(p.orders),0) orders,coalesce(sum(p.duration_minutes),0) duration_minutes
    from sess s left join public.live_session_performance p on p.session_id=s.id and p.workspace_id=s.workspace_id
    group by s.id order by s.session_date desc,s.start_at desc nulls last limit 30
  )
  select jsonb_build_object(
    'host',(select to_jsonb(h) from host h),
    'totals',jsonb_build_object(
      'gmv',t.gmv,'orders',t.orders,'qty',t.qty,'duration_minutes',t.duration_minutes,
      'peak_viewers',t.peak_viewers,'avg_viewers',round(t.avg_viewers,2),
      'revenue_per_hour',case when t.duration_minutes>0 then round(t.gmv/(t.duration_minutes/60),2) else 0 end,
      'orders_per_hour',case when t.duration_minutes>0 then round(t.orders/(t.duration_minutes/60),2) else 0 end,
      'ctr',case when t.impressions>0 then round(t.clicks/t.impressions*100,2) else 0 end
    ),
    'best_hour',(select to_jsonb(b) from best_hour b),
    'best_gimmick',(select to_jsonb(g) from best_gimmick g),
    'history',coalesce((select jsonb_agg(to_jsonb(h)) from history h),'[]'::jsonb)
  ) into v from totals t;
  return coalesce(v,'{}'::jsonb);
end $$;

revoke all on function public.luma_live_host_360_v1(uuid,uuid,date,date) from public,anon;
grant execute on function public.luma_live_host_360_v1(uuid,uuid,date,date) to authenticated,service_role;
