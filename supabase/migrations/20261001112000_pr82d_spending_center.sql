-- PR82D: Spending Center & reconciliation

create or replace function public.luma_spending_center_v1(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date,
  p_platform text default null,
  p_store_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  with affiliate as (
    select *
    from public.sales s
    where s.workspace_id=p_workspace_id
      and s.data_type in ('performance','sales')
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(coalesce(s.platform,''))=lower(p_platform))
      and (p_store_name is null or p_store_name='' or lower(coalesce(s.store_name,''))=lower(p_store_name))
  ),
  affiliate_sum as (
    select
      coalesce(sum(cost_product),0)::numeric hpp,
      coalesce(sum(commission),0)::numeric commission,
      coalesce(sum(shipping_cost),0)::numeric affiliate_shipping
    from affiliate
  ),
  operations as (
    select *
    from public.shipping sh
    where sh.workspace_id=p_workspace_id
      and lower(coalesce(sh.status,''))<>'cancelled'
      and (p_start_date is null or sh.data_date>=p_start_date)
      and (p_end_date is null or sh.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(coalesce(sh.platform,''))=lower(p_platform))
      and (p_store_name is null or p_store_name='' or lower(coalesce(sh.store_name,''))=lower(p_store_name))
  ),
  operations_sum as (
    select
      coalesce(sum(shipping_cost),0)::numeric operations_shipping,
      coalesce(sum(insurance_amount),0)::numeric operations_insurance,
      count(*)::bigint shipment_rows
    from operations
  ),
  ads as (
    select coalesce(max(a.amount),0)::numeric amount
    from public.affiliate_ads_support a
    where a.workspace_id=p_workspace_id
      and p_start_date is not null and p_end_date is not null
      and a.start_date=p_start_date and a.end_date=p_end_date
      and lower(a.platform)=lower(coalesce(nullif(p_platform,''),'ALL'))
      and lower(a.store_name)=lower(coalesce(nullif(p_store_name,''),'ALL'))
  ),
  daily as (
    select d::date data_date,
      coalesce((select sum(coalesce(s.cost_product,0)+coalesce(s.commission,0)+coalesce(s.shipping_cost,0))
        from affiliate s where s.data_date=d::date),0)::numeric affiliate_cost,
      coalesce((select sum(coalesce(sh.shipping_cost,0)+coalesce(sh.insurance_amount,0))
        from operations sh where sh.data_date=d::date),0)::numeric operations_shipping
    from generate_series(p_start_date,p_end_date,interval '1 day') d
  ),
  shipping_rows as (
    select id,data_date,reference_no,creator_name,platform,store_name,courier,service,status,
      shipping_cost,insurance_amount,
      (coalesce(shipping_cost,0)+coalesce(insurance_amount,0))::numeric spending
    from operations
    order by data_date desc nulls last,id desc
    limit 250
  )
  select jsonb_build_object(
    'period',jsonb_build_object('start',p_start_date,'end',p_end_date,'platform',p_platform,'store_name',p_store_name),
    'breakdown',jsonb_build_object(
      'hpp',a.hpp,
      'creator_commission',a.commission,
      'ads_spend',ads.amount,
      'affiliate_shipping',a.affiliate_shipping,
      'operations_shipping',o.operations_shipping,
      'operations_insurance',o.operations_insurance,
      'total_spending',a.hpp+a.commission+ads.amount+a.affiliate_shipping+o.operations_shipping+o.operations_insurance
    ),
    'shipment_rows',o.shipment_rows,
    'daily',coalesce((select jsonb_agg(to_jsonb(x) order by x.data_date) from daily x),'[]'::jsonb),
    'shipping_rows',coalesce((select jsonb_agg(to_jsonb(x)) from shipping_rows x),'[]'::jsonb)
  )
  into result
  from affiliate_sum a cross join operations_sum o cross join ads;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_spending_center_v1(uuid,date,date,text,text) from public,anon;
grant execute on function public.luma_spending_center_v1(uuid,date,date,text,text) to authenticated,service_role;
