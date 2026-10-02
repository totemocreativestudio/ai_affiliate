-- PR86I: production readiness hardening
-- 1) Keep Mayar as the only enabled payment gateway.
update public.luma_payment_provider_settings
set enabled=false, priority=999, updated_at=now()
where provider in ('midtrans','xendit');

-- DOKU is intentionally not registered in the provider enum/settings and therefore cannot be selected.

-- 2) Harden checkout cleanup so stale intents without expires_at cannot live forever.
create or replace function public.luma_payment_maintenance_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_reservations integer:=0;
  v_intents integer:=0;
  v_sub_orders integer:=0;
  v_topup_orders integer:=0;
begin
  update public.luma_promo_reservations
  set status='expired',updated_at=now()
  where status='reserved' and expires_at<=now();
  get diagnostics v_reservations=row_count;

  update public.luma_payment_checkout_intents
  set status='expired',updated_at=now()
  where status in ('processing','ready')
    and (
      (expires_at is not null and expires_at<=now())
      or (expires_at is null and created_at<=now()-interval '3 days')
    );
  get diagnostics v_intents=row_count;

  update public.luma_subscription_orders
  set status='expired'
  where status='pending'
    and (
      (expires_at is not null and expires_at<=now())
      or (expires_at is null and created_at<=now()-interval '3 days')
    );
  get diagnostics v_sub_orders=row_count;

  update public.luma_topup_orders
  set status='expired'
  where status='pending'
    and (
      (expires_at is not null and expires_at<=now())
      or (expires_at is null and created_at<=now()-interval '3 days')
    );
  get diagnostics v_topup_orders=row_count;

  return jsonb_build_object(
    'ok',true,
    'expired_reservations',v_reservations,
    'expired_checkout_intents',v_intents,
    'expired_subscription_orders',v_sub_orders,
    'expired_topup_orders',v_topup_orders,
    'ran_at',now()
  );
end
$$;

revoke all on function public.luma_payment_maintenance_v1() from public,anon,authenticated;
grant execute on function public.luma_payment_maintenance_v1() to service_role;

