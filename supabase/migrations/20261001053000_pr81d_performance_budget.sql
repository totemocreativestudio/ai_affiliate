-- PR81D: Load test & performance budget

create table if not exists public.luma_performance_budgets (
  id bigserial primary key,
  scope text not null unique,
  p95_ms numeric not null default 1500,
  error_rate_pct numeric not null default 1,
  min_requests integer not null default 20,
  enabled boolean not null default true,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.luma_performance_budgets enable row level security;

drop policy if exists luma_performance_budgets_admin_select on public.luma_performance_budgets;
create policy luma_performance_budgets_admin_select on public.luma_performance_budgets
for select to authenticated using(public.luma_is_admin());

drop policy if exists luma_performance_budgets_admin_insert on public.luma_performance_budgets;
create policy luma_performance_budgets_admin_insert on public.luma_performance_budgets
for insert to authenticated with check(public.luma_is_admin());

drop policy if exists luma_performance_budgets_admin_update on public.luma_performance_budgets;
create policy luma_performance_budgets_admin_update on public.luma_performance_budgets
for update to authenticated using(public.luma_is_admin()) with check(public.luma_is_admin());

insert into public.luma_performance_budgets(scope,p95_ms,error_rate_pct,min_requests,notes)
values
  ('global',1500,1,20,'Default production performance budget'),
  ('openai',5000,2,10,'AI calls may be slower than ordinary reads'),
  ('payment',2500,1,10,'Checkout/payment API budget'),
  ('import',5000,2,5,'Import API request budget')
on conflict(scope) do nothing;

create or replace function public.luma_owner_performance_budget_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare result jsonb;
begin
  if not public.luma_is_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;

  with budgets as (
    select * from public.luma_performance_budgets where enabled
  ),
  base as (
    select
      coalesce(service,'global') service,
      coalesce(provider,'unknown') provider,
      status,
      latency_ms,
      created_at
    from public.luma_api_usage_events
    where created_at>=now()-interval '24 hours'
  ),
  global_stats as (
    select
      count(*) requests,
      count(*) filter(where lower(coalesce(status,'')) not in ('success','ok','paid','ready')) errors,
      coalesce(percentile_cont(.95) within group(order by latency_ms) filter(where latency_ms is not null),0) p95
    from base
  ),
  service_stats as (
    select service,
      count(*) requests,
      count(*) filter(where lower(coalesce(status,'')) not in ('success','ok','paid','ready')) errors,
      coalesce(percentile_cont(.95) within group(order by latency_ms) filter(where latency_ms is not null),0) p95
    from base group by service
  ),
  checks as (
    select b.scope,
      case when b.scope='global' then g.requests else coalesce(s.requests,0) end requests,
      case when b.scope='global' then g.errors else coalesce(s.errors,0) end errors,
      round((case when b.scope='global' then g.p95 else coalesce(s.p95,0) end)::numeric,2) p95_ms,
      b.p95_ms budget_p95_ms,b.error_rate_pct budget_error_rate_pct,b.min_requests,
      round(case when (case when b.scope='global' then g.requests else coalesce(s.requests,0) end)>0
        then ((case when b.scope='global' then g.errors else coalesce(s.errors,0) end)::numeric/
          (case when b.scope='global' then g.requests else coalesce(s.requests,0) end)::numeric)*100 else 0 end,2) error_rate_pct
    from budgets b
    cross join global_stats g
    left join service_stats s on s.service=b.scope
  )
  select jsonb_build_object(
    'checked_at',now(),
    'checks',coalesce(jsonb_agg(jsonb_build_object(
      'scope',scope,'requests',requests,'errors',errors,'p95_ms',p95_ms,
      'error_rate_pct',error_rate_pct,'budget_p95_ms',budget_p95_ms,
      'budget_error_rate_pct',budget_error_rate_pct,'min_requests',min_requests,
      'enough_samples',(requests>=min_requests),
      'latency_pass',(requests<min_requests or p95_ms<=budget_p95_ms),
      'error_pass',(requests<min_requests or error_rate_pct<=budget_error_rate_pct),
      'status',case when requests<min_requests then 'insufficient_data'
                    when p95_ms<=budget_p95_ms and error_rate_pct<=budget_error_rate_pct then 'pass'
                    else 'fail' end
    ) order by scope),'[]'::jsonb)
  ) into result from checks;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_owner_performance_budget_v1() from public,anon;
grant execute on function public.luma_owner_performance_budget_v1() to authenticated,service_role;
