-- Lumaway production schema baseline snapshot
-- Captured from Supabase production on 2026-09-25.
-- Disaster-recovery reference only. DO NOT apply to the existing production database.
-- Customer/business row data is intentionally excluded.

-- get_affiliate_ads_support(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text)
CREATE OR REPLACE FUNCTION public.get_affiliate_ads_support(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_amount numeric := 0;
  v_platform text := coalesce(nullif(trim(p_platform),''),'ALL');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not (
    public.luma_is_admin()
    or exists(
      select 1 from public.workspace_members wm
      where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()
    )
  ) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  select coalesce(a.amount,0)
  into v_amount
  from public.affiliate_ads_support a
  where a.workspace_id=p_workspace_id
    and a.start_date=p_start_date
    and a.end_date=p_end_date
    and lower(a.platform)=lower(v_platform)
  limit 1;

  return coalesce(v_amount,0);
end
$function$
;

-- get_creator_360(p_workspace_id uuid, p_creator_id bigint, p_start_date date, p_end_date date)
CREATE OR REPLACE FUNCTION public.get_creator_360(p_workspace_id uuid, p_creator_id bigint, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_creator jsonb; v_manual jsonb; v_kpi jsonb; v_products jsonb; v_samples jsonb; v_stores jsonb; v_agreement jsonb; v_top_category text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not (public.luma_is_admin() or exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid())) then raise exception 'Workspace access denied' using errcode='42501'; end if;

  select to_jsonb(c) into v_creator from public.creators c where c.id=p_creator_id and c.workspace_id=p_workspace_id;
  if v_creator is null then raise exception 'Creator not found'; end if;
  select to_jsonb(x)-'id'-'workspace_id'-'creator_id' into v_manual from public.creator_360_profiles x where x.workspace_id=p_workspace_id and x.creator_id=p_creator_id;
  v_manual:=coalesce(v_manual,'{"favorite":false,"rating":0,"program_status":"Not Joined","top_creator":false,"ads_support":0,"target_sales":0,"target_live":0,"target_video":0,"video_links":[]}'::jsonb);

  with fs as (
    select s.* from public.sales s where s.workspace_id=p_workspace_id and s.creator_id=p_creator_id and (p_start_date is null or s.data_date>=p_start_date) and (p_end_date is null or s.data_date<=p_end_date)
  ), sale_kpi as (
    select coalesce(sum(qty),0) qty,coalesce(sum(orders),0) orders,coalesce(sum(gmv),0) gmv,coalesce(sum(commission),0) commission,coalesce(sum(refund),0) refund,coalesce(sum(live_gmv),0) live_gmv,coalesce(sum(video_gmv),0) video_gmv,coalesce(sum(showcase_gmv),0) showcase_gmv,
      coalesce(sum(case when coalesce(points,0)<>0 then points else coalesce(qty,0)*coalesce(pm.point_per_unit,0) end),0) points
    from fs left join public.product_master pm on pm.workspace_id=p_workspace_id and pm.sku_normalized=lower(coalesce(fs.sku,''))
  ), samp as (
    select coalesce(sum(coalesce(cs.product_value,0)),0) product_value_sent,count(*) filter(where lower(coalesce(cs.sample_status,'')) not in ('cancelled','rejected')) samples_sent from public.creator_samples cs where cs.workspace_id=p_workspace_id and (cs.creator_id=p_creator_id or (cs.creator_id is null and lower(cs.creator_name)=lower(v_creator->>'name'))) and (p_start_date is null or cs.sent_date>=p_start_date) and (p_end_date is null or cs.sent_date<=p_end_date)
  ), ship as (
    select coalesce(sum(coalesce(sh.shipping_cost,0)),0) shipping_cost from public.shipping sh where sh.workspace_id=p_workspace_id and (sh.creator_id=p_creator_id or (sh.creator_id is null and lower(sh.creator_name)=lower(v_creator->>'name'))) and (p_start_date is null or sh.data_date>=p_start_date) and (p_end_date is null or sh.data_date<=p_end_date)
  ) select jsonb_build_object('qty',sale_kpi.qty,'orders',sale_kpi.orders,'gmv',sale_kpi.gmv,'commission',sale_kpi.commission,'refund',sale_kpi.refund,'live_gmv',sale_kpi.live_gmv,'video_gmv',sale_kpi.video_gmv,'showcase_gmv',sale_kpi.showcase_gmv,'points',sale_kpi.points,'product_value_sent',samp.product_value_sent,'samples_sent',samp.samples_sent,'shipping_cost',ship.shipping_cost) into v_kpi from sale_kpi,samp,ship;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.gmv desc),'[]'::jsonb) into v_products from (
    select coalesce(nullif(s.product_name,''),nullif(s.sku,''),'Unknown Product') product_name,s.sku,coalesce(sum(s.qty),0) qty,coalesce(sum(s.orders),0) orders,coalesce(sum(s.gmv),0) gmv,coalesce(sum(s.commission),0) commission,
      coalesce(sum(case when coalesce(s.points,0)<>0 then s.points else coalesce(s.qty,0)*coalesce(pm.point_per_unit,0) end),0) points
    from public.sales s left join public.product_master pm on pm.workspace_id=p_workspace_id and pm.sku_normalized=lower(coalesce(s.sku,''))
    where s.workspace_id=p_workspace_id and s.creator_id=p_creator_id and (p_start_date is null or s.data_date>=p_start_date) and (p_end_date is null or s.data_date<=p_end_date) and (s.sku is not null or s.product_name is not null)
    group by coalesce(nullif(s.product_name,''),nullif(s.sku,''),'Unknown Product'),s.sku order by gmv desc limit 10
  ) q;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.sent_date desc nulls last),'[]'::jsonb) into v_samples from (
    select cs.id,cs.sent_date,cs.product_name,cs.sku,cs.qty,cs.product_value,cs.sample_status,cs.tracking from public.creator_samples cs where cs.workspace_id=p_workspace_id and (cs.creator_id=p_creator_id or (cs.creator_id is null and lower(cs.creator_name)=lower(v_creator->>'name'))) and (p_start_date is null or cs.sent_date>=p_start_date) and (p_end_date is null or cs.sent_date<=p_end_date) order by cs.sent_date desc nulls last limit 25
  ) q;

  select category into v_top_category from public.sales s where s.workspace_id=p_workspace_id and s.creator_id=p_creator_id and category is not null and (p_start_date is null or data_date>=p_start_date) and (p_end_date is null or data_date<=p_end_date) group by category order by sum(gmv) desc nulls last limit 1;

  select jsonb_build_object('status',coalesce(a.document_status,'Not Active'),'agreement_id',a.agreement_id,'start_date',a.start_date,'end_date',a.end_date,'support_status',a.support_status) into v_agreement from public.agreements a where a.workspace_id=p_workspace_id and lower(a.creator_name)=lower(v_creator->>'name') and (a.end_date is null or a.end_date>=coalesce(p_start_date,current_date)) order by a.start_date desc nulls last,a.id desc limit 1;
  v_agreement:=coalesce(v_agreement,'{"status":"Not Active"}'::jsonb);

  select coalesce(jsonb_agg(to_jsonb(q) order by q.gmv desc),'[]'::jsonb) into v_stores from (
    select a.store_name,a.platform,case when coalesce(sum(s.gmv),0)>0 or coalesce(sum(s.orders),0)>0 then 'Active' else 'Inactive' end status,coalesce(sum(s.gmv),0) gmv,coalesce(sum(s.orders),0) orders,coalesce(sum(s.qty),0) qty,
      coalesce(sum(coalesce(s.cost_product,0)+coalesce(s.shipping_cost,0)+coalesce(s.ads_spend,0)),0) spend,
      case when coalesce(sum(coalesce(s.cost_product,0)+coalesce(s.shipping_cost,0)+coalesce(s.ads_spend,0)),0)>0 then round(coalesce(sum(s.gmv),0)/sum(coalesce(s.cost_product,0)+coalesce(s.shipping_cost,0)+coalesce(s.ads_spend,0)),2) else 0 end roi
    from public.creator_store_affiliations a left join public.sales s on s.workspace_id=a.workspace_id and s.creator_id=a.creator_id and s.platform=a.platform and s.store_name=a.store_name and (p_start_date is null or s.data_date>=p_start_date) and (p_end_date is null or s.data_date<=p_end_date)
    where a.workspace_id=p_workspace_id and a.creator_id=p_creator_id group by a.store_name,a.platform
  ) q;

  return jsonb_build_object('creator',v_creator,'manual_profile',v_manual,'kpi',v_kpi,'top_products',v_products,'samples',v_samples,'stores',v_stores,'agreement',v_agreement,'top_category',v_top_category);
