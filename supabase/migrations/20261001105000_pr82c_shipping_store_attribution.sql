-- PR82C: Shipping store attribution

alter table public.shipping
  add column if not exists store_name text;

create index if not exists shipping_workspace_store_date_idx
  on public.shipping(workspace_id,store_name,data_date);

create or replace function public.get_dashboard_metrics_v5(
  p_workspace_id uuid,
  p_start_date date default null,
  p_end_date date default null,
  p_platform text default null,
  p_store_name text default null
)
returns table(
  total_creators bigint,
  total_sales_records bigint,
  total_qty numeric,
  total_orders numeric,
  total_gmv numeric,
  total_commission numeric,
  total_products bigint,
  total_cost_product numeric,
  total_shipping numeric,
  total_ads_spend numeric,
  total_spend numeric,
  roi numeric,
  aov numeric,
  avg_daily_creator_sales numeric,
  referral_commission numeric,
  total_live_streams numeric,
  total_videos numeric
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not (
    public.luma_is_admin()
    or exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid())
  ) then raise exception 'Workspace access denied' using errcode='42501'; end if;

  return query
  with affiliate_base as (
    select s.* from public.sales s
    where s.workspace_id=p_workspace_id and s.data_type in ('performance','sales')
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform))
      and (p_store_name is null or p_store_name='' or lower(coalesce(s.store_name,''))=lower(p_store_name))
  ),
  product_count as (
    select count(distinct nullif(coalesce(s.sku,s.product_name),''))::bigint products
    from public.sales s
    where s.workspace_id=p_workspace_id and s.data_type in ('product_performance','sales')
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform))
      and (p_store_name is null or p_store_name='' or lower(coalesce(s.store_name,''))=lower(p_store_name))
  ),
  agg as (
    select
      count(distinct creator_id) filter(where coalesce(gmv,0)<>0 or coalesce(orders,0)<>0 or coalesce(qty,0)<>0 or coalesce(commission,0)<>0)::bigint active_creators,
      count(*)::bigint rows,
      coalesce(sum(qty),0) qty,
      coalesce(sum(orders),0) orders,
      coalesce(sum(gmv),0) gmv,
      coalesce(sum(commission),0) commission,
      coalesce(sum(cost_product),0) cost_product,
      coalesce(sum(shipping_cost),0) affiliate_shipping,
      coalesce(sum(live_count),0) live_streams,
      coalesce(sum(video_count),0) videos,
      count(distinct data_date) filter(where data_date is not null) days
    from affiliate_base
  ),
  operations_shipping as (
    select coalesce(sum(coalesce(sh.shipping_cost,0)+coalesce(sh.insurance_amount,0)),0)::numeric amount
    from public.shipping sh
    where sh.workspace_id=p_workspace_id
      and lower(coalesce(sh.status,''))<>'cancelled'
      and (p_start_date is null or sh.data_date>=p_start_date)
      and (p_end_date is null or sh.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(coalesce(sh.platform,''))=lower(p_platform))
      and (p_store_name is null or p_store_name='' or lower(coalesce(sh.store_name,''))=lower(p_store_name))
  ),
  ads_support as (
    select coalesce(max(a.amount),0)::numeric amount
    from public.affiliate_ads_support a
    where a.workspace_id=p_workspace_id
      and p_start_date is not null and p_end_date is not null
      and a.start_date=p_start_date and a.end_date=p_end_date
      and lower(a.platform)=lower(coalesce(nullif(p_platform,''),'ALL'))
      and lower(a.store_name)=lower(coalesce(nullif(p_store_name,''),'ALL'))
  ),
  ref as (
    select coalesce(sum(r.commission_amount),0) amount
    from public.referral_events r
    where r.workspace_id=p_workspace_id and lower(coalesce(r.status,'')) in ('confirmed','paid')
      and (p_start_date is null or r.created_at::date>=p_start_date)
      and (p_end_date is null or r.created_at::date<=p_end_date)
  )
  select
    a.active_creators,a.rows,a.qty,a.orders,a.gmv,a.commission,pc.products,a.cost_product,
    (a.affiliate_shipping+ops.amount)::numeric,
    ads.amount,
    (a.cost_product+a.affiliate_shipping+ops.amount+ads.amount+a.commission)::numeric,
    case when (a.cost_product+a.affiliate_shipping+ops.amount+ads.amount+a.commission)>0
      then round(a.gmv/(a.cost_product+a.affiliate_shipping+ops.amount+ads.amount+a.commission),2) else 0 end,
    case when a.orders>0 then round(a.gmv/a.orders,2) else 0 end,
    case when a.active_creators>0 and a.days>0 then round(a.gmv/a.active_creators/a.days,2) else 0 end,
    ref.amount,a.live_streams,a.videos
  from agg a
  cross join product_count pc
  cross join operations_shipping ops
  cross join ads_support ads
  cross join ref;
end
$$;

revoke all on function public.get_dashboard_metrics_v5(uuid,date,date,text,text) from public,anon;
grant execute on function public.get_dashboard_metrics_v5(uuid,date,date,text,text) to authenticated,service_role;
