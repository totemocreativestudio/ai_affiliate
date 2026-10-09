-- Agreement legal identifier is an INTERNAL Digital Seal, NOT government e-Meterai.
-- Generate on server to prevent multi-user collisions / client manipulation.
create unique index if not exists agreements_global_digital_seal_unique
  on public.agreements(e_stamp_id) where e_stamp_id is not null;

create or replace function public.luma_agreement_set_seal_v2()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' then
   new.e_stamp_id:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,22));
 elsif new.e_stamp_id is distinct from old.e_stamp_id then
   raise exception 'Digital Seal ID is immutable' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists luma_agreement_digital_seal_trigger on public.agreements;
create trigger luma_agreement_digital_seal_trigger
before insert or update of e_stamp_id on public.agreements
for each row execute function public.luma_agreement_set_seal_v2();

create table if not exists public.luma_spark_ads_codes(
 id bigint generated always as identity primary key,
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 creator_id bigint not null references public.creators(id) on delete cascade,
 platform text not null default 'TikTok',
 code text not null check(length(btrim(code)) between 4 and 512),
 content_url text,
 description text,
 valid_from date,
 valid_until date,
 status text not null default 'active' check(status in ('active','used','expired','revoked')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint spark_ads_valid_period check(valid_from is null or valid_until is null or valid_until>=valid_from)
);
create unique index if not exists luma_spark_ads_codes_unique
on public.luma_spark_ads_codes(workspace_id,platform,code);
create index if not exists luma_spark_ads_codes_lookup
on public.luma_spark_ads_codes(workspace_id,creator_id,created_at desc);
alter table public.luma_spark_ads_codes enable row level security;
drop policy if exists spark_ads_select on public.luma_spark_ads_codes;
drop policy if exists spark_ads_insert on public.luma_spark_ads_codes;
drop policy if exists spark_ads_update on public.luma_spark_ads_codes;
drop policy if exists spark_ads_delete on public.luma_spark_ads_codes;
create policy spark_ads_select on public.luma_spark_ads_codes for select to authenticated
using (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy spark_ads_insert on public.luma_spark_ads_codes for insert to authenticated
with check ((public.luma_has_workspace(workspace_id) or public.luma_is_admin()) and created_by=auth.uid());
create policy spark_ads_update on public.luma_spark_ads_codes for update to authenticated
using (public.luma_has_workspace(workspace_id) or public.luma_is_admin())
with check (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy spark_ads_delete on public.luma_spark_ads_codes for delete to authenticated
using (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
grant select,insert,update,delete on public.luma_spark_ads_codes to authenticated;
grant usage,select on sequence public.luma_spark_ads_codes_id_seq to authenticated;

create or replace function public.luma_spark_ads_code_guard_v1()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.creators c where c.id=new.creator_id and c.workspace_id=new.workspace_id) then
    raise exception 'Creator must belong to the same workspace' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists luma_spark_ads_creator_workspace on public.luma_spark_ads_codes;
create trigger luma_spark_ads_creator_workspace before insert or update
on public.luma_spark_ads_codes for each row
execute function public.luma_spark_ads_code_guard_v1();
