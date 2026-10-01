-- PR82P: Fix ambiguous user_id in privacy-safe assignee RPC

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
    select coalesce(max(nullif(regexp_replace(a.alias_code,'[^0-9]','','g'),'')::int),0)+1
    into next_num
    from public.luma_workspace_member_aliases a
    where a.workspace_id=p_workspace_id;

    candidate:='PIC '||lpad(next_num::text,2,'0');

    insert into public.luma_workspace_member_aliases(workspace_id,user_id,alias_code)
    values(p_workspace_id,rec.user_id,candidate)
    on conflict on constraint luma_workspace_member_aliases_pkey do nothing;
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
