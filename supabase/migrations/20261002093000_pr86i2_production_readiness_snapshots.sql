-- PR86I2: seed current production readiness checkpoints after automated QC
do $$
declare
  v_run_id bigint;
  d record;
  v_status text;
  v_details text;
  v_evidence jsonb;
  v_bad bigint;
  v_cnt bigint;
begin
  insert into public.luma_qa_runs(environment,status,total_checks,pass_count,fail_count,pending_count,started_by,started_at)
  values('production','running',0,0,0,0,null,now())
  returning id into v_run_id;

  for d in select * from public.luma_qa_definitions where active order by sort_order,id loop
    v_status:='pending'; v_details:=null; v_evidence:='{}'::jsonb;

    if d.check_mode='automated' then
      case d.check_key
        when 'auth_schema' then
          select count(*) into v_cnt from public.profiles;
          v_status:=case when to_regclass('auth.users') is not null and v_cnt>0 then 'pass' else 'fail' end;
          v_details:='profiles='||v_cnt;
          v_evidence:=jsonb_build_object('profiles',v_cnt,'auth_users_table',to_regclass('auth.users') is not null);

        when 'workspace_integrity' then
          select count(*) into v_bad from public.workspace_members wm left join public.workspaces w on w.id=wm.workspace_id where w.id is null;
          select count(*) into v_cnt from public.workspaces;
          v_status:=case when v_cnt>0 and v_bad=0 then 'pass' else 'fail' end;
          v_details:='workspaces='||v_cnt||', orphan_memberships='||v_bad;
          v_evidence:=jsonb_build_object('workspaces',v_cnt,'orphan_memberships',v_bad);

        when 'affiliate_pipeline' then
          select count(*) into v_bad from public.imports i
          where lower(coalesce(i.status,'')) in ('completed','success')
            and coalesce(i.rows_imported,0)=0
            and i.imported_at>=now()-interval '30 days';
          v_status:=case when v_bad=0 then 'pass' else 'fail' end;
          v_details:='zero_row_completed_imports_30d='||v_bad;
          v_evidence:=jsonb_build_object('zero_row_completed_imports_30d',v_bad);

        when 'live_pipeline' then
          select count(*) into v_bad from public.live_session_performance p
          left join public.live_sessions s on s.id=p.session_id where s.id is null;
          v_status:=case when v_bad=0 then 'pass' else 'fail' end;
          v_details:='orphan_performance_rows='||v_bad;
          v_evidence:=jsonb_build_object('orphan_performance_rows',v_bad);

        when 'payment_pipeline' then
          v_status:=case when
            to_regclass('public.luma_payment_checkout_intents') is not null and
            to_regclass('public.luma_subscription_orders') is not null and
            to_regclass('public.luma_payment_webhook_events') is not null and
            to_regclass('public.luma_user_subscriptions') is not null
          then 'pass' else 'fail' end;
          v_details:='Required payment tables checked.';

        when 'promo_pipeline' then
          select count(*) into v_cnt from public.luma_promo_codes where active=true and is_published=true;
          v_status:=case when v_cnt>0 then 'pass' else 'fail' end;
          v_details:='active_published_promos='||v_cnt;
          v_evidence:=jsonb_build_object('active_published_promos',v_cnt);

        when 'scheduled_reports' then
          v_status:=case when to_regclass('public.luma_scheduled_reports') is not null and to_regclass('public.luma_scheduled_report_runs') is not null then 'pass' else 'fail' end;
          v_details:='Schedule and run tables checked.';

        when 'operations' then
          select count(*) into v_cnt from public.luma_operational_alert_rules where active=true;
          v_status:=case when v_cnt>0 and to_regclass('public.luma_incidents') is not null then 'pass' else 'fail' end;
          v_details:='active_alert_rules='||v_cnt;
          v_evidence:=jsonb_build_object('active_alert_rules',v_cnt);

        when 'public_content' then
          select count(*) into v_cnt from public.luma_blog_posts;
          v_status:=case when v_cnt>0 then 'pass' else 'fail' end;
          v_details:='luma_blog_posts='||v_cnt;
          v_evidence:=jsonb_build_object('luma_blog_posts',v_cnt);

        else
          v_status:='pending';
      end case;
    end if;

    insert into public.luma_qa_results(run_id,definition_id,status,details,evidence,checked_by,checked_at,notes)
    values(v_run_id,d.id,v_status,v_details,v_evidence,null,case when d.check_mode='automated' then now() else null end,
      case when d.check_mode='manual' then 'Pending browser/E2E verification.' else null end);
  end loop;

  update public.luma_qa_runs r set
    total_checks=(select count(*) from public.luma_qa_results qr where qr.run_id=v_run_id),
    pass_count=(select count(*) from public.luma_qa_results qr where qr.run_id=v_run_id and qr.status='pass'),
    fail_count=(select count(*) from public.luma_qa_results qr where qr.run_id=v_run_id and qr.status='fail'),
    pending_count=(select count(*) from public.luma_qa_results qr where qr.run_id=v_run_id and qr.status='pending'),
    status='completed',
    completed_at=now()
  where r.id=v_run_id;
