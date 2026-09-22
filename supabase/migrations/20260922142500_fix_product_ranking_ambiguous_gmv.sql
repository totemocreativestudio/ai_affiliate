-- Fix dashboard Product Ranking: PL/pgSQL output column "gmv" conflicted with
-- an unqualified CTE column reference in ORDER BY.

create or replace function public.get_product_ranking(
  p_workspace_id uuid,
  p_start_date date default null,
  p_end_date date default null,
  p_platform text default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns table(
  rank bigint,
  sku text,
  product_name text,
  platform text,
  qty numeric,
  orders numeric,
  gmv numeric,
  commission numeric,
  clicks numeric,
  buyers numeric,
  new_buyers numeric,
  refund numeric,
  refund_qty numeric,
  roi numeric,
  total_rows bigint
)
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if not (
    public.luma_is_admin()
    or exists(
      select 1
      from public.workspace_members wm
      where wm.workspace_id=p_workspace_id
        and wm.user_id=auth.uid()
    )
  ) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  return query
  with grouped as (
    select
      coalesce(nullif(s.sku,''),lower(coalesce(s.product_name,''))) as product_key,
      max(nullif(s.sku,'')) as sku,
      max(coalesce(nullif(s.product_name,''),pm.product_name,'')) as product_name,
      max(s.platform) as platform,
      coalesce(sum(s.qty),0) as qty,
      coalesce(sum(s.orders),0) as orders,
      coalesce(sum(s.gmv),0) as gmv,
      coalesce(sum(s.commission),0) as commission,
      coalesce(sum(s.clicks),0) as clicks,
      coalesce(sum(s.buyers),0) as buyers,
      coalesce(sum(s.new_buyers),0) as new_buyers,
      coalesce(sum(s.refund),0) as refund,
      coalesce(sum(s.refund_qty),0) as refund_qty,
      case
        when coalesce(sum(s.commission),0)>0 then round(sum(s.gmv)/sum(s.commission),2)
        else coalesce(max(s.roi),0)
      end as roi
    from public.sales s
    left join public.product_master pm
      on pm.workspace_id=s.workspace_id
      and pm.sku_normalized=lower(coalesce(s.sku,''))
    where s.workspace_id=p_workspace_id
      and s.data_type='product_performance'
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform))
    group by coalesce(nullif(s.sku,''),lower(coalesce(s.product_name,'')))
  ),
  filtered as (
    select g.*
    from grouped g
    where (p_search is null or p_search=''
      or coalesce(g.sku,'') ilike '%'||p_search||'%'
      or coalesce(g.product_name,'') ilike '%'||p_search||'%')
  ),
  numbered as (
    select
      row_number() over(
        order by f.gmv desc, f.orders desc, f.qty desc, f.product_key asc
      ) as row_rank,
      f.*
    from filtered f
  )
  select
    n.row_rank,
    n.sku,
    n.product_name,
    n.platform,
    n.qty,
    n.orders,
    n.gmv,
    n.commission,
    n.clicks,
    n.buyers,
    n.new_buyers,
    n.refund,
    n.refund_qty,
    n.roi,
    count(*) over() as total_rows
  from numbered n
  order by n.row_rank
  limit greatest(1,least(coalesce(p_page_size,50),100))
  offset greatest(0,coalesce(p_page,1)-1)*greatest(1,least(coalesce(p_page_size,50),100));
end
$function$;

revoke all on function public.get_product_ranking(uuid,date,date,text,text,integer,integer) from public;
revoke all on function public.get_product_ranking(uuid,date,date,text,text,integer,integer) from anon;
grant execute on function public.get_product_ranking(uuid,date,date,text,text,integer,integer) to authenticated;