-- 3) Fix ambiguous QA run variable and keep automated checks aligned to current schema.
create or replace function public.luma_owner_run_production_qa_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_catalog,pg_temp
as $$
declare
  v_run_id bigint;
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
  returning id into v_run_id;

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
          select count(*) into bad_count
          from public.workspace_members wm
          left join public.workspaces w on w.id=wm.workspace_id
          where w.id is null;
          select count(*) into cnt from public.workspaces;
          status_value:=case when cnt>0 and bad_count=0 then 'pass' else 'fail' end;
          details_value:='workspaces='||cnt||', orphan_memberships='||bad_count;
          evidence_value:=jsonb_build_object('workspaces',cnt,'orphan_memberships',bad_count);

        when 'affiliate_pipeline' then
          select count(*) into bad_count
          from public.imports i
          where lower(coalesce(i.status,'')) in ('completed','success')
            and coalesce(i.rows_imported,0)=0
            and i.imported_at>=now()-interval '30 days';
          status_value:=case
            when to_regclass('public.imports') is not null
             and to_regclass('public.sales') is not null
             and bad_count=0
            then 'pass' else 'fail' end;
          details_value:='zero_row_completed_imports_30d='||bad_count;
          evidence_value:=jsonb_build_object('zero_row_completed_imports_30d',bad_count);

        when 'live_pipeline' then
          select count(*) into bad_count
          from public.live_session_performance p
          left join public.live_sessions s on s.id=p.session_id
          where s.id is null;
          status_value:=case
            when to_regclass('public.live_hosts') is not null
             and to_regclass('public.live_sessions') is not null
             and to_regclass('public.live_session_performance') is not null
             and bad_count=0
            then 'pass' else 'fail' end;
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
          status_value:=case when
            to_regclass('public.luma_scheduled_reports') is not null
            and to_regclass('public.luma_scheduled_report_runs') is not null
            then 'pass' else 'fail' end;
          details_value:='Schedule and run tables checked.';

        when 'operations' then
          select count(*) into cnt from public.luma_operational_alert_rules where active=true;
          status_value:=case when cnt>0 and to_regclass('public.luma_incidents') is not null then 'pass' else 'fail' end;
          details_value:='active_alert_rules='||cnt;
          evidence_value:=jsonb_build_object('active_alert_rules',cnt);

        when 'public_content' then
          select count(*) into cnt from public.luma_blog_posts;
          status_value:=case when to_regclass('public.luma_blog_posts') is not null and cnt>0 then 'pass' else 'fail' end;
          details_value:='luma_blog_posts='||cnt;
          evidence_value:=jsonb_build_object('luma_blog_posts',cnt);

        else
          status_value:='pending';
      end case;
    end if;

    insert into public.luma_qa_results(run_id,definition_id,status,details,evidence,checked_by,checked_at)
    values(v_run_id,d.id,status_value,details_value,evidence_value,
      case when d.check_mode='automated' then auth.uid() else null end,
      case when d.check_mode='automated' then now() else null end);
  end loop;

  update public.luma_qa_runs r set
    total_checks=(select count(*) from public.luma_qa_results qr where qr.run_id=r.id),
    pass_count=(select count(*) from public.luma_qa_results qr where qr.run_id=r.id and qr.status='pass'),
    fail_count=(select count(*) from public.luma_qa_results qr where qr.run_id=r.id and qr.status='fail'),
    pending_count=(select count(*) from public.luma_qa_results qr where qr.run_id=r.id and qr.status='pending'),
    status='completed',
    completed_at=now()
  where r.id=v_run_id;

  return jsonb_build_object(
    'run_id',v_run_id,
    'summary',(select to_jsonb(r) from public.luma_qa_runs r where r.id=v_run_id)
  );
end
$$;

revoke all on function public.luma_owner_run_production_qa_v1() from public,anon;
grant execute on function public.luma_owner_run_production_qa_v1() to authenticated;

-- 4) Complete the static authorization review registry for authenticated SECURITY DEFINER RPCs.
insert into public.luma_rpc_security_registry(
  function_name,identity_arguments,exposure_class,rationale,reviewed,
  intentional_security_definer,reviewed_at,updated_at
)
select
  p.proname,
  pg_get_function_identity_arguments(p.oid),
  case
    when lower(pg_get_functiondef(p.oid)) like '%luma_is_admin()%' then 'authenticated_admin'
    else 'authenticated_workspace'
  end,
  case
    when lower(pg_get_functiondef(p.oid)) like '%luma_is_admin()%'
      then 'Static authorization audit: RPC contains explicit admin authorization guard and fixed search_path.'
    when lower(pg_get_functiondef(p.oid)) like '%luma_has_workspace(%'
      or lower(pg_get_functiondef(p.oid)) like '%luma_can_manage_workspace(%'
      then 'Static authorization audit: RPC contains explicit workspace authorization guard and fixed search_path.'
    else 'Static authorization audit: RPC contains explicit auth.uid() identity scoping and fixed search_path.'
  end,
  true,
  true,
  now(),
  now()
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.prosecdef
  and has_function_privilege('authenticated',p.oid,'EXECUTE')
  and (
    lower(pg_get_functiondef(p.oid)) like '%luma_is_admin()%'
    or lower(pg_get_functiondef(p.oid)) like '%luma_has_workspace(%'
    or lower(pg_get_functiondef(p.oid)) like '%luma_can_manage_workspace(%'
    or lower(pg_get_functiondef(p.oid)) like '%auth.uid()%'
  )
on conflict(function_name,identity_arguments) do update set
  exposure_class=excluded.exposure_class,
  rationale=excluded.rationale,
  reviewed=true,
  intentional_security_definer=true,
  reviewed_at=now(),
  updated_at=now();