end $function$
;

-- get_creator_360_activity(p_workspace_id uuid, p_creator_id bigint, p_start_date date, p_end_date date)
CREATE OR REPLACE FUNCTION public.get_creator_360_activity(p_workspace_id uuid, p_creator_id bigint, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_latest date;
  v_result jsonb;
  v_manual_samples numeric := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not (
    public.luma_is_admin()
    or exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid())
  ) then raise exception 'Workspace access denied' using errcode='42501'; end if;

  select max(s.data_date) into v_latest
  from public.sales s
  where s.workspace_id=p_workspace_id and s.creator_id=p_creator_id;

  select coalesce(sum(cs.qty),0) into v_manual_samples
  from public.creator_samples cs
  where cs.workspace_id=p_workspace_id
    and cs.creator_id=p_creator_id
    and lower(coalesce(cs.sample_status,'sent')) not in ('cancelled','rejected')
    and (p_start_date is null or cs.sent_date>=p_start_date)
    and (p_end_date is null or cs.sent_date<=p_end_date);

  select jsonb_build_object(
    'live_count',coalesce(sum(s.live_count),0),
    'video_count',coalesce(sum(s.video_count),0),
    'clicks',coalesce(sum(s.clicks),0),
    'buyers',coalesce(sum(s.buyers),0),
    'new_buyers',coalesce(sum(s.new_buyers),0),
    'impressions',coalesce(sum(s.impressions),0),
    'video_views',coalesce(sum(s.video_views),0),
    'sample_content',coalesce(sum(s.sample_content),0),
    'sample_sent_data',coalesce(sum(s.sample_sent),0),
    'manual_samples',v_manual_samples,
    'samples_total',coalesce(sum(s.sample_sent),0)+v_manual_samples,
    'refund_qty',coalesce(sum(s.refund_qty),0),
    'ctr',coalesce(avg(nullif(s.ctr,0)),0),
    'latest_data_date',v_latest
  )
  into v_result
  from public.sales s
  where s.workspace_id=p_workspace_id
    and s.creator_id=p_creator_id
    and s.data_type in ('performance','sales')
    and (p_start_date is null or s.data_date>=p_start_date)
    and (p_end_date is null or s.data_date<=p_end_date);

  return coalesce(v_result,jsonb_build_object(
    'live_count',0,'video_count',0,'clicks',0,'buyers',0,'new_buyers',0,
    'impressions',0,'video_views',0,'sample_content',0,'sample_sent_data',0,
    'manual_samples',v_manual_samples,'samples_total',v_manual_samples,'refund_qty',0,'ctr',0,
    'latest_data_date',v_latest
  ));
end
$function$
;

