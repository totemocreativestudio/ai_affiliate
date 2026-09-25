-- PR45 RLS Policy Consolidation & Query Plan Optimization
-- Goal: preserve existing authorization semantics while reducing repeated permissive
-- policy evaluation and eliminating hot-path per-row authorization helper calls.

-- ---------------------------------------------------------------------------
-- 1) Query-global helper sets used by the two largest RLS-protected tables.
-- ---------------------------------------------------------------------------

create or replace function public.luma_my_workspace_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    array_agg(wm.workspace_id order by wm.workspace_id)
      filter (where p.active = true and p.role <> 'admin'),
    array[]::uuid[]
  )
  from public.profiles p
  left join public.workspace_members wm
    on wm.user_id = p.id
  where p.id = (select auth.uid());
$$;

create or replace function public.luma_my_allowed_creator_ids()
returns bigint[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_active boolean;
  v_view_all boolean := false;
begin
  if v_uid is null then
    return array[]::bigint[];
  end if;

  select p.role, p.active
    into v_role, v_active
  from public.profiles p
  where p.id = v_uid;

  if coalesce(v_active, false) = false or v_role = 'admin' then
    return array[]::bigint[];
  end if;

  select exists (
    select 1
    from public.user_permissions up
    where up.user_id = v_uid
      and up.permission = 'creator.view_all'
      and up.enabled = true
  )
  into v_view_all;

  if v_view_all then
    return array(
      select c.id
      from public.creators c
      join public.workspace_members wm
        on wm.workspace_id = c.workspace_id
       and wm.user_id = v_uid
      order by c.id
    );
  end if;

  return array(
    select distinct cua.creator_id
    from public.creator_user_access cua
    join public.creators c
      on c.id = cua.creator_id
    join public.workspace_members wm
      on wm.workspace_id = c.workspace_id
     and wm.user_id = v_uid
    where cua.user_id = v_uid
    order by cua.creator_id
  );
end;
$$;

revoke execute on function public.luma_my_workspace_ids() from public, anon;
grant execute on function public.luma_my_workspace_ids() to authenticated, service_role;

revoke execute on function public.luma_my_allowed_creator_ids() from public, anon;
grant execute on function public.luma_my_allowed_creator_ids() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Normalize the two cross-role policies that currently contribute to the
-- authenticated multiple-permissive advisor warning.
-- ---------------------------------------------------------------------------

alter policy luma_blog_public_read
  on public.luma_blog_posts
  to anon;

create policy pr45_luma_blog_published_authenticated
  on public.luma_blog_posts
  as permissive
  for select
  to authenticated
  using ((status = 'published'::text) and (published_at <= now()));

-- This policy was TO public, but anon can never satisfy user_id = auth.uid()
-- because auth.uid() is NULL when unauthenticated. Restricting it to
-- authenticated therefore preserves effective row access.
alter policy luma_community_saves_self
  on public.luma_community_saves
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Consolidate overlapping authenticated permissive policies.
-- PostgreSQL combines permissive policies with OR. The generated per-action
-- policy below is the exact OR of the pre-existing effective expressions.
-- Restrictive policies and policies for other roles are left untouched.
-- ---------------------------------------------------------------------------

create temp table pr45_auth_policy_source on commit drop as
select schemaname, tablename, policyname, cmd, roles, permissive, qual, with_check
from pg_policies
where schemaname = 'public'
  and permissive = 'PERMISSIVE'
  and roles = array['authenticated']::name[];

create temp table pr45_affected_tables on commit drop as
with expanded as (
  select s.tablename, s.policyname, s.cmd, a.action
  from pr45_auth_policy_source s
  cross join lateral (
    values ('SELECT'::text), ('INSERT'::text), ('UPDATE'::text), ('DELETE'::text)
  ) a(action)
  where s.cmd = a.action or s.cmd = 'ALL'
),
overlaps as (
  select tablename, action
  from expanded
  group by tablename, action
  having count(*) > 1
)
select distinct tablename
from overlaps;

do $pr45_drop$
declare
  r record;
begin
  for r in
    select s.tablename, s.policyname
    from pr45_auth_policy_source s
    join pr45_affected_tables a using (tablename)
    order by s.tablename, s.policyname
  loop
    execute format(
      'drop policy %I on public.%I',
      r.policyname,
      r.tablename
    );
  end loop;
end
$pr45_drop$;

do $pr45_rebuild$
declare
  r record;
  v_using text;
  v_check text;
  v_policy_name text;
begin
  for r in
    select distinct s.tablename, a.action
    from pr45_auth_policy_source s
    join pr45_affected_tables t using (tablename)
    cross join lateral (
      values ('SELECT'::text), ('INSERT'::text), ('UPDATE'::text), ('DELETE'::text)
    ) a(action)
    where s.cmd = a.action or s.cmd = 'ALL'
    order by s.tablename, a.action
  loop
    v_policy_name := left(
      'pr45_' || r.tablename || '_' || lower(r.action) || '_auth',
      63
    );

    if r.action in ('SELECT', 'DELETE') then
      select string_agg(
        '(' || coalesce(s.qual, 'true') || ')',
        ' OR ' order by s.policyname
      )
      into v_using
      from pr45_auth_policy_source s
      where s.tablename = r.tablename
        and (s.cmd = r.action or s.cmd = 'ALL');

      execute format(
        'create policy %I on public.%I as permissive for %s to authenticated using (%s)',
        v_policy_name,
        r.tablename,
        r.action,
        v_using
      );

    elsif r.action = 'INSERT' then
      select string_agg(
        '(' || coalesce(s.with_check, s.qual, 'true') || ')',
        ' OR ' order by s.policyname
      )
      into v_check
      from pr45_auth_policy_source s
      where s.tablename = r.tablename
        and (s.cmd = 'INSERT' or s.cmd = 'ALL');

      execute format(
        'create policy %I on public.%I as permissive for insert to authenticated with check (%s)',
        v_policy_name,
        r.tablename,
        v_check
      );

    elsif r.action = 'UPDATE' then
      select string_agg(
        '(' || coalesce(s.qual, 'true') || ')',
        ' OR ' order by s.policyname
      ),
      string_agg(
        '(' || coalesce(s.with_check, s.qual, 'true') || ')',
        ' OR ' order by s.policyname
      )
      into v_using, v_check
      from pr45_auth_policy_source s
      where s.tablename = r.tablename
        and (s.cmd = 'UPDATE' or s.cmd = 'ALL');

      execute format(
        'create policy %I on public.%I as permissive for update to authenticated using (%s) with check (%s)',
        v_policy_name,
        r.tablename,
        v_using,
        v_check
      );
    end if;
  end loop;
end
$pr45_rebuild$;

-- ---------------------------------------------------------------------------
-- 4) Optimize the two hot RLS paths while preserving their prior semantics.
-- creators current effective SELECT:
--   admin OR (active workspace member AND (creator.view_all OR explicit access))
-- sales current effective SELECT:
--   admin OR (active workspace member AND
--     (creator_id IS NULL OR manager OR allowed creator))
-- ---------------------------------------------------------------------------