end $$;

insert into public.luma_backup_readiness_snapshots(
  checkpoint_type,database_bytes,critical_counts,latest_activity,notes,created_by
)
values(
  'manual',
  pg_database_size(current_database()),
  jsonb_build_object(
    'profiles',(select count(*) from public.profiles),
    'workspaces',(select count(*) from public.workspaces),
    'workspace_members',(select count(*) from public.workspace_members),
    'sales',(select count(*) from public.sales),
    'creators',(select count(*) from public.creators),
    'product_master',(select count(*) from public.product_master),
    'imports',(select count(*) from public.imports),
    'campaigns',(select count(*) from public.campaign_trackers),
    'subscriptions',(select count(*) from public.luma_user_subscriptions),
    'subscription_orders',(select count(*) from public.luma_subscription_orders),
    'topup_orders',(select count(*) from public.luma_topup_orders),
    'promo_redemptions',(select count(*) from public.luma_promo_redemptions)
  ),
  jsonb_build_object(
    'import',(select max(imported_at) from public.imports),
    'sale',(select max(updated_at) from public.sales),
    'subscription_order',(select max(created_at) from public.luma_subscription_orders),
    'topup_order',(select max(created_at) from public.luma_topup_orders)
  ),
  'Application-level QC checkpoint. This does not replace Supabase physical backup/PITR verification.',
  null
);

insert into public.luma_release_gate_snapshots(release_label,gate_status,summary,notes,created_by)
select
  '2026-10-02-production-qc',
  case when r.fail_count>0 then 'BLOCKED' else 'REVIEW' end,
  jsonb_build_object(
    'generated_at',now(),
    'blockers',case when r.fail_count>0 then jsonb_build_array(jsonb_build_object('key','qa_fail','count',r.fail_count)) else '[]'::jsonb end,
    'review_items',jsonb_build_array(
      jsonb_build_object('key','qa_pending','count',r.pending_count,'message','Manual browser/E2E QA remains pending.'),
      jsonb_build_object('key','performance_samples','message','Performance budgets still need more production samples.')
    ),
    'latest_qa',jsonb_build_object('id',r.id,'pass_count',r.pass_count,'fail_count',r.fail_count,'pending_count',r.pending_count,'started_at',r.started_at),
    'backup',jsonb_build_object('checkpoint_fresh',true,'recommended_rpo_hours',24,'recommended_rto_hours',4),
    'security',jsonb_build_object(
      'registry_reviewed',(select count(*) from public.luma_rpc_security_registry where reviewed=true),
      'registry_unreviewed',(select count(*) from public.luma_rpc_security_registry where reviewed=false),
      'intentional_public_share_rpc',true
    ),
    'incidents',jsonb_build_object('critical_open',(select count(*) from public.luma_incidents where status<>'resolved' and severity='critical')),
    'alerts',jsonb_build_object('critical_open',(select count(*) from public.luma_operational_alert_events where status='open' and severity='critical'))
  ),
  'Automated production QC snapshot. Final READY requires manual browser/E2E checks.',
  null
from public.luma_qa_runs r
order by r.started_at desc limit 1;

insert into public.luma_production_validation_snapshots(
  release_label,status,blocker_count,review_count,summary,notes,created_by
)
select
  '2026-10-02-production-qc',
  case when r.fail_count>0 then 'BLOCKED' else 'REVIEW' end,
  r.fail_count,
  case when r.pending_count>0 then 2 else 1 end,
  jsonb_build_object(
    'qa_run_id',r.id,
    'automated_pass',r.pass_count,
    'automated_fail',r.fail_count,
    'manual_pending',r.pending_count,
    'checkout_stale',(select count(*) from public.luma_payment_checkout_intents where status in ('processing','ready') and ((expires_at is not null and expires_at<=now()) or (expires_at is null and created_at<=now()-interval '3 days'))),
    'payment_enabled',(select jsonb_agg(provider order by priority) from public.luma_payment_provider_settings where enabled=true),
    'rpc_registry_unreviewed',(select count(*) from public.luma_rpc_security_registry where reviewed=false),
    'backup_checkpoint_created',true
  ),
  'Automated validation baseline; manual E2E and provider physical backup verification remain required.',
  null
from public.luma_qa_runs r
order by r.started_at desc limit 1;
