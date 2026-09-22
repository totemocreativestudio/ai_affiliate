-- Customer 360 activity metrics: LIVE, video, clicks, CTR, samples and refunds.
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
    and s.creator_id=p_creator_id
    and coalesce(s.data_type,'sales') <> 'product_performance';

  with metric as (
    select
      coalesce(sum(s.live_count),0) live_count,
      coalesce(sum(s.video_count),0) video_count,
      coalesce(sum(s.clicks),0) clicks,
      coalesce(sum(s.buyers),0) buyers,
      coalesce(sum(s.new_buyers),0) new_buyers,
      coalesce(sum(s.impressions),0) impressions,
      coalesce(sum(s.video_views),0) video_views,
      coalesce(sum(s.sample_content),0) sample_content,
      coalesce(sum(s.sample_sent),0) platform_sample_sent,
      coalesce(sum(s.refund),0) refund_gmv,
      coalesce(sum(s.refund_qty),0) refund_qty,
      case
        when coalesce(sum(s.impressions),0)>0
          then round(coalesce(sum(s.clicks),0) * 100.0 / nullif(sum(s.impressions),0),2)
        else round(coalesce(avg(nullif(s.ctr,0)),0),2)
      end ctr
    from public.sales s
    where s.workspace_id=p_workspace_id
      and s.creator_id=p_creator_id
      and coalesce(s.data_type,'sales') <> 'product_performance'
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
  ),
  manual_sample as (
    select coalesce(sum(coalesce(cs.qty,1)),0) qty
    from public.creator_samples cs
    where cs.workspace_id=p_workspace_id
      and (
        cs.creator_id=p_creator_id
        or (
          cs.creator_id is null
          and lower(coalesce(cs.creator_name,'')) = lower(coalesce((
            select c.name from public.creators c
            where c.id=p_creator_id and c.workspace_id=p_workspace_id
          ),''))
        )
      )
      and lower(coalesce(cs.sample_status,'sent')) not in ('cancelled','canceled','rejected','returned')
      and (p_start_date is null or cs.sent_date>=p_start_date)
      and (p_end_date is null or cs.sent_date<=p_end_date)
  )
  select jsonb_build_object(
    'live_count',m.live_count,
    'video_count',m.video_count,
    'clicks',m.clicks,
    'buyers',m.buyers,
    'new_buyers',m.new_buyers,
    'impressions',m.impressions,
    'video_views',m.video_views,
    'sample_content',m.sample_content,
    'sample_sent',m.platform_sample_sent,
    'manual_sample_sent',ms.qty,
    'sample_sent_total',m.platform_sample_sent+ms.qty,
    'refund',m.refund_gmv,
    'refund_qty',m.refund_qty,
    'ctr',m.ctr,
    'latest_data_date',v_latest
  )
  into v_result
  from metric m cross join manual_sample ms;

  return coalesce(v_result,jsonb_build_object(
    'live_count',0,'video_count',0,'clicks',0,'buyers',0,'new_buyers',0,
    'impressions',0,'video_views',0,'sample_content',0,'sample_sent',0,
    'manual_sample_sent',0,'sample_sent_total',0,'refund',0,'refund_qty',0,'ctr',0,
    'latest_data_date',v_latest
  ));
end
$function$;

grant execute on function public.get_creator_360_activity(uuid,bigint,date,date) to authenticated;