-- get_creator_ranking(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text, p_creator_id bigint, p_search text, p_page integer, p_page_size integer)
CREATE OR REPLACE FUNCTION public.get_creator_ranking(p_workspace_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_platform text DEFAULT NULL::text, p_creator_id bigint DEFAULT NULL::bigint, p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS TABLE(rank bigint, creator_id bigint, creator_code text, creator_name text, username text, platform text, qty numeric, orders numeric, gmv numeric, commission numeric, total_rows bigint)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
    with ranked as (
        select
            s.creator_id,
            max(s.creator_name) as sales_creator_name,
            max(s.username) as sales_username,
            max(s.platform) as sales_platform,
            coalesce(sum(s.qty), 0) as qty,
            coalesce(sum(s.orders), 0) as orders,
            coalesce(sum(s.gmv), 0) as gmv,
            coalesce(sum(s.commission), 0) as commission
        from public.sales s
        where s.workspace_id = p_workspace_id
          and (p_start_date is null or s.data_date >= p_start_date)
          and (p_end_date is null or s.data_date <= p_end_date)
          and (
              p_platform is null
              or p_platform = ''
              or s.platform = p_platform
          )
          and (
              p_creator_id is null
              or s.creator_id = p_creator_id
          )
        group by s.creator_id
    ),

    joined as (
        select
            r.creator_id,
            coalesce(c.creator_code, '') as creator_code,
            coalesce(c.name, r.sales_creator_name, '') as creator_name,
            coalesce(c.username, r.sales_username, '') as username,
            coalesce(r.sales_platform, c.platform, '') as platform,
            r.qty,
            r.orders,
            r.gmv,
            r.commission
        from ranked r
        left join public.creators c
            on c.id = r.creator_id
           and c.workspace_id = p_workspace_id
        where
            p_search is null
            or p_search = ''
            or coalesce(c.name, r.sales_creator_name, '') ilike '%' || p_search || '%'
            or coalesce(c.username, r.sales_username, '') ilike '%' || p_search || '%'
            or coalesce(c.creator_code, '') ilike '%' || p_search || '%'
    ),

    numbered as (
        select
            row_number() over (
                order by gmv desc, orders desc, qty desc, creator_id asc
            ) as rank,
            *
        from joined
    )

    select
        n.rank,
        n.creator_id,
        n.creator_code,
        n.creator_name,
        n.username,
        n.platform,
        n.qty,
        n.orders,
        n.gmv,
        n.commission,
        count(*) over() as total_rows
    from numbered n
    order by n.rank
    limit greatest(1, least(p_page_size, 100))
    offset greatest(0, p_page - 1) * greatest(1, least(p_page_size, 100));
$function$
;

-- get_creator_ranking_internal(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text, p_creator_id bigint, p_search text, p_page integer, p_page_size integer)
CREATE OR REPLACE FUNCTION public.get_creator_ranking_internal(p_workspace_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_platform text DEFAULT NULL::text, p_creator_id bigint DEFAULT NULL::bigint, p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS TABLE(rank bigint, creator_id bigint, creator_code text, creator_name text, username text, platform text, qty numeric, orders numeric, gmv numeric, commission numeric, total_rows bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with ranked as (
    select
      s.creator_id,
      max(s.creator_name) as sales_creator_name,
      max(s.username) as sales_username,
      max(s.platform) as sales_platform,
      coalesce(sum(s.qty),0) as qty,
      coalesce(sum(s.orders),0) as orders,
      coalesce(sum(s.gmv),0) as gmv,
      coalesce(sum(s.commission),0) as commission
    from public.sales s
    where s.workspace_id=p_workspace_id
      and s.data_type in ('performance','sales')
      and s.creator_id is not null
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform))
      and (p_creator_id is null or s.creator_id=p_creator_id)
    group by s.creator_id
  ),
  joined as (
    select
      r.creator_id,
      coalesce(c.creator_code,'') as creator_code,
      coalesce(c.name,r.sales_creator_name,'') as creator_name,
      coalesce(c.username,r.sales_username,'') as username,
      coalesce(r.sales_platform,c.platform,'') as platform,
      r.qty,r.orders,r.gmv,r.commission
    from ranked r
    left join public.creators c
      on c.id=r.creator_id and c.workspace_id=p_workspace_id
    where p_search is null or p_search=''
      or coalesce(c.name,r.sales_creator_name,'') ilike '%'||p_search||'%'
      or coalesce(c.username,r.sales_username,'') ilike '%'||p_search||'%'
      or coalesce(c.creator_code,'') ilike '%'||p_search||'%'
  ),
  numbered as (
    select row_number() over(order by gmv desc,orders desc,qty desc,creator_id asc) as rank,*
    from joined
  )
  select n.rank,n.creator_id,n.creator_code,n.creator_name,n.username,n.platform,
    n.qty,n.orders,n.gmv,n.commission,count(*) over() as total_rows
  from numbered n
  order by n.rank
  limit greatest(1,least(p_page_size,100))
  offset greatest(0,p_page-1)*greatest(1,least(p_page_size,100));
$function$
;

-- get_creator_ranking_summary(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text)
CREATE OR REPLACE FUNCTION public.get_creator_ranking_summary(p_workspace_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_platform text DEFAULT NULL::text)
 RETURNS TABLE(total_creators bigint, active_creators bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not (public.luma_is_admin() or exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()))
  then raise exception 'Workspace access denied' using errcode='42501'; end if;
  return query
  select count(distinct s.creator_id)::bigint,
         count(distinct s.creator_id) filter(where coalesce(s.gmv,0)<>0 or coalesce(s.orders,0)<>0 or coalesce(s.qty,0)<>0 or coalesce(s.commission,0)<>0)::bigint
  from public.sales s
  where s.workspace_id=p_workspace_id and s.data_type in ('performance','sales') and s.creator_id is not null
    and (p_start_date is null or s.data_date>=p_start_date)
    and (p_end_date is null or s.data_date<=p_end_date)
    and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform));
end
$function$
;