alter policy pr45_creators_select_auth
  on public.creators
  using (
    (select public.luma_is_admin())
    or id = any(
      ((select public.luma_my_allowed_creator_ids()))::bigint[]
    )
  );

alter policy pr45_creators_insert_auth
  on public.creators
  with check ((select public.luma_is_admin()));

alter policy pr45_creators_update_auth
  on public.creators
  using ((select public.luma_is_admin()))
  with check ((select public.luma_is_admin()));

alter policy pr45_creators_delete_auth
  on public.creators
  using ((select public.luma_is_admin()));

alter policy pr45_sales_select_auth
  on public.sales
  using (
    (select public.luma_is_admin())
    or (
      workspace_id = any(
        ((select public.luma_my_workspace_ids()))::uuid[]
      )
      and (
        creator_id is null
        or (select public.luma_is_manager_or_admin())
        or creator_id = any(
          ((select public.luma_my_allowed_creator_ids()))::bigint[]
        )
      )
    )
  );

alter policy pr45_sales_insert_auth
  on public.sales
  with check (
    (select public.luma_is_admin())
    or (
      (select public.luma_is_manager_or_admin())
      and workspace_id = any(
        ((select public.luma_my_workspace_ids()))::uuid[]
      )
    )
  );

alter policy pr45_sales_update_auth
  on public.sales
  using (
    (select public.luma_is_admin())
    or (
      (select public.luma_is_manager_or_admin())
      and workspace_id = any(
        ((select public.luma_my_workspace_ids()))::uuid[]
      )
    )
  )
  with check (
    (select public.luma_is_admin())
    or (
      (select public.luma_is_manager_or_admin())
      and workspace_id = any(
        ((select public.luma_my_workspace_ids()))::uuid[]
      )
    )
  );

alter policy pr45_sales_delete_auth
  on public.sales
  using (
    (select public.luma_is_admin())
    or (
      (select public.luma_is_manager_or_admin())
      and workspace_id = any(
        ((select public.luma_my_workspace_ids()))::uuid[]
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Add indexes matching the highest-cost production query shapes.
-- ---------------------------------------------------------------------------

create index if not exists idx_creators_workspace_name_id
  on public.creators (workspace_id, name, id);

create index if not exists idx_sales_workspace_type_date
  on public.sales (workspace_id, data_type, data_date desc);
