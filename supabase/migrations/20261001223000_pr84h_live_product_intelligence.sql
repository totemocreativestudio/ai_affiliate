alter table public.live_product_performance add column if not exists source_sku text, add column if not exists mapped_sku text, add column if not exists mapped_product_name text, add column if not exists mapping_method text, add column if not exists mapping_confidence numeric, add column if not exists mapped_at timestamptz;

create index if not exists live_product_perf_mapping_idx
on public.live_product_performance(workspace_id,product_master_id,platform,period_start,period_end);

create or replace function public.luma_live_product_intelligence_v1(
  p_workspace_id uuid,p_start date,p_end date,p_platform text default null,p_search text default null
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then raise exception 'Workspace access denied'; end if;

  with base as (
    select lp.platform,lp.product_master_id,
      coalesce(pm.sku,lp.mapped_sku,lp.source_sku) sku,
      coalesce(pm.product_name,lp.mapped_product_name,lp.product_name_raw) product_name,
      pm.category,pm.cost_price,pm.image_url,lp.mapping_method,lp.mapping_confidence,
      coalesce(lp.product_clicks,0) product_clicks,coalesce(lp.add_to_cart,0) add_to_cart,
      coalesce(lp.product_orders_created,0) product_order_attribution_created,
      coalesce(lp.product_orders_ready_to_ship,0) product_order_attribution_ready,
      coalesce(lp.qty_created,0) qty_created,coalesce(lp.qty_ready_to_ship,0) qty_ready,
      coalesce(lp.gmv_created,0) gmv_created,coalesce(lp.gmv_ready_to_ship,0) gmv_ready,
      case when pm.cost_price is not null then coalesce(lp.qty_created,0)*pm.cost_price end hpp_cost,
      case when pm.cost_price is not null then coalesce(lp.gmv_created,0)-(coalesce(lp.qty_created,0)*pm.cost_price) end contribution_margin
    from public.live_product_performance lp
    left join public.product_master pm on pm.id=lp.product_master_id and pm.workspace_id=lp.workspace_id
    where lp.workspace_id=p_workspace_id
      and lp.period_start<=p_end and lp.period_end>=p_start
      and (coalesce(p_platform,'')='' or lower(lp.platform)=lower(p_platform))
      and (coalesce(trim(p_search),'')='' or coalesce(lp.product_name_raw,'') ilike '%'||trim(p_search)||'%' or coalesce(pm.product_name,'') ilike '%'||trim(p_search)||'%' or coalesce(pm.sku,'') ilike '%'||trim(p_search)||'%')
  ),
  grouped as (
    select platform,product_master_id,sku,product_name,max(category) category,max(cost_price) cost_price,max(image_url) image_url,
      max(mapping_method) mapping_method,max(mapping_confidence) mapping_confidence,count(*) source_rows,
      sum(product_clicks) product_clicks,sum(add_to_cart) add_to_cart,
      sum(product_order_attribution_created) product_order_attribution_created,sum(product_order_attribution_ready) product_order_attribution_ready,
      sum(qty_created) qty_created,sum(qty_ready) qty_ready,sum(gmv_created) gmv_created,sum(gmv_ready) gmv_ready,
      case when bool_and(hpp_cost is not null) then sum(hpp_cost) end hpp_cost,
      case when bool_and(contribution_margin is not null) then sum(contribution_margin) end contribution_margin
    from base group by platform,product_master_id,sku,product_name
  ),
  summary as (
    select count(*) product_count,count(*) filter(where product_master_id is not null) mapped_products,count(*) filter(where product_master_id is null) unmapped_products,
      coalesce(sum(gmv_created),0) gmv_created,coalesce(sum(gmv_ready),0) gmv_ready,coalesce(sum(qty_created),0) qty_created,
      coalesce(sum(product_clicks),0) product_clicks,coalesce(sum(add_to_cart),0) add_to_cart,sum(hpp_cost) hpp_cost,sum(contribution_margin) contribution_margin
    from grouped
  )
  select jsonb_build_object('summary',(select to_jsonb(s) from summary s),'products',coalesce((select jsonb_agg(to_jsonb(g) order by g.gmv_created desc) from grouped g),'[]'::jsonb)) into result;
  return coalesce(result,'{}'::jsonb);
end $$;

grant execute on function public.luma_live_product_intelligence_v1(uuid,date,date,text,text) to authenticated,service_role;
