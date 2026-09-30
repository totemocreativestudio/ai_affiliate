-- PR76F: Creator identity cleanup/confidence scoring + social profiles

alter table public.creators
  add column if not exists avatar_url text,
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists social_profile_updated_at timestamptz;

create index if not exists idx_creators_social_profile_updated
  on public.creators(workspace_id,social_profile_updated_at desc);

create or replace function public.luma_identity_is_junk(p_value text)
returns boolean
language sql
immutable
set search_path=public,pg_temp
as $$
  select lower(regexp_replace(trim(coalesce(p_value,'')),'\s+','','g')) in
    ('','-','--','---','n/a','na','null','none','unknown','tidakada','notavailable','nil');
$$;

create or replace function public.luma_get_master_creators_unique_v2(
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
  profile_url text,
  avatar_url text,
  social_links jsonb,
  social_profile_updated_at timestamptz,
  total_count bigint
)
language sql
security definer
set search_path=public,pg_temp
as $$
  with ranked as (
    select
      c.*,
      row_number() over(
        partition by c.workspace_id,coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))
        order by
          case when nullif(trim(coalesce(c.avatar_url,'')),'') is not null then 0 else 1 end,
          c.updated_at desc nulls last,
          c.id desc
      ) as rn
    from public.creators c
    where c.workspace_id=p_workspace_id
      and c.merged_into_creator_id is null
      and lower(coalesce(c.status,''))<>'merged'
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
        or coalesce(r.affiliate_id,'') ilike '%'||trim(p_search)||'%'
      )
  )
  select
    f.id,f.creator_code,f.name,f.username,f.platform,f.affiliate_id,f.phone,
    f.payment_type,f.ratecard,f.status,f.profile_url,f.avatar_url,
    coalesce(f.social_links,'{}'::jsonb),f.social_profile_updated_at,
    count(*) over() as total_count
  from filtered f
  order by lower(coalesce(nullif(trim(f.username),''),nullif(trim(f.name),''),f.creator_code)),lower(coalesce(f.platform,''))
  limit greatest(1,least(coalesce(p_page_size,100),200))
  offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,100),200));
$$;

revoke all on function public.luma_get_master_creators_unique_v2(uuid,text,integer,integer) from public,anon;
grant execute on function public.luma_get_master_creators_unique_v2(uuid,text,integer,integer) to authenticated;

