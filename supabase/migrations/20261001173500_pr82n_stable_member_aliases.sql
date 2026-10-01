-- PR82N: Stable member aliases and platform-admin exclusion

create table if not exists public.luma_workspace_member_aliases(
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  alias_code text not null,
  created_at timestamptz not null default now(),
  primary key(workspace_id,user_id),
  unique(workspace_id,alias_code)
);

alter table public.luma_workspace_member_aliases enable row level security;

drop policy if exists luma_workspace_member_aliases_admin_only on public.luma_workspace_member_aliases;
create policy luma_workspace_member_aliases_admin_only
on public.luma_workspace_member_aliases
for all to authenticated
using(public.luma_is_admin())
with check(public.luma_is_admin());

create or replace function public.luma_safe_workspace_assignees_v1(p_workspace_id uuid)
returns table(user_id uuid,safe_label text,is_self boolean)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  rec record;
  next_num int;
  candidate text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  -- Persist aliases only for operational workspace users. Platform admins are excluded.
  for rec in
    select wm.user_id
    from public.workspace_members wm
    join public.profiles p on p.id=wm.user_id
    left join public.luma_workspace_member_aliases a
      on a.workspace_id=wm.workspace_id and a.user_id=wm.user_id
    where wm.workspace_id=p_workspace_id
      and coalesce(p.role,'staff')<>'admin'
      and coalesce(p.active,true)=true
      and a.user_id is null
    order by wm.created_at,wm.user_id
  loop
    select coalesce(max(nullif(regexp_replace(alias_code,'[^0-9]','','g'),'')::int),0)+1
    into next_num
    from public.luma_workspace_member_aliases
    where workspace_id=p_workspace_id;

    candidate:='PIC '||lpad(next_num::text,2,'0');

    insert into public.luma_workspace_member_aliases(workspace_id,user_id,alias_code)
    values(p_workspace_id,rec.user_id,candidate)
    on conflict(workspace_id,user_id) do nothing;
  end loop;

  return query
  select
    wm.user_id,
    case when wm.user_id=auth.uid() then 'Saya' else a.alias_code end as safe_label,
    (wm.user_id=auth.uid()) as is_self
  from public.workspace_members wm
  join public.profiles p on p.id=wm.user_id
  join public.luma_workspace_member_aliases a
    on a.workspace_id=wm.workspace_id and a.user_id=wm.user_id
  where wm.workspace_id=p_workspace_id
    and coalesce(p.role,'staff')<>'admin'
    and coalesce(p.active,true)=true
  order by case when wm.user_id=auth.uid() then 0 else 1 end,a.alias_code;
end
$$;

revoke all on function public.luma_safe_workspace_assignees_v1(uuid) from public,anon;
grant execute on function public.luma_safe_workspace_assignees_v1(uuid) to authenticated,service_role;

comment on table public.luma_workspace_member_aliases
is 'Stable privacy aliases for member-facing team assignment. Direct table access is admin-only.';

comment on function public.luma_safe_workspace_assignees_v1(uuid)
is 'Returns only operational non-admin workspace user UUID, safe alias, and self flag. Never returns profile identity or membership role.';
