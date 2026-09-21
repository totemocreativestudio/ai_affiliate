-- Secured Customer 360 activity metrics for rolling/month/year filters.
create or replace function public.get_creator_360_activity(
  p_workspace_id uuid,
  p_creator_id bigint,
  p_start_date date default null,
  p_end_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_latest date;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if not (
    public.luma_is_admin()
    or exists(
      select 1 from public.workspace_members wm
      where wm.workspace_id=p_workspace_id
        and wm.user_id=auth.uid()
    )
  ) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  if not exists(
    select 1 from public.creators c
    where c.id=p_creator_id and c.workspace_id=p_workspace_id
  ) then
    raise exception 'Creator not found';
  end if;

  select max(s.data_date) into v_latest
  from public.sales s
  where s.workspace_id=p_workspace_id
    and s.creator_id=p_creator_id;

  select jsonb_build_object(
    'live_count',coalesce(sum(s.live_count),0),
    'video_count',coalesce(sum(s.video_count),0),
    'clicks',coalesce(sum(s.clicks),0),
    'buyers',coalesce(sum(s.buyers),0),
    'new_buyers',coalesce(sum(s.new_buyers),0),
    'impressions',coalesce(sum(s.impressions),0),
    'video_views',coalesce(sum(s.video_views),0),
    'sample_content',coalesce(sum(s.sample_content),0),
    'sample_sent',coalesce(sum(s.sample_sent),0),
    'latest_data_date',v_latest
  )
  into v_result
  from public.sales s
  where s.workspace_id=p_workspace_id
    and s.creator_id=p_creator_id
    and (p_start_date is null or s.data_date>=p_start_date)
    and (p_end_date is null or s.data_date<=p_end_date);

  return coalesce(v_result,jsonb_build_object(
    'live_count',0,'video_count',0,'clicks',0,'buyers',0,'new_buyers',0,
    'impressions',0,'video_views',0,'sample_content',0,'sample_sent',0,
    'latest_data_date',v_latest
  ));
end
$function$;

grant execute on function public.get_creator_360_activity(uuid,bigint,date,date) to authenticated;