-- get_dashboard_kpi(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text, p_creator_id bigint)
CREATE OR REPLACE FUNCTION public.get_dashboard_kpi(p_workspace_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_platform text DEFAULT NULL::text, p_creator_id bigint DEFAULT NULL::bigint)
 RETURNS TABLE(total_creators bigint, total_sales_records bigint, total_qty numeric, total_orders numeric, total_gmv numeric, total_commission numeric)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
    select
        count(distinct s.creator_id)::bigint as total_creators,
        count(*)::bigint as total_sales_records,
        coalesce(sum(s.qty), 0) as total_qty,
        coalesce(sum(s.orders), 0) as total_orders,
        coalesce(sum(s.gmv), 0) as total_gmv,
        coalesce(sum(s.commission), 0) as total_commission
    from public.sales s
    where s.workspace_id = p_workspace_id
      and (p_start_date is null or s.data_date >= p_start_date)
      and (p_end_date is null or s.data_date <= p_end_date)
      and (
          p_platform is null
          or p_platform = ''
          or s.platform = p_platform
      )
      and (
          p_creator_id is null
          or s.creator_id = p_creator_id
      );
$function$
;

-- get_dashboard_latest_date(p_workspace_id uuid, p_platform text)
CREATE OR REPLACE FUNCTION public.get_dashboard_latest_date(p_workspace_id uuid, p_platform text DEFAULT NULL::text)
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_date date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if not (
    public.luma_is_admin()
    or exists(
      select 1 from public.workspace_members wm
      where wm.workspace_id=p_workspace_id
        and wm.user_id=auth.uid()
    )
  ) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  select max(s.data_date)
  into v_date
  from public.sales s
  where s.workspace_id=p_workspace_id
    and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform));

  return v_date;
end
$function$
;

-- get_dashboard_metrics_v2(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text)
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_v2(p_workspace_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_platform text DEFAULT NULL::text)
 RETURNS TABLE(total_creators bigint, total_sales_records bigint, total_qty numeric, total_orders numeric, total_gmv numeric, total_commission numeric, total_products bigint, total_cost_product numeric, total_shipping numeric, total_ads_spend numeric, total_spend numeric, roi numeric, aov numeric, avg_daily_creator_sales numeric, referral_commission numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

-- get_dashboard_metrics_v3(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text)
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_v3(p_workspace_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_platform text DEFAULT NULL::text)
 RETURNS TABLE(total_creators bigint, total_sales_records bigint, total_qty numeric, total_orders numeric, total_gmv numeric, total_commission numeric, total_products bigint, total_cost_product numeric, total_shipping numeric, total_ads_spend numeric, total_spend numeric, roi numeric, aov numeric, avg_daily_creator_sales numeric, referral_commission numeric, total_live_streams numeric, total_videos numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not (
    public.luma_is_admin()
    or exists(
      select 1 from public.workspace_members wm
      where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()
    )
  ) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  return query
  with affiliate_base as (
    select s.*
    from public.sales s
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
    select
      count(distinct creator_id)::bigint creators,
      count(*)::bigint rows,
      coalesce(sum(qty),0) qty,
      coalesce(sum(orders),0) orders,
      coalesce(sum(gmv),0) gmv,
      coalesce(sum(commission),0) commission,
      coalesce(sum(cost_product),0) cost_product,
      coalesce(sum(shipping_cost),0) shipping,
      coalesce(sum(live_count),0) live_streams,
      coalesce(sum(video_count),0) videos,
      count(distinct data_date) filter(where data_date is not null) days
    from affiliate_base
  ),
  ads_support as (
    select coalesce(max(a.amount),0)::numeric amount
    from public.affiliate_ads_support a
    where a.workspace_id=p_workspace_id
      and p_start_date is not null
      and p_end_date is not null
      and a.start_date=p_start_date
      and a.end_date=p_end_date
      and lower(a.platform)=lower(coalesce(nullif(p_platform,''),'ALL'))
  ),
  ref as (
    select coalesce(sum(r.commission_amount),0) amount
    from public.referral_events r
    where r.workspace_id=p_workspace_id
      and lower(coalesce(r.status,'')) in ('confirmed','paid')
      and (p_start_date is null or r.created_at::date>=p_start_date)
      and (p_end_date is null or r.created_at::date<=p_end_date)
  )
  select
    a.creators,
    a.rows,
    a.qty,
    a.orders,
    a.gmv,
    a.commission,
    pc.products,
    a.cost_product,
    a.shipping,
    ads.amount,
    (a.cost_product+a.shipping+ads.amount+a.commission)::numeric,
    case when (a.cost_product+a.shipping+ads.amount+a.commission)>0
      then round(a.gmv/(a.cost_product+a.shipping+ads.amount+a.commission),2)
      else 0 end,
    case when a.orders>0 then round(a.gmv/a.orders,2) else 0 end,
    case when a.creators>0 and a.days>0 then round(a.gmv/(a.creators*a.days),2) else 0 end,
    ref.amount,
    a.live_streams,
    a.videos
  from agg a
  cross join product_count pc
  cross join ads_support ads
  cross join ref;
end
$function$
;

-- get_dashboard_metrics_v4(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text)
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_v4(p_workspace_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_platform text DEFAULT NULL::text)
 RETURNS TABLE(total_creators bigint, total_sales_records bigint, total_qty numeric, total_orders numeric, total_gmv numeric, total_commission numeric, total_products bigint, total_cost_product numeric, total_shipping numeric, total_ads_spend numeric, total_spend numeric, roi numeric, aov numeric, avg_daily_creator_sales numeric, referral_commission numeric, total_live_streams numeric, total_videos numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not (public.luma_is_admin() or exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()))
  then raise exception 'Workspace access denied' using errcode='42501'; end if;
  return query
  with affiliate_base as (
    select s.* from public.sales s
    where s.workspace_id=p_workspace_id and s.data_type in ('performance','sales')
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform))
  ),
  product_count as (
    select count(distinct nullif(coalesce(s.sku,s.product_name),''))::bigint products
    from public.sales s
    where s.workspace_id=p_workspace_id and s.data_type in ('product_performance','sales')
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform))
  ),
  agg as (
    select count(distinct creator_id) filter(where coalesce(gmv,0)<>0 or coalesce(orders,0)<>0 or coalesce(qty,0)<>0 or coalesce(commission,0)<>0)::bigint active_creators,
      count(*)::bigint rows,coalesce(sum(qty),0) qty,coalesce(sum(orders),0) orders,coalesce(sum(gmv),0) gmv,
      coalesce(sum(commission),0) commission,coalesce(sum(cost_product),0) cost_product,coalesce(sum(shipping_cost),0) shipping,
      coalesce(sum(live_count),0) live_streams,coalesce(sum(video_count),0) videos,
      count(distinct data_date) filter(where data_date is not null) days
    from affiliate_base
  ),
  ads_support as (
    select coalesce(max(a.amount),0)::numeric amount from public.affiliate_ads_support a
    where a.workspace_id=p_workspace_id and p_start_date is not null and p_end_date is not null
      and a.start_date=p_start_date and a.end_date=p_end_date
      and lower(a.platform)=lower(coalesce(nullif(p_platform,''),'ALL'))
  ),
  ref as (
    select coalesce(sum(r.commission_amount),0) amount from public.referral_events r
    where r.workspace_id=p_workspace_id and lower(coalesce(r.status,'')) in ('confirmed','paid')
      and (p_start_date is null or r.created_at::date>=p_start_date)
      and (p_end_date is null or r.created_at::date<=p_end_date)
  )
  select a.active_creators,a.rows,a.qty,a.orders,a.gmv,a.commission,pc.products,a.cost_product,a.shipping,ads.amount,
    (a.cost_product+a.shipping+ads.amount+a.commission)::numeric,
    case when (a.cost_product+a.shipping+ads.amount+a.commission)>0 then round(a.gmv/(a.cost_product+a.shipping+ads.amount+a.commission),2) else 0 end,
    case when a.orders>0 then round(a.gmv/a.orders,2) else 0 end,
    case when a.active_creators>0 and a.days>0 then round(a.gmv/a.active_creators/a.days,2) else 0 end,
    ref.amount,a.live_streams,a.videos
  from agg a cross join product_count pc cross join ads_support ads cross join ref;
