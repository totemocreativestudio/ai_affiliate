-- PR79C: Goal, Target & Forecast Center

create table if not exists public.luma_workspace_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  target_gmv numeric not null default 0,
  target_orders numeric not null default 0,
  target_qty numeric not null default 0,
  target_contribution_margin numeric not null default 0,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,period_start,period_end)
);

create index if not exists idx_luma_workspace_goals_period
  on public.luma_workspace_goals(workspace_id,period_start,period_end);

alter table public.luma_workspace_goals enable row level security;

drop policy if exists luma_workspace_goals_select on public.luma_workspace_goals;
create policy luma_workspace_goals_select on public.luma_workspace_goals
for select to authenticated using(public.luma_has_workspace(workspace_id));

drop policy if exists luma_workspace_goals_insert on public.luma_workspace_goals;
create policy luma_workspace_goals_insert on public.luma_workspace_goals
for insert to authenticated with check(public.luma_has_workspace(workspace_id));

drop policy if exists luma_workspace_goals_update on public.luma_workspace_goals;
create policy luma_workspace_goals_update on public.luma_workspace_goals
for update to authenticated using(public.luma_has_workspace(workspace_id))
with check(public.luma_has_workspace(workspace_id));

drop policy if exists luma_workspace_goals_delete on public.luma_workspace_goals;
create policy luma_workspace_goals_delete on public.luma_workspace_goals
for delete to authenticated using(public.luma_has_workspace(workspace_id));

create or replace function public.luma_goal_forecast_v1(
  p_workspace_id uuid,
  p_period_start date,
  p_period_end date
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  g public.luma_workspace_goals%rowtype;
  v_days_total numeric;
  v_days_elapsed numeric;
  v_data_end date;
  v_gmv numeric:=0;
  v_orders numeric:=0;
  v_qty numeric:=0;
  v_refund numeric:=0;
  v_commission numeric:=0;
  v_ads numeric:=0;
  v_hpp numeric:=0;
  v_shipping numeric:=0;
  v_flat_fee numeric:=0;
  v_margin numeric:=0;
  v_forecast_gmv numeric:=0;
  v_forecast_orders numeric:=0;
  v_forecast_qty numeric:=0;
  v_forecast_margin numeric:=0;
  v_daily jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) then raise exception 'Workspace access denied' using errcode='42501'; end if;
  if p_period_end<p_period_start then raise exception 'Invalid period'; end if;

  select * into g from public.luma_workspace_goals
  where workspace_id=p_workspace_id and period_start=p_period_start and period_end=p_period_end
  limit 1;

  select max(data_date) into v_data_end
  from public.sales
  where workspace_id=p_workspace_id
    and data_type in ('performance','sales')
    and data_date between p_period_start and p_period_end;

  select
    coalesce(sum(gmv),0),coalesce(sum(orders),0),coalesce(sum(qty),0),
    coalesce(sum(refund),0),coalesce(sum(commission),0),coalesce(sum(ads_spend),0),
    coalesce(sum(cost_product),0),coalesce(sum(shipping_cost),0),coalesce(sum(flat_fee),0)
  into v_gmv,v_orders,v_qty,v_refund,v_commission,v_ads,v_hpp,v_shipping,v_flat_fee
  from public.sales
  where workspace_id=p_workspace_id
    and data_type in ('performance','sales')
    and data_date between p_period_start and p_period_end;

  v_margin:=v_gmv-v_refund-v_commission-v_ads-v_hpp-v_shipping-v_flat_fee;
  v_days_total:=(p_period_end-p_period_start)+1;
  v_days_elapsed:=greatest(1,least(v_days_total,(coalesce(v_data_end,least(current_date,p_period_end))-p_period_start)+1));

  v_forecast_gmv:=round((v_gmv/v_days_elapsed)*v_days_total,2);
  v_forecast_orders:=round((v_orders/v_days_elapsed)*v_days_total,2);
  v_forecast_qty:=round((v_qty/v_days_elapsed)*v_days_total,2);
  v_forecast_margin:=round((v_margin/v_days_elapsed)*v_days_total,2);

  select coalesce(jsonb_agg(row_data order by data_day),'[]'::jsonb) into v_daily
  from (
    select data_date as data_day, jsonb_build_object(
      'date',data_date,
      'gmv',coalesce(sum(gmv),0),
      'orders',coalesce(sum(orders),0),
      'qty',coalesce(sum(qty),0),
      'contribution_margin',
        coalesce(sum(gmv),0)-coalesce(sum(refund),0)-coalesce(sum(commission),0)-
        coalesce(sum(ads_spend),0)-coalesce(sum(cost_product),0)-coalesce(sum(shipping_cost),0)-coalesce(sum(flat_fee),0)
    ) row_data
    from public.sales
    where workspace_id=p_workspace_id and data_type in ('performance','sales')
      and data_date between p_period_start and p_period_end
    group by data_date
  ) d;

  return jsonb_build_object(
    'period',jsonb_build_object('start',p_period_start,'end',p_period_end,'data_end',v_data_end,'days_total',v_days_total,'days_elapsed',v_days_elapsed),
    'target',jsonb_build_object(
      'gmv',coalesce(g.target_gmv,0),'orders',coalesce(g.target_orders,0),'qty',coalesce(g.target_qty,0),
      'contribution_margin',coalesce(g.target_contribution_margin,0)
    ),
    'actual',jsonb_build_object('gmv',v_gmv,'orders',v_orders,'qty',v_qty,'contribution_margin',v_margin),
    'forecast',jsonb_build_object('gmv',v_forecast_gmv,'orders',v_forecast_orders,'qty',v_forecast_qty,'contribution_margin',v_forecast_margin),
    'costs',jsonb_build_object('refund',v_refund,'commission',v_commission,'ads_spend',v_ads,'hpp',v_hpp,'shipping',v_shipping,'flat_fee',v_flat_fee),
    'daily',v_daily
  );
end
$$;

revoke all on function public.luma_goal_forecast_v1(uuid,date,date) from public,anon;
grant execute on function public.luma_goal_forecast_v1(uuid,date,date) to authenticated,service_role;
