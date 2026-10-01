-- PR82M: Multi-user privacy audit

create or replace function public.luma_owner_multiuser_privacy_audit_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog,pg_temp
as $$
declare
  findings jsonb:='[]'::jsonb;
  ok boolean;
  def text;
  failed int:=0;
  total int:=0;
begin
  if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;

  -- 1 platform settings admin-only
  total:=total+1;
  select coalesce(bool_and(coalesce(qual,'') ilike '%luma_is_admin%' and coalesce(qual,'') not ilike '%true%'),false)
  into ok
  from pg_policies
  where schemaname='public' and tablename='luma_platform_settings' and cmd='SELECT';
  if not ok then failed:=failed+1; findings:=findings||jsonb_build_array(jsonb_build_object('key','platform_settings','status','fail','message','Platform settings SELECT is not strictly admin-only.')); end if;

  -- 2 provider accounts admin-only
  total:=total+1;
  select exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='luma_provider_accounts'
      and coalesce(qual,'') ilike '%luma_is_admin%'
  ) into ok;
  if not ok then failed:=failed+1; findings:=findings||jsonb_build_array(jsonb_build_object('key','provider_accounts','status','fail','message','Provider account policy is not admin guarded.')); end if;

  -- 3 payment provider client deny
  total:=total+1;
  select exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='luma_payment_provider_settings'
      and roles::text ilike '%authenticated%' and coalesce(qual,'')='false'
  ) into ok;
  if not ok then failed:=failed+1; findings:=findings||jsonb_build_array(jsonb_build_object('key','payment_provider_settings','status','fail','message','Payment provider settings are not explicitly denied to client roles.')); end if;

  -- 4 profiles restricted to self/admin
  total:=total+1;
  select exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and cmd='SELECT'
      and coalesce(qual,'') ilike '%auth.uid()%'
      and coalesce(qual,'') ilike '%luma_is_admin%'
  ) into ok;
  if not ok then failed:=failed+1; findings:=findings||jsonb_build_array(jsonb_build_object('key','profiles','status','fail','message','Profile SELECT policy is not self/admin restricted.')); end if;

  -- 5 safe assignee RPC exists
  total:=total+1;
  select exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='luma_safe_workspace_assignees_v1'
  ) into ok;
  if not ok then failed:=failed+1; findings:=findings||jsonb_build_array(jsonb_build_object('key','safe_assignees','status','fail','message','Privacy-safe assignee RPC is missing.')); end if;

  -- 6 safe RPC must not contain profile identity columns
  total:=total+1;
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='luma_safe_workspace_assignees_v1'
  limit 1;
  ok:=def is not null
      and lower(def) not like '%full_name%'
      and lower(def) not like '%email%'
      and lower(def) not like '%username%'
      and lower(def) not like '%membership_role%';
  if not ok then failed:=failed+1; findings:=findings||jsonb_build_array(jsonb_build_object('key','safe_assignee_payload','status','fail','message','Safe assignee RPC references an identity-bearing profile field.')); end if;

  -- 7 owner audit RPCs remain admin guarded
  total:=total+1;
  select bool_and(pg_get_functiondef(p.oid) ilike '%luma_is_admin%')
  into ok
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'luma_owner_%';
  ok:=coalesce(ok,false);
  if not ok then failed:=failed+1; findings:=findings||jsonb_build_array(jsonb_build_object('key','owner_rpc_guard','status','fail','message','One or more owner RPCs do not contain an admin guard.')); end if;

  -- 8 catch unconditional TRUE on known sensitive configuration tables
  total:=total+1;
  select not exists(
    select 1 from pg_policies
    where schemaname='public'
      and tablename in ('luma_platform_settings','luma_provider_accounts','luma_payment_provider_settings','owner_service_subscriptions')
      and cmd in ('SELECT','ALL')
      and roles::text ilike '%authenticated%'
      and (coalesce(qual,'')='true' or coalesce(qual,'') ilike '% or true%')
  ) into ok;
  if not ok then failed:=failed+1; findings:=findings||jsonb_build_array(jsonb_build_object('key','unconditional_sensitive_read','status','fail','message','Sensitive table has an unconditional authenticated read path.')); end if;

  return jsonb_build_object(
    'checked_at',now(),
    'status',case when failed=0 then 'PASS' else 'REVIEW' end,
    'total_checks',total,
    'failed_checks',failed,
    'findings',findings
  );
end
$$;

revoke all on function public.luma_owner_multiuser_privacy_audit_v1() from public,anon;
grant execute on function public.luma_owner_multiuser_privacy_audit_v1() to authenticated,service_role;
