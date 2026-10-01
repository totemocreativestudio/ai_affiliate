-- PR86H: fix Production QA harness against current schema

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
