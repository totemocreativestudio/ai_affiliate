-- PR76C follow-up: hide archived merged creators from master creator search/typeahead

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
    f.payment_type,f.ratecard,f.status,count(*) over() as total_count
  from filtered f
  order by lower(coalesce(nullif(trim(f.username),''),nullif(trim(f.name),''),f.creator_code)),lower(coalesce(f.platform,''))
  limit greatest(1,least(coalesce(p_page_size,100),200))
  offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,100),200));
$function$;

revoke all on function public.luma_get_master_creators_unique(uuid,text,integer,integer) from public,anon;
grant execute on function public.luma_get_master_creators_unique(uuid,text,integer,integer) to authenticated;
