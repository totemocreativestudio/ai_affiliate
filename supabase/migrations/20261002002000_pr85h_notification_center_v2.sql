-- PR85H Notification Center 2.0

create table if not exists public.luma_user_notification_state(
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check(source_type in ('broadcast','direct')),
  source_id bigint not null,
  snoozed_until timestamptz,
  archived_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(workspace_id,user_id,source_type,source_id)
);
alter table public.luma_user_notification_state enable row level security;
drop policy if exists luma_user_notification_state_self_all on public.luma_user_notification_state;
create policy luma_user_notification_state_self_all on public.luma_user_notification_state
for all to authenticated
using(user_id=auth.uid() and public.luma_has_workspace(workspace_id))
with check(user_id=auth.uid() and public.luma_has_workspace(workspace_id));

create table if not exists public.luma_user_notification_preferences(
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  toast_enabled boolean not null default true,
  critical_toast_only boolean not null default false,
  operational_enabled boolean not null default true,
  marketing_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);
alter table public.luma_user_notification_preferences enable row level security;
drop policy if exists luma_user_notification_preferences_self_all on public.luma_user_notification_preferences;
create policy luma_user_notification_preferences_self_all on public.luma_user_notification_preferences
for all to authenticated
using(user_id=auth.uid() and public.luma_has_workspace(workspace_id))
with check(user_id=auth.uid() and public.luma_has_workspace(workspace_id));

create or replace function public.luma_notification_preferences_v1(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  insert into public.luma_user_notification_preferences(workspace_id,user_id)
  values(p_workspace_id,auth.uid())
  on conflict(workspace_id,user_id) do nothing;

  select to_jsonb(p) into result
  from (
    select toast_enabled,critical_toast_only,operational_enabled,marketing_enabled
    from public.luma_user_notification_preferences
    where workspace_id=p_workspace_id and user_id=auth.uid()
  ) p;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_notification_preferences_v1(uuid) from public,anon;
grant execute on function public.luma_notification_preferences_v1(uuid) to authenticated,service_role;
