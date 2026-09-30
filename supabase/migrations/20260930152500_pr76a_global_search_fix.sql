-- PR76A production corrective migration for global search
create or replace function public.luma_global_search_v1(
  p_workspace_id uuid,
  p_query text,
  p_limit integer default 24
)
returns table(
  entity_type text,
  entity_id bigint,
  title text,
  subtitle text,
  meta text,
  section text,
  score integer
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_query text:=lower(trim(coalesce(p_query,'')));
  v_limit integer:=least(greatest(coalesce(p_limit,24),1),40);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not public.luma_has_workspace(p_workspace_id) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;
  if length(v_query)<2 then
    return;
  end if;

  return query
  select x.entity_type,x.entity_id,x.title,x.subtitle,x.meta,x.section,x.score
  from (
    select
      'creator'::text as entity_type,
      c.id::bigint as entity_id,
      coalesce(nullif(c.name,''),nullif(c.username,''),nullif(c.creator_code,''),'Creator')::text as title,
      concat_ws(' · ',nullif(c.username,''),nullif(c.affiliate_id,''))::text as subtitle,
      concat_ws(' · ',nullif(c.platform,''),nullif(c.status,''))::text as meta,
      'listings'::text as section,
      case
        when lower(coalesce(c.username,''))=v_query or lower(coalesce(c.creator_code,''))=v_query then 1
        when lower(coalesce(c.name,''))=v_query then 2
        else 8
      end::integer as score
    from public.creators c
    where c.workspace_id=p_workspace_id
      and (
        lower(coalesce(c.name,'')) like '%'||v_query||'%'
        or lower(coalesce(c.username,'')) like '%'||v_query||'%'
        or lower(coalesce(c.creator_code,'')) like '%'||v_query||'%'
        or lower(coalesce(c.affiliate_id,'')) like '%'||v_query||'%'
      )

    union all

    select
      'product'::text,
      p.id::bigint,
      coalesce(nullif(p.product_name,''),p.sku,'Product')::text,
      p.sku::text,
      concat_ws(' · ',nullif(p.category,''),nullif(p.status,''))::text,
      'product-master'::text,
      case when lower(coalesce(p.sku,''))=v_query then 1 when lower(coalesce(p.product_name,''))=v_query then 2 else 9 end::integer
    from public.product_master p
    where p.workspace_id=p_workspace_id
      and (
        lower(coalesce(p.sku,'')) like '%'||v_query||'%'
        or lower(coalesce(p.product_name,'')) like '%'||v_query||'%'
        or lower(coalesce(p.category,'')) like '%'||v_query||'%'
      )

    union all

    select
      'campaign'::text,
      c.id::bigint,
      c.name::text,
      concat_ws(' · ',nullif(c.brand_name,''),nullif(c.campaign_type,''))::text,
      concat_ws(' · ',nullif(c.platform,''),nullif(c.status,''))::text,
      'campaign-tracker'::text,
      case when lower(c.name)=v_query then 2 else 10 end::integer
    from public.campaign_trackers c
    where c.workspace_id=p_workspace_id
      and (
        lower(coalesce(c.name,'')) like '%'||v_query||'%'
        or lower(coalesce(c.brand_name,'')) like '%'||v_query||'%'
        or lower(coalesce(c.platform,'')) like '%'||v_query||'%'
      )

    union all

    select
      'shipping'::text,
      s.id::bigint,
      coalesce(nullif(s.reference_no,''),nullif(s.tracking,''),'Shipping #'||s.id::text)::text,
      concat_ws(' · ',nullif(s.receiver_name,''),nullif(s.creator_name,''))::text,
      concat_ws(' · ',nullif(s.courier,''),nullif(s.status,''))::text,
      'shipping'::text,
      case when lower(coalesce(s.tracking,''))=v_query or lower(coalesce(s.reference_no,''))=v_query then 1 else 11 end::integer
    from public.shipping s
    where s.workspace_id=p_workspace_id
      and (
        lower(coalesce(s.reference_no,'')) like '%'||v_query||'%'
        or lower(coalesce(s.tracking,'')) like '%'||v_query||'%'
        or lower(coalesce(s.receiver_name,'')) like '%'||v_query||'%'
        or lower(coalesce(s.creator_name,'')) like '%'||v_query||'%'
        or lower(coalesce(s.product_name,'')) like '%'||v_query||'%'
      )

    union all

    select
      'task'::text,
      t.id::bigint,
      t.title::text,
      coalesce(nullif(t.description,''),'Task')::text,
      concat_ws(' · ',nullif(t.priority,''),nullif(t.status,''),case when t.due_date is not null then 'Due '||t.due_date::text else null end)::text,
      'kanban'::text,
      case when lower(t.title)=v_query then 3 else 12 end::integer
    from public.creator_tasks t
    where t.workspace_id=p_workspace_id
      and (
        lower(coalesce(t.title,'')) like '%'||v_query||'%'
        or lower(coalesce(t.description,'')) like '%'||v_query||'%'
        or lower(coalesce(t.creator_name,'')) like '%'||v_query||'%'
      )

    union all

    select
      'listing'::text,
      l.id::bigint,
      coalesce(nullif(l.creator_name,''),'Listing #'||l.id::text)::text,
      concat_ws(' · ',nullif(l.product_name,''),nullif(l.sku,''))::text,
      concat_ws(' · ',nullif(l.platform,''),nullif(l.stage,''))::text,
      'listings'::text,
      13::integer
    from public.listings l
    where l.workspace_id=p_workspace_id
      and (
        lower(coalesce(l.creator_name,'')) like '%'||v_query||'%'
        or lower(coalesce(l.product_name,'')) like '%'||v_query||'%'
        or lower(coalesce(l.sku,'')) like '%'||v_query||'%'
        or lower(coalesce(l.next_action,'')) like '%'||v_query||'%'
      )
  ) x
  order by x.score asc,x.title asc
  limit v_limit;
end
$$;

revoke all on function public.luma_global_search_v1(uuid,text,integer) from public;
revoke all on function public.luma_global_search_v1(uuid,text,integer) from anon;
grant execute on function public.luma_global_search_v1(uuid,text,integer) to authenticated;
