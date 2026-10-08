-- PR87 — Listing ↔ Master Creator link flow (ADDITIVE ONLY)
-- Tujuan: memperbaiki akar alur data antara public.listings dan public.creators
-- supaya kontak (nomor WhatsApp/phone) selalu bisa di-resolve dari Master Creator.
--
-- Prinsip keamanan data:
--   * TIDAK menghapus apa pun.
--   * TIDAK menimpa nilai yang sudah ada (hanya mengisi creator_id yang masih NULL).
--   * Semua statement idempotent (aman dijalankan berulang).

-- ============================================================================
-- 1) Index pendukung resolusi (berbasis nama/username yang dinormalisasi)
-- ============================================================================
create index if not exists idx_listings_workspace_creator
  on public.listings(workspace_id, creator_id);

create index if not exists idx_listings_workspace_creator_name_lower
  on public.listings(workspace_id, lower(btrim(regexp_replace(coalesce(creator_name,''),'^@+','','g'))));

create index if not exists idx_creators_workspace_name_lower
  on public.creators(workspace_id, lower(btrim(regexp_replace(coalesce(name,''),'^@+','','g'))));

create index if not exists idx_creators_workspace_username_lower
  on public.creators(workspace_id, lower(btrim(regexp_replace(coalesce(username,''),'^@+','','g'))));

-- ============================================================================
-- 2) Backfill creator_id pada listings yang masih NULL
--    Hanya mengisi baris dengan creator_id IS NULL (tidak menimpa data lama).
--    Pencocokan: nama ATAU username creator == creator_name listing (per workspace),
--    dengan preferensi platform cocok, lalu nama persis, lalu yang terbaru.
-- ============================================================================
with matched as (
  select distinct on (l2.id)
    l2.id as listing_id,
    c.id  as creator_id
  from public.listings l2
  join public.creators c
    on c.workspace_id = l2.workspace_id
   and c.merged_into_creator_id is null
   and lower(coalesce(c.status,'')) <> 'merged'
   and (
     lower(btrim(regexp_replace(coalesce(c.name,''),'^@+','','g')))
       = lower(btrim(regexp_replace(coalesce(l2.creator_name,''),'^@+','','g')))
     or
     lower(btrim(regexp_replace(coalesce(c.username,''),'^@+','','g')))
       = lower(btrim(regexp_replace(coalesce(l2.creator_name,''),'^@+','','g')))
   )
   and (
     coalesce(btrim(l2.platform),'') = ''
     or coalesce(btrim(c.platform),'') = ''
     or lower(c.platform) = lower(l2.platform)
   )
  where l2.workspace_id is not null
    and l2.creator_id is null
    and coalesce(btrim(l2.creator_name),'') <> ''
  order by
    l2.id,
    case when coalesce(btrim(l2.platform),'') <> ''
              and lower(coalesce(c.platform,'')) = lower(l2.platform) then 0 else 1 end,
    case when lower(btrim(regexp_replace(coalesce(c.name,''),'^@+','','g')))
              = lower(btrim(regexp_replace(coalesce(l2.creator_name,''),'^@+','','g'))) then 0 else 1 end,
    c.updated_at desc nulls last,
    c.id desc
)
update public.listings l
   set creator_id = m.creator_id
  from matched m
 where l.id = m.listing_id
   and l.creator_id is null;

-- ============================================================================
-- 3) Trigger: link otomatis untuk listing baru / yang diubah ke depan
--    Hanya bertindak bila creator_id masih NULL (tidak menimpa pilihan manual).
-- ============================================================================
create or replace function public.luma_listings_link_creator()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_id bigint;
begin
  if new.creator_id is null
     and new.workspace_id is not null
     and coalesce(btrim(new.creator_name),'') <> '' then

    select c.id into v_id
    from public.creators c
    where c.workspace_id = new.workspace_id
      and c.merged_into_creator_id is null
      and lower(coalesce(c.status,'')) <> 'merged'
      and (
        lower(btrim(regexp_replace(coalesce(c.name,''),'^@+','','g')))
          = lower(btrim(regexp_replace(new.creator_name,'^@+','','g')))
        or
        lower(btrim(regexp_replace(coalesce(c.username,''),'^@+','','g')))
          = lower(btrim(regexp_replace(new.creator_name,'^@+','','g')))
      )
      and (
        coalesce(btrim(new.platform),'') = ''
        or coalesce(btrim(c.platform),'') = ''
        or lower(c.platform) = lower(new.platform)
      )
    order by
      case when coalesce(btrim(new.platform),'') <> ''
                and lower(coalesce(c.platform,'')) = lower(new.platform) then 0 else 1 end,
      case when lower(btrim(regexp_replace(coalesce(c.name,''),'^@+','','g')))
                = lower(btrim(regexp_replace(new.creator_name,'^@+','','g'))) then 0 else 1 end,
      c.updated_at desc nulls last,
      c.id desc
    limit 1;

    if v_id is not null then
      new.creator_id := v_id;
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_luma_listings_link_creator on public.listings;
create trigger trg_luma_listings_link_creator
before insert or update of creator_id,creator_name,platform
on public.listings
for each row execute function public.luma_listings_link_creator();

