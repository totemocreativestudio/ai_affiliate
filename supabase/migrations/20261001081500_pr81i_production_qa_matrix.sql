-- PR81I: Production QA Matrix

create table if not exists public.luma_qa_definitions (
  id bigserial primary key,
  check_key text not null unique,
  area text not null,
  title text not null,
  description text,
  check_mode text not null check(check_mode in ('automated','manual')),
  severity text not null default 'major' check(severity in ('minor','major','critical')),
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.luma_qa_runs (
  id bigserial primary key,
  environment text not null default 'production',
  status text not null default 'running' check(status in ('running','completed')),
  total_checks integer not null default 0,
  pass_count integer not null default 0,
  fail_count integer not null default 0,
  pending_count integer not null default 0,
  started_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.luma_qa_results (
  id bigserial primary key,
  run_id bigint not null references public.luma_qa_runs(id) on delete cascade,
  definition_id bigint not null references public.luma_qa_definitions(id) on delete cascade,
  status text not null check(status in ('pass','fail','pending')),
  details text,
  evidence jsonb not null default '{}'::jsonb,
  checked_by uuid references public.profiles(id) on delete set null,
  checked_at timestamptz,
  notes text,
  unique(run_id,definition_id)
);

create index if not exists luma_qa_runs_started_idx on public.luma_qa_runs(started_at desc);
create index if not exists luma_qa_results_run_idx on public.luma_qa_results(run_id,status);

alter table public.luma_qa_definitions enable row level security;
alter table public.luma_qa_runs enable row level security;
alter table public.luma_qa_results enable row level security;

do $$
declare t text;
begin
  foreach t in array array['luma_qa_definitions','luma_qa_runs','luma_qa_results']
  loop
    execute format('drop policy if exists %I_admin_select on public.%I',t,t);
    execute format('create policy %I_admin_select on public.%I for select to authenticated using(public.luma_is_admin())',t,t);
  end loop;
end $$;

insert into public.luma_qa_definitions(check_key,area,title,description,check_mode,severity,sort_order)
values
 ('auth_schema','Auth','Auth schema & profile','Auth user/profile structure tersedia dan profile tidak kosong.','automated','critical',10),
 ('workspace_integrity','Workspace/RLS','Workspace membership integrity','Workspace dan membership tersedia tanpa orphan workspace reference.','automated','critical',20),
 ('affiliate_pipeline','Affiliate Upload','Affiliate import pipeline','Tabel import + sales tersedia dan import completed tidak menghasilkan persisted row kosong secara mencurigakan.','automated','critical',30),
 ('live_pipeline','Live Streaming','Live data pipeline','Host, session, performance dan import Live tersedia dan relasi performance tidak orphan.','automated','critical',40),
 ('payment_pipeline','Payment','Payment data model','Checkout intent, subscription order, webhook event dan subscription tables tersedia.','automated','critical',50),
 ('promo_pipeline','Promo','Featured promo configuration','Promo aktif/published tersedia dan constraint promo production dapat dibaca.','automated','major',60),
 ('scheduled_reports','Scheduled Report','Scheduled reporting structure','Schedule dan run history tables tersedia.','automated','major',70),
 ('operations','Operations','Operational alert & incident','Alert rules dan incident tables tersedia.','automated','major',80),
 ('public_content','Public Insights','Public content structure','Public blog/insight storage tersedia.','automated','minor',90),
 ('login_journey','Auth','Login & register browser flow','Uji login email/Google, register, verification, redirect workspace.','manual','critical',110),
 ('affiliate_upload_journey','Affiliate Upload','Affiliate XLSX/CSV E2E','Upload file uji, mapping, preview, import, dashboard reconciliation.','manual','critical',120),
 ('live_upload_journey','Live Streaming','Live XLSX/CSV E2E','Host → Session → Upload → Mapping → Analytics → Host 360.','manual','critical',130),
 ('payment_checkout_journey','Payment','Checkout E2E','Pilih plan, apply promo bila relevan, buat payment, webhook, activation. Gunakan transaksi test/non-customer.','manual','critical',140),
 ('promo_checkout_journey','Promo','Promo checkout display','Pastikan campaign display dan nilai diskon aktual transparan di checkout.','manual','major',150),
 ('scheduled_delivery_journey','Scheduled Report','Scheduled report delivery','Buat schedule test dan validasi run + email delivery.','manual','major',160),
 ('notification_journey','Notifications','Notification & toast','Validasi direct/broadcast notification, mark read, action URL dan toast.','manual','major',170),
 ('alert_incident_journey','Operations','Alert → Incident → Escalation','Trigger di environment aman atau gunakan event test, lalu validasi incident lifecycle dan SLA.','manual','major',180),
 ('responsive_journey','UI/UX','Responsive critical routes','Dashboard, upload, Live, Affiliate360, billing dan tutorial di desktop/tablet/mobile.','manual','major',190)
on conflict(check_key) do update set
 area=excluded.area,title=excluded.title,description=excluded.description,check_mode=excluded.check_mode,severity=excluded.severity,sort_order=excluded.sort_order,active=true;

create or replace function public.luma_owner_run_production_qa_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_catalog,pg_temp
as $$
declare
  run_id bigint;
  d record;
  status_value text;
  details_value text;
  evidence_value jsonb;
  bad_count bigint;
  cnt bigint;
begin
  if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;

  insert into public.luma_qa_runs(environment,status,started_by)
  values('production','running',auth.uid())
  returning id into run_id;

  for d in select * from public.luma_qa_definitions where active order by sort_order,id loop
    status_value:='pending'; details_value:=null; evidence_value:='{}'::jsonb;

    if d.check_mode='automated' then
      case d.check_key
        when 'auth_schema' then
          select count(*) into cnt from public.profiles;
          status_value:=case when to_regclass('auth.users') is not null and cnt>0 then 'pass' else 'fail' end;
          details_value:='profiles='||cnt;
          evidence_value:=jsonb_build_object('profiles',cnt,'auth_users_table',to_regclass('auth.users') is not null);

        when 'workspace_integrity' then
          select count(*) into bad_count from public.workspace_members wm left join public.workspaces w on w.id=wm.workspace_id where w.id is null;
          select count(*) into cnt from public.workspaces;
          status_value:=case when cnt>0 and bad_count=0 then 'pass' else 'fail' end;
          details_value:='workspaces='||cnt||', orphan_memberships='||bad_count;
          evidence_value:=jsonb_build_object('workspaces',cnt,'orphan_memberships',bad_count);

        when 'affiliate_pipeline' then
          select count(*) into bad_count from public.imports i
          where lower(coalesce(i.status,'')) in ('completed','success')
            and coalesce(i.persisted_rows,0)=0
            and coalesce(i.row_count,0)>0
            and i.imported_at>=now()-interval '30 days';
          status_value:=case when to_regclass('public.imports') is not null and to_regclass('public.sales') is not null and bad_count=0 then 'pass' else 'fail' end;
          details_value:='suspicious_zero_persist_imports_30d='||bad_count;
          evidence_value:=jsonb_build_object('suspicious_zero_persist_imports_30d',bad_count);

        when 'live_pipeline' then
          select count(*) into bad_count
          from public.live_session_performance p left join public.live_sessions s on s.id=p.session_id
          where s.id is null;
          status_value:=case when to_regclass('public.live_hosts') is not null and to_regclass('public.live_sessions') is not null and to_regclass('public.live_session_performance') is not null and bad_count=0 then 'pass' else 'fail' end;
          details_value:='orphan_performance_rows='||bad_count;
          evidence_value:=jsonb_build_object('orphan_performance_rows',bad_count);

        when 'payment_pipeline' then
          status_value:=case when
            to_regclass('public.luma_payment_checkout_intents') is not null
            and to_regclass('public.luma_subscription_orders') is not null
            and to_regclass('public.luma_payment_webhook_events') is not null
            and to_regclass('public.luma_user_subscriptions') is not null
            then 'pass' else 'fail' end;
          details_value:='Required payment tables checked.';

        when 'promo_pipeline' then
          select count(*) into cnt from public.luma_promo_codes where active=true and is_published=true;
          status_value:=case when cnt>0 then 'pass' else 'fail' end;
          details_value:='active_published_promos='||cnt;
          evidence_value:=jsonb_build_object('active_published_promos',cnt);

        when 'scheduled_reports' then
          status_value:=case when to_regclass('public.luma_scheduled_reports') is not null and to_regclass('public.luma_scheduled_report_runs') is not null then 'pass' else 'fail' end;
          details_value:='Schedule and run tables checked.';

        when 'operations' then
          select count(*) into cnt from public.luma_operational_alert_rules where active=true;
          status_value:=case when cnt>0 and to_regclass('public.luma_incidents') is not null then 'pass' else 'fail' end;
          details_value:='active_alert_rules='||cnt;
          evidence_value:=jsonb_build_object('active_alert_rules',cnt);

        when 'public_content' then
          status_value:=case when to_regclass('public.public_blogs') is not null or to_regclass('public.blog_posts') is not null then 'pass' else 'fail' end;
          details_value:='Public content storage checked.';

        else
          status_value:='pending';
      end case;
    end if;

    insert into public.luma_qa_results(run_id,definition_id,status,details,evidence,checked_by,checked_at)
    values(run_id,d.id,status_value,details_value,evidence_value,
      case when d.check_mode='automated' then auth.uid() else null end,
      case when d.check_mode='automated' then now() else null end);
  end loop;

  update public.luma_qa_runs r set
    total_checks=(select count(*) from public.luma_qa_results where run_id=r.id),
    pass_count=(select count(*) from public.luma_qa_results where run_id=r.id and status='pass'),
    fail_count=(select count(*) from public.luma_qa_results where run_id=r.id and status='fail'),
    pending_count=(select count(*) from public.luma_qa_results where run_id=r.id and status='pending'),
    status='completed',
    completed_at=now()
  where r.id=run_id;

  return jsonb_build_object(
    'run_id',run_id,
    'summary',(select to_jsonb(r) from public.luma_qa_runs r where r.id=run_id)
  );
end
$$;

revoke all on function public.luma_owner_run_production_qa_v1() from public,anon;
grant execute on function public.luma_owner_run_production_qa_v1() to authenticated;

create or replace function public.luma_owner_set_qa_result_v1(
  p_result_id bigint,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  rid bigint;
begin
  if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
  if p_status not in ('pass','fail','pending') then raise exception 'Invalid QA status'; end if;

  update public.luma_qa_results
  set status=p_status,notes=nullif(trim(coalesce(p_notes,'')),''),checked_by=auth.uid(),checked_at=now()
  where id=p_result_id
  returning run_id into rid;

  if rid is null then raise exception 'QA result not found'; end if;

  update public.luma_qa_runs r set
    pass_count=(select count(*) from public.luma_qa_results where run_id=rid and status='pass'),
    fail_count=(select count(*) from public.luma_qa_results where run_id=rid and status='fail'),
    pending_count=(select count(*) from public.luma_qa_results where run_id=rid and status='pending')
  where id=rid;

  return jsonb_build_object('ok',true,'run_id',rid);
end
$$;

revoke all on function public.luma_owner_set_qa_result_v1(bigint,text,text) from public,anon;
grant execute on function public.luma_owner_set_qa_result_v1(bigint,text,text) to authenticated;
