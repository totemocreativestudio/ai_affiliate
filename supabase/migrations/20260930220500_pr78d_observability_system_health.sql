-- PR78D: Observability and System Health

alter table public.luma_api_usage_events
  add column if not exists latency_ms numeric;

create index if not exists idx_luma_api_usage_health
  on public.luma_api_usage_events(created_at desc,status,provider,service);

create index if not exists idx_luma_imports_health
  on public.imports(status,imported_at desc);

create index if not exists idx_luma_webhook_health
  on public.luma_payment_webhook_events(processing_status,created_at desc);

create table if not exists public.luma_system_health_snapshots (
  id bigserial primary key,
  status text not null check(status in ('healthy','degraded','critical')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.luma_system_health_snapshots enable row level security;

drop policy if exists pr78d_health_admin_read on public.luma_system_health_snapshots;
create policy pr78d_health_admin_read
on public.luma_system_health_snapshots for select to authenticated
using (public.luma_is_admin());

revoke insert,update,delete on public.luma_system_health_snapshots from anon,authenticated;

create or replace function public.luma_owner_system_health_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_api_total bigint:=0;
  v_api_errors bigint:=0;
  v_api_error_rate numeric:=0;
  v_failed_imports bigint:=0;
  v_stale_imports bigint:=0;
  v_failed_webhooks bigint:=0;
  v_stale_webhooks bigint:=0;
  v_duplicate_webhooks bigint:=0;
  v_stale_intents bigint:=0;
  v_open_issues bigint:=0;
  v_db_bytes bigint:=0;
  v_latest_import timestamptz;
  v_latest_webhook timestamptz;
  v_providers jsonb:='[]'::jsonb;
  v_status text:='healthy';
  v_summary jsonb;
begin
  if not public.luma_is_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;

  select count(*),
         count(*) filter(where lower(coalesce(status,'')) not in ('success','ok','paid','ready'))
  into v_api_total,v_api_errors
  from public.luma_api_usage_events
  where created_at>=now()-interval '15 minutes';

  if v_api_total>0 then
    v_api_error_rate:=round((v_api_errors::numeric/v_api_total::numeric)*100,2);
  end if;

  select
    count(*) filter(where lower(coalesce(status,''))='error' and imported_at>=now()-interval '24 hours'),
    count(*) filter(where lower(coalesce(status,''))='processing' and imported_at<now()-interval '30 minutes'),
    max(imported_at)
  into v_failed_imports,v_stale_imports,v_latest_import
  from public.imports;

  select
    count(*) filter(where processing_status='failed' and created_at>=now()-interval '24 hours'),
    count(*) filter(where processing_status='processing' and created_at<now()-interval '10 minutes'),
    count(*) filter(where attempts>1 and created_at>=now()-interval '24 hours'),
    max(created_at)
  into v_failed_webhooks,v_stale_webhooks,v_duplicate_webhooks,v_latest_webhook
  from public.luma_payment_webhook_events;

  select count(*) into v_stale_intents
  from public.luma_payment_checkout_intents
  where status in ('processing','ready')
    and (
      (expires_at is not null and expires_at<now())
      or (status='processing' and created_at<now()-interval '10 minutes')
    );

  select count(*) into v_open_issues
  from public.luma_issue_logs
  where lower(coalesce(status,''))<>'resolved';

  select pg_database_size(current_database()) into v_db_bytes;

  select coalesce(jsonb_agg(jsonb_build_object(
    'provider',provider,
    'enabled',enabled,
    'health_status',health_status,
    'last_success_at',last_success_at,
    'last_error_at',last_error_at,
    'last_error',left(coalesce(last_error,''),160)
  ) order by priority,provider),'[]'::jsonb)
  into v_providers
  from public.luma_payment_provider_settings;

  if v_failed_webhooks>0 or v_stale_webhooks>0 or v_stale_intents>5 or v_api_error_rate>=20 then
    v_status:='critical';
  elsif v_stale_imports>0 or v_failed_imports>0 or v_stale_intents>0 or v_api_error_rate>=5 then
    v_status:='degraded';
  end if;

  v_summary:=jsonb_build_object(
    'status',v_status,
    'checked_at',now(),
    'api',jsonb_build_object(
      'requests_15m',v_api_total,
      'errors_15m',v_api_errors,
      'error_rate_pct',v_api_error_rate
    ),
    'imports',jsonb_build_object(
      'failed_24h',v_failed_imports,
      'stale_processing',v_stale_imports,
      'latest_at',v_latest_import
    ),
    'payments',jsonb_build_object(
      'failed_webhooks_24h',v_failed_webhooks,
      'stale_webhooks',v_stale_webhooks,
      'duplicate_deliveries_24h',v_duplicate_webhooks,
      'stale_checkout_intents',v_stale_intents,
      'latest_webhook_at',v_latest_webhook,
      'providers',v_providers
    ),
    'database',jsonb_build_object(
      'bytes',v_db_bytes,
      'megabytes',round(v_db_bytes::numeric/1024/1024,2)
    ),
    'issues',jsonb_build_object(
      'open',v_open_issues
    )
  );

  insert into public.luma_system_health_snapshots(status,summary)
  values(v_status,v_summary);

  delete from public.luma_system_health_snapshots
  where created_at<now()-interval '30 days';

  return v_summary;
end
$$;

revoke all on function public.luma_owner_system_health_v1() from public,anon;
grant execute on function public.luma_owner_system_health_v1() to authenticated,service_role;

comment on function public.luma_owner_system_health_v1() is
'Owner-only production health snapshot for API errors, imports, payment webhooks, checkout intents, DB size, providers, and issue queue.';
