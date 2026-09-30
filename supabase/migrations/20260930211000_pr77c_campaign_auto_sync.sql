-- PR77C: Automatically refresh Campaign Tracker metrics after Affiliate Performance imports

create or replace function public.luma_sync_workspace_campaign_performance_v1(
  p_workspace_id uuid,
  p_start_date date default null,
  p_end_date date default null,
  p_platform text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_campaign record;
  v_count integer:=0;
  v_results jsonb:='[]'::jsonb;
  v_result jsonb;
begin
  if auth.role()<>'service_role' and auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if auth.role()<>'service_role' and not public.luma_has_workspace(p_workspace_id) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  for v_campaign in
    select id
    from public.campaign_trackers c
    where c.workspace_id=p_workspace_id
      and lower(coalesce(c.status,'')) not in ('cancelled','canceled')
      and (
        p_start_date is null
        or coalesce(c.end_date,current_date)>=p_start_date
      )
      and (
        p_end_date is null
        or coalesce(c.start_date,c.created_at::date)<=p_end_date
      )
      and (
        nullif(trim(coalesce(p_platform,'')),'') is null
        or nullif(trim(coalesce(c.platform,'')),'') is null
        or lower(trim(c.platform))=lower(trim(p_platform))
      )
    order by c.id
  loop
    v_result:=public.luma_sync_campaign_performance_v1(p_workspace_id,v_campaign.id);
    v_results:=v_results||jsonb_build_array(v_result);
    v_count:=v_count+1;
  end loop;

  return jsonb_build_object(
    'ok',true,
    'workspace_id',p_workspace_id,
    'campaigns_synced',v_count,
    'results',v_results,
    'synced_at',now()
  );
end
$$;

revoke all on function public.luma_sync_workspace_campaign_performance_v1(uuid,date,date,text) from public,anon;
grant execute on function public.luma_sync_workspace_campaign_performance_v1(uuid,date,date,text) to authenticated,service_role;

comment on function public.luma_sync_workspace_campaign_performance_v1(uuid,date,date,text) is
'Refreshes non-cancelled Campaign Tracker creator performance affected by an Affiliate Performance import.';
