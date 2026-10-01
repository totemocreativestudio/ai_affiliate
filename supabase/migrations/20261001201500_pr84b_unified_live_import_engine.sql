-- PR84B Unified Live Import Engine: Shopee + TikTok

alter table public.live_imports
  add column if not exists dataset_type text,
  add column if not exists parser_version text,
  add column if not exists source_sheet text,
  add column if not exists parser_meta jsonb not null default '{}'::jsonb,
  add column if not exists warnings jsonb not null default '[]'::jsonb;

alter table public.live_sessions
  add column if not exists source_user_id text,
  add column if not exists source_rank_no integer,
  add column if not exists source_natural_key text,
  add column if not exists source_import_id text,
  add column if not exists source_raw jsonb not null default '{}'::jsonb;

create unique index if not exists live_sessions_source_natural_key_uq
  on public.live_sessions(workspace_id,platform,source_natural_key)
  where source_natural_key is not null;

alter table public.live_session_performance
  add column if not exists source_row_key text,
  add column if not exists gmv_created numeric,
  add column if not exists gmv_ready_to_ship numeric,
  add column if not exists orders_created numeric,
  add column if not exists orders_ready_to_ship numeric,
  add column if not exists qty_created numeric,
  add column if not exists qty_ready_to_ship numeric,
  add column if not exists comments numeric,
  add column if not exists add_to_cart numeric,
  add column if not exists viewers numeric,
  add column if not exists avg_watch_duration_seconds numeric,
  add column if not exists duration_seconds numeric,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb;

create unique index if not exists live_perf_source_row_key_uq
  on public.live_session_performance(workspace_id,source_row_key)
  where source_row_key is not null;

create table if not exists public.live_daily_performance(
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null,
  dataset_type text not null default 'core_stats',
  metric_date date not null,
  period_start date,
  period_end date,
  gmv_attributed numeric,
  gmv_direct numeric,
  gmv_indirect numeric,
  display_gpm numeric,
  live_stream_count numeric,
  live_streams_with_gmv numeric,
  products_sold_attributed numeric,
  products_sold_direct numeric,
  products_sold_indirect numeric,
  sku_orders_attributed numeric,
  sku_orders_direct numeric,
  sku_orders_indirect numeric,
  buyers_search numeric,
  live_ctr_pct numeric,
  live_ctor_order_pct numeric,
  live_impressions numeric,
  avg_watch_duration_seconds numeric,
  source_import_id text,
  source_row_key text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,source_row_key)
);

create table if not exists public.live_product_performance(
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null,
  source_user_id text,
  period_start date,
  period_end date,
  ranking integer,
  product_master_id bigint references public.product_master(id) on delete set null,
  product_name_raw text not null,
  product_clicks numeric,
  add_to_cart numeric,
  product_orders_created numeric,
  product_orders_ready_to_ship numeric,
  qty_created numeric,
  qty_ready_to_ship numeric,
  gmv_created numeric,
  gmv_ready_to_ship numeric,
  source_import_id text,
  source_row_key text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,source_row_key)
);

create table if not exists public.live_period_overview(
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null,
  source_user_id text,
  period_start date not null,
  period_end date not null,
  gmv_created numeric,
  gmv_ready_to_ship numeric,
  new_buyer_gmv_created numeric,
  new_buyer_gmv_ready numeric,
  returning_buyer_gmv_created numeric,
  returning_buyer_gmv_ready numeric,
  orders_created numeric,
  orders_ready_to_ship numeric,
  qty_created numeric,
  qty_ready_to_ship numeric,
  aov_created numeric,
  aov_ready numeric,
  sales_per_buyer_created numeric,
  sales_per_buyer_ready numeric,
  livestream_count numeric,
  live_duration_seconds numeric,
  avg_live_duration_seconds numeric,
  viewers numeric,
  period_active_viewers numeric,
  views numeric,
  peak_viewers numeric,
  avg_watch_duration_seconds numeric,
  click_pct numeric,
  buyers_created numeric,
  buyers_ready numeric,
  orders_per_click_created_pct numeric,
  orders_per_click_ready_pct numeric,
  add_to_cart numeric,
  sales_per_mille_created numeric,
  sales_per_mille_ready numeric,
  products_viewed numeric,
  conversion_click_pct numeric,
  product_clicks numeric,
  order_pct_created numeric,
  order_pct_ready numeric,
  conversion_orders_created numeric,
  conversion_orders_confirmed numeric,
  likes numeric,
  shares numeric,
  comments numeric,
  new_followers numeric,
  store_vouchers_claimed numeric,
  special_live_vouchers_claimed numeric,
  coins_claimed numeric,
  source_import_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,platform,source_user_id,period_start,period_end)
);

create table if not exists public.live_traffic_sources(
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null,
  source_user_id text,
  period_start date not null,
  period_end date not null,
  traffic_source_code text not null,
  traffic_source_label text not null,
  live_view_ratio_pct numeric,
  live_viewer_ratio_pct numeric,
  active_viewer_ratio_pct numeric,
  live_views numeric,
  live_viewers numeric,
  active_viewers numeric,
  source_import_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,platform,source_user_id,period_start,period_end,traffic_source_code)
);

do $$
declare t text;
begin
  foreach t in array array['live_daily_performance','live_product_performance','live_period_overview','live_traffic_sources']
  loop
    execute format('alter table public.%I enable row level security',t);
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

create or replace function public.luma_live_source_summary_v1(p_workspace_id uuid,p_start date,p_end date)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not public.luma_has_workspace(p_workspace_id) then raise exception 'Workspace access denied' using errcode='42501'; end if;
 with tt as (
   select coalesce(sum(gmv_attributed),0) gmv,coalesce(sum(gmv_direct),0) direct_gmv,coalesce(sum(gmv_indirect),0) indirect_gmv,
     coalesce(sum(sku_orders_attributed),0) orders,coalesce(sum(products_sold_attributed),0) qty,
     coalesce(sum(live_stream_count),0) live_streams,coalesce(sum(live_impressions),0) impressions
   from public.live_daily_performance
   where workspace_id=p_workspace_id and lower(platform)='tiktok' and metric_date between p_start and p_end
 ), sh as (
   select coalesce(sum(gmv_created),0) gmv_created,coalesce(sum(gmv_ready_to_ship),0) gmv_ready,
     coalesce(sum(orders_created),0) orders_created,coalesce(sum(orders_ready_to_ship),0) orders_ready,
     count(*) sessions
   from public.live_session_performance
   where workspace_id=p_workspace_id and metric_date between p_start and p_end
     and source_row_key like 'shopee:%'
 )
 select jsonb_build_object(
   'tiktok',to_jsonb(tt),
   'shopee',to_jsonb(sh)
 ) into v from tt cross join sh;
 return coalesce(v,'{}'::jsonb);
end $$;

revoke all on function public.luma_live_source_summary_v1(uuid,date,date) from public,anon;
grant execute on function public.luma_live_source_summary_v1(uuid,date,date) to authenticated,service_role;
