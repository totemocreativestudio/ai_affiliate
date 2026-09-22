create or replace function public.get_dashboard_metrics_v2(
  p_workspace_id uuid,
  p_start_date date default null,
  p_end_date date default null,
  p_platform text default null
)
returns table(
  total_creators bigint,total_sales_records bigint,total_qty numeric,total_orders numeric,total_gmv numeric,
  total_commission numeric,total_products bigint,total_cost_product numeric,total_shipping numeric,total_ads_spend numeric,
  total_spend numeric,roi numeric,aov numeric,avg_daily_creator_sales numeric,referral_commission numeric
)
language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not (public.luma_is_admin() or exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()))
    then raise exception 'Workspace access denied' using errcode='42501'; end if;

  return query
  with affiliate_base as (
    select s.* from public.sales s
    where s.workspace_id=p_workspace_id
      and s.data_type in ('performance','sales')
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform))
  ),
  product_count as (
    select count(distinct nullif(coalesce(s.sku,s.product_name),''))::bigint products
    from public.sales s
    where s.workspace_id=p_workspace_id
      and s.data_type in ('product_performance','sales')
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform))
  ),
  agg as (
    select count(distinct creator_id)::bigint creators,count(*)::bigint rows,
      coalesce(sum(qty),0) qty,coalesce(sum(orders),0) orders,coalesce(sum(gmv),0) gmv,
      coalesce(sum(commission),0) commission,coalesce(sum(cost_product),0) cost_product,
      coalesce(sum(shipping_cost),0) shipping,coalesce(sum(ads_spend),0) ads,
      count(distinct data_date) filter(where data_date is not null) days
    from affiliate_base
  ),
  ref as (
    select coalesce(sum(r.commission_amount),0) amount
    from public.referral_events r
    where r.workspace_id=p_workspace_id and lower(coalesce(r.status,'')) in ('confirmed','paid')
      and (p_start_date is null or r.created_at::date>=p_start_date)
      and (p_end_date is null or r.created_at::date<=p_end_date)
  )
  select a.creators,a.rows,a.qty,a.orders,a.gmv,a.commission,pc.products,a.cost_product,a.shipping,a.ads,
    (a.cost_product+a.shipping+a.ads+a.commission)::numeric,
    case when (a.cost_product+a.shipping+a.ads+a.commission)>0 then round(a.gmv/(a.cost_product+a.shipping+a.ads+a.commission),2) else 0 end,
    case when a.orders>0 then round(a.gmv/a.orders,2) else 0 end,
    case when a.creators>0 and a.days>0 then round(a.gmv/(a.creators*a.days),2) else 0 end,
    ref.amount
  from agg a cross join product_count pc cross join ref;
end
$function$;

grant execute on function public.get_dashboard_metrics_v2(uuid,date,date,text) to authenticated;
