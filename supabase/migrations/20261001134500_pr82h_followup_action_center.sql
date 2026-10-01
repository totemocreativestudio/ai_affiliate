-- PR82H: Listing follow-up Action Center automation

create index if not exists luma_action_items_listing_followup_lookup_idx
  on public.luma_action_items(workspace_id,source_type,source_id,status)
  where source_type='listing_followup';

create or replace function public.luma_sync_listing_followup_actions_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  l record;
  existing_id bigint;
  created_count int:=0;
  updated_count int:=0;
  resolved_count int:=0;
  severity_value text;
begin
  for l in
    select *
    from public.listings
    where next_follow_up_at is not null
      and next_follow_up_at<=now()+interval '7 days'
      and (follow_up_completed_at is null or follow_up_completed_at<next_follow_up_at)
      and (
        stage not in ('Won / Active','Lost / Inactive')
        or next_follow_up_at is not null
      )
  loop
    severity_value:=case coalesce(l.follow_up_priority,'normal')
      when 'urgent' then 'critical'
      when 'high' then 'high'
      when 'low' then 'low'
      else 'normal'
    end;

    select id into existing_id
    from public.luma_action_items
    where workspace_id=l.workspace_id
      and source_type='listing_followup'
      and source_id=l.id::text
      and status='open'
    order by id desc
    limit 1;

    if existing_id is null then
      insert into public.luma_action_items(
        workspace_id,source_type,source_id,title,description,severity,status,due_date,action_route,metadata,created_by
      )
      values(
        l.workspace_id,
        'listing_followup',
        l.id::text,
        'Follow up '||coalesce(nullif(l.creator_name,''),'creator'),
        concat_ws(' · ',
          nullif(l.follow_up_channel,''),
          nullif(l.next_action,''),
          nullif(coalesce(l.product_name,l.sku),'')
        ),
        severity_value,
        'open',
        (l.next_follow_up_at at time zone 'Asia/Jakarta')::date,
        'listings',
        jsonb_build_object(
          'listing_id',l.id,
          'creator_id',l.creator_id,
          'creator_name',l.creator_name,
          'follow_up_channel',l.follow_up_channel,
          'next_follow_up_at',l.next_follow_up_at,
          'follow_up_priority',l.follow_up_priority,
          'stage',l.stage
        ),
        null
      );
      created_count:=created_count+1;
    else
      update public.luma_action_items
      set
        title='Follow up '||coalesce(nullif(l.creator_name,''),'creator'),
        description=concat_ws(' · ',
          nullif(l.follow_up_channel,''),
          nullif(l.next_action,''),
          nullif(coalesce(l.product_name,l.sku),'')
        ),
        severity=severity_value,
        due_date=(l.next_follow_up_at at time zone 'Asia/Jakarta')::date,
        metadata=jsonb_build_object(
          'listing_id',l.id,
          'creator_id',l.creator_id,
          'creator_name',l.creator_name,
          'follow_up_channel',l.follow_up_channel,
          'next_follow_up_at',l.next_follow_up_at,
          'follow_up_priority',l.follow_up_priority,
          'stage',l.stage
        ),
        updated_at=now()
      where id=existing_id;
      updated_count:=updated_count+1;
    end if;
  end loop;

  update public.luma_action_items ai
  set status='done',updated_at=now()
  where ai.source_type='listing_followup'
    and ai.status='open'
    and not exists(
      select 1
      from public.listings l
      where l.workspace_id=ai.workspace_id
        and l.id::text=ai.source_id
        and l.next_follow_up_at is not null
        and l.next_follow_up_at<=now()+interval '7 days'
        and (l.follow_up_completed_at is null or l.follow_up_completed_at<l.next_follow_up_at)
    );

  get diagnostics resolved_count=row_count;

  return jsonb_build_object(
    'checked_at',now(),
    'created',created_count,
    'updated',updated_count,
    'resolved',resolved_count
  );
end
$$;

revoke all on function public.luma_sync_listing_followup_actions_v1() from public,anon,authenticated;
grant execute on function public.luma_sync_listing_followup_actions_v1() to service_role;
