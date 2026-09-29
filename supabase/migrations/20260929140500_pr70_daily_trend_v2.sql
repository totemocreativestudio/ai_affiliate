-- PR70: metric-selectable daily performance trend.
create or replace function public.get_dashboard_daily_trend_v2(
  p_workspace_id uuid,
  p_start_date date default null,
  p_end_date date default null,
  p_platform text default null,
  p_store_name text default null
)
returns table(
  data_date date,
  gmv numeric,
  orders numeric,
  qty numeric,
  commission numeric,
  refund numeric,
  active_creators bigint,
  live_streams numeric,
  videos numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not (
    public.luma_is_admin()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()
    )
  ) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  return query
  select
    s.data_date,
    coalesce(sum(s.gmv),0)::numeric,
    coalesce(sum(s.orders),0)::numeric,
    coalesce(sum(s.qty),0)::numeric,
    coalesce(sum(s.commission),0)::numeric,
    coalesce(sum(s.refund),0)::numeric,
    count(distinct s.creator_id) filter (
      where coalesce(s.gmv,0)<>0
         or coalesce(s.orders,0)<>0
         or coalesce(s.qty,0)<>0
         or coalesce(s.commission,0)<>0
    )::bigint,
    coalesce(sum(s.live_count),0)::numeric,
    coalesce(sum(s.video_count),0)::numeric
  from public.sales s
  where s.workspace_id=p_workspace_id
    and s.data_type in ('performance','sales')
    and s.data_date is not null
    and (p_start_date is null or s.data_date>=p_start_date)
    and (p_end_date is null or s.data_date<=p_end_date)
    and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform))
    and (p_store_name is null or p_store_name='' or lower(coalesce(s.store_name,''))=lower(p_store_name))
  group by s.data_date
  order by s.data_date;
end
$$;

revoke all on function public.get_dashboard_daily_trend_v2(uuid,date,date,text,text) from public;
revoke all on function public.get_dashboard_daily_trend_v2(uuid,date,date,text,text) from anon;
grant execute on function public.get_dashboard_daily_trend_v2(uuid,date,date,text,text) to authenticated;
