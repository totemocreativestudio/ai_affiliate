-- PR84G Source-aware Live analytics

create or replace function public.luma_live_source_analytics_v1(
  p_workspace_id uuid,
  p_start date,
  p_end date
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

  with
  tk_daily as (
    select metric_date,
      coalesce(gmv_attributed,0) gmv_attributed,
      coalesce(gmv_direct,0) gmv_direct,
      coalesce(gmv_indirect,0) gmv_indirect,
      coalesce(sku_orders_attributed,0) sku_orders_attributed,
      coalesce(sku_orders_direct,0) sku_orders_direct,
      coalesce(sku_orders_indirect,0) sku_orders_indirect,
      coalesce(products_sold_attributed,0) products_sold_attributed,
      coalesce(products_sold_direct,0) products_sold_direct,
      coalesce(products_sold_indirect,0) products_sold_indirect,
      coalesce(live_stream_count,0) live_stream_count,
      coalesce(live_streams_with_gmv,0) live_streams_with_gmv,
      coalesce(live_impressions,0) live_impressions,
      live_ctr_pct,live_ctor_order_pct,avg_watch_duration_seconds
    from public.live_daily_performance
    where workspace_id=p_workspace_id and lower(platform)='tiktok'
      and metric_date between p_start and p_end
    order by metric_date
  ),
  tk_total as (
    select
      count(*) days,
      coalesce(sum(gmv_attributed),0) gmv_attributed,
      coalesce(sum(gmv_direct),0) gmv_direct,
      coalesce(sum(gmv_indirect),0) gmv_indirect,
      coalesce(sum(sku_orders_attributed),0) sku_orders_attributed,
      coalesce(sum(sku_orders_direct),0) sku_orders_direct,
      coalesce(sum(sku_orders_indirect),0) sku_orders_indirect,
      coalesce(sum(products_sold_attributed),0) products_sold_attributed,
      coalesce(sum(products_sold_direct),0) products_sold_direct,
      coalesce(sum(products_sold_indirect),0) products_sold_indirect,
      coalesce(sum(live_stream_count),0) live_stream_count,
      coalesce(sum(live_streams_with_gmv),0) live_streams_with_gmv,
      coalesce(sum(live_impressions),0) live_impressions,
      avg(live_ctr_pct) live_ctr_pct_avg,
      avg(live_ctor_order_pct) live_ctor_order_pct_avg,
      avg(avg_watch_duration_seconds) avg_watch_duration_seconds
    from tk_daily
  ),
  sh_session as (
    select
      count(distinct lsp.session_id) sessions,
      coalesce(sum(lsp.gmv_created),0) gmv_created,
      coalesce(sum(lsp.gmv_ready_to_ship),0) gmv_ready,
      coalesce(sum(lsp.orders_created),0) orders_created,
      coalesce(sum(lsp.orders_ready_to_ship),0) orders_ready,
      coalesce(sum(lsp.qty_created),0) qty_created,
      coalesce(sum(lsp.qty_ready_to_ship),0) qty_ready,
      coalesce(sum(lsp.comments),0) comments,
      coalesce(sum(lsp.add_to_cart),0) add_to_cart,
      coalesce(sum(lsp.viewers),0) viewers,
      coalesce(sum(lsp.duration_seconds),0) duration_seconds
    from public.live_session_performance lsp
    join public.live_sessions ls on ls.id=lsp.session_id
    where lsp.workspace_id=p_workspace_id
      and lower(ls.platform)='shopee'
      and lsp.metric_date between p_start and p_end
  ),
  sh_overview as (
    select
      coalesce(sum(livestream_count),0) livestream_count,
      coalesce(sum(gmv_created),0) gmv_created,
      coalesce(sum(gmv_ready_to_ship),0) gmv_ready,
      coalesce(sum(orders_created),0) orders_created,
      coalesce(sum(orders_ready_to_ship),0) orders_ready,
      coalesce(sum(qty_created),0) qty_created,
      coalesce(sum(qty_ready_to_ship),0) qty_ready,
      coalesce(sum(viewers),0) viewers,
      coalesce(sum(period_active_viewers),0) period_active_viewers,
      coalesce(sum(views),0) views,
      coalesce(sum(peak_viewers),0) peak_viewers,
      coalesce(sum(add_to_cart),0) add_to_cart,
      coalesce(sum(comments),0) comments,
      coalesce(sum(likes),0) likes,
      coalesce(sum(shares),0) shares,
      coalesce(sum(new_followers),0) new_followers,
      avg(click_pct) click_pct_avg
    from public.live_period_overview
    where workspace_id=p_workspace_id and lower(platform)='shopee'
      and period_start<=p_end and period_end>=p_start
  ),
  sh_products as (
    select product_name_raw,
      coalesce(sum(gmv_created),0) gmv_created,
      coalesce(sum(gmv_ready_to_ship),0) gmv_ready,
      coalesce(sum(qty_created),0) qty_created,
      coalesce(sum(qty_ready_to_ship),0) qty_ready,
      coalesce(sum(product_clicks),0) product_clicks,
      coalesce(sum(add_to_cart),0) add_to_cart
    from public.live_product_performance
    where workspace_id=p_workspace_id and lower(platform)='shopee'
      and period_start<=p_end and period_end>=p_start
    group by product_name_raw
    order by gmv_created desc
    limit 20
  ),
  sh_traffic as (
    select traffic_source_code,traffic_source_label,
      coalesce(sum(live_views),0) live_views,
      coalesce(sum(live_viewers),0) live_viewers,
      coalesce(sum(active_viewers),0) active_viewers,
      avg(live_view_ratio_pct) live_view_ratio_pct,
      avg(live_viewer_ratio_pct) live_viewer_ratio_pct,
      avg(active_viewer_ratio_pct) active_viewer_ratio_pct
    from public.live_traffic_sources
    where workspace_id=p_workspace_id and lower(platform)='shopee'
      and period_start<=p_end and period_end>=p_start
    group by traffic_source_code,traffic_source_label
    order by live_viewers desc
    limit 20
  )
  select jsonb_build_object(
    'range',jsonb_build_object('start',p_start,'end',p_end),
    'tiktok',jsonb_build_object(
      'totals',(select to_jsonb(t) from tk_total t),
      'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.metric_date) from tk_daily d),'[]'::jsonb)
    ),
    'shopee',jsonb_build_object(
      'session_totals',(select to_jsonb(s) from sh_session s),
      'overview_totals',(select to_jsonb(o) from sh_overview o),
      'products',coalesce((select jsonb_agg(to_jsonb(p)) from sh_products p),'[]'::jsonb),
      'traffic',coalesce((select jsonb_agg(to_jsonb(t)) from sh_traffic t),'[]'::jsonb)
    )
  ) into result;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_live_source_analytics_v1(uuid,date,date) from public,anon;
grant execute on function public.luma_live_source_analytics_v1(uuid,date,date) to authenticated,service_role;