-- ============================================================================
-- 4) Helper resolusi kontak creator untuk sebuah listing (read-only)
--    Dipakai oleh app/API agar kontak (phone/WA) konsisten walau creator_id NULL.
-- ============================================================================
create or replace function public.luma_resolve_listing_creator_v1(
  p_workspace_id uuid,
  p_creator_id bigint default null,
  p_creator_name text default null
)
returns table(
  id bigint,
  creator_code text,
  name text,
  username text,
  platform text,
  phone text,
  affiliate_id text,
  avatar_url text,
  resolved_by text
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if p_workspace_id is null then
    return;
  end if;

  if auth.uid() is not null
     and not public.luma_has_workspace(p_workspace_id)
     and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  -- Prioritas 1: langsung dari creator_id
  if p_creator_id is not null then
    return query
      select c.id,c.creator_code,c.name,c.username,c.platform,c.phone,c.affiliate_id,c.avatar_url,'creator_id'::text
      from public.creators c
      where c.id = p_creator_id
        and c.workspace_id = p_workspace_id
        and c.merged_into_creator_id is null
      limit 1;
    if found then
      return;
    end if;
  end if;

  -- Prioritas 2: cocokkan dari nama/username (case + @ tidak sensitif)
  if coalesce(btrim(p_creator_name),'') <> '' then
    return query
      select c.id,c.creator_code,c.name,c.username,c.platform,c.phone,c.affiliate_id,c.avatar_url,'name'::text
      from public.creators c
      where c.workspace_id = p_workspace_id
        and c.merged_into_creator_id is null
        and lower(coalesce(c.status,'')) <> 'merged'
        and (
          lower(btrim(regexp_replace(coalesce(c.name,''),'^@+','','g')))
            = lower(btrim(regexp_replace(p_creator_name,'^@+','','g')))
          or
          lower(btrim(regexp_replace(coalesce(c.username,''),'^@+','','g')))
            = lower(btrim(regexp_replace(p_creator_name,'^@+','','g')))
        )
      order by
        case when nullif(btrim(coalesce(c.avatar_url,'')),'') is not null then 0 else 1 end,
        c.updated_at desc nulls last,
        c.id desc
      limit 1;
  end if;
end
$$;

revoke all on function public.luma_resolve_listing_creator_v1(uuid,bigint,text) from public,anon;
grant execute on function public.luma_resolve_listing_creator_v1(uuid,bigint,text) to authenticated,service_role;

comment on function public.luma_resolve_listing_creator_v1(uuid,bigint,text) is
'PR87: Resolve Master Creator (kontak/phone) untuk sebuah listing, fallback dari creator_id lalu nama/username. Read-only, additive.';

-- ============================================================================
-- 5) Laporan audit keterhubungan Listing ↔ Creator (read-only)
-- ============================================================================
create or replace function public.luma_listing_creator_link_report_v1(
  p_workspace_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_total bigint:=0;
  v_linked bigint:=0;
  v_unlinked bigint:=0;
  v_linkable bigint:=0;
  v_unmatched jsonb:='[]'::jsonb;
begin
  if auth.uid() is not null
     and not public.luma_has_workspace(p_workspace_id)
     and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  select count(*) into v_total
  from public.listings where workspace_id=p_workspace_id;

  select count(*) into v_linked
  from public.listings where workspace_id=p_workspace_id and creator_id is not null;

  v_unlinked:=coalesce(v_total,0)-coalesce(v_linked,0);

  -- Berapa yang masih bisa di-link (ada creator cocok by nama/username)
  select count(*) into v_linkable
  from public.listings l
  where l.workspace_id=p_workspace_id
    and l.creator_id is null
    and coalesce(btrim(l.creator_name),'')<>''
    and exists (
      select 1 from public.creators c
      where c.workspace_id=l.workspace_id
        and c.merged_into_creator_id is null
        and lower(coalesce(c.status,''))<>'merged'
        and (
          lower(btrim(regexp_replace(coalesce(c.name,''),'^@+','','g')))
            = lower(btrim(regexp_replace(coalesce(l.creator_name,''),'^@+','','g')))
          or
          lower(btrim(regexp_replace(coalesce(c.username,''),'^@+','','g')))
            = lower(btrim(regexp_replace(coalesce(l.creator_name,''),'^@+','','g')))
        )
    );

  -- Daftar creator_name pada listing yang tak punya creator_id & tak ketemu (top 20)
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_unmatched
  from (
    select l.creator_name, count(*) as listings
    from public.listings l
    where l.workspace_id=p_workspace_id
      and l.creator_id is null
      and coalesce(btrim(l.creator_name),'')<>''
      and not exists (
        select 1 from public.creators c
        where c.workspace_id=l.workspace_id
          and c.merged_into_creator_id is null
          and lower(coalesce(c.status,''))<>'merged'
          and (
            lower(btrim(regexp_replace(coalesce(c.name,''),'^@+','','g')))
              = lower(btrim(regexp_replace(coalesce(l.creator_name,''),'^@+','','g')))
            or
            lower(btrim(regexp_replace(coalesce(c.username,''),'^@+','','g')))
              = lower(btrim(regexp_replace(coalesce(l.creator_name,''),'^@+','','g')))
          )
      )
    group by l.creator_name
    order by count(*) desc, l.creator_name
    limit 20
  ) x;

  return jsonb_build_object(
    'workspace_id',p_workspace_id,
    'total_listings',coalesce(v_total,0),
    'linked_listings',coalesce(v_linked,0),
    'unlinked_listings',coalesce(v_unlinked,0),
    'linkable_now',coalesce(v_linkable,0),
    'unlinked_unmatched',greatest(coalesce(v_unlinked,0)-coalesce(v_linkable,0),0),
    'unmatched_names',v_unmatched,
    'checked_at',now()
  );
end
$$;

revoke all on function public.luma_listing_creator_link_report_v1(uuid) from public,anon;
grant execute on function public.luma_listing_creator_link_report_v1(uuid) to authenticated,service_role;

comment on function public.luma_listing_creator_link_report_v1(uuid) is
'PR87: Audit keterhubungan listings<->creators (read-only): total, linked, unlinked, linkable, nama yang belum ketemu.';
