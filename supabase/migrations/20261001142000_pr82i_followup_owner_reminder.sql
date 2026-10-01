-- PR82I: Follow-up PIC & targeted reminder

alter table public.listings
  add column if not exists follow_up_owner_user_id uuid references public.profiles(id) on delete set null;

create index if not exists listings_workspace_followup_owner_idx
  on public.listings(workspace_id,follow_up_owner_user_id,next_follow_up_at);

create or replace function public.luma_sync_listing_followup_actions_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  rec record;
  existing_id bigint;
  created_count int:=0;
  updated_count int:=0;
  resolved_count int:=0;
  notified_count int:=0;
  severity_value text;
  reminder_key text;
begin
  for rec in
    select l.*
    from public.listings l
    where l.next_follow_up_at is not null
      and l.next_follow_up_at<=now()+interval '7 days'
      and (l.follow_up_completed_at is null or l.follow_up_completed_at<l.next_follow_up_at)
  loop
    severity_value:=case coalesce(rec.follow_up_priority,'normal')
      when 'urgent' then 'critical'
      when 'high' then 'high'
      when 'low' then 'low'
      else 'normal'
    end;

    select id into existing_id
    from public.luma_action_items
    where workspace_id=rec.workspace_id
      and source_type='listing_followup'
      and source_id=rec.id::text
      and status='open'
    order by id desc limit 1;

    if existing_id is null then
      insert into public.luma_action_items(
        workspace_id,source_type,source_id,title,description,severity,status,due_date,action_route,metadata,created_by
      )
      values(
        rec.workspace_id,'listing_followup',rec.id::text,
        'Follow up '||coalesce(nullif(rec.creator_name,''),'creator'),
        concat_ws(' · ',nullif(rec.follow_up_channel,''),nullif(rec.next_action,''),nullif(coalesce(rec.product_name,rec.sku),'')),
        severity_value,'open',
        (rec.next_follow_up_at at time zone 'Asia/Jakarta')::date,
        'listings',
        jsonb_build_object(
          'listing_id',rec.id,'creator_id',rec.creator_id,'creator_name',rec.creator_name,
          'follow_up_channel',rec.follow_up_channel,'next_follow_up_at',rec.next_follow_up_at,
          'follow_up_priority',rec.follow_up_priority,'follow_up_owner_user_id',rec.follow_up_owner_user_id,'stage',rec.stage
        ),
        null
      );
      created_count:=created_count+1;
    else
      update public.luma_action_items set
        title='Follow up '||coalesce(nullif(rec.creator_name,''),'creator'),
        description=concat_ws(' · ',nullif(rec.follow_up_channel,''),nullif(rec.next_action,''),nullif(coalesce(rec.product_name,rec.sku),'')),
        severity=severity_value,
        due_date=(rec.next_follow_up_at at time zone 'Asia/Jakarta')::date,
        metadata=jsonb_build_object(
          'listing_id',rec.id,'creator_id',rec.creator_id,'creator_name',rec.creator_name,
          'follow_up_channel',rec.follow_up_channel,'next_follow_up_at',rec.next_follow_up_at,
          'follow_up_priority',rec.follow_up_priority,'follow_up_owner_user_id',rec.follow_up_owner_user_id,'stage',rec.stage
        ),
        updated_at=now()
      where id=existing_id;
      updated_count:=updated_count+1;
    end if;

    if rec.follow_up_owner_user_id is not null
       and rec.next_follow_up_at<=now()+interval '24 hours'
       and exists(
         select 1 from public.workspace_members wm
         where wm.workspace_id=rec.workspace_id and wm.user_id=rec.follow_up_owner_user_id
       ) then
      reminder_key:='listing-followup-'||rec.id||'-'||to_char(rec.next_follow_up_at at time zone 'UTC','YYYYMMDDHH24MI');
      insert into public.user_notifications(
        user_id,workspace_id,title,message,kind,is_read,action_url,dedupe_key
      )
      values(
        rec.follow_up_owner_user_id,
        rec.workspace_id,
        case when rec.next_follow_up_at<now() then 'Follow up creator overdue' else 'Follow up creator segera jatuh tempo' end,
        coalesce(rec.creator_name,'Creator')||' · '||
          coalesce(rec.follow_up_channel,'Channel belum ditentukan')||' · '||
          to_char(rec.next_follow_up_at at time zone 'Asia/Jakarta','DD Mon YYYY HH24:MI'),
        'listing_followup',
        false,
        '/dashboard?section=listings',
        reminder_key
      )
      on conflict(dedupe_key) do nothing;

      if found then notified_count:=notified_count+1; end if;
    end if;
  end loop;

  update public.luma_action_items ai
  set status='done',updated_at=now()
  where ai.source_type='listing_followup'
    and ai.status='open'
    and not exists(
      select 1 from public.listings s
      where s.workspace_id=ai.workspace_id
        and s.id::text=ai.source_id
        and s.next_follow_up_at is not null
        and s.next_follow_up_at<=now()+interval '7 days'
        and (s.follow_up_completed_at is null or s.follow_up_completed_at<s.next_follow_up_at)
    );
  get diagnostics resolved_count=row_count;

  return jsonb_build_object(
    'checked_at',now(),'created',created_count,'updated',updated_count,
    'resolved',resolved_count,'notified',notified_count
  );
end
$$;

revoke all on function public.luma_sync_listing_followup_actions_v1() from public,anon,authenticated;
grant execute on function public.luma_sync_listing_followup_actions_v1() to service_role;
