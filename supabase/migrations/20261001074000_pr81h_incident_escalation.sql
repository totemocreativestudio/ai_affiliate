-- PR81H: Incident timeline + escalation

create table if not exists public.luma_incidents (
  id bigserial primary key,
  alert_event_id bigint unique references public.luma_operational_alert_events(id) on delete set null,
  title text not null,
  severity text not null check(severity in ('info','warning','critical')),
  status text not null default 'open' check(status in ('open','acknowledged','investigating','monitoring','resolved')),
  assignee_user_id uuid references public.profiles(id) on delete set null,
  escalation_level smallint not null default 0 check(escalation_level between 0 and 3),
  sla_ack_due_at timestamptz,
  sla_resolve_due_at timestamptz,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.luma_incident_timeline (
  id bigserial primary key,
  incident_id bigint not null references public.luma_incidents(id) on delete cascade,
  event_type text not null check(event_type in ('created','acknowledged','status_change','assigned','note','escalated','resolved')),
  note text,
  from_status text,
  to_status text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists luma_incidents_status_idx on public.luma_incidents(status,severity,created_at desc);
create index if not exists luma_incident_timeline_incident_idx on public.luma_incident_timeline(incident_id,created_at desc);

alter table public.luma_incidents enable row level security;
alter table public.luma_incident_timeline enable row level security;

drop policy if exists luma_incidents_admin_select on public.luma_incidents;
create policy luma_incidents_admin_select on public.luma_incidents
for select to authenticated using(public.luma_is_admin());

drop policy if exists luma_incidents_admin_insert on public.luma_incidents;
create policy luma_incidents_admin_insert on public.luma_incidents
for insert to authenticated with check(public.luma_is_admin());

drop policy if exists luma_incidents_admin_update on public.luma_incidents;
create policy luma_incidents_admin_update on public.luma_incidents
for update to authenticated using(public.luma_is_admin()) with check(public.luma_is_admin());

drop policy if exists luma_incident_timeline_admin_select on public.luma_incident_timeline;
create policy luma_incident_timeline_admin_select on public.luma_incident_timeline
for select to authenticated using(public.luma_is_admin());

drop policy if exists luma_incident_timeline_admin_insert on public.luma_incident_timeline;
create policy luma_incident_timeline_admin_insert on public.luma_incident_timeline
for insert to authenticated with check(public.luma_is_admin());

create or replace function public.luma_incident_sla_v1(p_severity text)
returns jsonb
language sql
immutable
set search_path=public,pg_temp
as $$
  select case lower(coalesce(p_severity,'warning'))
    when 'critical' then jsonb_build_object('ack_minutes',15,'resolve_minutes',120)
    when 'warning' then jsonb_build_object('ack_minutes',60,'resolve_minutes',480)
    else jsonb_build_object('ack_minutes',240,'resolve_minutes',1440)
  end;
$$;

create or replace function public.luma_sync_alert_incidents_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  e record;
  sla jsonb;
  incident_id bigint;
  created_count int:=0;
  resolved_count int:=0;
begin
  for e in
    select ae.id,ae.severity,ae.message,ae.status,ar.name
    from public.luma_operational_alert_events ae
    join public.luma_operational_alert_rules ar on ar.id=ae.rule_id
    order by ae.opened_at asc
  loop
    select id into incident_id from public.luma_incidents where alert_event_id=e.id limit 1;

    if e.status='open' and incident_id is null then
      sla:=public.luma_incident_sla_v1(e.severity);
      insert into public.luma_incidents(
        alert_event_id,title,severity,status,sla_ack_due_at,sla_resolve_due_at,created_by
      )
      values(
        e.id,e.name,e.severity,'open',
        now()+make_interval(mins=>(sla->>'ack_minutes')::int),
        now()+make_interval(mins=>(sla->>'resolve_minutes')::int),
        null
      ) returning id into incident_id;

      insert into public.luma_incident_timeline(incident_id,event_type,note)
      values(incident_id,'created',e.message);
      created_count:=created_count+1;

    elsif e.status='resolved' and incident_id is not null then
      update public.luma_incidents
      set status='resolved',resolved_at=coalesce(resolved_at,now()),updated_at=now()
      where id=incident_id and status<>'resolved';

      if found then
        insert into public.luma_incident_timeline(incident_id,event_type,note,from_status,to_status)
        values(incident_id,'resolved','Alert source returned to normal.','monitoring','resolved');
        resolved_count:=resolved_count+1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('created',created_count,'resolved',resolved_count,'checked_at',now());
end
$$;

revoke all on function public.luma_sync_alert_incidents_v1() from public,anon,authenticated;
grant execute on function public.luma_sync_alert_incidents_v1() to service_role;

create or replace function public.luma_owner_update_incident_v1(
  p_incident_id bigint,
  p_status text default null,
  p_assignee_user_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  old_row public.luma_incidents%rowtype;
  new_status text;
begin
  if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;

  select * into old_row from public.luma_incidents where id=p_incident_id for update;
  if old_row.id is null then raise exception 'Incident not found'; end if;

  new_status:=coalesce(p_status,old_row.status);
  if new_status not in ('open','acknowledged','investigating','monitoring','resolved') then
    raise exception 'Invalid incident status';
  end if;

  update public.luma_incidents
  set
    status=new_status,
    assignee_user_id=coalesce(p_assignee_user_id,assignee_user_id),
    acknowledged_at=case
      when new_status in ('acknowledged','investigating','monitoring','resolved') then coalesce(acknowledged_at,now())
      else acknowledged_at end,
    resolved_at=case when new_status='resolved' then coalesce(resolved_at,now()) else resolved_at end,
    updated_at=now()
  where id=p_incident_id;

  if p_assignee_user_id is not null and p_assignee_user_id is distinct from old_row.assignee_user_id then
    insert into public.luma_incident_timeline(incident_id,event_type,note,actor_user_id)
    values(p_incident_id,'assigned','Incident assigned.',auth.uid());

    insert into public.user_notifications(user_id,title,message,kind,is_read,action_url,dedupe_key)
    values(p_assignee_user_id,'Incident assigned: '||old_row.title,'Anda ditugaskan menangani incident '||old_row.title,'system_incident',false,'/owner/monitoring','incident-assigned-'||p_incident_id||'-'||p_assignee_user_id)
    on conflict(dedupe_key) do nothing;
  end if;

  if new_status is distinct from old_row.status then
    insert into public.luma_incident_timeline(incident_id,event_type,from_status,to_status,note,actor_user_id)
    values(
      p_incident_id,
      case when new_status='resolved' then 'resolved'
           when new_status='acknowledged' then 'acknowledged'
           else 'status_change' end,
      old_row.status,new_status,null,auth.uid()
    );
  end if;

  if nullif(trim(coalesce(p_note,'')),'') is not null then
    insert into public.luma_incident_timeline(incident_id,event_type,note,actor_user_id)
    values(p_incident_id,'note',trim(p_note),auth.uid());
  end if;

  return jsonb_build_object('ok',true,'incident_id',p_incident_id,'status',new_status);
end
$$;

revoke all on function public.luma_owner_update_incident_v1(bigint,text,uuid,text) from public,anon;
grant execute on function public.luma_owner_update_incident_v1(bigint,text,uuid,text) to authenticated;

create or replace function public.luma_escalate_incidents_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  i record;
  next_level int;
  escalated jsonb:='[]'::jsonb;
begin
  for i in
    select *
    from public.luma_incidents
    where status<>'resolved'
      and escalation_level<3
      and (
        (acknowledged_at is null and sla_ack_due_at is not null and now()>sla_ack_due_at)
        or (sla_resolve_due_at is not null and now()>sla_resolve_due_at)
      )
  loop
    next_level:=least(3,i.escalation_level+1);

    update public.luma_incidents
    set escalation_level=next_level,updated_at=now()
    where id=i.id;

    insert into public.luma_incident_timeline(incident_id,event_type,note)
    values(i.id,'escalated','Escalation level '||next_level||' triggered because SLA target was exceeded.');

    if i.assignee_user_id is not null then
      insert into public.user_notifications(user_id,title,message,kind,is_read,action_url,dedupe_key)
      values(
        i.assignee_user_id,
        'Incident escalation L'||next_level||': '||i.title,
        'SLA incident terlewati. Buka Owner Platform Health untuk tindak lanjut.',
        'system_incident',false,'/owner/monitoring',
        'incident-escalation-'||i.id||'-'||next_level
      )
      on conflict(dedupe_key) do nothing;
    end if;

    escalated:=escalated||jsonb_build_array(jsonb_build_object(
      'incident_id',i.id,'title',i.title,'severity',i.severity,'level',next_level,'assignee_user_id',i.assignee_user_id
    ));
  end loop;

  return jsonb_build_object('checked_at',now(),'escalated',escalated);
end
$$;

revoke all on function public.luma_escalate_incidents_v1() from public,anon,authenticated;
grant execute on function public.luma_escalate_incidents_v1() to service_role;
