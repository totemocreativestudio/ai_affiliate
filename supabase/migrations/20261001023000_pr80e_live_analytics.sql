-- PR80E: Live Analytics Visualization RPC

create or replace function public.luma_live_analytics_v1(p_workspace_id uuid,p_start date,p_end date)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) then raise exception 'Workspace access denied' using errcode='42501'; end if;

  with perf as (
    select p.*,s.host_id,s.gimmick,s.platform,s.title,s.session_date,h.name host_name,h.username host_username
    from public.live_session_performance p
    join public.live_sessions s on s.id=p.session_id and s.workspace_id=p.workspace_id
    left join public.live_hosts h on h.id=s.host_id and h.workspace_id=s.workspace_id
    where p.workspace_id=p_workspace_id and p.metric_date between p_start and p_end
  ),
  by_day as (
    select metric_date,coalesce(sum(gmv),0) gmv,coalesce(sum(orders),0) orders,coalesce(avg(nullif(avg_viewers,0)),0) avg_viewers,
      coalesce(sum(duration_minutes),0) duration_minutes
    from perf group by metric_date order by metric_date
  ),
  by_hour as (
    select hour_bucket,coalesce(sum(gmv),0) gmv,coalesce(sum(orders),0) orders,coalesce(avg(nullif(avg_viewers,0)),0) avg_viewers,
      coalesce(sum(duration_minutes),0) duration_minutes
    from perf where hour_bucket is not null group by hour_bucket order by hour_bucket
  ),
  by_host as (
    select host_id,coalesce(host_name,'Unknown Host') host_name,coalesce(host_username,'') host_username,
      coalesce(sum(gmv),0) gmv,coalesce(sum(orders),0) orders,coalesce(sum(qty),0) qty,
      coalesce(sum(duration_minutes),0) duration_minutes,coalesce(avg(nullif(avg_viewers,0)),0) avg_viewers
    from perf group by host_id,host_name,host_username order by gmv desc
  ),
  by_gimmick as (
    select coalesce(nullif(trim(gimmick),''),'Tanpa Gimmick') gimmick,coalesce(sum(gmv),0) gmv,coalesce(sum(orders),0) orders,
      coalesce(avg(nullif(avg_viewers,0)),0) avg_viewers,coalesce(sum(duration_minutes),0) duration_minutes
    from perf group by coalesce(nullif(trim(gimmick),''),'Tanpa Gimmick') order by gmv desc
  ),
  by_platform as (
    select coalesce(platform,'Other') platform,coalesce(sum(gmv),0) gmv,coalesce(sum(orders),0) orders
    from perf group by coalesce(platform,'Other') order by gmv desc
  ),
  by_session as (
    select session_id,max(title) title,max(host_name) host_name,max(gimmick) gimmick,
      coalesce(sum(gmv),0) gmv,coalesce(sum(orders),0) orders,coalesce(sum(qty),0) qty,
      coalesce(max(peak_viewers),0) peak_viewers,coalesce(avg(nullif(avg_viewers,0)),0) avg_viewers,
      coalesce(sum(duration_minutes),0) duration_minutes
    from perf group by session_id order by gmv desc limit 50
  )
  select jsonb_build_object(
    'by_day',coalesce((select jsonb_agg(to_jsonb(x)) from by_day x),'[]'::jsonb),
    'by_hour',coalesce((select jsonb_agg(to_jsonb(x)) from by_hour x),'[]'::jsonb),
    'by_host',coalesce((select jsonb_agg(to_jsonb(x)) from by_host x),'[]'::jsonb),
    'by_gimmick',coalesce((select jsonb_agg(to_jsonb(x)) from by_gimmick x),'[]'::jsonb),
    'by_platform',coalesce((select jsonb_agg(to_jsonb(x)) from by_platform x),'[]'::jsonb),
    'by_session',coalesce((select jsonb_agg(to_jsonb(x)) from by_session x),'[]'::jsonb)
  ) into v;
  return coalesce(v,'{}'::jsonb);
end $$;

revoke all on function public.luma_live_analytics_v1(uuid,date,date) from public,anon;
grant execute on function public.luma_live_analytics_v1(uuid,date,date) to authenticated,service_role;
