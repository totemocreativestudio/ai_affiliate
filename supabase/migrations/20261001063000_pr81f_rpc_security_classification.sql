-- PR81F: RPC security classification registry

create table if not exists public.luma_rpc_security_registry (
  id bigserial primary key,
  function_name text not null,
  identity_arguments text not null default '',
  exposure_class text not null check(exposure_class in ('public_read','authenticated_workspace','authenticated_admin','service_only','internal_helper','review')),
  rationale text,
  reviewed boolean not null default false,
  intentional_security_definer boolean not null default false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(function_name,identity_arguments)
);

alter table public.luma_rpc_security_registry enable row level security;

drop policy if exists luma_rpc_security_registry_admin_select on public.luma_rpc_security_registry;
create policy luma_rpc_security_registry_admin_select on public.luma_rpc_security_registry
for select to authenticated using(public.luma_is_admin());

drop policy if exists luma_rpc_security_registry_admin_insert on public.luma_rpc_security_registry;
create policy luma_rpc_security_registry_admin_insert on public.luma_rpc_security_registry
for insert to authenticated with check(public.luma_is_admin());

drop policy if exists luma_rpc_security_registry_admin_update on public.luma_rpc_security_registry;
create policy luma_rpc_security_registry_admin_update on public.luma_rpc_security_registry
for update to authenticated using(public.luma_is_admin()) with check(public.luma_is_admin());

insert into public.luma_rpc_security_registry(function_name,identity_arguments,exposure_class,rationale,reviewed,intentional_security_definer,reviewed_at)
values
  ('luma_get_public_share_post','p_post_id bigint','public_read','Intentional public-share projection restricted to published posts.',true,true,now()),
  ('luma_claim_due_scheduled_reports_v1','p_limit integer','service_only','Scheduled report claim RPC is cron/service role only.',true,true,now()),
  ('luma_daily_brief_service_v1','p_workspace_id uuid','service_only','Scheduled report service wrapper.',true,true,now()),
  ('luma_goal_forecast_service_v1','p_workspace_id uuid, p_period_start date, p_period_end date','service_only','Scheduled report service wrapper.',true,true,now()),
  ('luma_is_admin','','internal_helper','Authorization helper used by admin RLS/RPC checks.',true,true,now()),
  ('luma_has_workspace','p_workspace_id uuid','internal_helper','Workspace authorization helper used by RLS/RPC checks.',true,true,now()),
  ('luma_can_manage_workspace','p_workspace_id uuid','internal_helper','Workspace management authorization helper.',true,true,now())
on conflict(function_name,identity_arguments) do nothing;

create or replace function public.luma_owner_rpc_security_inventory_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog,pg_temp
as $$
declare result jsonb;
begin
  if not public.luma_is_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;

  with funcs as (
    select
      p.oid,
      p.proname function_name,
      pg_get_function_identity_arguments(p.oid) identity_arguments,
      p.prosecdef security_definer,
      has_function_privilege('anon',p.oid,'execute') anon_execute,
      has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,
      has_function_privilege('service_role',p.oid,'execute') service_execute,
      exists(select 1 from unnest(coalesce(p.proconfig,array[]::text[])) x where x like 'search_path=%') has_search_path,
      pg_get_functiondef(p.oid) definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
  ),
  classified as (
    select f.function_name,f.identity_arguments,f.security_definer,f.anon_execute,f.authenticated_execute,f.service_execute,f.has_search_path,
      coalesce(r.exposure_class,
        case
          when f.anon_execute then 'public_read'
          when f.authenticated_execute and f.definition ilike '%luma_is_admin%' then 'authenticated_admin'
          when f.authenticated_execute and (
            f.definition ilike '%luma_has_workspace%'
            or f.definition ilike '%luma_can_manage_workspace%'
            or f.definition ilike '%auth.uid()%'
          ) then 'authenticated_workspace'
          when f.service_execute and not f.authenticated_execute then 'service_only'
          else 'review'
        end
      ) exposure_class,
      coalesce(r.reviewed,false) reviewed,
      coalesce(r.intentional_security_definer,false) intentional_security_definer,
      r.rationale,
      case
        when f.security_definer and not f.has_search_path then 'missing_search_path'
        when f.security_definer and f.anon_execute and coalesce(r.exposure_class,'')<>'public_read' then 'anon_review'
        when f.security_definer and f.authenticated_execute and coalesce(r.reviewed,false)=false then 'review'
        else 'ok'
      end review_status
    from funcs f
    left join public.luma_rpc_security_registry r
      on r.function_name=f.function_name and r.identity_arguments=f.identity_arguments
    where f.security_definer
  )
  select jsonb_build_object(
    'generated_at',now(),
    'summary',jsonb_build_object(
      'security_definer',count(*),
      'anon_executable',count(*) filter(where anon_execute),
      'authenticated_executable',count(*) filter(where authenticated_execute),
      'service_executable',count(*) filter(where service_execute),
      'reviewed',count(*) filter(where reviewed),
      'needs_review',count(*) filter(where review_status<>'ok'),
      'missing_search_path',count(*) filter(where not has_search_path)
    ),
    'functions',coalesce(jsonb_agg(jsonb_build_object(
      'function_name',function_name,
      'identity_arguments',identity_arguments,
      'security_definer',security_definer,
      'anon_execute',anon_execute,
      'authenticated_execute',authenticated_execute,
      'service_execute',service_execute,
      'has_search_path',has_search_path,
      'exposure_class',exposure_class,
      'reviewed',reviewed,
      'intentional_security_definer',intentional_security_definer,
      'rationale',rationale,
      'review_status',review_status
    ) order by review_status desc,function_name),'[]'::jsonb)
  ) into result
  from classified;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_owner_rpc_security_inventory_v1() from public,anon;
grant execute on function public.luma_owner_rpc_security_inventory_v1() to authenticated,service_role;

create or replace function public.luma_owner_review_rpc_security_v1(
  p_function_name text,
  p_identity_arguments text,
  p_exposure_class text,
  p_intentional_security_definer boolean,
  p_rationale text
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
  if p_exposure_class not in ('public_read','authenticated_workspace','authenticated_admin','service_only','internal_helper','review') then
    raise exception 'Invalid exposure class';
  end if;
  insert into public.luma_rpc_security_registry(
    function_name,identity_arguments,exposure_class,rationale,reviewed,intentional_security_definer,reviewed_by,reviewed_at,updated_at
  ) values(
    p_function_name,coalesce(p_identity_arguments,''),p_exposure_class,nullif(trim(coalesce(p_rationale,'')),''),
    true,p_intentional_security_definer,auth.uid(),now(),now()
  )
  on conflict(function_name,identity_arguments) do update set
    exposure_class=excluded.exposure_class,
    rationale=excluded.rationale,
    reviewed=true,
    intentional_security_definer=excluded.intentional_security_definer,
    reviewed_by=auth.uid(),
    reviewed_at=now(),
    updated_at=now();
end
$$;

revoke all on function public.luma_owner_review_rpc_security_v1(text,text,text,boolean,text) from public,anon;
grant execute on function public.luma_owner_review_rpc_security_v1(text,text,text,boolean,text) to authenticated;
