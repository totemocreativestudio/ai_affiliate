-- PR90A: searchable Master Creator across 80k+ rows; service role ONLY.
-- Route must verify authenticated workspace membership using getServerContext().
create extension if not exists pg_trgm;
create index if not exists creators_ws_username_search_trgm
 on public.creators using gin (lower(coalesce(username,'')) gin_trgm_ops);
create index if not exists creators_ws_name_search_trgm
 on public.creators using gin (lower(coalesce(name,'')) gin_trgm_ops);
create index if not exists creators_ws_affiliate_search_trgm
 on public.creators using gin (lower(coalesce(affiliate_id,'')) gin_trgm_ops);
create index if not exists creators_ws_master_recent
 on public.creators(workspace_id,id desc) where merged_into_creator_id is null;

create or replace function public.luma_master_creators_service_search_v4(
 p_workspace_id uuid,p_search text default null,p_page integer default 1,p_page_size integer default 25)
returns table(
 id bigint,creator_code text,name text,username text,platform text,affiliate_id text,
 phone text,payment_type text,ratecard numeric,status text,profile_url text,
 avatar_url text,social_links jsonb,social_profile_updated_at timestamptz,total_count bigint)
language sql stable security invoker set search_path=public,pg_temp as $$
 with params as (select left(lower(trim(regexp_replace(coalesce(p_search,''),'^@+',''))),160) q),
 filtered as (
  select c.*,
  row_number() over (
    partition by c.workspace_id,
      coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))
    order by c.updated_at desc nulls last,c.id desc
  ) rn
  from public.creators c cross join params p
  where c.workspace_id=p_workspace_id
  and c.merged_into_creator_id is null
  and lower(coalesce(c.status,'')) <> 'merged'
  and (p.q='' or
    lower(coalesce(c.username,'')) like '%'||p.q||'%' or
    lower(coalesce(c.name,'')) like '%'||p.q||'%' or
    lower(coalesce(c.creator_code,'')) like '%'||p.q||'%' or
    lower(coalesce(c.affiliate_id,'')) like '%'||p.q||'%')
 )
 select f.id,f.creator_code,f.name,f.username,f.platform,f.affiliate_id,
        f.phone,f.payment_type,f.ratecard,f.status,f.profile_url,f.avatar_url,
        coalesce(f.social_links,'{}'::jsonb),f.social_profile_updated_at,
        count(*) over()
 from filtered f where f.rn=1
 order by case when lower(coalesce(f.username,''))=(select q from params) then 0
               when lower(coalesce(f.name,''))=(select q from params) then 1
               else 2 end,
          f.id desc
 limit least(greatest(coalesce(p_page_size,25),1),100)
 offset (greatest(coalesce(p_page,1),1)-1)*least(greatest(coalesce(p_page_size,25),1),100);
$$;
revoke all on function public.luma_master_creators_service_search_v4(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.luma_master_creators_service_search_v4(uuid,text,integer,integer) to service_role;

-- Agreement rights must derive from the user's role IN the workspace,
-- not their unrelated global profiles.role (often 'staff' for workspace owners).
drop policy if exists pr45_agreements_insert_auth on public.agreements;
drop policy if exists pr45_agreements_update_auth on public.agreements;
drop policy if exists pr45_agreements_delete_auth on public.agreements;
create policy pr90_agreements_insert_workspace on public.agreements
 for insert to authenticated with check (
  public.luma_has_workspace(workspace_id) and
  (public.luma_is_workspace_admin(workspace_id)
   or public.luma_workspace_role(workspace_id)='manager')
 );
create policy pr90_agreements_update_workspace on public.agreements
 for update to authenticated using (
  public.luma_has_workspace(workspace_id) and
  (public.luma_is_workspace_admin(workspace_id)
   or public.luma_workspace_role(workspace_id)='manager')
 ) with check (
  public.luma_has_workspace(workspace_id) and
  (public.luma_is_workspace_admin(workspace_id)
   or public.luma_workspace_role(workspace_id)='manager')
 );
create policy pr90_agreements_delete_workspace on public.agreements
 for delete to authenticated using (
  public.luma_has_workspace(workspace_id) and
  (public.luma_is_workspace_admin(workspace_id)
   or public.luma_workspace_role(workspace_id)='manager')
 );

-- In-app terms are an explicit acknowledgement; not legal e-Meterai.
alter table public.agreements
 add column if not exists terms_accepted boolean not null default false,
 add column if not exists terms_accepted_at timestamptz,
 add column if not exists terms_accepted_by uuid references auth.users(id) on delete set null,
 add column if not exists terms_version text;

create or replace function public.luma_agreement_terms_consent_v1()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' then
  if new.terms_accepted is distinct from true then
    raise exception 'Persetujuan Term of Policy Agreement wajib dicentang.'
      using errcode='23514';
  end if;
  if auth.uid() is null then
    raise exception 'Login diperlukan untuk menyetujui Term of Policy Agreement.'
      using errcode='42501';
  end if;
  new.terms_accepted_at:=now();
  new.terms_accepted_by:=auth.uid();
  new.terms_version:='2026-10-09';
 else
  if (new.terms_accepted,new.terms_accepted_at,new.terms_accepted_by,new.terms_version)
   is distinct from (old.terms_accepted,old.terms_accepted_at,old.terms_accepted_by,old.terms_version) then
   raise exception 'Audit persetujuan Agreement tidak boleh diubah.'
     using errcode='23514';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists luma_agreement_terms_consent on public.agreements;
create trigger luma_agreement_terms_consent before insert or update of
 terms_accepted,terms_accepted_at,terms_accepted_by,terms_version
 on public.agreements for each row execute function public.luma_agreement_terms_consent_v1();
