-- PR40: workspace write stability, creator identity dedupe, marketplace category support.

-- Operational master-data screens are workspace tools. Every authenticated workspace
-- member may create/update/delete records inside their own workspace.
drop policy if exists luma_creator_samples_select on public.creator_samples;
drop policy if exists luma_creator_samples_write on public.creator_samples;
create policy luma_creator_samples_select on public.creator_samples
for select using (public.luma_has_workspace(workspace_id));
create policy luma_creator_samples_write on public.creator_samples
for all using (public.luma_has_workspace(workspace_id))
with check (public.luma_has_workspace(workspace_id));

drop policy if exists luma_listings_write on public.listings;
create policy luma_listings_write on public.listings
for all using (public.luma_has_workspace(workspace_id))
with check (public.luma_has_workspace(workspace_id));

drop policy if exists luma_shipping_write on public.shipping;
create policy luma_shipping_write on public.shipping
for all using (public.luma_has_workspace(workspace_id))
with check (public.luma_has_workspace(workspace_id));

drop policy if exists ratecard_master_insert on public.ratecard_master;
drop policy if exists ratecard_master_update on public.ratecard_master;
drop policy if exists ratecard_master_delete on public.ratecard_master;
create policy ratecard_master_insert on public.ratecard_master
for insert with check (public.luma_has_workspace(workspace_id));
create policy ratecard_master_update on public.ratecard_master
for update using (public.luma_has_workspace(workspace_id))
with check (public.luma_has_workspace(workspace_id));
create policy ratecard_master_delete on public.ratecard_master
for delete using (public.luma_has_workspace(workspace_id));

-- Stable creator identity. Historical duplicates stay referenced safely, while
-- searches/imports can use one canonical row per username/name + platform.
alter table public.creators add column if not exists identity_key text;

create or replace function public.luma_creator_identity_key(
  p_username text,
  p_name text,
  p_creator_code text,
  p_platform text
)
returns text
language sql
immutable
set search_path to 'public','pg_temp'
as $function$
  select lower(coalesce(nullif(trim(p_username),''),nullif(trim(p_name),''),nullif(trim(p_creator_code),''),'unknown'))
         || '|' ||
         lower(coalesce(nullif(trim(p_platform),''),'other'));
$function$;

update public.creators
set identity_key=public.luma_creator_identity_key(username,name,creator_code,platform)
where identity_key is distinct from public.luma_creator_identity_key(username,name,creator_code,platform);

create or replace function public.luma_sync_creator_identity_key()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  new.identity_key := public.luma_creator_identity_key(new.username,new.name,new.creator_code,new.platform);
  return new;
end
$function$;

drop trigger if exists trg_luma_sync_creator_identity_key on public.creators;
create trigger trg_luma_sync_creator_identity_key
before insert or update of username,name,creator_code,platform
on public.creators
for each row execute function public.luma_sync_creator_identity_key();

create index if not exists idx_creators_workspace_identity
on public.creators(workspace_id,identity_key);

create or replace function public.luma_get_master_creators_unique(
  p_workspace_id uuid,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 100
)
returns table(
  id bigint,
  creator_code text,
  name text,
  username text,
  platform text,
  affiliate_id text,
  phone text,
  payment_type text,
  ratecard numeric,
  status text,
  total_count bigint
)
language sql
security definer
set search_path to 'public','pg_temp'
as $function$
  with ranked as (
    select
      c.*,
      row_number() over(
        partition by c.workspace_id,coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))
        order by c.updated_at desc nulls last,c.id desc
      ) as rn
    from public.creators c
    where c.workspace_id=p_workspace_id
  ),
  filtered as (
    select *
    from ranked r
    where r.rn=1
      and (
        nullif(trim(coalesce(p_search,'')),'') is null
        or coalesce(r.name,'') ilike '%'||trim(p_search)||'%'
        or coalesce(r.username,'') ilike '%'||trim(p_search)||'%'
        or coalesce(r.platform,'') ilike '%'||trim(p_search)||'%'
      )
  )
  select
    f.id,f.creator_code,f.name,f.username,f.platform,f.affiliate_id,f.phone,
    f.payment_type,f.ratecard,f.status,count(*) over() as total_count
  from filtered f
  order by lower(coalesce(nullif(trim(f.username),''),nullif(trim(f.name),''),f.creator_code)),lower(coalesce(f.platform,''))
  limit greatest(1,least(coalesce(p_page_size,100),200))
  offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,100),200));
$function$;

revoke all on function public.luma_get_master_creators_unique(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.luma_get_master_creators_unique(uuid,text,integer,integer) to service_role;

-- Keep marketplace category per platform item. Product Master may use the latest
-- non-empty marketplace category while retaining platform-specific values.
alter table public.product_platform_items add column if not exists category text;
