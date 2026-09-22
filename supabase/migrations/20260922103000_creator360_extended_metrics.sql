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
  v_manual_samples numeric := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not (
    public.luma_is_admin()
    or exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid())
  ) then raise exception 'Workspace access denied' using errcode='42501'; end if;

  select max(s.data_date) into v_latest
  from public.sales s
  where s.workspace_id=p_workspace_id and s.creator_id=p_creator_id;

  select coalesce(sum(cs.qty),0) into v_manual_samples
  from public.creator_samples cs
  where cs.workspace_id=p_workspace_id
    and cs.creator_id=p_creator_id
    and lower(coalesce(cs.sample_status,'sent')) not in ('cancelled','rejected')
    and (p_start_date is null or cs.sent_date>=p_start_date)
    and (p_end_date is null or cs.sent_date<=p_end_date);

  select jsonb_build_object(
    'live_count',coalesce(sum(s.live_count),0),
    'video_count',coalesce(sum(s.video_count),0),
    'clicks',coalesce(sum(s.clicks),0),
    'buyers',coalesce(sum(s.buyers),0),
    'new_buyers',coalesce(sum(s.new_buyers),0),
    'impressions',coalesce(sum(s.impressions),0),
    'video_views',coalesce(sum(s.video_views),0),
    'sample_content',coalesce(sum(s.sample_content),0),
    'sample_sent_data',coalesce(sum(s.sample_sent),0),
    'manual_samples',v_manual_samples,
    'samples_total',coalesce(sum(s.sample_sent),0)+v_manual_samples,
    'refund_qty',coalesce(sum(s.refund_qty),0),
    'ctr',coalesce(avg(nullif(s.ctr,0)),0),
    'latest_data_date',v_latest
  )
  into v_result
  from public.sales s
  where s.workspace_id=p_workspace_id
    and s.creator_id=p_creator_id
    and s.data_type in ('performance','sales')
    and (p_start_date is null or s.data_date>=p_start_date)
    and (p_end_date is null or s.data_date<=p_end_date);

  return coalesce(v_result,jsonb_build_object(
    'live_count',0,'video_count',0,'clicks',0,'buyers',0,'new_buyers',0,
    'impressions',0,'video_views',0,'sample_content',0,'sample_sent_data',0,
    'manual_samples',v_manual_samples,'samples_total',v_manual_samples,'refund_qty',0,'ctr',0,
    'latest_data_date',v_latest
  ));
end
$function$;

grant execute on function public.get_creator_360_activity(uuid,bigint,date,date) to authenticated;
