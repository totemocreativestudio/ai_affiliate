-- PR82L: Multi-user privacy boundary

drop policy if exists pr45_luma_platform_settings_select_auth on public.luma_platform_settings;
create policy pr45_luma_platform_settings_select_auth on public.luma_platform_settings
for select to authenticated
using(public.luma_is_admin());

create or replace function public.luma_safe_workspace_assignees_v1(p_workspace_id uuid)
returns table(user_id uuid,safe_label text,is_self boolean)
language sql
security definer
set search_path=public,pg_temp
as $$
  with allowed as (
    select wm.user_id,row_number() over(order by wm.user_id)::int as seq
    from public.workspace_members wm
    where wm.workspace_id=p_workspace_id
  )
  select a.user_id,
    case when a.user_id=auth.uid() then 'Saya'
         else 'PIC '||lpad(a.seq::text,2,'0') end,
    (a.user_id=auth.uid())
  from allowed a
  where auth.uid() is not null
    and (public.luma_has_workspace(p_workspace_id) or public.luma_is_admin())
  order by case when a.user_id=auth.uid() then 0 else 1 end,a.seq;
$$;

revoke all on function public.luma_safe_workspace_assignees_v1(uuid) from public,anon;
grant execute on function public.luma_safe_workspace_assignees_v1(uuid) to authenticated,service_role;

comment on function public.luma_safe_workspace_assignees_v1(uuid)
is 'Member-facing privacy-safe assignee directory. Never returns profile name, email, username, role, or owner identity.';

create or replace function public.luma_listing_followup_queue_v1(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  with aliases as (
    select * from public.luma_safe_workspace_assignees_v1(p_workspace_id)
  ),
  base as (
    select l.id,l.creator_id,l.creator_name,l.platform,l.product_name,l.sku,l.stage,
      l.follow_up_channel,l.next_action,l.next_follow_up_at,l.follow_up_priority,
      l.follow_up_completed_at,l.follow_up_owner_user_id,
      a.safe_label follow_up_owner_name,
      case
        when l.next_follow_up_at is null then 'no_schedule'
        when l.follow_up_completed_at is not null and l.follow_up_completed_at>=l.next_follow_up_at then 'done'
        when l.next_follow_up_at<now() then 'overdue'
        when (l.next_follow_up_at at time zone 'Asia/Jakarta')::date=(now() at time zone 'Asia/Jakarta')::date then 'today'
        when l.next_follow_up_at<now()+interval '7 days' then 'upcoming'
        else 'later'
      end queue_status
    from public.listings l
    left join aliases a on a.user_id=l.follow_up_owner_user_id
    where l.workspace_id=p_workspace_id
  ),
  active as (
    select * from base
    where queue_status<>'done'
      and (stage not in ('Won / Active','Lost / Inactive') or next_follow_up_at is not null)
  )
  select jsonb_build_object(
    'generated_at',now(),
    'summary',jsonb_build_object(
      'overdue',count(*) filter(where queue_status='overdue'),
      'today',count(*) filter(where queue_status='today'),
      'upcoming',count(*) filter(where queue_status='upcoming'),
      'no_schedule',count(*) filter(where queue_status='no_schedule')
    ),
    'items',coalesce(jsonb_agg(to_jsonb(active) order by
      case follow_up_priority when 'urgent' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,
      next_follow_up_at asc nulls last
    ),'[]'::jsonb)
  ) into result
  from active;
  return coalesce(result,'{}'::jsonb);
end $$;

revoke all on function public.luma_listing_followup_queue_v1(uuid) from public,anon;
grant execute on function public.luma_listing_followup_queue_v1(uuid) to authenticated,service_role;

create or replace function public.luma_listing_followup_calendar_v1(p_workspace_id uuid,p_month_start date)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare month_end date; result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;
  month_end:=(p_month_start+interval '1 month - 1 day')::date;

  with aliases as (
    select * from public.luma_safe_workspace_assignees_v1(p_workspace_id)
  ),
  base as (
    select l.id,l.creator_id,l.creator_name,l.platform,l.product_name,l.sku,l.stage,
      l.follow_up_channel,l.next_action,l.next_follow_up_at,l.follow_up_priority,
      l.follow_up_completed_at,l.follow_up_owner_user_id,
      a.safe_label follow_up_owner_name,
      (l.next_follow_up_at at time zone 'Asia/Jakarta')::date local_date
    from public.listings l
    left join aliases a on a.user_id=l.follow_up_owner_user_id
    where l.workspace_id=p_workspace_id and l.next_follow_up_at is not null
  ),
  month_items as (
    select * from base where local_date between p_month_start and month_end
  ),
  overdue as (
    select * from base
    where next_follow_up_at<now()
      and (follow_up_completed_at is null or follow_up_completed_at<next_follow_up_at)
    order by next_follow_up_at asc limit 100
  ),
  members as (
    select user_id,safe_label name from aliases
  ),
  workload as (
    select m.user_id,m.name,
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
    'month_start',p_month_start,'month_end',month_end,
    'items',coalesce((select jsonb_agg(to_jsonb(x) order by x.next_follow_up_at) from month_items x),'[]'::jsonb),
    'overdue',coalesce((select jsonb_agg(to_jsonb(x) order by x.next_follow_up_at) from overdue x),'[]'::jsonb),
    'workload',coalesce((select jsonb_agg(to_jsonb(w) order by w.scheduled desc,w.name) from workload w),'[]'::jsonb)
  ) into result;
  return coalesce(result,'{}'::jsonb);
end $$;

revoke all on function public.luma_listing_followup_calendar_v1(uuid,date) from public,anon;
grant execute on function public.luma_listing_followup_calendar_v1(uuid,date) to authenticated,service_role;
