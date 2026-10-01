-- PR81G: Operational Alert Center + threshold rules

create table if not exists public.luma_operational_alert_rules (
  id bigserial primary key,
  name text not null,
  metric_key text not null check(metric_key in (
    'api_error_rate_15m','p95_latency_24h','failed_imports_24h',
    'failed_webhooks_24h','stale_checkout_intents','open_issues'
  )),
  operator text not null default 'gte' check(operator in ('gt','gte')),
  threshold numeric not null default 0,
  severity text not null default 'warning' check(severity in ('info','warning','critical')),
  notify_email boolean not null default false,
  email_recipients text[] not null default '{}'::text[],
  cooldown_minutes integer not null default 60,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.luma_operational_alert_events (
  id bigserial primary key,
  rule_id bigint not null references public.luma_operational_alert_rules(id) on delete cascade,
  metric_key text not null,
  severity text not null,
  metric_value numeric not null,
  threshold numeric not null,
  status text not null default 'open' check(status in ('open','resolved')),
  message text not null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  last_notified_at timestamptz
);

create index if not exists luma_alert_events_status_idx
  on public.luma_operational_alert_events(status,opened_at desc);
create index if not exists luma_alert_events_rule_idx
  on public.luma_operational_alert_events(rule_id,opened_at desc);

alter table public.luma_operational_alert_rules enable row level security;
alter table public.luma_operational_alert_events enable row level security;

drop policy if exists luma_alert_rules_admin_select on public.luma_operational_alert_rules;
create policy luma_alert_rules_admin_select on public.luma_operational_alert_rules
for select to authenticated using(public.luma_is_admin());
drop policy if exists luma_alert_rules_admin_write on public.luma_operational_alert_rules;
create policy luma_alert_rules_admin_write on public.luma_operational_alert_rules
for all to authenticated using(public.luma_is_admin()) with check(public.luma_is_admin());

drop policy if exists luma_alert_events_admin_select on public.luma_operational_alert_events;
create policy luma_alert_events_admin_select on public.luma_operational_alert_events
for select to authenticated using(public.luma_is_admin());
drop policy if exists luma_alert_events_admin_update on public.luma_operational_alert_events;
create policy luma_alert_events_admin_update on public.luma_operational_alert_events
for update to authenticated using(public.luma_is_admin()) with check(public.luma_is_admin());

insert into public.luma_operational_alert_rules(name,metric_key,operator,threshold,severity,notify_email,cooldown_minutes)
values
  ('API Error Rate tinggi','api_error_rate_15m','gte',5,'critical',false,30),
  ('P95 Latency tinggi','p95_latency_24h','gte',1500,'warning',false,60),
  ('Import gagal 24 jam','failed_imports_24h','gte',1,'warning',false,60),
  ('Payment webhook gagal','failed_webhooks_24h','gte',1,'critical',false,30),
  ('Checkout intent stale','stale_checkout_intents','gte',1,'warning',false,30),
  ('Open issue menumpuk','open_issues','gte',10,'warning',false,120)
on conflict do nothing;

create or replace function public.luma_evaluate_operational_alerts_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  r public.luma_operational_alert_rules%rowtype;
  current_value numeric;
  triggered boolean;
  existing_event public.luma_operational_alert_events%rowtype;
  new_events jsonb:='[]'::jsonb;
begin
  for r in select * from public.luma_operational_alert_rules where active loop
    current_value:=case r.metric_key
      when 'api_error_rate_15m' then (
        select case when count(*)=0 then 0 else
          round((count(*) filter(where lower(coalesce(status,'')) not in ('success','ok','paid','ready')))::numeric/count(*)::numeric*100,2)
        end from public.luma_api_usage_events where created_at>=now()-interval '15 minutes'
      )
      when 'p95_latency_24h' then (
        select coalesce(percentile_cont(.95) within group(order by latency_ms),0)
        from public.luma_api_usage_events where created_at>=now()-interval '24 hours' and latency_ms is not null
      )
      when 'failed_imports_24h' then (
        select count(*) from public.imports where lower(coalesce(status,''))='error' and imported_at>=now()-interval '24 hours'
      )
      when 'failed_webhooks_24h' then (
        select count(*) from public.luma_payment_webhook_events where processing_status='failed' and created_at>=now()-interval '24 hours'
      )
      when 'stale_checkout_intents' then (
        select count(*) from public.luma_payment_checkout_intents
        where status in ('processing','ready')
          and ((expires_at is not null and expires_at<now()) or (status='processing' and created_at<now()-interval '10 minutes'))
      )
      when 'open_issues' then (
        select count(*) from public.luma_issue_logs where lower(coalesce(status,''))<>'resolved'
      )
      else 0
    end;

    triggered:=case r.operator when 'gt' then current_value>r.threshold else current_value>=r.threshold end;

    select * into existing_event
    from public.luma_operational_alert_events
    where rule_id=r.id and status='open'
    order by opened_at desc limit 1;

    if triggered then
      if existing_event.id is null then
        insert into public.luma_operational_alert_events(rule_id,metric_key,severity,metric_value,threshold,message)
        values(r.id,r.metric_key,r.severity,current_value,r.threshold,
          r.name||' · current='||current_value||' threshold='||r.threshold)
        returning * into existing_event;

        new_events:=new_events||jsonb_build_array(jsonb_build_object(
          'event_id',existing_event.id,
          'rule_id',r.id,
          'name',r.name,
          'metric_key',r.metric_key,
          'severity',r.severity,
          'metric_value',current_value,
          'threshold',r.threshold,
          'notify_email',r.notify_email,
          'email_recipients',to_jsonb(r.email_recipients),
          'message',existing_event.message
        ));
      else
        update public.luma_operational_alert_events
        set metric_value=current_value,
            threshold=r.threshold,
            message=r.name||' · current='||current_value||' threshold='||r.threshold
        where id=existing_event.id;
      end if;
    elsif existing_event.id is not null then
      update public.luma_operational_alert_events
      set status='resolved',resolved_at=now(),metric_value=current_value
      where id=existing_event.id;
    end if;
  end loop;

  return jsonb_build_object('checked_at',now(),'new_events',new_events);
end
$$;

revoke all on function public.luma_evaluate_operational_alerts_v1() from public,anon,authenticated;
grant execute on function public.luma_evaluate_operational_alerts_v1() to service_role;
