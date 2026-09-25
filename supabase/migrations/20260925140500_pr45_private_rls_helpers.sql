-- PR45 phase 2: move RLS-only SECURITY DEFINER helpers out of the exposed public schema.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.luma_my_workspace_ids()
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

create or replace function private.luma_my_allowed_creator_ids()
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

revoke execute on function private.luma_my_workspace_ids() from public, anon;
grant execute on function private.luma_my_workspace_ids() to authenticated, service_role;

revoke execute on function private.luma_my_allowed_creator_ids() from public, anon;
grant execute on function private.luma_my_allowed_creator_ids() to authenticated, service_role;

alter policy pr45_creators_select_auth
  on public.creators
  using (
    (select public.luma_is_admin())
    or id = any(
      ((select private.luma_my_allowed_creator_ids()))::bigint[]
    )
  );

alter policy pr45_sales_select_auth
  on public.sales
  using (
    (select public.luma_is_admin())
    or (
      workspace_id = any(
        ((select private.luma_my_workspace_ids()))::uuid[]
      )
      and (
        creator_id is null
        or (select public.luma_is_manager_or_admin())
        or creator_id = any(
          ((select private.luma_my_allowed_creator_ids()))::bigint[]
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
        ((select private.luma_my_workspace_ids()))::uuid[]
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
        ((select private.luma_my_workspace_ids()))::uuid[]
      )
    )
  )
  with check (
    (select public.luma_is_admin())
    or (
      (select public.luma_is_manager_or_admin())
      and workspace_id = any(
        ((select private.luma_my_workspace_ids()))::uuid[]
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
        ((select private.luma_my_workspace_ids()))::uuid[]
      )
    )
  );

drop function public.luma_my_workspace_ids();
drop function public.luma_my_allowed_creator_ids();
