-- PR86E Live Upload Context, Store/Host Attribution & Product Intelligence UX

alter table public.live_imports
  add column if not exists store_name text,
  add column if not exists store_id text,
  add column if not exists store_username text,
  add column if not exists host_id uuid references public.live_hosts(id) on delete set null;

alter table public.live_daily_performance
  add column if not exists store_name text,
  add column if not exists store_id text,
  add column if not exists store_username text;

alter table public.live_product_performance
  add column if not exists store_name text,
  add column if not exists store_id text,
  add column if not exists store_username text;

alter table public.live_period_overview
  add column if not exists store_name text,
  add column if not exists store_id text,
  add column if not exists store_username text;

alter table public.live_session_performance
  add column if not exists store_name text,
  add column if not exists store_id text,
  add column if not exists store_username text;

alter table public.live_sessions
  add column if not exists store_name text,
  add column if not exists store_id text,
  add column if not exists store_username text;

create index if not exists live_imports_workspace_store_idx
  on public.live_imports(workspace_id,store_name,created_at desc);
create index if not exists live_product_perf_workspace_store_idx
  on public.live_product_performance(workspace_id,store_name,period_start,period_end);
create index if not exists live_daily_perf_workspace_store_idx
  on public.live_daily_performance(workspace_id,store_name,metric_date);
create index if not exists live_sessions_workspace_store_idx
  on public.live_sessions(workspace_id,store_name,session_date);

create or replace function public.luma_live_upload_context_health_v1(
  p_workspace_id uuid,
  p_start date,
  p_end date
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  missing_store int:=0;
  missing_host int:=0;
  host_mismatch int:=0;
  completed_imports int:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  select
    count(*),
    count(*) filter(
      where nullif(trim(coalesce(store_name,'')),'') is null
         or nullif(trim(coalesce(store_id,'')),'') is null
         or nullif(trim(coalesce(store_username,'')),'') is null
    ),
    count(*) filter(where host_id is null)
  into completed_imports,missing_store,missing_host
  from public.live_imports
  where workspace_id=p_workspace_id
    and status='completed'
    and coalesce(period_start,created_at::date)<=p_end
    and coalesce(period_end,created_at::date)>=p_start;

  select count(*)
  into host_mismatch
  from public.live_sessions s
  join public.live_imports i
    on i.workspace_id=s.workspace_id and i.import_id=s.source_import_id
  where s.workspace_id=p_workspace_id
    and lower(coalesce(s.platform,''))='shopee'
    and s.session_date between p_start and p_end
    and i.dataset_type='shopee_session_list'
    and i.host_id is not null
    and s.host_id is distinct from i.host_id;

  return jsonb_build_object(
    'completed_imports',completed_imports,
    'missing_store_context',missing_store,
    'missing_host_context',missing_host,
    'session_host_mismatch',host_mismatch,
    'status',case when missing_store=0 and missing_host=0 and host_mismatch=0 then 'EXACT' else 'REVIEW' end,
    'checked_at',now()
  );
end
$$;

revoke all on function public.luma_live_upload_context_health_v1(uuid,date,date) from public,anon;
grant execute on function public.luma_live_upload_context_health_v1(uuid,date,date) to authenticated,service_role;
