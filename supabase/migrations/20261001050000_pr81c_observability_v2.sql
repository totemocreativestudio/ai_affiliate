-- PR81C: Observability v2

create or replace function public.luma_owner_observability_v2()
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  result jsonb;
begin
  if not public.luma_is_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;

  with api as (
    select *
    from public.luma_api_usage_events
    where created_at>=now()-interval '24 hours'
  ),
  latency as (
    select
      coalesce(percentile_cont(0.50) within group(order by latency_ms),0) p50,
      coalesce(percentile_cont(0.95) within group(order by latency_ms),0) p95,
      coalesce(percentile_cont(0.99) within group(order by latency_ms),0) p99
    from api where latency_ms is not null
  ),
  services as (
    select
      coalesce(service,'unknown') service,
      count(*) requests,
      count(*) filter(where lower(coalesce(status,'')) not in ('success','ok','paid','ready')) errors,
      round(coalesce(avg(latency_ms),0),2) avg_latency_ms,
      round(coalesce(percentile_cont(0.95) within group(order by latency_ms),0)::numeric,2) p95_latency_ms
    from api
    group by coalesce(service,'unknown')
    order by requests desc
    limit 20
  ),
  providers as (
    select
      coalesce(provider,'unknown') provider,
      count(*) requests,
      count(*) filter(where lower(coalesce(status,'')) not in ('success','ok','paid','ready')) errors,
      round(coalesce(avg(latency_ms),0),2) avg_latency_ms,
      coalesce(sum(cost_usd),0) cost_usd,
      coalesce(sum(cost_idr),0) cost_idr
    from api
    group by coalesce(provider,'unknown')
    order by requests desc
    limit 20
  ),
  hourly as (
    select date_trunc('hour',created_at) bucket,
      count(*) requests,
      count(*) filter(where lower(coalesce(status,'')) not in ('success','ok','paid','ready')) errors,
      round(coalesce(avg(latency_ms),0),2) avg_latency_ms
    from api
    group by 1 order by 1
  ),
  snapshots as (
    select id,status,summary,created_at
    from public.luma_system_health_snapshots
    where created_at>=now()-interval '24 hours'
    order by created_at asc
    limit 300
  )
  select jsonb_build_object(
    'generated_at',now(),
    'latency',jsonb_build_object(
      'p50_ms',round(l.p50::numeric,2),
      'p95_ms',round(l.p95::numeric,2),
      'p99_ms',round(l.p99::numeric,2)
    ),
    'services',coalesce((select jsonb_agg(to_jsonb(s)) from services s),'[]'::jsonb),
    'providers',coalesce((select jsonb_agg(to_jsonb(p)) from providers p),'[]'::jsonb),
    'hourly',coalesce((select jsonb_agg(to_jsonb(h)) from hourly h),'[]'::jsonb),
    'health_snapshots',coalesce((select jsonb_agg(to_jsonb(x)) from snapshots x),'[]'::jsonb)
  ) into result
  from latency l;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_owner_observability_v2() from public,anon;
grant execute on function public.luma_owner_observability_v2() to authenticated,service_role;

comment on function public.luma_owner_observability_v2()
is 'Owner-only 24h observability summary with API latency percentiles, service/provider breakdown, hourly trend and health snapshot history.';