create or replace function public.luma_creator_identity_candidates_v3(
  p_workspace_id uuid,
  p_search text default null,
  p_review_state text default 'pending',
  p_confidence text default 'all',
  p_include_junk boolean default false,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_result jsonb:='[]'::jsonb;
  v_active_count bigint:=0;
  v_group_count bigint:=0;
  v_duplicate_records bigint:=0;
  v_pending_groups bigint:=0;
  v_confirmed_groups bigint:=0;
  v_ignored_groups bigint:=0;
  v_junk_groups bigint:=0;
  v_high_groups bigint:=0;
  v_medium_groups bigint:=0;
  v_low_groups bigint:=0;
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

  with ref_union as (
    select creator_id,count(*)::bigint cnt from public.sales where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,count(*) from public.listings where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,count(*) from public.creator_samples where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,count(*) from public.shipping where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,count(*) from public.campaign_tracker_creators where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,count(*) from public.agreements where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,count(*) from public.creator_tasks where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,count(*) from public.ratecard_master where workspace_id=p_workspace_id and creator_id is not null group by creator_id
  ),
  refs as (
    select creator_id,sum(cnt)::bigint link_score
    from ref_union group by creator_id
  ),
  base as (
    select
      c.*,
      coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform)) as group_key,
      split_part(coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform)),'|',1) as identity_value,
      coalesce(r.link_score,0)::bigint as link_score,
      (
        (case when not public.luma_identity_is_junk(c.name) then 1 else 0 end)+
        (case when not public.luma_identity_is_junk(c.username) then 1 else 0 end)+
        (case when not public.luma_identity_is_junk(c.affiliate_id) then 1 else 0 end)+
        (case when nullif(trim(coalesce(c.phone,'')),'') is not null then 1 else 0 end)+
        (case when nullif(trim(coalesce(c.profile_url,'')),'') is not null or coalesce(c.social_links,'{}'::jsonb)<>'{}'::jsonb then 1 else 0 end)
      )::integer as completeness
    from public.creators c
    left join refs r on r.creator_id=c.id
    where c.workspace_id=p_workspace_id
      and c.merged_into_creator_id is null
      and lower(coalesce(c.status,''))<>'merged'
  ),
  grouped as (
    select
      b.group_key,
      count(*)::integer duplicate_count,
      bool_or(public.luma_identity_is_junk(b.identity_value)) as junk_identity,
      sum(b.link_score)::bigint linked_total,
      max(b.link_score)::bigint linked_max,
      sum(b.completeness)::bigint completeness_total,
      case
        when bool_or(public.luma_identity_is_junk(b.identity_value)) then 'Low'
        when count(*) filter(where not public.luma_identity_is_junk(b.affiliate_id))>=2
             and count(distinct lower(trim(b.affiliate_id))) filter(where not public.luma_identity_is_junk(b.affiliate_id))=1 then 'High'
        when count(*) filter(where not public.luma_identity_is_junk(b.username))=count(*)
             and count(distinct lower(trim(b.username))) filter(where not public.luma_identity_is_junk(b.username))=1 then 'High'
        when count(*) filter(where not public.luma_identity_is_junk(b.name))>=2
             and count(distinct lower(trim(b.name))) filter(where not public.luma_identity_is_junk(b.name))=1 then 'Medium'
        else 'Low'
      end::text as confidence,
      (
        sum(b.link_score)*10+
        max(b.link_score)*3+
        sum(b.completeness)+
        count(*)
      )::bigint as priority_score
    from base b
    group by b.group_key
    having count(*)>1
  ),
  stats as (
    select
      count(*)::bigint group_count,
      coalesce(sum(g.duplicate_count-1),0)::bigint duplicate_records,
      count(*) filter(where coalesce(r.decision,'pending')='pending')::bigint pending_groups,
      count(*) filter(where r.decision='confirmed_duplicate')::bigint confirmed_groups,
      count(*) filter(where r.decision='not_duplicate')::bigint ignored_groups,
      count(*) filter(where g.junk_identity)::bigint junk_groups,
      count(*) filter(where g.confidence='High')::bigint high_groups,
      count(*) filter(where g.confidence='Medium')::bigint medium_groups,
      count(*) filter(where g.confidence='Low')::bigint low_groups
    from grouped g
    left join public.creator_identity_reviews r
      on r.workspace_id=p_workspace_id and r.group_key=g.group_key
  )
  select group_count,duplicate_records,pending_groups,confirmed_groups,ignored_groups,junk_groups,high_groups,medium_groups,low_groups
  into v_group_count,v_duplicate_records,v_pending_groups,v_confirmed_groups,v_ignored_groups,v_junk_groups,v_high_groups,v_medium_groups,v_low_groups
  from stats;

  with ref_union as (
    select creator_id,'sales'::text kind,count(*)::bigint cnt from public.sales where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,'listings',count(*) from public.listings where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,'samples',count(*) from public.creator_samples where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,'shipping',count(*) from public.shipping where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,'campaigns',count(*) from public.campaign_tracker_creators where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,'agreements',count(*) from public.agreements where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,'tasks',count(*) from public.creator_tasks where workspace_id=p_workspace_id and creator_id is not null group by creator_id
    union all select creator_id,'ratecards',count(*) from public.ratecard_master where workspace_id=p_workspace_id and creator_id is not null group by creator_id
  ),
  refs as (
    select creator_id,
      jsonb_object_agg(kind,cnt) as refs,
      sum(cnt)::bigint as link_score
    from ref_union
    group by creator_id
  ),
  base as (
    select
      c.*,
      coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform)) as group_key,
      split_part(coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform)),'|',1) as identity_value,
      coalesce(r.link_score,0)::bigint as link_score,
      coalesce(r.refs,'{}'::jsonb) as refs,
      (
        (case when not public.luma_identity_is_junk(c.name) then 1 else 0 end)+
        (case when not public.luma_identity_is_junk(c.username) then 1 else 0 end)+
        (case when not public.luma_identity_is_junk(c.affiliate_id) then 1 else 0 end)+
        (case when nullif(trim(coalesce(c.phone,'')),'') is not null then 1 else 0 end)+
        (case when nullif(trim(coalesce(c.profile_url,'')),'') is not null or coalesce(c.social_links,'{}'::jsonb)<>'{}'::jsonb then 1 else 0 end)
      )::integer as completeness
    from public.creators c
    left join refs r on r.creator_id=c.id
    where c.workspace_id=p_workspace_id
      and c.merged_into_creator_id is null
      and lower(coalesce(c.status,''))<>'merged'
      and (
        nullif(trim(coalesce(p_search,'')),'') is null
        or c.name ilike '%'||p_search||'%'
        or c.username ilike '%'||p_search||'%'
        or c.affiliate_id ilike '%'||p_search||'%'
        or c.identity_key ilike '%'||p_search||'%'
      )
  ),
  grouped as (
    select
      b.group_key,
      count(*)::integer duplicate_count,
      bool_or(public.luma_identity_is_junk(b.identity_value)) as junk_identity,
      sum(b.link_score)::bigint linked_total,
      max(b.link_score)::bigint linked_max,
      sum(b.completeness)::bigint completeness_total,
      case
        when bool_or(public.luma_identity_is_junk(b.identity_value)) then 'Low'
        when count(*) filter(where not public.luma_identity_is_junk(b.affiliate_id))>=2
             and count(distinct lower(trim(b.affiliate_id))) filter(where not public.luma_identity_is_junk(b.affiliate_id))=1 then 'High'
        when count(*) filter(where not public.luma_identity_is_junk(b.username))=count(*)
             and count(distinct lower(trim(b.username))) filter(where not public.luma_identity_is_junk(b.username))=1 then 'High'
        when count(*) filter(where not public.luma_identity_is_junk(b.name))>=2
             and count(distinct lower(trim(b.name))) filter(where not public.luma_identity_is_junk(b.name))=1 then 'Medium'
        else 'Low'
      end::text as confidence,
      (sum(b.link_score)*10+max(b.link_score)*3+sum(b.completeness)+count(*))::bigint as priority_score
    from base b
    group by b.group_key
    having count(*)>1
  ),
  eligible as (
    select g.*,coalesce(r.decision,'pending') as review_decision,r.note as review_note,r.reviewed_at
    from grouped g
    left join public.creator_identity_reviews r
      on r.workspace_id=p_workspace_id and r.group_key=g.group_key
    where
      (coalesce(nullif(trim(p_review_state),''),'pending')='all' or coalesce(r.decision,'pending')=coalesce(nullif(trim(p_review_state),''),'pending'))
      and (coalesce(nullif(trim(p_confidence),''),'all')='all' or lower(g.confidence)=lower(trim(p_confidence)))
      and (coalesce(p_include_junk,false) or not g.junk_identity)
    order by g.priority_score desc,
      case g.confidence when 'High' then 1 when 'Medium' then 2 else 3 end,
      g.duplicate_count desc
    limit least(greatest(coalesce(p_limit,100),1),250)
  ),
  payload as (
    select
      e.*,
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',b.id,
            'creator_code',b.creator_code,
            'name',b.name,
            'username',b.username,
            'platform',b.platform,
            'affiliate_id',b.affiliate_id,
            'phone',b.phone,
            'profile_url',b.profile_url,
            'avatar_url',b.avatar_url,
            'social_links',coalesce(b.social_links,'{}'::jsonb),
            'ratecard',b.ratecard,
            'status',b.status,
            'updated_at',b.updated_at,
            'completeness',b.completeness,
            'refs',b.refs,
            'link_score',b.link_score,
            'junk_fields',jsonb_build_object(
              'name',public.luma_identity_is_junk(b.name),
              'username',public.luma_identity_is_junk(b.username),
              'affiliate_id',public.luma_identity_is_junk(b.affiliate_id)
            )
          )
          order by b.link_score desc,b.completeness desc,b.updated_at desc nulls last,b.id asc
        )
        from base b
        where b.group_key=e.group_key
      ) creators
    from eligible e
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'group_key',group_key,
      'duplicate_count',duplicate_count,
      'match_reason',case when junk_identity then 'Junk identity collision' when confidence='High' then 'Strong identity match' when confidence='Medium' then 'Name/platform match' else 'Weak identity match' end,
      'confidence',confidence,
      'priority_score',priority_score,
      'linked_total',linked_total,
      'junk_identity',junk_identity,
      'review_decision',review_decision,
      'review_note',review_note,
      'reviewed_at',reviewed_at,
      'creators',creators
    )
    order by priority_score desc
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
    'junk_groups',v_junk_groups,
    'high_groups',v_high_groups,
    'medium_groups',v_medium_groups,
    'low_groups',v_low_groups,
    'groups',coalesce(v_result,'[]'::jsonb)
  );
end
$$;

revoke all on function public.luma_creator_identity_candidates_v3(uuid,text,text,text,boolean,integer) from public,anon;
grant execute on function public.luma_creator_identity_candidates_v3(uuid,text,text,text,boolean,integer) to authenticated;
