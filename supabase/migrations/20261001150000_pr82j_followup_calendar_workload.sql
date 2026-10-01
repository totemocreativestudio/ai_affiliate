-- PR82J: Follow-up calendar & team workload

create or replace function public.luma_listing_followup_calendar_v1(
  p_workspace_id uuid,
  p_month_start date
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  month_end date;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  month_end:=(p_month_start + interval '1 month - 1 day')::date;

  with base as (
    select
      l.id,l.creator_id,l.creator_name,l.platform,l.product_name,l.sku,l.stage,
      l.follow_up_channel,l.next_action,l.next_follow_up_at,l.follow_up_priority,
      l.follow_up_completed_at,l.follow_up_owner_user_id,
      coalesce(p.full_name,p.username,p.email) follow_up_owner_name,
      (l.next_follow_up_at at time zone 'Asia/Jakarta')::date local_date
    from public.listings l
    left join public.profiles p on p.id=l.follow_up_owner_user_id
    where l.workspace_id=p_workspace_id
      and l.next_follow_up_at is not null
  ),
  month_items as (
    select *
    from base
    where local_date between p_month_start and month_end
  ),
  overdue as (
    select *
    from base
    where next_follow_up_at<now()
      and (follow_up_completed_at is null or follow_up_completed_at<next_follow_up_at)
    order by next_follow_up_at asc
    limit 100
  ),
  members as (
    select wm.user_id,coalesce(p.full_name,p.username,p.email) name
    from public.workspace_members wm
    join public.profiles p on p.id=wm.user_id
    where wm.workspace_id=p_workspace_id and p.active=true
  ),
  workload as (
    select
      m.user_id,m.name,
      count(mi.id) filter(where mi.follow_up_owner_user_id=m.user_id)::bigint scheduled,
      count(mi.id) filter(where mi.follow_up_owner_user_id=m.user_id and mi.next_follow_up_at<now() and (mi.follow_up_completed_at is null or mi.follow_up_completed_at<mi.next_follow_up_at))::bigint overdue,
      count(mi.id) filter(where mi.follow_up_owner_user_id=m.user_id and mi.local_date=(now() at time zone 'Asia/Jakarta')::date)::bigint today,
      count(mi.id) filter(where mi.follow_up_owner_user_id=m.user_id and mi.follow_up_priority in ('urgent','high'))::bigint high_priority,
      count(mi.id) filter(where mi.follow_up_owner_user_id=m.user_id and mi.follow_up_completed_at is not null and mi.follow_up_completed_at>=mi.next_follow_up_at)::bigint completed
    from members m
    left join month_items mi on mi.follow_up_owner_user_id=m.user_id
    group by m.user_id,m.name
  )
  select jsonb_build_object(
    'month_start',p_month_start,
    'month_end',month_end,
    'items',coalesce((select jsonb_agg(to_jsonb(x) order by x.next_follow_up_at) from month_items x),'[]'::jsonb),
    'overdue',coalesce((select jsonb_agg(to_jsonb(x) order by x.next_follow_up_at) from overdue x),'[]'::jsonb),
    'workload',coalesce((select jsonb_agg(to_jsonb(w) order by w.scheduled desc,w.name) from workload w),'[]'::jsonb)
  ) into result;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_listing_followup_calendar_v1(uuid,date) from public,anon;
grant execute on function public.luma_listing_followup_calendar_v1(uuid,date) to authenticated,service_role;
