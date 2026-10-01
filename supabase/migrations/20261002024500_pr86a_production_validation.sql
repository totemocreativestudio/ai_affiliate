-- PR86A Production Validation Hub

create or replace function public.luma_owner_production_validation_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  blockers jsonb:='[]'::jsonb;
  reviews jsonb:='[]'::jsonb;
  latest_qa_id bigint;
  px_critical_fail int:=0;
  px_critical_pending int:=0;
  px_total int:=0;
  px_pass int:=0;
  affiliate_failed_imports int:=0;
  affiliate_partial_imports int:=0;
  live_failed_imports int:=0;
  live_partial_imports int:=0;
  live_qty numeric:=0;
  live_covered_qty numeric:=0;
  live_hpp_coverage numeric:=0;
  live_pnl_sales_ref int:=0;
  live_pnl_commission_ref int:=0;
  saved_view_self_policy boolean:=false;
  notification_state_self_policy boolean:=false;
  privacy jsonb:='{}'::jsonb;
  perf jsonb:='{}'::jsonb;
  release_gate jsonb:='{}'::jsonb;
  perf_fail int:=0;
  perf_insufficient int:=0;
  gate_status text:='REVIEW';
begin
  if not public.luma_is_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;

  select id into latest_qa_id
  from public.luma_qa_runs
  order by started_at desc
  limit 1;

  if latest_qa_id is not null then
    select
      count(*) filter(where d.check_key like 'px_%'),
      count(*) filter(where d.check_key like 'px_%' and r.status='pass'),
      count(*) filter(where d.check_key like 'px_%' and d.severity='critical' and r.status='fail'),
      count(*) filter(where d.check_key like 'px_%' and d.severity='critical' and r.status='pending')
    into px_total,px_pass,px_critical_fail,px_critical_pending
    from public.luma_qa_results r
    join public.luma_qa_definitions d on d.id=r.definition_id
    where r.run_id=latest_qa_id;
  end if;

  select
    count(*) filter(where lower(coalesce(status,'')) in ('failed','error')),
    count(*) filter(where lower(coalesce(status,'')) in ('completed','success') and coalesce(persisted_rows,0)<coalesce(row_count,0))
  into affiliate_failed_imports,affiliate_partial_imports
  from public.imports
  where imported_at>=now()-interval '7 days';

  select
    count(*) filter(where lower(coalesce(status,'')) in ('failed','error')),
    count(*) filter(where lower(coalesce(status,''))='completed' and coalesce(persisted_rows,0)<coalesce(row_count,0))
  into live_failed_imports,live_partial_imports
  from public.live_imports
  where created_at>=now()-interval '7 days';

  select
    coalesce(sum(lp.qty_created),0),
    coalesce(sum(lp.qty_created) filter(where lp.product_master_id is not null and pm.cost_price is not null),0)
  into live_qty,live_covered_qty
  from public.live_product_performance lp
  left join public.product_master pm on pm.id=lp.product_master_id and pm.workspace_id=lp.workspace_id
  where lp.period_end>=current_date-30;

  live_hpp_coverage:=case when live_qty=0 then 100 else round((live_covered_qty/live_qty)*100,2) end;

  select
    position('public.sales' in lower(pg_get_functiondef(p.oid))),
    position('commission' in lower(pg_get_functiondef(p.oid)))
  into live_pnl_sales_ref,live_pnl_commission_ref
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='luma_live_pnl_v1'
  limit 1;

  select exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='luma_saved_views'
      and (qual ilike '%auth.uid()%' or with_check ilike '%auth.uid()%')
  ) into saved_view_self_policy;

  select exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='luma_user_notification_state'
      and (qual ilike '%auth.uid()%' or with_check ilike '%auth.uid()%')
  ) into notification_state_self_policy;

  begin
    privacy:=public.luma_owner_multiuser_privacy_audit_v1();
  exception when others then
    privacy:=jsonb_build_object('status','REVIEW','failed_checks',1,'error','privacy audit unavailable');
  end;

  begin
    perf:=public.luma_owner_performance_budget_v1();
  exception when others then
    perf:=jsonb_build_object('checks','[]'::jsonb);
  end;

  select
    count(*) filter(where coalesce(x->>'status','')='fail'),
    count(*) filter(where coalesce(x->>'status','')='insufficient_data')
  into perf_fail,perf_insufficient
  from jsonb_array_elements(coalesce(perf->'checks','[]'::jsonb)) x;

  begin
    release_gate:=public.luma_owner_release_gate_v1();
    gate_status:=coalesce(release_gate->>'gate_status','REVIEW');
  exception when others then
    release_gate:=jsonb_build_object('gate_status','REVIEW');
    gate_status:='REVIEW';
  end;

  if px_critical_fail>0 then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('key','px_critical_fail','message','Critical Product Experience QA failure','count',px_critical_fail));
  end if;

  if coalesce((privacy->>'failed_checks')::int,0)>0 then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('key','privacy','message','Multi-user privacy audit has failures','count',(privacy->>'failed_checks')::int));
  end if;

  if coalesce(live_pnl_sales_ref,0)>0 or coalesce(live_pnl_commission_ref,0)>0 then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('key','live_affiliate_separation','message','Live P&L references Affiliate sales/commission','count',1));
  end if;

  if gate_status='BLOCKED' then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('key','release_gate','message','Existing Production Release Gate is BLOCKED','count',1));
  end if;

  if px_critical_pending>0 then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('key','px_pending','message','Critical Product Experience QA still pending','count',px_critical_pending));
  end if;

  if perf_fail>0 then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('key','performance_fail','message','Performance budget has failing scopes','count',perf_fail));
  end if;

  if perf_insufficient>0 then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('key','performance_samples','message','Performance budget has insufficient sample sizes','count',perf_insufficient));
  end if;

  if affiliate_failed_imports+affiliate_partial_imports>0 then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('key','affiliate_imports','message','Affiliate imports need review in the last 7 days','count',affiliate_failed_imports+affiliate_partial_imports));
  end if;

  if live_failed_imports+live_partial_imports>0 then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('key','live_imports','message','Live imports need review in the last 7 days','count',live_failed_imports+live_partial_imports));
  end if;

  if live_hpp_coverage<100 then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('key','live_hpp_coverage','message','Live HPP coverage is incomplete','coverage_pct',live_hpp_coverage));
  end if;

  if not saved_view_self_policy then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('key','saved_view_rls','message','Saved View user isolation policy requires review'));
  end if;

  if not notification_state_self_policy then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('key','notification_rls','message','Notification state user isolation policy requires review'));
  end if;

  return jsonb_build_object(
    'checked_at',now(),
    'status',case when jsonb_array_length(blockers)>0 then 'BLOCKED' when jsonb_array_length(reviews)>0 then 'REVIEW' else 'READY' end,
    'blockers',blockers,
    'review_items',reviews,
    'product_experience',jsonb_build_object(
      'latest_run_id',latest_qa_id,
      'total',px_total,
      'pass',px_pass,
      'critical_fail',px_critical_fail,
      'critical_pending',px_critical_pending
    ),
    'imports',jsonb_build_object(
      'affiliate_failed_7d',affiliate_failed_imports,
      'affiliate_partial_7d',affiliate_partial_imports,
      'live_failed_7d',live_failed_imports,
      'live_partial_7d',live_partial_imports
    ),
    'live',jsonb_build_object(
      'hpp_coverage_pct',live_hpp_coverage,
      'qty_30d',live_qty,
      'covered_qty_30d',live_covered_qty,
      'pnl_affiliate_sales_reference',coalesce(live_pnl_sales_ref,0)>0,
      'pnl_commission_reference',coalesce(live_pnl_commission_ref,0)>0
    ),
    'isolation',jsonb_build_object(
      'saved_views_self_policy',saved_view_self_policy,
      'notification_state_self_policy',notification_state_self_policy,
      'privacy_status',coalesce(privacy->>'status','REVIEW')
    ),
    'performance',perf,
    'release_gate',release_gate
  );
end
$$;

revoke all on function public.luma_owner_production_validation_v1() from public,anon;
grant execute on function public.luma_owner_production_validation_v1() to authenticated,service_role;
