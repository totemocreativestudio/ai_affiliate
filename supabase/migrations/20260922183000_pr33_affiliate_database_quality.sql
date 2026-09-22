-- PR33: affiliate database summary + post-import metric quality checks.

create or replace function public.get_database_affiliate_summary(
  p_workspace_id uuid,
  p_start_date date default null,
  p_end_date date default null,
  p_platform text default null
)
returns table(
  total_rows bigint,
  active_rows bigint,
  zero_rows bigint,
  total_qty numeric,
  total_orders numeric,
  total_gmv numeric,
  total_commission numeric
)
language sql
security definer
set search_path to 'public','pg_temp'
as $function$
  select
    count(*)::bigint,
    count(*) filter (
      where coalesce(s.qty,0)<>0
         or coalesce(s.orders,0)<>0
         or coalesce(s.gmv,0)<>0
         or coalesce(s.commission,0)<>0
    )::bigint,
    count(*) filter (
      where coalesce(s.qty,0)=0
        and coalesce(s.orders,0)=0
        and coalesce(s.gmv,0)=0
        and coalesce(s.commission,0)=0
    )::bigint,
    coalesce(sum(s.qty),0)::numeric,
    coalesce(sum(s.orders),0)::numeric,
    coalesce(sum(s.gmv),0)::numeric,
    coalesce(sum(s.commission),0)::numeric
  from public.sales s
  where s.workspace_id=p_workspace_id
    and s.data_type in ('performance','sales')
    and (p_start_date is null or s.data_date>=p_start_date)
    and (p_end_date is null or s.data_date<=p_end_date)
    and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform));
$function$;

revoke all on function public.get_database_affiliate_summary(uuid,date,date,text) from public;
revoke all on function public.get_database_affiliate_summary(uuid,date,date,text) from anon;
revoke all on function public.get_database_affiliate_summary(uuid,date,date,text) from authenticated;
grant execute on function public.get_database_affiliate_summary(uuid,date,date,text) to service_role;

create or replace function public.get_import_metric_quality(
  p_workspace_id uuid,
  p_import_id text
)
returns table(
  total_rows bigint,
  active_rows bigint,
  zero_rows bigint,
  total_qty numeric,
  total_orders numeric,
  total_gmv numeric,
  total_commission numeric
)
language sql
security definer
set search_path to 'public','pg_temp'
as $function$
  select
    count(*)::bigint,
    count(*) filter (
      where coalesce(s.qty,0)<>0
         or coalesce(s.orders,0)<>0
         or coalesce(s.gmv,0)<>0
         or coalesce(s.commission,0)<>0
    )::bigint,
    count(*) filter (
      where coalesce(s.qty,0)=0
        and coalesce(s.orders,0)=0
        and coalesce(s.gmv,0)=0
        and coalesce(s.commission,0)=0
    )::bigint,
    coalesce(sum(s.qty),0)::numeric,
    coalesce(sum(s.orders),0)::numeric,
    coalesce(sum(s.gmv),0)::numeric,
    coalesce(sum(s.commission),0)::numeric
  from public.sales s
  where s.workspace_id=p_workspace_id
    and s.import_id=p_import_id
    and s.data_type in ('performance','sales');
$function$;

revoke all on function public.get_import_metric_quality(uuid,text) from public;
revoke all on function public.get_import_metric_quality(uuid,text) from anon;
revoke all on function public.get_import_metric_quality(uuid,text) from authenticated;
grant execute on function public.get_import_metric_quality(uuid,text) to service_role;