end
$function$
;

-- get_database_affiliate_summary(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text)
CREATE OR REPLACE FUNCTION public.get_database_affiliate_summary(p_workspace_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_platform text DEFAULT NULL::text)
 RETURNS TABLE(total_rows bigint, active_rows bigint, zero_rows bigint, total_qty numeric, total_orders numeric, total_gmv numeric, total_commission numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    count(*)::bigint as total_rows,
    count(*) filter (
      where coalesce(s.qty,0)<>0
         or coalesce(s.orders,0)<>0
         or coalesce(s.gmv,0)<>0
         or coalesce(s.commission,0)<>0
    )::bigint as active_rows,
    count(*) filter (
      where coalesce(s.qty,0)=0
        and coalesce(s.orders,0)=0
        and coalesce(s.gmv,0)=0
        and coalesce(s.commission,0)=0
    )::bigint as zero_rows,
    coalesce(sum(s.qty),0)::numeric as total_qty,
    coalesce(sum(s.orders),0)::numeric as total_orders,
    coalesce(sum(s.gmv),0)::numeric as total_gmv,
    coalesce(sum(s.commission),0)::numeric as total_commission
  from public.sales s
  where s.workspace_id=p_workspace_id
    and s.data_type in ('performance','sales')
    and (p_start_date is null or s.data_date>=p_start_date)
    and (p_end_date is null or s.data_date<=p_end_date)
    and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform));
$function$
;

