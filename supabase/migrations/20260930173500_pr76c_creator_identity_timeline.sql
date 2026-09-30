-- PR76C: Unified Creator Identity, safe merge and cross-module timeline

alter table public.creators
  add column if not exists merged_into_creator_id bigint null references public.creators(id) on delete set null,
  add column if not exists merged_at timestamptz null,
  add column if not exists merge_note text null;

create index if not exists idx_creators_workspace_canonical
  on public.creators(workspace_id, merged_into_creator_id, identity_key);

create table if not exists public.creator_identity_aliases (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  canonical_creator_id bigint not null references public.creators(id) on delete cascade,
  source_creator_id bigint null references public.creators(id) on delete set null,
  alias_key text not null,
  alias_type text not null default 'identity',
  alias_value text null,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  unique(workspace_id, alias_key)
);

create index if not exists idx_creator_identity_aliases_lookup
  on public.creator_identity_aliases(workspace_id, alias_key, canonical_creator_id);

alter table public.creator_identity_aliases enable row level security;

drop policy if exists creator_identity_aliases_select on public.creator_identity_aliases;
create policy creator_identity_aliases_select
on public.creator_identity_aliases
for select to authenticated
using (public.luma_has_workspace(workspace_id));

drop policy if exists creator_identity_aliases_insert on public.creator_identity_aliases;
create policy creator_identity_aliases_insert
on public.creator_identity_aliases
for insert to authenticated
with check (public.luma_has_workspace(workspace_id));

drop policy if exists creator_identity_aliases_update on public.creator_identity_aliases;
create policy creator_identity_aliases_update
on public.creator_identity_aliases
for update to authenticated
using (public.luma_has_workspace(workspace_id))
with check (public.luma_has_workspace(workspace_id));

drop policy if exists creator_identity_aliases_delete on public.creator_identity_aliases;
create policy creator_identity_aliases_delete
on public.creator_identity_aliases
for delete to authenticated
using (public.luma_has_workspace(workspace_id));

create table if not exists public.creator_merge_log (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  primary_creator_id bigint not null references public.creators(id) on delete restrict,
  secondary_creator_id bigint not null references public.creators(id) on delete restrict,
  primary_snapshot jsonb not null default '{}'::jsonb,
  secondary_snapshot jsonb not null default '{}'::jsonb,
  migrated_counts jsonb not null default '{}'::jsonb,
  merged_by uuid null default auth.uid(),
  merged_at timestamptz not null default now()
);

create index if not exists idx_creator_merge_log_workspace
  on public.creator_merge_log(workspace_id, merged_at desc);

alter table public.creator_merge_log enable row level security;

drop policy if exists creator_merge_log_select on public.creator_merge_log;
create policy creator_merge_log_select
on public.creator_merge_log
for select to authenticated
using (public.luma_has_workspace(workspace_id));

-- Inserts are performed through the security-definer merge RPC.
revoke insert, update, delete on public.creator_merge_log from authenticated;

