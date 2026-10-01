-- PR85L Live P&L & Cost Allocation

create table if not exists public.live_cost_entries(
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  cost_date date not null,
  platform text,
  session_id uuid references public.live_sessions(id) on delete set null,
  category text not null check(category in ('host_cost','studio_cost','live_ads','production_cost','voucher_promo','other')),
  amount numeric not null default 0 check(amount>=0),
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_cost_entries_lookup_idx on public.live_cost_entries(workspace_id,cost_date,platform,category);
alter table public.live_cost_entries enable row level security;
drop policy if exists live_cost_entries_workspace_all on public.live_cost_entries;
create policy live_cost_entries_workspace_all on public.live_cost_entries
for all to authenticated
using(public.luma_has_workspace(workspace_id))
with check(public.luma_has_workspace(workspace_id) and created_by=auth.uid());

create or replace function public.luma_live_pnl_v1(
  p_workspace_id uuid,
  p_start date,
  p_end date,
  p_platform text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  with
  tk as (
    select coalesce(sum(gmv_attributed),0)::numeric revenue
    from public.live_daily_performance
    where workspace_id=p_workspace_id
      and metric_date between p_start and p_end
      and (coalesce(p_platform,'')='' or lower(p_platform)='tiktok')
  ),
  sh_overview as (
    select coalesce(sum(gmv_created),0)::numeric revenue,count(*)::int rows
    from public.live_period_overview
    where workspace_id=p_workspace_id
      and lower(platform)='shopee'
      and period_start>=p_start and period_end<=p_end
      and (coalesce(p_platform,'')='' or lower(p_platform)='shopee')
  ),
  sh_session as (
    select coalesce(sum(lsp.gmv_created),0)::numeric revenue
    from public.live_session_performance lsp
    join public.live_sessions ls on ls.id=lsp.session_id
    where lsp.workspace_id=p_workspace_id
      and lower(ls.platform)='shopee'
      and lsp.metric_date between p_start and p_end
      and (coalesce(p_platform,'')='' or lower(p_platform)='shopee')
  ),
  revenue as (
    select
      (select revenue from tk) tiktok_revenue,
      case when (select rows from sh_overview)>0 then (select revenue from sh_overview) else (select revenue from sh_session) end shopee_revenue
  ),
  products as (
    select
      coalesce(sum(lp.gmv_created),0)::numeric product_revenue,
      coalesce(sum(lp.qty_created),0)::numeric total_qty,
      coalesce(sum(lp.qty_created) filter(where lp.product_master_id is not null and pm.cost_price is not null),0)::numeric covered_qty,
      coalesce(sum(lp.qty_created*pm.cost_price) filter(where lp.product_master_id is not null and pm.cost_price is not null),0)::numeric known_hpp
    from public.live_product_performance lp
    left join public.product_master pm on pm.id=lp.product_master_id and pm.workspace_id=lp.workspace_id
    where lp.workspace_id=p_workspace_id
      and lp.period_start>=p_start and lp.period_end<=p_end
      and (coalesce(p_platform,'')='' or lower(lp.platform)=lower(p_platform))
  ),
  costs as (
    select
      coalesce(sum(amount),0)::numeric total_cost,
      coalesce(sum(amount) filter(where category='host_cost'),0)::numeric host_cost,
      coalesce(sum(amount) filter(where category='studio_cost'),0)::numeric studio_cost,
      coalesce(sum(amount) filter(where category='live_ads'),0)::numeric live_ads,
      coalesce(sum(amount) filter(where category='production_cost'),0)::numeric production_cost,
      coalesce(sum(amount) filter(where category='voucher_promo'),0)::numeric voucher_promo,
      coalesce(sum(amount) filter(where category='other'),0)::numeric other_cost
    from public.live_cost_entries
    where workspace_id=p_workspace_id
      and cost_date between p_start and p_end
      and (coalesce(p_platform,'')='' or lower(coalesce(platform,''))=lower(p_platform) or platform is null)
  ),
  entries as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'cost_date',cost_date,'platform',platform,'session_id',session_id,'category',category,'amount',amount,'note',note,'created_at',created_at
    ) order by cost_date desc,id desc),'[]'::jsonb) rows
    from public.live_cost_entries
    where workspace_id=p_workspace_id
      and cost_date between p_start and p_end
      and (coalesce(p_platform,'')='' or lower(coalesce(platform,''))=lower(p_platform) or platform is null)
  )
  select jsonb_build_object(
    'range',jsonb_build_object('start',p_start,'end',p_end,'platform',p_platform),
    'revenue',jsonb_build_object(
      'tiktok',(select tiktok_revenue from revenue),
      'shopee',(select shopee_revenue from revenue),
      'total',(select tiktok_revenue+shopee_revenue from revenue)
    ),
    'hpp',jsonb_build_object(
      'known',(select known_hpp from products),
      'total_qty',(select total_qty from products),
      'covered_qty',(select covered_qty from products),
      'coverage_pct',(select case when total_qty=0 then 0 else round(covered_qty/total_qty*100,2) end from products)
    ),
    'costs',(select to_jsonb(c) from costs c),
    'pnl',(
      select jsonb_build_object(
        'gross_contribution_before_operational',(r.tiktok_revenue+r.shopee_revenue)-p.known_hpp,
        'contribution_margin',(r.tiktok_revenue+r.shopee_revenue)-p.known_hpp-c.total_cost,
        'margin_pct',case when (r.tiktok_revenue+r.shopee_revenue)=0 then null else round((((r.tiktok_revenue+r.shopee_revenue)-p.known_hpp-c.total_cost)/(r.tiktok_revenue+r.shopee_revenue))*100,2) end,
        'coverage_complete',p.total_qty=0 or p.covered_qty=p.total_qty
      )
      from revenue r cross join products p cross join costs c
    ),
    'entries',(select rows from entries)
  ) into result;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_live_pnl_v1(uuid,date,date,text) from public,anon;
grant execute on function public.luma_live_pnl_v1(uuid,date,date,text) to authenticated,service_role;