-- get_import_metric_quality(p_workspace_id uuid, p_import_id text)
CREATE OR REPLACE FUNCTION public.get_import_metric_quality(p_workspace_id uuid, p_import_id text)
 RETURNS TABLE(total_rows bigint, active_rows bigint, zero_rows bigint, total_qty numeric, total_orders numeric, total_gmv numeric, total_commission numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    count(*)::bigint as total_rows,
    count(*) filter (
      where coalesce(s.qty,0)<>0
         or coalesce(s.orders,0)<>0
         or coalesce(s.gmv,0)<>0
         or coalesce(s.commission,0)<>0
    )::bigint as active_rows,
    count(*) filter (
      where coalesce(s.qty,0)=0
        and coalesce(s.orders,0)=0
        and coalesce(s.gmv,0)=0
        and coalesce(s.commission,0)=0
    )::bigint as zero_rows,
    coalesce(sum(s.qty),0)::numeric as total_qty,
    coalesce(sum(s.orders),0)::numeric as total_orders,
    coalesce(sum(s.gmv),0)::numeric as total_gmv,
    coalesce(sum(s.commission),0)::numeric as total_commission
  from public.sales s
  where s.workspace_id=p_workspace_id
    and s.import_id=p_import_id
    and s.data_type in ('performance','sales');
$function$
;

-- get_owner_creator_monitoring(p_limit integer)
CREATE OR REPLACE FUNCTION public.get_owner_creator_monitoring(p_limit integer DEFAULT 500)
 RETURNS TABLE(workspace_id uuid, workspace_name text, creator_id bigint, creator_code text, creator_name text, username text, platform text, status text, favorite boolean, rating numeric, program_status text, top_creator boolean, gmv numeric, orders numeric, qty numeric, commission numeric, sample_value numeric, shipping_cost numeric, ads_support numeric, spend numeric, roi numeric, points numeric, store_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 return query
 select c.workspace_id,w.name,c.id,c.creator_code,c.name,c.username,c.platform,c.status,coalesce(m.favorite,false),coalesce(m.rating,0),coalesce(m.program_status,'Not Joined'),coalesce(m.top_creator,false),
 coalesce(sa.gmv,0),coalesce(sa.orders,0),coalesce(sa.qty,0),coalesce(sa.commission,0),coalesce(sp.sample_value,0),coalesce(sh.ship_cost,0),coalesce(m.ads_support,0),
 (coalesce(sp.sample_value,0)+coalesce(sh.ship_cost,0)+coalesce(sa.commission,0)+coalesce(m.ads_support,0))::numeric,
 case when (coalesce(sp.sample_value,0)+coalesce(sh.ship_cost,0)+coalesce(sa.commission,0)+coalesce(m.ads_support,0))>0 then round(coalesce(sa.gmv,0)/(coalesce(sp.sample_value,0)+coalesce(sh.ship_cost,0)+coalesce(sa.commission,0)+coalesce(m.ads_support,0)),2) else 0 end,
 coalesce(sa.points,0),coalesce(st.shop_count,0)::bigint
 from public.creators c join public.workspaces w on w.id=c.workspace_id
 left join public.creator_360_profiles m on m.workspace_id=c.workspace_id and m.creator_id=c.id
 left join lateral (select coalesce(sum(s.gmv),0) gmv,coalesce(sum(s.orders),0) orders,coalesce(sum(s.qty),0) qty,coalesce(sum(s.commission),0) commission,coalesce(sum(case when coalesce(s.points,0)<>0 then s.points else coalesce(s.qty,0)*coalesce(pm.point_per_unit,0) end),0) points from public.sales s left join public.product_master pm on pm.workspace_id=s.workspace_id and pm.sku_normalized=lower(coalesce(s.sku,'')) where s.workspace_id=c.workspace_id and s.creator_id=c.id) sa on true
 left join lateral (select coalesce(sum(cs.product_value),0) sample_value from public.creator_samples cs where cs.workspace_id=c.workspace_id and (cs.creator_id=c.id or (cs.creator_id is null and lower(cs.creator_name)=lower(c.name)))) sp on true
 left join lateral (select coalesce(sum(x.shipping_cost),0) ship_cost from public.shipping x where x.workspace_id=c.workspace_id and (x.creator_id=c.id or (x.creator_id is null and lower(x.creator_name)=lower(c.name)))) sh on true
 left join lateral (select count(distinct (a.platform,a.store_name)) shop_count from public.creator_store_affiliations a where a.workspace_id=c.workspace_id and a.creator_id=c.id) st on true
 order by sa.gmv desc limit greatest(1,least(coalesce(p_limit,500),2000));
end $function$
;

-- get_owner_grid_storage_preview(p_limit integer)
CREATE OR REPLACE FUNCTION public.get_owner_grid_storage_preview(p_limit integer DEFAULT 100)
 RETURNS TABLE(workspace_id uuid, workspace_name text, user_email text, sheet_count bigint, row_count bigint, estimated_bytes bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 return query
 select w.id,w.name,p.email,
 (select count(*) from public.workspace_grid_sheets gs where gs.workspace_id=w.id)::bigint,
 (select count(*) from public.workspace_grid_rows gr where gr.workspace_id=w.id)::bigint,
 coalesce((select sum(length(gr.row_data::text)) from public.workspace_grid_rows gr where gr.workspace_id=w.id),0)::bigint
 from public.workspaces w
 left join lateral (select pr.email from public.workspace_members wm join public.profiles pr on pr.id=wm.user_id where wm.workspace_id=w.id order by wm.created_at asc limit 1) p on true
 order by 6 desc
 limit greatest(1,least(coalesce(p_limit,100),500));
end $function$
;

-- get_owner_monitoring_summary()
CREATE OR REPLACE FUNCTION public.get_owner_monitoring_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r jsonb;
begin
  if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
  select jsonb_build_object(
    'users',(select count(*) from public.profiles),'active_users',(select count(*) from public.profiles where active),'workspaces',(select count(*) from public.workspaces),'creators',(select count(*) from public.creators),'stores',(select count(distinct (workspace_id,platform,store_name)) from public.creator_store_affiliations),'sales_rows',(select count(*) from public.sales),'agreements',(select count(*) from public.agreements),'samples',(select count(*) from public.creator_samples),'imports',(select count(*) from public.imports),'notifications',(select count(*) from public.luma_notifications),'blog_posts',(select count(*) from public.luma_blog_posts),'social_posts',(select count(*) from public.luma_community_posts),
    'gmv',(select coalesce(sum(gmv),0) from public.sales),'orders',(select coalesce(sum(orders),0) from public.sales),'qty',(select coalesce(sum(qty),0) from public.sales),'creator_commission',(select coalesce(sum(commission),0) from public.sales),'topup_revenue',(select coalesce(sum(amount),0) from public.luma_topup_orders where lower(status)='paid'),'topup_paid',(select count(*) from public.luma_topup_orders where lower(status)='paid'),'referral_commission_total',(select coalesce(sum(commission_amount),0) from public.referral_events),'referral_commission_confirmed',(select coalesce(sum(commission_amount),0) from public.referral_events where lower(status) in ('confirmed','paid')),
    'withdraw_pending_count',(select count(*) from public.referral_withdrawals where lower(status) in ('pending','processing')),'withdraw_pending_amount',(select coalesce(sum(amount),0) from public.referral_withdrawals where lower(status) in ('pending','processing')),'withdraw_paid_count',(select count(*) from public.referral_withdrawals where lower(status)='paid'),'withdraw_paid_amount',(select coalesce(sum(amount),0) from public.referral_withdrawals where lower(status)='paid'),'withdraw_failed_count',(select count(*) from public.referral_withdrawals where lower(status) in ('failed','rejected')),
    'wallet_monthly_limit',(select coalesce(sum(monthly_limit),0) from public.luma_token_wallets),'wallet_used',(select coalesce(sum(used_tokens),0) from public.luma_token_wallets),'wallet_bonus',(select coalesce(sum(bonus_tokens),0) from public.luma_token_wallets),'wallet_available',(select coalesce(sum(greatest(monthly_limit-used_tokens,0)+bonus_tokens),0) from public.luma_token_wallets),'ai_runs',(select count(*) from public.ai_analysis_runs),'ai_success',(select count(*) from public.ai_analysis_runs where lower(status)='success'),'ai_error',(select count(*) from public.ai_analysis_runs where lower(status)='error'),'api_requests',(select count(*) from public.luma_api_usage_events),'api_input_tokens',(select coalesce(sum(input_tokens),0) from public.luma_api_usage_events),'api_output_tokens',(select coalesce(sum(output_tokens),0) from public.luma_api_usage_events),'api_total_tokens',(select coalesce(sum(total_tokens),0) from public.luma_api_usage_events),'open_issues',(select count(*) from public.luma_issue_logs where lower(status)<>'resolved')
  ) into r;
  return r;
end $function$
;

-- get_owner_storage_summary()
CREATE OR REPLACE FUNCTION public.get_owner_storage_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare db_bytes bigint:=0; obj_count bigint:=0; obj_bytes bigint:=0;
begin
 if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 select coalesce(sum(pg_total_relation_size(c.oid)),0) into db_bytes from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','m');
 begin
   execute 'select count(*), coalesce(sum(coalesce((metadata->>''size'')::bigint,0)),0) from storage.objects' into obj_count,obj_bytes;
 exception when others then obj_count:=0;obj_bytes:=0;
 end;
 return jsonb_build_object('database_bytes',db_bytes,'storage_objects',obj_count,'storage_bytes',obj_bytes);
end $function$
;

-- get_owner_store_monitoring()
CREATE OR REPLACE FUNCTION public.get_owner_store_monitoring()
 RETURNS TABLE(workspace_name text, store_name text, platform text, total_affiliates bigint, active_affiliates bigint, gmv numeric, orders numeric, qty numeric, spend numeric, roi numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 return query
 select w.name,a.store_name,a.platform,count(distinct a.creator_id)::bigint,count(distinct s.creator_id)::bigint,coalesce(sum(s.gmv),0),coalesce(sum(s.orders),0),coalesce(sum(s.qty),0),coalesce(sum(coalesce(s.cost_product,0)+coalesce(s.shipping_cost,0)+coalesce(s.ads_spend,0)),0),case when coalesce(sum(coalesce(s.cost_product,0)+coalesce(s.shipping_cost,0)+coalesce(s.ads_spend,0)),0)>0 then round(coalesce(sum(s.gmv),0)/sum(coalesce(s.cost_product,0)+coalesce(s.shipping_cost,0)+coalesce(s.ads_spend,0)),2) else 0 end
 from public.creator_store_affiliations a join public.workspaces w on w.id=a.workspace_id left join public.sales s on s.workspace_id=a.workspace_id and s.creator_id=a.creator_id and s.platform=a.platform and s.store_name=a.store_name
 group by w.name,a.store_name,a.platform order by 6 desc;
end $function$
;

-- get_owner_user_360(p_user_id uuid)
CREATE OR REPLACE FUNCTION public.get_owner_user_360(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r jsonb;
begin
 if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 select jsonb_build_object(
  'profile',(select to_jsonb(p) from public.profiles p where p.id=p_user_id),
  'workspaces',(select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'slug',w.slug,'membership_role',wm.membership_role)),'[]'::jsonb) from public.workspace_members wm join public.workspaces w on w.id=wm.workspace_id where wm.user_id=p_user_id),
  'wallets',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.luma_token_wallets x where x.user_id=p_user_id),
  'topups',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from public.luma_topup_orders x where x.user_id=p_user_id),
  'referral_profile',(select to_jsonb(x) from public.referral_profiles x where x.user_id=p_user_id limit 1),
  'referral_earned',(select coalesce(sum(commission_amount),0) from public.referral_events where referrer_user_id=p_user_id),
  'withdrawals',(select coalesce(jsonb_agg(to_jsonb(x) order by x.requested_at desc),'[]'::jsonb) from public.referral_withdrawals x where x.user_id=p_user_id),
  'ai_runs',(select count(*) from public.ai_analysis_runs where created_by=p_user_id::text),
  'ai_errors',(select count(*) from public.ai_analysis_runs where created_by=p_user_id::text and lower(status)='error'),
  'api_usage',(select jsonb_build_object('requests',count(*),'input_tokens',coalesce(sum(input_tokens),0),'output_tokens',coalesce(sum(output_tokens),0),'total_tokens',coalesce(sum(total_tokens),0)) from public.luma_api_usage_events where user_id=p_user_id),
  'notification_reads',(select count(*) from public.luma_notification_reads where user_id=p_user_id)
 ) into r;
 return r;
