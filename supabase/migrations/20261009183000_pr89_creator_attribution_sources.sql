-- PR89: immutable source-granularity rows. Never infer Shopee creator-to-SKU from aggregate reports.
create table if not exists public.luma_creator_attribution_imports(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 platform text not null check(platform in ('Shopee','TikTok')),
 source_type text not null check(source_type in ('shopee_creator','tiktok_video','tiktok_product','tiktok_live')),
 file_name text not null,
 file_hash text not null check(length(file_hash)=64),
 period_start date not null,
 period_end date not null,
 store_name text,
 store_id text,
 row_count integer not null default 0 check(row_count>=0),
 import_status text not null default 'completed' check(import_status in ('processing','completed','failed')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 constraint luma_creator_attribution_period_valid check(period_end>=period_start),
 constraint luma_creator_attribution_same_file_unique unique(workspace_id,platform,source_type,file_hash)
);
create index if not exists luma_creator_attribution_imports_workspace_idx
 on public.luma_creator_attribution_imports(workspace_id,platform,period_start desc,created_at desc);
alter table public.luma_creator_attribution_imports enable row level security;
drop policy if exists luma_creator_attribution_imports_read on public.luma_creator_attribution_imports;
create policy luma_creator_attribution_imports_read on public.luma_creator_attribution_imports
for select to authenticated using (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
revoke insert,update,delete on public.luma_creator_attribution_imports from authenticated,anon;
grant select on public.luma_creator_attribution_imports to authenticated;

create table if not exists public.luma_creator_attribution_rows(
 id bigint generated always as identity primary key,
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 import_id uuid not null references public.luma_creator_attribution_imports(id) on delete cascade,
 platform text not null check(platform in ('Shopee','TikTok')),
 source_type text not null check(source_type in ('shopee_creator','tiktok_video','tiktok_product','tiktok_live')),
 source_key text not null,
 creator_id bigint references public.creators(id) on delete set null,
 creator_name text,
 creator_username text,
 affiliate_id text,
 attribution_level text not null check(attribution_level in ('creator_summary','creator_video_product','product_summary','live_session_unassigned')),
 asset_id text,
 asset_url text,
 content_posted_at timestamptz,
 product_code text,
 product_codes text[] not null default '{}',
 product_name text,
 session_start_at timestamptz,
 session_end_at timestamptz,
 gmv numeric not null default 0,
 qty numeric not null default 0,
 orders numeric not null default 0,
 commission numeric not null default 0,
 refund_gmv numeric not null default 0,
 refund_qty numeric not null default 0,
 clicks numeric not null default 0,
 views numeric not null default 0,
 buyers numeric not null default 0,
 source_metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 constraint luma_creator_attribution_source_row_unique unique(import_id,source_key)
);
create index if not exists luma_creator_attribution_rows_workspace_source_idx
 on public.luma_creator_attribution_rows(workspace_id,source_type,creator_username,product_code);
create index if not exists luma_creator_attribution_rows_product_idx
 on public.luma_creator_attribution_rows(workspace_id,product_code) where product_code is not null;
alter table public.luma_creator_attribution_rows enable row level security;
drop policy if exists luma_creator_attribution_rows_read on public.luma_creator_attribution_rows;
create policy luma_creator_attribution_rows_read on public.luma_creator_attribution_rows
for select to authenticated using (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
revoke insert,update,delete on public.luma_creator_attribution_rows from authenticated,anon;
grant select on public.luma_creator_attribution_rows to authenticated;

create or replace function public.luma_creator_attribution_guard_v1()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_workspace uuid; v_platform text; v_source text;
begin
 select workspace_id,platform,source_type into v_workspace,v_platform,v_source
 from public.luma_creator_attribution_imports where id=new.import_id;
 if v_workspace is distinct from new.workspace_id
   or v_platform is distinct from new.platform
   or v_source is distinct from new.source_type then
  raise exception 'Attribution source and workspace mismatch' using errcode='23514';
 end if;
 if new.creator_id is not null and not exists(
   select 1 from public.creators c where c.id=new.creator_id and c.workspace_id=new.workspace_id
 ) then
  raise exception 'Attribution creator belongs to another workspace' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists luma_creator_attribution_workspace_guard on public.luma_creator_attribution_rows;
create trigger luma_creator_attribution_workspace_guard
before insert or update on public.luma_creator_attribution_rows
for each row execute function public.luma_creator_attribution_guard_v1();