create or replace function public.luma_creator_identity_candidates_v1(
  p_workspace_id uuid,
  p_search text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_result jsonb;
  v_active_count bigint:=0;
  v_group_count bigint:=0;
  v_duplicate_records bigint:=0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not public.luma_has_workspace(p_workspace_id) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  select count(*) into v_active_count
  from public.creators c
  where c.workspace_id=p_workspace_id
    and c.merged_into_creator_id is null
    and lower(coalesce(c.status,''))<>'merged';

  with grouped as (
    select c.identity_key, count(*) as cnt
    from public.creators c
    where c.workspace_id=p_workspace_id
      and c.merged_into_creator_id is null
      and lower(coalesce(c.status,''))<>'merged'
      and nullif(trim(coalesce(c.identity_key,'')),'') is not null
    group by c.identity_key
    having count(*)>1
  )
  select count(*),coalesce(sum(cnt-1),0)
  into v_group_count,v_duplicate_records
  from grouped;

  with grouped as (
    select
      c.identity_key as group_key,
      count(*)::integer as duplicate_count,
      max(c.updated_at) as latest_update
    from public.creators c
    where c.workspace_id=p_workspace_id
      and c.merged_into_creator_id is null
      and lower(coalesce(c.status,''))<>'merged'
      and nullif(trim(coalesce(c.identity_key,'')),'') is not null
      and (
        nullif(trim(coalesce(p_search,'')),'') is null
        or c.name ilike '%'||p_search||'%'
        or c.username ilike '%'||p_search||'%'
        or c.affiliate_id ilike '%'||p_search||'%'
        or c.identity_key ilike '%'||p_search||'%'
      )
    group by c.identity_key
    having count(*)>1
    order by count(*) desc,max(c.updated_at) desc nulls last
    limit least(greatest(coalesce(p_limit,100),1),250)
  ),
  payload as (
    select
      g.group_key,
      g.duplicate_count,
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',c.id,
            'creator_code',c.creator_code,
            'name',c.name,
            'username',c.username,
            'platform',c.platform,
            'affiliate_id',c.affiliate_id,
            'phone',c.phone,
            'ratecard',c.ratecard,
            'status',c.status,
            'updated_at',c.updated_at,
            'completeness',
              (case when nullif(trim(coalesce(c.name,'')),'') is not null then 1 else 0 end)+
              (case when nullif(trim(coalesce(c.username,'')),'') is not null then 1 else 0 end)+
              (case when nullif(trim(coalesce(c.affiliate_id,'')),'') is not null then 1 else 0 end)+
              (case when nullif(trim(coalesce(c.phone,'')),'') is not null then 1 else 0 end)+
              (case when nullif(trim(coalesce(c.profile_url,'')),'') is not null then 1 else 0 end),
            'refs',jsonb_build_object(
              'sales',(select count(*) from public.sales x where x.workspace_id=p_workspace_id and x.creator_id=c.id),
              'listings',(select count(*) from public.listings x where x.workspace_id=p_workspace_id and x.creator_id=c.id),
              'samples',(select count(*) from public.creator_samples x where x.workspace_id=p_workspace_id and x.creator_id=c.id),
              'shipping',(select count(*) from public.shipping x where x.workspace_id=p_workspace_id and x.creator_id=c.id),
              'campaigns',(select count(*) from public.campaign_tracker_creators x where x.workspace_id=p_workspace_id and x.creator_id=c.id),
              'agreements',(select count(*) from public.agreements x where x.workspace_id=p_workspace_id and x.creator_id=c.id),
              'tasks',(select count(*) from public.creator_tasks x where x.workspace_id=p_workspace_id and x.creator_id=c.id),
              'ratecards',(select count(*) from public.ratecard_master x where x.workspace_id=p_workspace_id and x.creator_id=c.id)
            ),
            'link_score',
              (select count(*) from public.sales x where x.workspace_id=p_workspace_id and x.creator_id=c.id)+
              (select count(*) from public.listings x where x.workspace_id=p_workspace_id and x.creator_id=c.id)+
              (select count(*) from public.creator_samples x where x.workspace_id=p_workspace_id and x.creator_id=c.id)+
              (select count(*) from public.shipping x where x.workspace_id=p_workspace_id and x.creator_id=c.id)+
              (select count(*) from public.campaign_tracker_creators x where x.workspace_id=p_workspace_id and x.creator_id=c.id)+
              (select count(*) from public.agreements x where x.workspace_id=p_workspace_id and x.creator_id=c.id)
          )
          order by
            (
              (select count(*) from public.sales x where x.workspace_id=p_workspace_id and x.creator_id=c.id)+
              (select count(*) from public.listings x where x.workspace_id=p_workspace_id and x.creator_id=c.id)+
              (select count(*) from public.creator_samples x where x.workspace_id=p_workspace_id and x.creator_id=c.id)+
              (select count(*) from public.shipping x where x.workspace_id=p_workspace_id and x.creator_id=c.id)+
              (select count(*) from public.campaign_tracker_creators x where x.workspace_id=p_workspace_id and x.creator_id=c.id)+
              (select count(*) from public.agreements x where x.workspace_id=p_workspace_id and x.creator_id=c.id)
            ) desc,
            c.updated_at desc nulls last,
            c.id asc
        )
        from public.creators c
        where c.workspace_id=p_workspace_id
          and c.identity_key=g.group_key
          and c.merged_into_creator_id is null
          and lower(coalesce(c.status,''))<>'merged'
      ) as creators
    from grouped g
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'group_key',group_key,
      'duplicate_count',duplicate_count,
      'match_reason','Exact identity key',
      'creators',creators
    )
    order by duplicate_count desc
  ),'[]'::jsonb)
  into v_result
  from payload;

  return jsonb_build_object(
    'active_creators',v_active_count,
    'duplicate_groups',v_group_count,
    'duplicate_records',v_duplicate_records,
    'groups',coalesce(v_result,'[]'::jsonb)
  );
