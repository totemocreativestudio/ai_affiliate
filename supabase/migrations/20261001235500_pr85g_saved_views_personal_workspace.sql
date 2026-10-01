-- PR85G Saved Views & Personal Workspace

create table if not exists public.luma_saved_views(
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  section text not null,
  filter_json jsonb not null default '{}'::jsonb,
  sort_json jsonb not null default '{}'::jsonb,
  ui_state_json jsonb not null default '{}'::jsonb,
  is_pinned boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists luma_saved_views_user_idx on public.luma_saved_views(workspace_id,user_id,is_pinned desc,last_used_at desc,updated_at desc);
alter table public.luma_saved_views enable row level security;
drop policy if exists luma_saved_views_self_all on public.luma_saved_views;
create policy luma_saved_views_self_all on public.luma_saved_views
for all to authenticated
using(user_id=auth.uid() and public.luma_has_workspace(workspace_id))
with check(user_id=auth.uid() and public.luma_has_workspace(workspace_id));

create table if not exists public.luma_user_workspace_pins(
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null,
  title text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key(workspace_id,user_id,section)
);
alter table public.luma_user_workspace_pins enable row level security;
drop policy if exists luma_user_workspace_pins_self_all on public.luma_user_workspace_pins;
create policy luma_user_workspace_pins_self_all on public.luma_user_workspace_pins
for all to authenticated
using(user_id=auth.uid() and public.luma_has_workspace(workspace_id))
with check(user_id=auth.uid() and public.luma_has_workspace(workspace_id));

create table if not exists public.luma_user_recent_sections(
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null,
  title text not null,
  last_opened_at timestamptz not null default now(),
  open_count int not null default 1,
  primary key(workspace_id,user_id,section)
);
alter table public.luma_user_recent_sections enable row level security;
drop policy if exists luma_user_recent_sections_self_all on public.luma_user_recent_sections;
create policy luma_user_recent_sections_self_all on public.luma_user_recent_sections
for all to authenticated
using(user_id=auth.uid() and public.luma_has_workspace(workspace_id))
with check(user_id=auth.uid() and public.luma_has_workspace(workspace_id));

create or replace function public.luma_personal_workspace_v1(p_workspace_id uuid)
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

  -- First-use default pins.
  insert into public.luma_user_workspace_pins(workspace_id,user_id,section,title,display_order)
  select p_workspace_id,auth.uid(),x.section,x.title,x.ord
  from (values
    ('dashboard','Dashboard',1),
    ('upload','Upload Center',2),
    ('listings','Listings',3),
    ('live-streaming','Live Streaming',4)
  ) x(section,title,ord)
  where not exists(
    select 1 from public.luma_user_workspace_pins p
    where p.workspace_id=p_workspace_id and p.user_id=auth.uid()
  )
  on conflict do nothing;

  select jsonb_build_object(
    'saved_views',coalesce((
      select jsonb_agg(to_jsonb(v) order by v.is_pinned desc,v.last_used_at desc nulls last,v.updated_at desc)
      from (
        select id,name,section,filter_json,sort_json,ui_state_json,is_pinned,last_used_at,updated_at
        from public.luma_saved_views
        where workspace_id=p_workspace_id and user_id=auth.uid()
        order by is_pinned desc,last_used_at desc nulls last,updated_at desc
        limit 50
      ) v
    ),'[]'::jsonb),
    'pins',coalesce((
      select jsonb_agg(to_jsonb(p) order by p.display_order,p.title)
      from (
        select section,title,display_order
        from public.luma_user_workspace_pins
        where workspace_id=p_workspace_id and user_id=auth.uid()
      ) p
    ),'[]'::jsonb),
    'recent',coalesce((
      select jsonb_agg(to_jsonb(r) order by r.last_opened_at desc)
      from (
        select section,title,last_opened_at,open_count
        from public.luma_user_recent_sections
        where workspace_id=p_workspace_id and user_id=auth.uid()
        order by last_opened_at desc
        limit 8
      ) r
    ),'[]'::jsonb)
  ) into result;
  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_personal_workspace_v1(uuid) from public,anon;
grant execute on function public.luma_personal_workspace_v1(uuid) to authenticated,service_role;

create or replace function public.luma_record_recent_section_v1(
  p_workspace_id uuid,
  p_section text,
  p_title text
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then return; end if;
  if not public.luma_has_workspace(p_workspace_id) then return; end if;
  insert into public.luma_user_recent_sections(workspace_id,user_id,section,title,last_opened_at,open_count)
  values(p_workspace_id,auth.uid(),left(coalesce(p_section,'dashboard'),80),left(coalesce(p_title,p_section,'Dashboard'),120),now(),1)
  on conflict(workspace_id,user_id,section) do update
    set title=excluded.title,last_opened_at=now(),open_count=public.luma_user_recent_sections.open_count+1;
end
$$;

revoke all on function public.luma_record_recent_section_v1(uuid,text,text) from public,anon;
grant execute on function public.luma_record_recent_section_v1(uuid,text,text) to authenticated,service_role;
