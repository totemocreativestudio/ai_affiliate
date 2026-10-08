-- PR88: Follow-up channel contacts (WhatsApp / IG / TikTok / dll) + PIC label dari nama member
-- Tujuan:
--   1. Tombol/pilihan "Follow Up Via" benar-benar tersambung ke database (bukan daftar mati/hardcoded).
--   2. Contact (no telfon, username IG/TikTok) tersimpan per channel per creator.
--   3. Label PIC pada listing memakai nama profil member asli, bukan teks statis "Saya".

-- 1) Tabel kanal kontak ------------------------------------------------------
create table if not exists public.luma_channel_contacts(
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creator_id bigint references public.creators(id) on delete cascade,
  channel text not null,
  phone text,
  handle text,
  url text,
  note text,
  is_primary boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists luma_channel_contacts_workspace_idx
  on public.luma_channel_contacts(workspace_id, channel);
create index if not exists luma_channel_contacts_creator_idx
  on public.luma_channel_contacts(workspace_id, creator_id);
create unique index if not exists luma_channel_contacts_unique_primary_idx
  on public.luma_channel_contacts(workspace_id, creator_id, channel)
  where is_primary;

alter table public.luma_channel_contacts enable row level security;

drop policy if exists luma_channel_contacts_select on public.luma_channel_contacts;
create policy luma_channel_contacts_select on public.luma_channel_contacts
for select to authenticated using(public.luma_has_workspace(workspace_id));

drop policy if exists luma_channel_contacts_insert on public.luma_channel_contacts;
create policy luma_channel_contacts_insert on public.luma_channel_contacts
for insert to authenticated with check(public.luma_has_workspace(workspace_id));

drop policy if exists luma_channel_contacts_update on public.luma_channel_contacts;
create policy luma_channel_contacts_update on public.luma_channel_contacts
for update to authenticated
using(public.luma_has_workspace(workspace_id))
with check(public.luma_has_workspace(workspace_id));

drop policy if exists luma_channel_contacts_delete on public.luma_channel_contacts;
create policy luma_channel_contacts_delete on public.luma_channel_contacts
for delete to authenticated using(public.luma_has_workspace(workspace_id));

comment on table public.luma_channel_contacts
is 'Per-creator outreach contacts per channel (WhatsApp, IG, TikTok, dll). Powers the Follow Up Via selector.';

-- 2) Label PIC memakai nama profil member, bukan teks statis "Saya" ----------
--    Tetap privacy-safe: hanya mengembalikan user_id, label aman, dan flag is_self.
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
    coalesce(
      nullif(btrim(coalesce(p.n,p.full_name,'')),''),
      a.alias_code,
      'PIC'
    ) as safe_label,
    (wm.user_id=auth.uid()) as is_self
  from public.workspace_members wm
  join public.profiles p on p.id=wm.user_id
  join public.luma_workspace_member_aliases a
    on a.workspace_id=wm.workspace_id and a.user_id=wm.user_id
  where wm.workspace_id=p_workspace_id
    and coalesce(p.role,'staff')<>'admin'
    and coalesce(p.active,true)=true
  order by case when wm.user_id=auth.uid() then 0 else 1 end,
    coalesce(nullif(btrim(coalesce(p.n,p.full_name,'')),''),a.alias_code);
end
$$;

revoke all on function public.luma_safe_workspace_assignees_v1(uuid) from public,anon;
grant execute on function public.luma_safe_workspace_assignees_v1(uuid) to authenticated,service_role;
