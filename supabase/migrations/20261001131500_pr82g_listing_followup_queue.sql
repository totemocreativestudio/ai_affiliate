-- PR82G: Listing follow-up queue

alter table public.listings
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists follow_up_priority text not null default 'normal',
  add column if not exists follow_up_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='listings_follow_up_priority_check'
  ) then
    alter table public.listings
      add constraint listings_follow_up_priority_check
      check(follow_up_priority in ('low','normal','high','urgent'));
  end if;
end $$;

create index if not exists listings_workspace_next_followup_idx
  on public.listings(workspace_id,next_follow_up_at)
  where next_follow_up_at is not null;

create or replace function public.luma_listing_followup_queue_v1(
  p_workspace_id uuid
)
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

  with base as (
    select
      l.id,l.creator_id,l.creator_name,l.platform,l.product_name,l.sku,l.stage,
      l.follow_up_channel,l.next_action,l.next_follow_up_at,l.follow_up_priority,
      l.follow_up_completed_at,
      case
        when l.next_follow_up_at is null then 'no_schedule'
        when l.follow_up_completed_at is not null and l.follow_up_completed_at>=l.next_follow_up_at then 'done'
        when l.next_follow_up_at<now() then 'overdue'
        when (l.next_follow_up_at at time zone 'Asia/Jakarta')::date=(now() at time zone 'Asia/Jakarta')::date then 'today'
        when l.next_follow_up_at<now()+interval '7 days' then 'upcoming'
        else 'later'
      end queue_status
    from public.listings l
    where l.workspace_id=p_workspace_id
  ),
  active as (
    select * from base
    where queue_status<>'done'
      and (
        stage not in ('Won / Active','Lost / Inactive')
        or next_follow_up_at is not null
      )
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
  )
  into result
  from active;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_listing_followup_queue_v1(uuid) from public,anon;
grant execute on function public.luma_listing_followup_queue_v1(uuid) to authenticated,service_role;
