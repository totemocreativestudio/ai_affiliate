-- PR80K: Live Streaming E2E data health

create or replace function public.luma_live_data_health_v1(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) then raise exception 'Workspace access denied' using errcode='42501'; end if;

  select jsonb_build_object(
    'hosts', (select count(*) from public.live_hosts where workspace_id=p_workspace_id),
    'sessions', (select count(*) from public.live_sessions where workspace_id=p_workspace_id),
    'performance_rows', (select count(*) from public.live_session_performance where workspace_id=p_workspace_id),
    'imports', (select count(*) from public.live_imports where workspace_id=p_workspace_id),
    'failed_imports', (select count(*) from public.live_imports where workspace_id=p_workspace_id and status='failed'),
    'sessions_without_host', (select count(*) from public.live_sessions where workspace_id=p_workspace_id and host_id is null),
    'completed_without_performance', (
      select count(*) from public.live_sessions s
      where s.workspace_id=p_workspace_id and s.status='completed'
        and not exists(select 1 from public.live_session_performance p where p.workspace_id=s.workspace_id and p.session_id=s.id)
    ),
    'performance_without_hour', (select count(*) from public.live_session_performance where workspace_id=p_workspace_id and hour_bucket is null),
    'performance_without_gmv_orders', (select count(*) from public.live_session_performance where workspace_id=p_workspace_id and coalesce(gmv,0)=0 and coalesce(orders,0)=0),
    'campaigns', (select count(*) from public.live_campaigns where workspace_id=p_workspace_id),
    'campaign_sessions_unlinked', (
      select count(*) from public.live_sessions where workspace_id=p_workspace_id and nullif(trim(coalesce(campaign_name,'')),'') is not null and campaign_id is null
    ),
    'latest_metric_date', (select max(metric_date) from public.live_session_performance where workspace_id=p_workspace_id),
    'latest_import_at', (select max(created_at) from public.live_imports where workspace_id=p_workspace_id)
  ) into v;
  return coalesce(v,'{}'::jsonb);
end $$;

revoke all on function public.luma_live_data_health_v1(uuid) from public,anon;
grant execute on function public.luma_live_data_health_v1(uuid) to authenticated,service_role;
