-- PR76D: Creator duplicate review queue / false-positive suppression

create table if not exists public.creator_identity_reviews (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  group_key text not null,
  decision text not null check (decision in ('pending','confirmed_duplicate','not_duplicate')),
  note text null,
  reviewed_by uuid null default auth.uid(),
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,group_key)
);

create index if not exists idx_creator_identity_reviews_workspace
  on public.creator_identity_reviews(workspace_id,decision,updated_at desc);

alter table public.creator_identity_reviews enable row level security;

drop policy if exists creator_identity_reviews_select on public.creator_identity_reviews;
create policy creator_identity_reviews_select
on public.creator_identity_reviews for select to authenticated
using (public.luma_has_workspace(workspace_id));

drop policy if exists creator_identity_reviews_insert on public.creator_identity_reviews;
create policy creator_identity_reviews_insert
on public.creator_identity_reviews for insert to authenticated
with check (public.luma_has_workspace(workspace_id));

drop policy if exists creator_identity_reviews_update on public.creator_identity_reviews;
create policy creator_identity_reviews_update
on public.creator_identity_reviews for update to authenticated
using (public.luma_has_workspace(workspace_id))
with check (public.luma_has_workspace(workspace_id));

drop policy if exists creator_identity_reviews_delete on public.creator_identity_reviews;
create policy creator_identity_reviews_delete
on public.creator_identity_reviews for delete to authenticated
using (public.luma_has_workspace(workspace_id));

create or replace function public.luma_creator_identity_candidates_v2(
  p_workspace_id uuid,
  p_search text default null,
  p_review_state text default 'pending',
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
  v_pending_groups bigint:=0;
  v_confirmed_groups bigint:=0;
  v_ignored_groups bigint:=0;
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
    select c.identity_key,count(*) cnt
    from public.creators c
    where c.workspace_id=p_workspace_id
      and c.merged_into_creator_id is null
      and lower(coalesce(c.status,''))<>'merged'
      and nullif(trim(coalesce(c.identity_key,'')),'') is not null
    group by c.identity_key
    having count(*)>1
  )
  select
    count(*),
    coalesce(sum(g.cnt-1),0),
    count(*) filter(where coalesce(r.decision,'pending')='pending'),
    count(*) filter(where r.decision='confirmed_duplicate'),
    count(*) filter(where r.decision='not_duplicate')
  into v_group_count,v_duplicate_records,v_pending_groups,v_confirmed_groups,v_ignored_groups
  from grouped g
  left join public.creator_identity_reviews r
    on r.workspace_id=p_workspace_id and r.group_key=g.identity_key;

  with grouped as (
    select
      c.identity_key as group_key,
      count(*)::integer as duplicate_count,
      max(c.updated_at) as latest_update
    from public.creators c
    left join public.creator_identity_reviews r
      on r.workspace_id=p_workspace_id and r.group_key=c.identity_key
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
      and (
        coalesce(nullif(trim(p_review_state),''),'pending')='all'
        or coalesce(r.decision,'pending')=coalesce(nullif(trim(p_review_state),''),'pending')
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
      coalesce(r.decision,'pending') as review_decision,
      r.note as review_note,
      r.reviewed_at,
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
            ) desc,c.updated_at desc nulls last,c.id asc
        )
        from public.creators c
        where c.workspace_id=p_workspace_id
          and c.identity_key=g.group_key
          and c.merged_into_creator_id is null
          and lower(coalesce(c.status,''))<>'merged'
      ) as creators
    from grouped g
    left join public.creator_identity_reviews r
      on r.workspace_id=p_workspace_id and r.group_key=g.group_key
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'group_key',group_key,
      'duplicate_count',duplicate_count,
      'match_reason','Exact identity key',
      'review_decision',review_decision,
      'review_note',review_note,
      'reviewed_at',reviewed_at,
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
    'pending_groups',v_pending_groups,
    'confirmed_groups',v_confirmed_groups,
    'ignored_groups',v_ignored_groups,
    'groups',coalesce(v_result,'[]'::jsonb)
  );
end
$$;

create or replace function public.luma_review_creator_identity_group_v1(
  p_workspace_id uuid,
  p_group_key text,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not public.luma_has_workspace(p_workspace_id) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;
  if p_decision not in ('pending','confirmed_duplicate','not_duplicate') then
    raise exception 'Invalid decision';
  end if;

  insert into public.creator_identity_reviews(
    workspace_id,group_key,decision,note,reviewed_by,reviewed_at,updated_at
  ) values (
    p_workspace_id,p_group_key,p_decision,nullif(trim(coalesce(p_note,'')),''),
    auth.uid(),case when p_decision='pending' then null else now() end,now()
  )
  on conflict(workspace_id,group_key)
  do update set
    decision=excluded.decision,
    note=excluded.note,
    reviewed_by=excluded.reviewed_by,
    reviewed_at=excluded.reviewed_at,
    updated_at=now();

  return jsonb_build_object('ok',true,'group_key',p_group_key,'decision',p_decision);
end
$$;

revoke all on function public.luma_creator_identity_candidates_v2(uuid,text,text,integer) from public,anon;
revoke all on function public.luma_review_creator_identity_group_v1(uuid,text,text,text) from public,anon;
grant execute on function public.luma_creator_identity_candidates_v2(uuid,text,text,integer) to authenticated;
grant execute on function public.luma_review_creator_identity_group_v1(uuid,text,text,text) to authenticated;
