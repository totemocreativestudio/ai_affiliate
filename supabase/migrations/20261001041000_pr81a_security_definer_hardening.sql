-- PR81A: SECURITY DEFINER hardening phase 1
-- 1) Remove implicit PUBLIC execute from every SECURITY DEFINER function.
--    Existing explicit anon/authenticated/service_role grants remain unchanged.
-- 2) Convert active promotions reader to SECURITY INVOKER because authenticated RLS
--    already enforces the same published/active time-window filter.

do $$
declare
  r record;
begin
  for r in
    select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
  loop
    execute format('revoke execute on function %I.%I(%s) from public',r.nspname,r.proname,r.args);
  end loop;
end $$;

alter function public.luma_active_promotions_v1() security invoker;
revoke execute on function public.luma_active_promotions_v1() from public,anon;
grant execute on function public.luma_active_promotions_v1() to authenticated,service_role;

comment on function public.luma_active_promotions_v1()
is 'Authenticated published-promo reader. SECURITY INVOKER intentionally relies on luma_promo_codes RLS.';

comment on function public.luma_get_public_share_post(bigint)
is 'Intentional public-share RPC. SECURITY DEFINER is retained so anon can read only the restricted published-post projection returned by this function.';
