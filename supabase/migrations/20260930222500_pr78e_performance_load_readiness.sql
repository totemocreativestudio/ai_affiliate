-- PR78E: Performance, load-readiness, and database diagnostics

create index if not exists idx_sales_workspace_type_date_platform_store
  on public.sales(workspace_id,data_type,data_date,platform,store_name);

create index if not exists idx_sales_workspace_creator_date
  on public.sales(workspace_id,creator_id,data_date)
  where creator_id is not null;

create index if not exists idx_sales_workspace_sku_date
  on public.sales(workspace_id,sku,data_date)
  where sku is not null;

create index if not exists idx_sales_workspace_product_code_date
  on public.sales(workspace_id,product_code,data_date)
  where product_code is not null;

create index if not exists idx_imports_workspace_recent
  on public.imports(workspace_id,imported_at desc,status);

create index if not exists idx_creators_workspace_identity_active
  on public.creators(workspace_id,identity_key,id)
  where merged_into_creator_id is null;

create index if not exists idx_product_master_workspace_sku
  on public.product_master(workspace_id,sku_normalized);

create index if not exists idx_campaign_creator_performance_lookup
  on public.campaign_tracker_creators(workspace_id,campaign_id,creator_id,platform,sku)
  where creator_id is not null;

create or replace function public.luma_owner_query_performance_v1(p_limit integer default 20)
returns table(
  queryid bigint,
  calls bigint,
  total_exec_ms numeric,
  mean_exec_ms numeric,
  rows bigint
)
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
begin
  if not public.luma_is_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;

  return query
  select
    s.queryid,
    s.calls,
    round(s.total_exec_time::numeric,2),
    round(s.mean_exec_time::numeric,2),
    s.rows
  from extensions.pg_stat_statements s
  where s.dbid=(select oid from pg_database where datname=current_database())
    and s.calls>0
  order by s.total_exec_time desc
  limit greatest(1,least(coalesce(p_limit,20),100));
end
$$;

create or replace function public.luma_owner_backup_readiness_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.luma_is_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;

  select jsonb_build_object(
    'checked_at',now(),
    'database_bytes',pg_database_size(current_database()),
    'critical_counts',jsonb_build_object(
      'profiles',(select count(*) from public.profiles),
      'workspaces',(select count(*) from public.workspaces),
      'workspace_members',(select count(*) from public.workspace_members),
      'sales',(select count(*) from public.sales),
      'creators',(select count(*) from public.creators),
      'product_master',(select count(*) from public.product_master),
      'imports',(select count(*) from public.imports),
      'campaigns',(select count(*) from public.campaign_trackers),
      'subscriptions',(select count(*) from public.luma_user_subscriptions),
      'subscription_orders',(select count(*) from public.luma_subscription_orders),
      'topup_orders',(select count(*) from public.luma_topup_orders),
      'promo_redemptions',(select count(*) from public.luma_promo_redemptions)
    ),
    'latest_activity',jsonb_build_object(
      'import',(select max(imported_at) from public.imports),
      'sale',(select max(updated_at) from public.sales),
      'subscription_order',(select max(created_at) from public.luma_subscription_orders),
      'topup_order',(select max(created_at) from public.luma_topup_orders)
    )
  ) into v_result;

  return v_result;
end
$$;

revoke all on function public.luma_owner_query_performance_v1(integer) from public,anon;
revoke all on function public.luma_owner_backup_readiness_v1() from public,anon;
grant execute on function public.luma_owner_query_performance_v1(integer) to authenticated,service_role;
grant execute on function public.luma_owner_backup_readiness_v1() to authenticated,service_role;

comment on function public.luma_owner_query_performance_v1(integer) is
'Owner-only pg_stat_statements summary without query text for slow-query prioritization.';
comment on function public.luma_owner_backup_readiness_v1() is
'Owner-only logical backup verification baseline: critical table counts and latest activity timestamps.';