end
$$;

create or replace function public.luma_creator_merge_preview_v1(
  p_workspace_id uuid,
  p_primary_creator_id bigint,
  p_secondary_creator_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_primary public.creators%rowtype;
  v_secondary public.creators%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not public.luma_has_workspace(p_workspace_id) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;
  if p_primary_creator_id=p_secondary_creator_id then
    raise exception 'Primary and secondary creator must be different';
  end if;

  select * into v_primary from public.creators
  where id=p_primary_creator_id and workspace_id=p_workspace_id;
  select * into v_secondary from public.creators
  where id=p_secondary_creator_id and workspace_id=p_workspace_id;

  if v_primary.id is null or v_secondary.id is null then
    raise exception 'Creator not found in workspace';
  end if;
  if v_primary.merged_into_creator_id is not null then
    raise exception 'Primary creator is already merged into another creator';
  end if;
  if v_secondary.merged_into_creator_id is not null then
    raise exception 'Secondary creator is already merged';
  end if;

  return jsonb_build_object(
    'primary',to_jsonb(v_primary),
    'secondary',to_jsonb(v_secondary),
    'counts',jsonb_build_object(
      'sales',(select count(*) from public.sales where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
      'listings',(select count(*) from public.listings where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
      'listing_activities',(select count(*) from public.listing_activities where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
      'samples',(select count(*) from public.creator_samples where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
      'shipping',(select count(*) from public.shipping where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
      'campaigns',(select count(*) from public.campaign_tracker_creators where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
      'agreements',(select count(*) from public.agreements where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
      'documents',(select count(*) from public.creator_documents where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
      'history',(select count(*) from public.creator_history where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
      'tasks',(select count(*) from public.creator_tasks where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
      'ratecards',(select count(*) from public.ratecard_master where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
      'targets',(select count(*) from public.creator_360_targets where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
      'store_affiliations',(select count(*) from public.creator_store_affiliations where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id)
    )
  );
end
$$;

create or replace function public.luma_merge_creator_v1(
  p_workspace_id uuid,
  p_primary_creator_id bigint,
  p_secondary_creator_id bigint,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_primary public.creators%rowtype;
  v_secondary public.creators%rowtype;
  v_counts jsonb;
  v_primary_profile_id bigint;
  v_secondary_profile_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not public.luma_has_workspace(p_workspace_id) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;
  if p_primary_creator_id=p_secondary_creator_id then
    raise exception 'Primary and secondary creator must be different';
  end if;

  select * into v_primary
  from public.creators
  where id=p_primary_creator_id and workspace_id=p_workspace_id
  for update;

  select * into v_secondary
  from public.creators
  where id=p_secondary_creator_id and workspace_id=p_workspace_id
  for update;

  if v_primary.id is null or v_secondary.id is null then
    raise exception 'Creator not found in workspace';
  end if;
  if v_primary.merged_into_creator_id is not null then
    raise exception 'Primary creator is already merged into another creator';
  end if;
  if v_secondary.merged_into_creator_id is not null then
    raise exception 'Secondary creator is already merged';
  end if;

  v_counts:=jsonb_build_object(
    'sales',(select count(*) from public.sales where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
    'listings',(select count(*) from public.listings where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
    'listing_activities',(select count(*) from public.listing_activities where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
    'samples',(select count(*) from public.creator_samples where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
    'shipping',(select count(*) from public.shipping where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
    'campaigns',(select count(*) from public.campaign_tracker_creators where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
    'agreements',(select count(*) from public.agreements where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
    'documents',(select count(*) from public.creator_documents where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
    'history',(select count(*) from public.creator_history where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
    'tasks',(select count(*) from public.creator_tasks where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id),
    'ratecards',(select count(*) from public.ratecard_master where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id)
  );

  -- Keep aliases so future imports map old identities back to the canonical creator.
  if nullif(trim(coalesce(v_secondary.identity_key,'')),'') is not null then
    insert into public.creator_identity_aliases(
      workspace_id,canonical_creator_id,source_creator_id,alias_key,alias_type,alias_value,created_by
    ) values (
      p_workspace_id,p_primary_creator_id,p_secondary_creator_id,
      'i:'||lower(trim(v_secondary.identity_key)),'identity',v_secondary.identity_key,auth.uid()
    )
    on conflict(workspace_id,alias_key) do update
      set canonical_creator_id=excluded.canonical_creator_id,
          source_creator_id=excluded.source_creator_id;
  end if;

  if nullif(trim(coalesce(v_secondary.affiliate_id,'')),'') is not null then
    insert into public.creator_identity_aliases(
      workspace_id,canonical_creator_id,source_creator_id,alias_key,alias_type,alias_value,created_by
    ) values (
      p_workspace_id,p_primary_creator_id,p_secondary_creator_id,
      'a:'||lower(trim(v_secondary.affiliate_id)),'affiliate_id',v_secondary.affiliate_id,auth.uid()
    )
    on conflict(workspace_id,alias_key) do update
      set canonical_creator_id=excluded.canonical_creator_id,
          source_creator_id=excluded.source_creator_id;
  end if;

  -- Preserve the secondary manual profile only when the primary has none.
  select id into v_primary_profile_id
  from public.creator_360_profiles
  where workspace_id=p_workspace_id and creator_id=p_primary_creator_id;

  select id into v_secondary_profile_id
  from public.creator_360_profiles
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  if v_secondary_profile_id is not null then
    if v_primary_profile_id is null then
      update public.creator_360_profiles
      set creator_id=p_primary_creator_id,updated_at=now()
      where id=v_secondary_profile_id;
    else
      update public.creator_360_profiles p
      set favorite=(p.favorite or s.favorite),
          top_creator=(p.top_creator or s.top_creator),
          rating=greatest(p.rating,s.rating),
          ads_support=greatest(p.ads_support,s.ads_support),
          target_sales=greatest(p.target_sales,s.target_sales),
          target_live=greatest(p.target_live,s.target_live),
          target_video=greatest(p.target_video,s.target_video),
          program_status=case
            when p.program_status='Not Joined' and s.program_status<>'Not Joined' then s.program_status
            else p.program_status
          end,
          updated_at=now()
      from public.creator_360_profiles s
      where p.id=v_primary_profile_id and s.id=v_secondary_profile_id;

      delete from public.creator_360_profiles where id=v_secondary_profile_id;
    end if;
  end if;

  -- Merge period targets without double rows.
  update public.creator_360_targets p
  set target_sales=greatest(p.target_sales,s.target_sales),
      target_live=greatest(p.target_live,s.target_live),
      target_video=greatest(p.target_video,s.target_video),
      notes=coalesce(p.notes,s.notes),
      updated_at=now()
  from public.creator_360_targets s
  where p.workspace_id=p_workspace_id
    and p.creator_id=p_primary_creator_id
    and s.workspace_id=p_workspace_id
    and s.creator_id=p_secondary_creator_id
    and p.target_year=s.target_year
    and p.target_month=s.target_month;

  delete from public.creator_360_targets s
  where s.workspace_id=p_workspace_id
    and s.creator_id=p_secondary_creator_id
    and exists(
      select 1 from public.creator_360_targets p
      where p.workspace_id=p_workspace_id
        and p.creator_id=p_primary_creator_id
        and p.target_year=s.target_year
        and p.target_month=s.target_month
    );

  update public.creator_360_targets
  set creator_id=p_primary_creator_id,updated_at=now()
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  -- Merge store affiliations and keep the widest observed period.
  update public.creator_store_affiliations p
  set first_seen_at=least(p.first_seen_at,s.first_seen_at),
      last_seen_at=greatest(p.last_seen_at,s.last_seen_at),
      store_id=coalesce(p.store_id,s.store_id),
      source_import_id=coalesce(p.source_import_id,s.source_import_id)
  from public.creator_store_affiliations s
  where p.workspace_id=p_workspace_id
    and p.creator_id=p_primary_creator_id
    and s.workspace_id=p_workspace_id
    and s.creator_id=p_secondary_creator_id
    and lower(p.platform)=lower(s.platform)
    and lower(p.store_name)=lower(s.store_name);

  delete from public.creator_store_affiliations s
  where s.workspace_id=p_workspace_id
    and s.creator_id=p_secondary_creator_id
    and exists(
      select 1 from public.creator_store_affiliations p
      where p.workspace_id=p_workspace_id
        and p.creator_id=p_primary_creator_id
        and lower(p.platform)=lower(s.platform)
        and lower(p.store_name)=lower(s.store_name)
    );

  update public.creator_store_affiliations
  set creator_id=p_primary_creator_id
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  -- De-duplicate direct user access before moving remaining rows.
  delete from public.creator_user_access s
  where s.workspace_id=p_workspace_id
    and s.creator_id=p_secondary_creator_id
    and exists(
      select 1 from public.creator_user_access p
      where p.workspace_id=p_workspace_id
        and p.creator_id=p_primary_creator_id
        and p.user_id=s.user_id
    );

  update public.creator_user_access
  set creator_id=p_primary_creator_id
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  -- Consolidate KPI targets where the unique business key overlaps.
  update public.kpi_targets p
  set target_gmv=greatest(coalesce(p.target_gmv,0),coalesce(s.target_gmv,0)),
      target_qty=greatest(coalesce(p.target_qty,0),coalesce(s.target_qty,0)),
      target_orders=greatest(coalesce(p.target_orders,0),coalesce(s.target_orders,0)),
      target_commission=greatest(coalesce(p.target_commission,0),coalesce(s.target_commission,0)),
      target_live_hours=greatest(coalesce(p.target_live_hours,0),coalesce(s.target_live_hours,0)),
      target_video_upload=greatest(coalesce(p.target_video_upload,0),coalesce(s.target_video_upload,0)),
      target_deals=greatest(coalesce(p.target_deals,0),coalesce(s.target_deals,0)),
      notes=coalesce(p.notes,s.notes),
      updated_at=now()
  from public.kpi_targets s
  where p.workspace_id=p_workspace_id
    and p.creator_id=p_primary_creator_id
    and s.workspace_id=p_workspace_id
    and s.creator_id=p_secondary_creator_id
    and p.scope is not distinct from s.scope
    and p.period=s.period
    and p.platform is not distinct from s.platform;

  delete from public.kpi_targets s
  where s.workspace_id=p_workspace_id
    and s.creator_id=p_secondary_creator_id
    and exists(
      select 1 from public.kpi_targets p
      where p.workspace_id=p_workspace_id
        and p.creator_id=p_primary_creator_id
        and p.scope is not distinct from s.scope
        and p.period=s.period
        and p.platform is not distinct from s.platform
    );

  update public.kpi_targets
  set creator_id=p_primary_creator_id,updated_at=now()
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  -- Move all non-conflicting references to the canonical creator.
  update public.sales set creator_id=p_primary_creator_id,updated_at=now()
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  update public.listings set creator_id=p_primary_creator_id,updated_at=now()
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  update public.listing_activities set creator_id=p_primary_creator_id
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  update public.creator_samples set creator_id=p_primary_creator_id,updated_at=now()
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  update public.shipping set creator_id=p_primary_creator_id,updated_at=now()
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  update public.campaign_tracker_creators set creator_id=p_primary_creator_id,updated_at=now()
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  update public.agreements set creator_id=p_primary_creator_id,updated_at=now()
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  update public.creator_documents set creator_id=p_primary_creator_id
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  update public.creator_history set creator_id=p_primary_creator_id
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  update public.creator_tasks set creator_id=p_primary_creator_id,updated_at=now()
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  update public.ratecard_master set creator_id=p_primary_creator_id,updated_at=now()
  where workspace_id=p_workspace_id and creator_id=p_secondary_creator_id;

  -- Archive the duplicate record instead of deleting it.
  update public.creators
  set merged_into_creator_id=p_primary_creator_id,
      merged_at=now(),
      merge_note=coalesce(nullif(trim(p_note),''),'Merged through Creator Identity Center'),
      status='Merged',
      identity_key='merged:'||id::text,
      updated_at=now()
  where id=p_secondary_creator_id and workspace_id=p_workspace_id;

  -- Fill missing canonical fields from the secondary without overwriting primary choices.
  update public.creators
  set name=coalesce(nullif(trim(name),''),v_secondary.name),
      username=coalesce(nullif(trim(username),''),v_secondary.username),
      affiliate_id=coalesce(nullif(trim(affiliate_id),''),v_secondary.affiliate_id),
      phone=coalesce(nullif(trim(phone),''),v_secondary.phone),
      address=coalesce(nullif(trim(address),''),v_secondary.address),
      payment_type=coalesce(nullif(trim(payment_type),''),v_secondary.payment_type),
      ratecard=case when coalesce(ratecard,0)=0 then v_secondary.ratecard else ratecard end,
      profile_url=coalesce(nullif(trim(profile_url),''),v_secondary.profile_url),
      notes=coalesce(nullif(trim(notes),''),v_secondary.notes),
      updated_at=now()
  where id=p_primary_creator_id and workspace_id=p_workspace_id;

  insert into public.creator_merge_log(
    workspace_id,primary_creator_id,secondary_creator_id,
    primary_snapshot,secondary_snapshot,migrated_counts,merged_by
  ) values (
    p_workspace_id,p_primary_creator_id,p_secondary_creator_id,
    to_jsonb(v_primary),to_jsonb(v_secondary),v_counts,auth.uid()
  );

  return jsonb_build_object(
    'ok',true,
    'primary_creator_id',p_primary_creator_id,
    'secondary_creator_id',p_secondary_creator_id,
    'migrated_counts',v_counts
  );
end
$$;

create or replace function public.luma_creator_timeline_v1(
  p_workspace_id uuid,
  p_creator_id bigint,
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_result jsonb;
  v_canonical_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not public.luma_has_workspace(p_workspace_id) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  select coalesce(c.merged_into_creator_id,c.id)
  into v_canonical_id
  from public.creators c
  where c.workspace_id=p_workspace_id and c.id=p_creator_id;

  if v_canonical_id is null then
    raise exception 'Creator not found';
  end if;

  with events as (
    select
      coalesce(a.created_at,a.activity_date::timestamptz) as event_at,
      'listing'::text as event_type,
      a.activity_type as title,
      coalesce(a.result,l.stage,'Listing') as subtitle,
      jsonb_build_object(
        'listing_id',a.listing_id,'product_name',l.product_name,'sku',l.sku,
        'stage',l.stage,'note',a.note,'next_action',l.next_action
      ) as meta
    from public.listing_activities a
    left join public.listings l on l.id=a.listing_id and l.workspace_id=p_workspace_id
    where a.workspace_id=p_workspace_id and a.creator_id=v_canonical_id

    union all

    select
      coalesce(cs.updated_at,cs.sent_date::timestamptz,cs.return_date::timestamptz,now()),
      'sample',
      'Creator Sample',
      coalesce(cs.sample_status,'Sample'),
      jsonb_build_object(
        'sample_id',cs.id,'product_name',cs.product_name,'sku',cs.sku,'qty',cs.qty,
        'product_value',cs.product_value,'tracking',cs.tracking,'notes',cs.notes
      )
    from public.creator_samples cs
    where cs.workspace_id=p_workspace_id and cs.creator_id=v_canonical_id

    union all

    select
      coalesce(sh.updated_at,sh.delivered_at::timestamptz,sh.shipped_at::timestamptz,sh.data_date::timestamptz,now()),
      'shipping',
      'Shipping',
      coalesce(sh.status,'Shipping'),
      jsonb_build_object(
        'shipping_id',sh.id,'reference_no',sh.reference_no,'courier',sh.courier,
        'tracking',sh.tracking,'product_name',sh.product_name,'sku',sh.sku,
        'shipping_cost',sh.shipping_cost,'shipped_at',sh.shipped_at,'delivered_at',sh.delivered_at
      )
    from public.shipping sh
    where sh.workspace_id=p_workspace_id and sh.creator_id=v_canonical_id

    union all

    select
      ctc.updated_at,
      'campaign',
      coalesce(ct.name,'Campaign'),
      coalesce(ctc.deliverable_status,ct.status,'Campaign'),
      jsonb_build_object(
        'campaign_id',ctc.campaign_id,'campaign_creator_id',ctc.id,
        'campaign_name',ct.name,'content_type',ctc.content_type,'due_date',ctc.due_date,
        'sample_status',ctc.sample_status,'orders',ctc.orders,'gmv',ctc.gmv,
        'commission',ctc.commission,'notes',ctc.notes
      )
    from public.campaign_tracker_creators ctc
    join public.campaign_trackers ct on ct.id=ctc.campaign_id and ct.workspace_id=p_workspace_id
    where ctc.workspace_id=p_workspace_id and ctc.creator_id=v_canonical_id

    union all

    select
      coalesce(ag.updated_at,ag.start_date::timestamptz,now()),
      'agreement',
      'Agreement',
      coalesce(ag.document_status,ag.support_status,ag.deal_type,'Agreement'),
      jsonb_build_object(
        'agreement_id',ag.agreement_id,'brand',ag.brand,'product_name',ag.product_name,
        'deal_type',ag.deal_type,'ratecard',ag.ratecard,'support_type',ag.support_type,
        'support_value',ag.support_value,'start_date',ag.start_date,'end_date',ag.end_date
      )
    from public.agreements ag
    where ag.workspace_id=p_workspace_id and ag.creator_id=v_canonical_id

    union all

    select
      coalesce(ch.created_at,now()),
      'history',
      coalesce(ch.title,'Creator History'),
      coalesce(ch.history_type,'History'),
      jsonb_build_object(
        'history_id',ch.id,'summary',ch.summary,'period_start',ch.period_start,
        'period_end',ch.period_end,'detail',ch.detail_json
      )
    from public.creator_history ch
    where ch.workspace_id=p_workspace_id and ch.creator_id=v_canonical_id

    union all

    select
      coalesce(ctask.updated_at,ctask.created_at,ctask.due_date::timestamptz,now()),
      'task',
      ctask.title,
      coalesce(ctask.status,'Task'),
      jsonb_build_object(
        'task_id',ctask.id,'priority',ctask.priority,'due_date',ctask.due_date,
        'description',ctask.description,'source',ctask.source
      )
    from public.creator_tasks ctask
    where ctask.workspace_id=p_workspace_id and ctask.creator_id=v_canonical_id

    union all

    select
      coalesce(max(s.updated_at),max(s.imported_at),max(s.data_date)::timestamptz,now()),
      'performance',
      'Affiliate Performance',
      coalesce(s.platform,'Performance'),
      jsonb_build_object(
        'date',s.data_date,'platform',s.platform,
        'gmv',sum(coalesce(s.gmv,0)),'orders',sum(coalesce(s.orders,0)),
        'qty',sum(coalesce(s.qty,0)),'commission',sum(coalesce(s.commission,0)),
        'live_count',sum(coalesce(s.live_count,0)),'video_count',sum(coalesce(s.video_count,0))
      )
    from public.sales s
    where s.workspace_id=p_workspace_id
      and s.creator_id=v_canonical_id
      and s.data_type in ('performance','sales')
    group by s.data_date,s.platform
  ),
  ranked as (
    select event_at,event_type,title,subtitle,meta
    from events
    order by event_at desc
    limit least(greatest(coalesce(p_limit,200),1),500)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'event_at',event_at,
      'event_type',event_type,
      'title',title,
      'subtitle',subtitle,
      'meta',meta
    )
    order by event_at desc
  ),'[]'::jsonb)
  into v_result
  from ranked;

  return jsonb_build_object(
    'creator_id',v_canonical_id,
    'events',coalesce(v_result,'[]'::jsonb)
  );
end
$$;

revoke all on function public.luma_creator_identity_candidates_v1(uuid,text,integer) from public,anon;
revoke all on function public.luma_creator_merge_preview_v1(uuid,bigint,bigint) from public,anon;
revoke all on function public.luma_merge_creator_v1(uuid,bigint,bigint,text) from public,anon;
revoke all on function public.luma_creator_timeline_v1(uuid,bigint,integer) from public,anon;

grant execute on function public.luma_creator_identity_candidates_v1(uuid,text,integer) to authenticated;
grant execute on function public.luma_creator_merge_preview_v1(uuid,bigint,bigint) to authenticated;
grant execute on function public.luma_merge_creator_v1(uuid,bigint,bigint,text) to authenticated;
grant execute on function public.luma_creator_timeline_v1(uuid,bigint,integer) to authenticated;

comment on table public.creator_identity_aliases is
'Persistent aliases that map merged creator identities back to one canonical creator for future imports.';

comment on table public.creator_merge_log is
'Audit log for safe non-destructive creator merges across Lumaway modules.';