end $function$
;

-- get_owner_workspace_monthly_preview(p_limit integer)
CREATE OR REPLACE FUNCTION public.get_owner_workspace_monthly_preview(p_limit integer DEFAULT 100)
 RETURNS TABLE(workspace_id uuid, workspace_name text, user_email text, month text, gmv numeric, orders numeric, qty numeric, commission numeric, creators bigint, products bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if not public.luma_is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 return query
 select w.id,w.name,p.email,to_char(date_trunc('month',s.data_date),'YYYY-MM')::text,
 coalesce(sum(s.gmv),0),coalesce(sum(s.orders),0),coalesce(sum(s.qty),0),coalesce(sum(s.commission),0),count(distinct s.creator_id)::bigint,count(distinct nullif(coalesce(s.sku,s.product_name),''))::bigint
 from public.sales s join public.workspaces w on w.id=s.workspace_id
 left join lateral (select pr.email from public.workspace_members wm join public.profiles pr on pr.id=wm.user_id where wm.workspace_id=w.id order by wm.created_at asc limit 1) p on true
 where s.data_date is not null
 group by w.id,w.name,p.email,date_trunc('month',s.data_date)
 order by date_trunc('month',s.data_date) desc,sum(s.gmv) desc
 limit greatest(1,least(coalesce(p_limit,100),500));
end $function$
;

-- get_product_ranking(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text, p_search text, p_page integer, p_page_size integer)
CREATE OR REPLACE FUNCTION public.get_product_ranking(p_workspace_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_platform text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS TABLE(rank bigint, sku text, product_name text, platform text, qty numeric, orders numeric, gmv numeric, commission numeric, clicks numeric, buyers numeric, new_buyers numeric, refund numeric, refund_qty numeric, roi numeric, total_rows bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

-- get_store_dashboard(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text)
CREATE OR REPLACE FUNCTION public.get_store_dashboard(p_workspace_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_platform text DEFAULT NULL::text)
 RETURNS TABLE(store_name text, platform text, total_affiliates bigint, active_affiliates bigint, inactive_affiliates bigint, gmv numeric, orders numeric, qty numeric, spend numeric, roi numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not (public.luma_is_admin() or exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid())) then raise exception 'Workspace access denied' using errcode='42501'; end if;
  return query
  with aff as (
    select a.store_name,a.platform,a.creator_id from public.creator_store_affiliations a where a.workspace_id=p_workspace_id and (p_platform is null or p_platform='' or a.platform=p_platform)
  ), fs as (
    select s.* from public.sales s where s.workspace_id=p_workspace_id and s.store_name is not null and (p_start_date is null or s.data_date>=p_start_date) and (p_end_date is null or s.data_date<=p_end_date) and (p_platform is null or p_platform='' or s.platform=p_platform)
  )
  select a.store_name,a.platform,count(distinct a.creator_id)::bigint,count(distinct a.creator_id) filter(where exists(select 1 from fs x where x.creator_id=a.creator_id and x.store_name=a.store_name and x.platform=a.platform and (coalesce(x.gmv,0)>0 or coalesce(x.orders,0)>0)))::bigint,
    (count(distinct a.creator_id)-count(distinct a.creator_id) filter(where exists(select 1 from fs x where x.creator_id=a.creator_id and x.store_name=a.store_name and x.platform=a.platform and (coalesce(x.gmv,0)>0 or coalesce(x.orders,0)>0))))::bigint,
    coalesce(sum(fs.gmv),0),coalesce(sum(fs.orders),0),coalesce(sum(fs.qty),0),coalesce(sum(coalesce(fs.cost_product,0)+coalesce(fs.shipping_cost,0)+coalesce(fs.ads_spend,0)),0),
    case when coalesce(sum(coalesce(fs.cost_product,0)+coalesce(fs.shipping_cost,0)+coalesce(fs.ads_spend,0)),0)>0 then round(coalesce(sum(fs.gmv),0)/sum(coalesce(fs.cost_product,0)+coalesce(fs.shipping_cost,0)+coalesce(fs.ads_spend,0)),2) else 0 end
  from aff a left join fs on fs.creator_id=a.creator_id and fs.store_name=a.store_name and fs.platform=a.platform group by a.store_name,a.platform order by 6 desc;
end $function$
;

-- handle_new_luma_user()
CREATE OR REPLACE FUNCTION public.handle_new_luma_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_workspace_id uuid;
begin
  insert into public.profiles(id,email,full_name,role,active)
  values(new.id,new.email,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),nullif(new.raw_user_meta_data->>'name','')),'staff',true)
  on conflict(id) do update set email=excluded.email,full_name=coalesce(public.profiles.full_name,excluded.full_name);
  v_workspace_id:=public.luma_provision_customer_workspace(new.id);
  perform public.luma_ensure_referral_profile(new.id,v_workspace_id);
  perform public.luma_ensure_social_identity(new.id);
  return new;
end;
$function$
;

-- luma_agreement_seal_defaults()
CREATE OR REPLACE FUNCTION public.luma_agreement_seal_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  attempt integer := 0;
begin
  if nullif(trim(new.e_stamp_id),'') is null then
    loop
      new.e_stamp_id := public.luma_random_alnum22();
      exit when not exists (
        select 1 from public.agreements a
        where a.workspace_id=new.workspace_id and a.e_stamp_id=new.e_stamp_id
          and (tg_op='INSERT' or a.id<>new.id)
      );
      attempt := attempt + 1;
      if attempt > 10 then
        raise exception 'Gagal membuat Digital Seal ID unik.';
      end if;
    end loop;
  end if;

  if new.e_stamp_id !~ '^[A-Za-z0-9]{22}$' then
    raise exception 'Digital Seal ID wajib tepat 22 karakter angka/huruf.';
  end if;

  if nullif(trim(new.signed_by_name),'') is null then
    new.signed_by_name := coalesce(nullif(trim(new.creator_name),''),'Creator');
  end if;
  if new.signed_at is null then new.signed_at := now(); end if;
  return new;
end
$function$
;

-- luma_apply_my_referral(p_code text)
CREATE OR REPLACE FUNCTION public.luma_apply_my_referral(p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_ref uuid;
  v_current uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if nullif(trim(coalesce(p_code,'')),'') is null then return false; end if;
  select referred_by_user_id into v_current from public.referral_profiles where user_id=v_user;
  if v_current is not null then return false; end if;
  select user_id into v_ref from public.referral_profiles where referral_code=upper(trim(p_code)) limit 1;
  if v_ref is null or v_ref=v_user then return false; end if;
  update public.referral_profiles
  set referred_by_user_id=v_ref,referred_by_code=upper(trim(p_code)),updated_at=now()
  where user_id=v_user and referred_by_user_id is null;
  return found;
end;
$function$
;
