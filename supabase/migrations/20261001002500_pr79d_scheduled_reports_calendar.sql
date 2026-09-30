-- PR79D: Scheduled Report + Visual Calendar

create table if not exists public.luma_scheduled_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  report_type text not null default 'goal_forecast' check(report_type in ('goal_forecast','daily_brief','affiliate_performance')),
  cadence text not null default 'weekly' check(cadence in ('one_time','daily','weekly','monthly')),
  timezone text not null default 'Asia/Jakarta',
  recipients text[] not null default '{}'::text[],
  formats text[] not null default array['email']::text[],
  configuration jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.luma_scheduled_report_runs (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  schedule_id uuid not null references public.luma_scheduled_reports(id) on delete cascade,
  status text not null default 'processing' check(status in ('processing','delivered','failed')),
  report_type text not null,
  recipients text[] not null default '{}'::text[],
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_luma_scheduled_reports_due
  on public.luma_scheduled_reports(active,next_run_at,workspace_id);
create index if not exists idx_luma_scheduled_report_runs_schedule
  on public.luma_scheduled_report_runs(workspace_id,schedule_id,created_at desc);

alter table public.luma_scheduled_reports enable row level security;
alter table public.luma_scheduled_report_runs enable row level security;

drop policy if exists luma_scheduled_reports_select on public.luma_scheduled_reports;
create policy luma_scheduled_reports_select on public.luma_scheduled_reports
for select to authenticated using(public.luma_has_workspace(workspace_id));
drop policy if exists luma_scheduled_reports_insert on public.luma_scheduled_reports;
create policy luma_scheduled_reports_insert on public.luma_scheduled_reports
for insert to authenticated with check(public.luma_has_workspace(workspace_id));
drop policy if exists luma_scheduled_reports_update on public.luma_scheduled_reports;
create policy luma_scheduled_reports_update on public.luma_scheduled_reports
for update to authenticated using(public.luma_has_workspace(workspace_id))
with check(public.luma_has_workspace(workspace_id));
drop policy if exists luma_scheduled_reports_delete on public.luma_scheduled_reports;
create policy luma_scheduled_reports_delete on public.luma_scheduled_reports
for delete to authenticated using(public.luma_has_workspace(workspace_id));

drop policy if exists luma_scheduled_report_runs_select on public.luma_scheduled_report_runs;
create policy luma_scheduled_report_runs_select on public.luma_scheduled_report_runs
for select to authenticated using(public.luma_has_workspace(workspace_id));

create or replace function public.luma_claim_due_scheduled_reports_v1(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  item record;
  result jsonb:='[]'::jsonb;
  next_at timestamptz;
  run_id bigint;
begin
  for item in
    select *
    from public.luma_scheduled_reports
    where active=true and next_run_at<=now()
    order by next_run_at asc
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,20),100))
  loop
    next_at:=case item.cadence
      when 'daily' then item.next_run_at+interval '1 day'
      when 'weekly' then item.next_run_at+interval '7 days'
      when 'monthly' then item.next_run_at+interval '1 month'
      else item.next_run_at
    end;

    insert into public.luma_scheduled_report_runs(workspace_id,schedule_id,status,report_type,recipients)
    values(item.workspace_id,item.id,'processing',item.report_type,item.recipients)
    returning id into run_id;

    update public.luma_scheduled_reports
    set last_run_at=now(),
        next_run_at=next_at,
        active=case when item.cadence='one_time' then false else active end,
        updated_at=now()
    where id=item.id;

    result:=result||jsonb_build_array(jsonb_build_object(
      'run_id',run_id,'schedule_id',item.id,'workspace_id',item.workspace_id,
      'name',item.name,'report_type',item.report_type,'cadence',item.cadence,
      'timezone',item.timezone,'recipients',to_jsonb(item.recipients),
      'configuration',item.configuration
    ));
  end loop;
  return result;
end
$$;

revoke all on function public.luma_claim_due_scheduled_reports_v1(integer) from public,anon,authenticated;
grant execute on function public.luma_claim_due_scheduled_reports_v1(integer) to service_role;

-- Service-only report wrappers for scheduled report cron.
create or replace function public.luma_daily_brief_service_v1(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v jsonb;
begin
  -- Mirrors key Daily Brief metrics without auth.uid() because this function is service-role only.
  select jsonb_build_object(
    'generated_at',now(),
    'performance',jsonb_build_object(
      'gmv',coalesce(sum(gmv),0),
      'orders',coalesce(sum(orders),0)
    )
  ) into v
  from public.sales
  where workspace_id=p_workspace_id and data_type in ('performance','sales')
    and data_date=(select max(data_date) from public.sales where workspace_id=p_workspace_id and data_type in ('performance','sales'));
  return coalesce(v,'{}'::jsonb);
end $$;
revoke all on function public.luma_daily_brief_service_v1(uuid) from public,anon,authenticated;
grant execute on function public.luma_daily_brief_service_v1(uuid) to service_role;

create or replace function public.luma_goal_forecast_service_v1(p_workspace_id uuid,p_period_start date,p_period_end date)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  g public.luma_workspace_goals%rowtype;
  days_total numeric; days_elapsed numeric; data_end date;
  gmv numeric:=0; orders numeric:=0; qty numeric:=0; refund numeric:=0; commission numeric:=0; ads numeric:=0; hpp numeric:=0; shipping numeric:=0; fee numeric:=0; margin numeric:=0;
begin
  select * into g from public.luma_workspace_goals where workspace_id=p_workspace_id and period_start=p_period_start and period_end=p_period_end limit 1;
  select max(data_date) into data_end from public.sales where workspace_id=p_workspace_id and data_type in ('performance','sales') and data_date between p_period_start and p_period_end;
  select coalesce(sum(s.gmv),0),coalesce(sum(s.orders),0),coalesce(sum(s.qty),0),coalesce(sum(s.refund),0),coalesce(sum(s.commission),0),coalesce(sum(s.ads_spend),0),coalesce(sum(s.cost_product),0),coalesce(sum(s.shipping_cost),0),coalesce(sum(s.flat_fee),0)
  into gmv,orders,qty,refund,commission,ads,hpp,shipping,fee
  from public.sales s where s.workspace_id=p_workspace_id and s.data_type in ('performance','sales') and s.data_date between p_period_start and p_period_end;
  margin:=gmv-refund-commission-ads-hpp-shipping-fee;
  days_total:=(p_period_end-p_period_start)+1;
  days_elapsed:=greatest(1,least(days_total,(coalesce(data_end,least(current_date,p_period_end))-p_period_start)+1));
  return jsonb_build_object(
    'target',jsonb_build_object('gmv',coalesce(g.target_gmv,0),'orders',coalesce(g.target_orders,0),'qty',coalesce(g.target_qty,0),'contribution_margin',coalesce(g.target_contribution_margin,0)),
    'actual',jsonb_build_object('gmv',gmv,'orders',orders,'qty',qty,'contribution_margin',margin),
    'forecast',jsonb_build_object('gmv',round(gmv/days_elapsed*days_total,2),'orders',round(orders/days_elapsed*days_total,2),'qty',round(qty/days_elapsed*days_total,2),'contribution_margin',round(margin/days_elapsed*days_total,2))
  );
end $$;
revoke all on function public.luma_goal_forecast_service_v1(uuid,date,date) from public,anon,authenticated;
grant execute on function public.luma_goal_forecast_service_v1(uuid,date,date) to service_role;
