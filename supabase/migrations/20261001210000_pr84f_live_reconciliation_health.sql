-- PR84F: Shopee + TikTok Live reconciliation and data health

create or replace function public.luma_live_reconciliation_v1(
  p_workspace_id uuid,
  p_start date,
  p_end date
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  with
  sh_session as (
    select
      count(distinct lsp.session_id)::numeric session_count,
      coalesce(sum(lsp.gmv_created),0)::numeric gmv_created,
      coalesce(sum(lsp.gmv_ready_to_ship),0)::numeric gmv_ready,
      coalesce(sum(lsp.orders_created),0)::numeric orders_created,
      coalesce(sum(lsp.orders_ready_to_ship),0)::numeric orders_ready,
      coalesce(sum(lsp.qty_created),0)::numeric qty_created,
      coalesce(sum(lsp.qty_ready_to_ship),0)::numeric qty_ready,
      coalesce(sum(lsp.comments),0)::numeric comments,
      coalesce(sum(lsp.add_to_cart),0)::numeric add_to_cart,
      coalesce(sum(lsp.viewers),0)::numeric viewers,
      coalesce(sum(lsp.active_viewers),0)::numeric active_viewers_sum
    from public.live_session_performance lsp
    join public.live_sessions ls on ls.id=lsp.session_id
    where lsp.workspace_id=p_workspace_id
      and lower(ls.platform)='shopee'
      and lsp.metric_date between p_start and p_end
  ),
  sh_overview as (
    select
      count(*)::numeric source_count,
      coalesce(sum(livestream_count),0)::numeric session_count,
      coalesce(sum(gmv_created),0)::numeric gmv_created,
      coalesce(sum(gmv_ready_to_ship),0)::numeric gmv_ready,
      coalesce(sum(orders_created),0)::numeric orders_created,
      coalesce(sum(orders_ready_to_ship),0)::numeric orders_ready,
      coalesce(sum(qty_created),0)::numeric qty_created,
      coalesce(sum(qty_ready_to_ship),0)::numeric qty_ready,
      coalesce(sum(comments),0)::numeric comments,
      coalesce(sum(add_to_cart),0)::numeric add_to_cart,
      coalesce(sum(viewers),0)::numeric viewers,
      coalesce(sum(period_active_viewers),0)::numeric period_active_viewers
    from public.live_period_overview
    where workspace_id=p_workspace_id
      and lower(platform)='shopee'
      and period_start<=p_end
      and period_end>=p_start
  ),
  sh_product as (
    select
      count(*)::numeric source_count,
      coalesce(sum(gmv_created),0)::numeric gmv_created,
      coalesce(sum(gmv_ready_to_ship),0)::numeric gmv_ready,
      coalesce(sum(qty_created),0)::numeric qty_created,
      coalesce(sum(qty_ready_to_ship),0)::numeric qty_ready,
      coalesce(sum(add_to_cart),0)::numeric add_to_cart,
      coalesce(sum(product_orders_created),0)::numeric product_order_rows_sum,
      coalesce(sum(product_clicks),0)::numeric product_clicks_sum
    from public.live_product_performance
    where workspace_id=p_workspace_id
      and lower(platform)='shopee'
      and period_start<=p_end
      and period_end>=p_start
  ),
  tk as (
    select
      count(*)::numeric row_count,
      count(distinct metric_date)::numeric unique_dates,
      min(metric_date) min_date,
      max(metric_date) max_date,
      coalesce(sum(gmv_attributed),0)::numeric gmv_attr,
      coalesce(sum(gmv_direct),0)::numeric gmv_direct,
      coalesce(sum(gmv_indirect),0)::numeric gmv_indirect,
      coalesce(sum(products_sold_attributed),0)::numeric products_attr,
      coalesce(sum(products_sold_direct),0)::numeric products_direct,
      coalesce(sum(products_sold_indirect),0)::numeric products_indirect,
      coalesce(sum(sku_orders_attributed),0)::numeric orders_attr,
      coalesce(sum(sku_orders_direct),0)::numeric orders_direct,
      coalesce(sum(sku_orders_indirect),0)::numeric orders_indirect,
      count(*) filter(where abs(coalesce(gmv_attributed,0)-coalesce(gmv_direct,0)-coalesce(gmv_indirect,0))>1)::numeric bad_gmv_rows,
      count(*) filter(where abs(coalesce(products_sold_attributed,0)-coalesce(products_sold_direct,0)-coalesce(products_sold_indirect,0))>0)::numeric bad_product_rows,
      count(*) filter(where abs(coalesce(sku_orders_attributed,0)-coalesce(sku_orders_direct,0)-coalesce(sku_orders_indirect,0))>0)::numeric bad_order_rows
    from public.live_daily_performance
    where workspace_id=p_workspace_id
      and lower(platform)='tiktok'
      and metric_date between p_start and p_end
  ),
  imports as (
    select
      count(*) filter(where status='failed')::numeric failed_imports,
      count(*) filter(where status='completed' and coalesce(persisted_rows,0)<coalesce(row_count,0))::numeric partial_imports,
      count(*) filter(where jsonb_array_length(coalesce(warnings,'[]'::jsonb))>0)::numeric imports_with_warnings,
      coalesce(jsonb_agg(jsonb_build_object(
        'import_id',import_id,'filename',filename,'platform',platform,'dataset_type',dataset_type,
        'status',status,'row_count',row_count,'persisted_rows',persisted_rows,'warnings',warnings,'created_at',created_at
      ) order by created_at desc) filter(where jsonb_array_length(coalesce(warnings,'[]'::jsonb))>0 or status='failed'),'[]'::jsonb) recent_issues
    from public.live_imports
    where workspace_id=p_workspace_id
      and coalesce(period_start,created_at::date)<=p_end
      and coalesce(period_end,created_at::date)>=p_start
  ),
  sh_checks as (
    select jsonb_agg(check_row order by ord) checks
    from (
      select * from (
        values
        (1,'session_count','Jumlah Livestream',so.session_count,ss.session_count,
          case when so.source_count=0 or ss.session_count=0 then 'SOURCE_MISSING'
               when abs(so.session_count-ss.session_count)=0 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Live Session List'),
        (2,'gmv_created','GMV Pesanan Dibuat',so.gmv_created,ss.gmv_created,
          case when so.source_count=0 or ss.session_count=0 then 'SOURCE_MISSING'
               when abs(so.gmv_created-ss.gmv_created)<=1 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Live Session List'),
        (3,'gmv_ready','GMV Siap Dikirim',so.gmv_ready,ss.gmv_ready,
          case when so.source_count=0 or ss.session_count=0 then 'SOURCE_MISSING'
               when abs(so.gmv_ready-ss.gmv_ready)<=1 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Live Session List'),
        (4,'orders_created','Orders Dibuat',so.orders_created,ss.orders_created,
          case when so.source_count=0 or ss.session_count=0 then 'SOURCE_MISSING'
               when abs(so.orders_created-ss.orders_created)=0 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Live Session List'),
        (5,'orders_ready','Orders Siap Dikirim',so.orders_ready,ss.orders_ready,
          case when so.source_count=0 or ss.session_count=0 then 'SOURCE_MISSING'
               when abs(so.orders_ready-ss.orders_ready)=0 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Live Session List'),
        (6,'qty_created','Qty Dibuat',so.qty_created,ss.qty_created,
          case when so.source_count=0 or ss.session_count=0 then 'SOURCE_MISSING'
               when abs(so.qty_created-ss.qty_created)=0 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Live Session List'),
        (7,'qty_ready','Qty Siap Dikirim',so.qty_ready,ss.qty_ready,
          case when so.source_count=0 or ss.session_count=0 then 'SOURCE_MISSING'
               when abs(so.qty_ready-ss.qty_ready)=0 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Live Session List'),
        (8,'comments','Komentar',so.comments,ss.comments,
          case when so.source_count=0 or ss.session_count=0 then 'SOURCE_MISSING'
               when abs(so.comments-ss.comments)=0 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Live Session List'),
        (9,'add_to_cart','Tambah ke Keranjang',so.add_to_cart,ss.add_to_cart,
          case when so.source_count=0 or ss.session_count=0 then 'SOURCE_MISSING'
               when abs(so.add_to_cart-ss.add_to_cart)=0 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Live Session List'),
        (10,'viewers','Penonton',so.viewers,ss.viewers,
          case when so.source_count=0 or ss.session_count=0 then 'SOURCE_MISSING'
               when abs(so.viewers-ss.viewers)=0 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Live Session List'),
        (11,'active_viewers','Penonton Aktif',so.period_active_viewers,ss.active_viewers_sum,
          case when so.source_count=0 or ss.session_count=0 then 'SOURCE_MISSING' else 'NOT_APPLICABLE' end,
          'Semantik period unique tidak sama dengan SUM session'),
        (12,'product_gmv_created','Produk · GMV Dibuat',so.gmv_created,sp.gmv_created,
          case when so.source_count=0 or sp.source_count=0 then 'SOURCE_MISSING'
               when abs(so.gmv_created-sp.gmv_created)<=1 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Product List'),
        (13,'product_gmv_ready','Produk · GMV Ready',so.gmv_ready,sp.gmv_ready,
          case when so.source_count=0 or sp.source_count=0 then 'SOURCE_MISSING'
               when abs(so.gmv_ready-sp.gmv_ready)<=1 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Product List'),
        (14,'product_qty_created','Produk · Qty Dibuat',so.qty_created,sp.qty_created,
          case when so.source_count=0 or sp.source_count=0 then 'SOURCE_MISSING'
               when abs(so.qty_created-sp.qty_created)=0 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Product List'),
        (15,'product_qty_ready','Produk · Qty Ready',so.qty_ready,sp.qty_ready,
          case when so.source_count=0 or sp.source_count=0 then 'SOURCE_MISSING'
               when abs(so.qty_ready-sp.qty_ready)=0 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Product List'),
        (16,'product_add_to_cart','Produk · Add to Cart',so.add_to_cart,sp.add_to_cart,
          case when so.source_count=0 or sp.source_count=0 then 'SOURCE_MISSING'
               when abs(so.add_to_cart-sp.add_to_cart)=0 then 'EXACT' else 'DIFFERENCE' end,
          'Overview vs Product List'),
        (17,'product_orders','Produk · Sum Orders',so.orders_created,sp.product_order_rows_sum,
          case when so.source_count=0 or sp.source_count=0 then 'SOURCE_MISSING' else 'NOT_APPLICABLE' end,
          'Satu order dapat berisi beberapa produk'),
        (18,'product_clicks','Produk · Sum Clicks',so.product_clicks,sp.product_clicks_sum,
          case when so.source_count=0 or sp.source_count=0 then 'SOURCE_MISSING' else 'NOT_APPLICABLE' end,
          'Product clicks attribution tidak dipaksa sama dengan Overview')
      ) v(ord,key,label,expected,actual,status,note)
      cross join sh_session ss cross join sh_overview so cross join sh_product sp
    ) q
    cross join lateral (
      select jsonb_build_object(
        'key',q.key,'label',q.label,'expected',q.expected,'actual',q.actual,'status',q.status,'note',q.note,
        'difference',case when q.status in ('EXACT','DIFFERENCE') then abs(coalesce(q.expected,0)-coalesce(q.actual,0)) else null end,
        'difference_pct',case when q.status in ('EXACT','DIFFERENCE') and coalesce(q.expected,0)<>0 then round(abs(q.expected-q.actual)/abs(q.expected)*100,4) else null end
      ) check_row
    ) j
  ),
  tk_checks as (
    select jsonb_build_array(
      jsonb_build_object('key','date_uniqueness','label','Tanggal Harian Unik','expected',tk.row_count,'actual',tk.unique_dates,
        'status',case when tk.row_count=0 then 'SOURCE_MISSING' when tk.row_count=tk.unique_dates then 'EXACT' else 'DIFFERENCE' end,
        'difference',abs(tk.row_count-tk.unique_dates),'note','Satu row TikTok Core Stats per tanggal'),
      jsonb_build_object('key','period_range','label','Range Tanggal','expected',p_start::text||' → '||p_end::text,'actual',coalesce(tk.min_date::text,'-')||' → '||coalesce(tk.max_date::text,'-'),
        'status',case when tk.row_count=0 then 'SOURCE_MISSING' when tk.min_date=p_start and tk.max_date=p_end then 'EXACT' else 'DIFFERENCE' end,
        'difference',null,'note','Min/max daily row dibanding filter aktif'),
      jsonb_build_object('key','gmv_identity','label','GMV Attributed = Direct + Indirect','expected',tk.gmv_attr,'actual',tk.gmv_direct+tk.gmv_indirect,
        'status',case when tk.row_count=0 then 'SOURCE_MISSING' when abs(tk.gmv_attr-tk.gmv_direct-tk.gmv_indirect)<=1 and tk.bad_gmv_rows=0 then 'EXACT' else 'DIFFERENCE' end,
        'difference',abs(tk.gmv_attr-tk.gmv_direct-tk.gmv_indirect),'note',tk.bad_gmv_rows::text||' row tidak reconcile'),
      jsonb_build_object('key','product_identity','label','Produk Attributed = Direct + Indirect','expected',tk.products_attr,'actual',tk.products_direct+tk.products_indirect,
        'status',case when tk.row_count=0 then 'SOURCE_MISSING' when tk.products_attr=tk.products_direct+tk.products_indirect and tk.bad_product_rows=0 then 'EXACT' else 'DIFFERENCE' end,
        'difference',abs(tk.products_attr-tk.products_direct-tk.products_indirect),'note',tk.bad_product_rows::text||' row tidak reconcile'),
      jsonb_build_object('key','orders_identity','label','SKU Orders Attributed = Direct + Indirect','expected',tk.orders_attr,'actual',tk.orders_direct+tk.orders_indirect,
        'status',case when tk.row_count=0 then 'SOURCE_MISSING' when tk.orders_attr=tk.orders_direct+tk.orders_indirect and tk.bad_order_rows=0 then 'EXACT' else 'DIFFERENCE' end,
        'difference',abs(tk.orders_attr-tk.orders_direct-tk.orders_indirect),'note',tk.bad_order_rows::text||' row tidak reconcile')
    ) checks
    from tk
  )
  select jsonb_build_object(
    'range',jsonb_build_object('start',p_start,'end',p_end),
    'shopee',jsonb_build_object(
      'source_presence',jsonb_build_object(
        'session_list',(select session_count>0 from sh_session),
        'overview',(select source_count>0 from sh_overview),
        'product_list',(select source_count>0 from sh_product)
      ),
      'checks',(select checks from sh_checks)
    ),
    'tiktok',jsonb_build_object(
      'source_presence',jsonb_build_object('core_stats',(select row_count>0 from tk)),
      'checks',(select checks from tk_checks)
    ),
    'imports',jsonb_build_object(
      'failed',(select failed_imports from imports),
      'partial',(select partial_imports from imports),
      'with_warnings',(select imports_with_warnings from imports),
      'recent_issues',(select recent_issues from imports)
    )
  ) into result;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_live_reconciliation_v1(uuid,date,date) from public,anon;
grant execute on function public.luma_live_reconciliation_v1(uuid,date,date) to authenticated,service_role;
