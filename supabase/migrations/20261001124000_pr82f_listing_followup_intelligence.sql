-- PR82F: Listing follow-up intelligence

create or replace function public.luma_listing_followup_intelligence_v1(
  p_workspace_id uuid,
  p_start_date date default null,
  p_end_date date default null
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

  with listing_base as (
    select *
    from public.listings l
    where l.workspace_id=p_workspace_id
      and (p_start_date is null or l.data_date>=p_start_date)
      and (p_end_date is null or l.data_date<=p_end_date)
  ),
  activity_base as (
    select *
    from public.listing_activities a
    where a.workspace_id=p_workspace_id
      and a.activity_type in ('Reach Out','Follow Up','Negotiation','No Response')
      and (p_start_date is null or a.activity_date>=p_start_date)
      and (p_end_date is null or a.activity_date<=p_end_date)
  ),
  channels as (
    select coalesce(nullif(trim(l.follow_up_channel),''),'Belum ditentukan') channel,
      count(*)::bigint listings,
      count(*) filter(where l.stage='Won / Active')::bigint won_active
    from listing_base l
    group by 1
  ),
  activity_channels as (
    select coalesce(nullif(trim(a.follow_up_channel),''),'Belum ditentukan') channel,
      count(*) filter(where a.activity_type in ('Reach Out','Follow Up','Negotiation'))::bigint followup_activities,
      count(*) filter(where a.activity_type='No Response')::bigint no_response
    from activity_base a
    group by 1
  ),
  merged as (
    select
      coalesce(c.channel,a.channel) channel,
      coalesce(c.listings,0)::bigint listings,
      coalesce(c.won_active,0)::bigint won_active,
      coalesce(a.followup_activities,0)::bigint followup_activities,
      coalesce(a.no_response,0)::bigint no_response,
      case when coalesce(c.listings,0)>0 then round(coalesce(c.won_active,0)::numeric/c.listings::numeric*100,1) else 0 end association_rate
    from channels c
    full join activity_channels a on a.channel=c.channel
  )
  select jsonb_build_object(
    'generated_at',now(),
    'totals',jsonb_build_object(
      'listings',(select count(*) from listing_base),
      'followup_activities',(select count(*) from activity_base where activity_type in ('Reach Out','Follow Up','Negotiation')),
      'no_response',(select count(*) from activity_base where activity_type='No Response'),
      'won_active',(select count(*) from listing_base where stage='Won / Active')
    ),
    'channels',coalesce((select jsonb_agg(to_jsonb(m) order by m.listings desc,m.followup_activities desc) from merged m),'[]'::jsonb)
  )
  into result;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_listing_followup_intelligence_v1(uuid,date,date) from public,anon;
grant execute on function public.luma_listing_followup_intelligence_v1(uuid,date,date) to authenticated,service_role;
