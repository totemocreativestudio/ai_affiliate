-- PR86C Production Data Reconciliation & Regression Suite

create or replace function public.luma_get_master_creators_unique_v3(
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
  profile_url text,
  avatar_url text,
  social_links jsonb,
  social_profile_updated_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with params as (
    select lower(regexp_replace(trim(coalesce(p_search,'')),'^@+','','g')) q
  ),
  matched_identities as (
    select distinct
      coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform)) identity_key
    from public.creators c
    cross join params p
    where auth.uid() is not null
      and public.luma_has_workspace(p_workspace_id)
      and c.workspace_id=p_workspace_id
      and c.merged_into_creator_id is null
      and lower(coalesce(c.status,''))<>'merged'
      and (
        p.q=''
        or lower(regexp_replace(coalesce(c.name,''),'^@+','','g')) like '%'||p.q||'%'
        or lower(regexp_replace(coalesce(c.username,''),'^@+','','g')) like '%'||p.q||'%'
        or lower(coalesce(c.creator_code,'')) like '%'||p.q||'%'
        or lower(coalesce(c.affiliate_id,'')) like '%'||p.q||'%'
        or lower(coalesce(c.platform,'')) like '%'||p.q||'%'
      )

    union

    select distinct
      coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform)) identity_key
    from public.sales s
    join public.creators c on c.workspace_id=s.workspace_id and c.id=s.creator_id
    cross join params p
    where auth.uid() is not null
      and public.luma_has_workspace(p_workspace_id)
      and s.workspace_id=p_workspace_id
      and s.data_type in ('performance','sales')
      and c.merged_into_creator_id is null
      and lower(coalesce(c.status,''))<>'merged'
      and p.q<>''
      and (
        lower(regexp_replace(coalesce(s.creator_name,''),'^@+','','g')) like '%'||p.q||'%'
        or lower(regexp_replace(coalesce(s.username,''),'^@+','','g')) like '%'||p.q||'%'
      )
  ),
  ranked as (
    select c.*,
      row_number() over(
        partition by c.workspace_id,coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))
        order by
          case when nullif(trim(coalesce(c.avatar_url,'')),'') is not null then 0 else 1 end,
          c.updated_at desc nulls last,c.id desc
      ) rn
    from public.creators c
    cross join params p
    where auth.uid() is not null
      and public.luma_has_workspace(p_workspace_id)
      and c.workspace_id=p_workspace_id
      and c.merged_into_creator_id is null
      and lower(coalesce(c.status,''))<>'merged'
      and (
        p.q=''
        or coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))
          in (select identity_key from matched_identities where identity_key is not null)
      )
  ),
  filtered as (
    select * from ranked where rn=1
  )
  select f.id,f.creator_code,f.name,f.username,f.platform,f.affiliate_id,f.phone,
         f.payment_type,f.ratecard,f.status,f.profile_url,f.avatar_url,
         coalesce(f.social_links,'{}'::jsonb),f.social_profile_updated_at,count(*) over()
  from filtered f
  order by lower(coalesce(nullif(trim(f.username),''),nullif(trim(f.name),''),f.creator_code)),
           lower(coalesce(f.platform,''))
  limit greatest(1,least(coalesce(p_page_size,100),200))
  offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,100),200));
$$;

revoke all on function public.luma_get_master_creators_unique_v3(uuid,text,integer,integer) from public,anon;
grant execute on function public.luma_get_master_creators_unique_v3(uuid,text,integer,integer) to authenticated,service_role;


create or replace function public.luma_affiliate_cost_components_v1(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date,
  p_platform text default null,
  p_store_name text default null
)
returns table(
  sales_hpp numeric,
  sample_hpp numeric,
  creator_commission numeric,
  affiliate_shipping numeric,
  operations_shipping numeric,
  operations_insurance numeric,
  ads_spend numeric,
  total_hpp numeric,
  total_shipping numeric,
  total_spending numeric,
  sample_rows bigint,
  sample_mapped_rows bigint,
  operations_rows bigint
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  return query
  with affiliate as (
    select s.*
    from public.sales s
    where s.workspace_id=p_workspace_id
      and s.data_type in ('performance','sales')
      and s.data_date between p_start_date and p_end_date
      and (coalesce(p_platform,'')='' or lower(coalesce(s.platform,''))=lower(p_platform))
      and (coalesce(p_store_name,'')='' or lower(coalesce(s.store_name,''))=lower(p_store_name))
  ),
  affiliate_sum as (
    select
      coalesce(sum(cost_product),0)::numeric sales_hpp,
      coalesce(sum(commission),0)::numeric creator_commission,
      coalesce(sum(shipping_cost),0)::numeric affiliate_shipping
    from affiliate
  ),
  samples as (
    select cs.*,
      case
        when pm.cost_price is not null and pm.cost_price>0 then coalesce(cs.qty,1)*pm.cost_price
        else coalesce(cs.product_value,0)
      end::numeric sample_cost,
      (pm.id is not null and pm.cost_price is not null and pm.cost_price>0) hpp_mapped
    from public.creator_samples cs
    left join public.product_master pm
      on pm.id=cs.product_master_id and pm.workspace_id=cs.workspace_id
    where cs.workspace_id=p_workspace_id
      and cs.sent_date is not null
      and cs.sent_date between p_start_date and p_end_date
      and (coalesce(p_platform,'')='' or lower(coalesce(cs.platform,''))=lower(p_platform))
      -- creator_samples currently has no store dimension; do not attribute shared sample HPP to one store.
      and coalesce(p_store_name,'')=''
  ),
  sample_sum as (
    select
      coalesce(sum(sample_cost),0)::numeric sample_hpp,
      count(*)::bigint sample_rows,
      count(*) filter(where hpp_mapped)::bigint sample_mapped_rows
    from samples
  ),
  operations as (
    select sh.*
    from public.shipping sh
    where sh.workspace_id=p_workspace_id
      and lower(coalesce(sh.status,'')) not in ('cancelled','canceled')
      and sh.data_date between p_start_date and p_end_date
      and (coalesce(p_platform,'')='' or lower(coalesce(sh.platform,''))=lower(p_platform))
      and (coalesce(p_store_name,'')='' or lower(coalesce(sh.store_name,''))=lower(p_store_name))
  ),
  operations_sum as (
    select
      coalesce(sum(shipping_cost),0)::numeric operations_shipping,
      coalesce(sum(insurance_amount),0)::numeric operations_insurance,
      count(*)::bigint operations_rows
    from operations
  ),
  ads as (
    select coalesce(max(a.amount),0)::numeric amount
    from public.affiliate_ads_support a
    where a.workspace_id=p_workspace_id
      and a.start_date=p_start_date and a.end_date=p_end_date
      and lower(a.platform)=lower(coalesce(nullif(p_platform,''),'ALL'))
      and lower(a.store_name)=lower(coalesce(nullif(p_store_name,''),'ALL'))
  )
  select
    a.sales_hpp,
    sm.sample_hpp,
    a.creator_commission,
    a.affiliate_shipping,
    o.operations_shipping,
    o.operations_insurance,
    ads.amount,
    (a.sales_hpp+sm.sample_hpp)::numeric,
    (a.affiliate_shipping+o.operations_shipping+o.operations_insurance)::numeric,
    (a.sales_hpp+sm.sample_hpp+a.creator_commission+a.affiliate_shipping+o.operations_shipping+o.operations_insurance+ads.amount)::numeric,
    sm.sample_rows,
    sm.sample_mapped_rows,
    o.operations_rows
  from affiliate_sum a cross join sample_sum sm cross join operations_sum o cross join ads;
end
$$;

revoke all on function public.luma_affiliate_cost_components_v1(uuid,date,date,text,text) from public,anon;
grant execute on function public.luma_affiliate_cost_components_v1(uuid,date,date,text,text) to authenticated,service_role;


create or replace function public.get_dashboard_metrics_v6(
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
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;
  if p_start_date is null or p_end_date is null then
    raise exception 'Start and end date required';
  end if;

  return query
  with affiliate_base as (
    select s.* from public.sales s
    where s.workspace_id=p_workspace_id and s.data_type in ('performance','sales')
      and s.data_date between p_start_date and p_end_date
      and (coalesce(p_platform,'')='' or lower(coalesce(s.platform,''))=lower(p_platform))
      and (coalesce(p_store_name,'')='' or lower(coalesce(s.store_name,''))=lower(p_store_name))
  ),
  product_count as (
    select count(distinct nullif(coalesce(s.sku,s.product_name),''))::bigint products
    from public.sales s
    where s.workspace_id=p_workspace_id and s.data_type in ('product_performance','sales')
      and s.data_date between p_start_date and p_end_date
      and (coalesce(p_platform,'')='' or lower(coalesce(s.platform,''))=lower(p_platform))
      and (coalesce(p_store_name,'')='' or lower(coalesce(s.store_name,''))=lower(p_store_name))
  ),
  agg as (
    select
      count(distinct creator_id) filter(where coalesce(gmv,0)<>0 or coalesce(orders,0)<>0 or coalesce(qty,0)<>0 or coalesce(commission,0)<>0)::bigint active_creators,
      count(*)::bigint rows,
      coalesce(sum(qty),0)::numeric qty,
      coalesce(sum(orders),0)::numeric orders,
      coalesce(sum(gmv),0)::numeric gmv,
      coalesce(sum(commission),0)::numeric commission,
      coalesce(sum(live_count),0)::numeric live_streams,
      coalesce(sum(video_count),0)::numeric videos,
      count(distinct data_date) filter(where data_date is not null)::numeric days
    from affiliate_base
  ),
  cost as (
    select * from public.luma_affiliate_cost_components_v1(p_workspace_id,p_start_date,p_end_date,p_platform,p_store_name)
  ),
  ref as (
    select coalesce(sum(r.commission_amount),0)::numeric amount
    from public.referral_events r
    where r.workspace_id=p_workspace_id and lower(coalesce(r.status,'')) in ('confirmed','paid')
      and r.created_at::date between p_start_date and p_end_date
  )
  select
    a.active_creators,a.rows,a.qty,a.orders,a.gmv,a.commission,pc.products,
    c.total_hpp,c.total_shipping,c.ads_spend,c.total_spending,
    case when c.total_spending>0 then round(a.gmv/c.total_spending,2) else 0 end,
    case when a.orders>0 then round(a.gmv/a.orders,2) else 0 end,
    case when a.active_creators>0 and a.days>0 then round(a.gmv/a.active_creators/a.days,2) else 0 end,
    r.amount,a.live_streams,a.videos
  from agg a cross join product_count pc cross join cost c cross join ref r;
end
$$;

revoke all on function public.get_dashboard_metrics_v6(uuid,date,date,text,text) from public,anon;
grant execute on function public.get_dashboard_metrics_v6(uuid,date,date,text,text) to authenticated,service_role;


create or replace function public.luma_spending_center_v2(
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

  with costs as (
    select * from public.luma_affiliate_cost_components_v1(p_workspace_id,p_start_date,p_end_date,p_platform,p_store_name)
  ),
  affiliate as (
    select s.* from public.sales s
    where s.workspace_id=p_workspace_id and s.data_type in ('performance','sales')
      and s.data_date between p_start_date and p_end_date
      and (coalesce(p_platform,'')='' or lower(coalesce(s.platform,''))=lower(p_platform))
      and (coalesce(p_store_name,'')='' or lower(coalesce(s.store_name,''))=lower(p_store_name))
  ),
  samples as (
    select cs.sent_date data_date,
      case when pm.cost_price is not null and pm.cost_price>0 then coalesce(cs.qty,1)*pm.cost_price else coalesce(cs.product_value,0) end::numeric sample_hpp
    from public.creator_samples cs
    left join public.product_master pm on pm.id=cs.product_master_id and pm.workspace_id=cs.workspace_id
    where cs.workspace_id=p_workspace_id and cs.sent_date between p_start_date and p_end_date
      and (coalesce(p_platform,'')='' or lower(coalesce(cs.platform,''))=lower(p_platform))
      and coalesce(p_store_name,'')=''
  ),
  operations as (
    select sh.*
    from public.shipping sh
    where sh.workspace_id=p_workspace_id
      and lower(coalesce(sh.status,'')) not in ('cancelled','canceled')
      and sh.data_date between p_start_date and p_end_date
      and (coalesce(p_platform,'')='' or lower(coalesce(sh.platform,''))=lower(p_platform))
      and (coalesce(p_store_name,'')='' or lower(coalesce(sh.store_name,''))=lower(p_store_name))
  ),
  daily as (
    select d::date data_date,
      (
        coalesce((select sum(coalesce(s.cost_product,0)+coalesce(s.commission,0)+coalesce(s.shipping_cost,0)) from affiliate s where s.data_date=d::date),0)
        +coalesce((select sum(sample_hpp) from samples sm where sm.data_date=d::date),0)
      )::numeric affiliate_cost,
      coalesce((select sum(coalesce(sh.shipping_cost,0)+coalesce(sh.insurance_amount,0)) from operations sh where sh.data_date=d::date),0)::numeric operations_shipping
    from generate_series(p_start_date,p_end_date,interval '1 day') d
  ),
  shipping_rows as (
    select id,data_date,reference_no,creator_name,platform,store_name,courier,service,status,
      shipping_cost,insurance_amount,product_cost,
      (coalesce(shipping_cost,0)+coalesce(insurance_amount,0))::numeric spending
    from operations
    order by data_date desc nulls last,id desc
    limit 250
  )
  select jsonb_build_object(
    'period',jsonb_build_object('start',p_start_date,'end',p_end_date,'platform',p_platform,'store_name',p_store_name),
    'breakdown',jsonb_build_object(
      'sales_hpp',c.sales_hpp,
      'sample_hpp',c.sample_hpp,
      'hpp',c.total_hpp,
      'creator_commission',c.creator_commission,
      'ads_spend',c.ads_spend,
      'affiliate_shipping',c.affiliate_shipping,
      'operations_shipping',c.operations_shipping,
      'operations_insurance',c.operations_insurance,
      'total_shipping',c.total_shipping,
      'total_spending',c.total_spending
    ),
    'sample_rows',c.sample_rows,
    'sample_mapped_rows',c.sample_mapped_rows,
    'shipment_rows',c.operations_rows,
    'daily',coalesce((select jsonb_agg(to_jsonb(x) order by x.data_date) from daily x),'[]'::jsonb),
    'shipping_rows',coalesce((select jsonb_agg(to_jsonb(x)) from shipping_rows x),'[]'::jsonb)
  )
  into result from costs c;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_spending_center_v2(uuid,date,date,text,text) from public,anon;
grant execute on function public.luma_spending_center_v2(uuid,date,date,text,text) to authenticated,service_role;


create or replace function public.luma_data_reconciliation_v1(
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
declare
  cost record;
  dash record;
  spending jsonb;
  orphan_sales_creator_ids bigint:=0;
  sample_unmapped bigint:=0;
  shipping_no_cost bigint:=0;
  live_ref boolean:=false;
  checks jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then raise exception 'Workspace access denied' using errcode='42501'; end if;

  select * into cost from public.luma_affiliate_cost_components_v1(p_workspace_id,p_start_date,p_end_date,p_platform,p_store_name);
  select * into dash from public.get_dashboard_metrics_v6(p_workspace_id,p_start_date,p_end_date,p_platform,p_store_name);
  spending:=public.luma_spending_center_v2(p_workspace_id,p_start_date,p_end_date,p_platform,p_store_name);

  select count(distinct s.creator_id) into orphan_sales_creator_ids
  from public.sales s
  left join public.creators c on c.workspace_id=s.workspace_id and c.id=s.creator_id
  where s.workspace_id=p_workspace_id and s.data_type in ('performance','sales')
    and s.data_date between p_start_date and p_end_date
    and s.creator_id is not null and c.id is null;

  select count(*) into sample_unmapped
  from public.creator_samples cs
  left join public.product_master pm on pm.id=cs.product_master_id and pm.workspace_id=cs.workspace_id
  where cs.workspace_id=p_workspace_id and cs.sent_date between p_start_date and p_end_date
    and (coalesce(p_platform,'')='' or lower(coalesce(cs.platform,''))=lower(p_platform))
    and coalesce(p_store_name,'')=''
    and not (pm.cost_price is not null and pm.cost_price>0)
    and coalesce(cs.product_value,0)<=0;

  select count(*) into shipping_no_cost
  from public.shipping sh
  where sh.workspace_id=p_workspace_id
    and lower(coalesce(sh.status,'')) not in ('cancelled','canceled')
    and sh.data_date between p_start_date and p_end_date
    and (coalesce(p_platform,'')='' or lower(coalesce(sh.platform,''))=lower(p_platform))
    and (coalesce(p_store_name,'')='' or lower(coalesce(sh.store_name,''))=lower(p_store_name))
    and coalesce(sh.shipping_cost,0)=0 and coalesce(sh.insurance_amount,0)=0;

  select position('live_' in lower(pg_get_functiondef(p.oid)))>0 into live_ref
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='luma_affiliate_cost_components_v1'
  limit 1;

  checks:=checks||jsonb_build_array(jsonb_build_object(
    'key','dashboard_shipping','label','Dashboard Shipping = Canonical Shipping',
    'expected',cost.total_shipping,'actual',dash.total_shipping,
    'status',case when abs(coalesce(cost.total_shipping,0)-coalesce(dash.total_shipping,0))<=1 then 'EXACT' else 'DIFFERENCE' end
  ));
  checks:=checks||jsonb_build_array(jsonb_build_object(
    'key','dashboard_hpp','label','Dashboard HPP = Sales HPP + Sample HPP',
    'expected',cost.total_hpp,'actual',dash.total_cost_product,
    'status',case when abs(coalesce(cost.total_hpp,0)-coalesce(dash.total_cost_product,0))<=1 then 'EXACT' else 'DIFFERENCE' end
  ));
  checks:=checks||jsonb_build_array(jsonb_build_object(
    'key','spending_total','label','Spending Total = Canonical Total',
    'expected',cost.total_spending,'actual',coalesce((spending->'breakdown'->>'total_spending')::numeric,0),
    'status',case when abs(coalesce(cost.total_spending,0)-coalesce((spending->'breakdown'->>'total_spending')::numeric,0))<=1 then 'EXACT' else 'DIFFERENCE' end
  ));
  checks:=checks||jsonb_build_array(jsonb_build_object(
    'key','creator_identity_coverage','label','Affiliate creator IDs have Creator Master rows',
    'actual',orphan_sales_creator_ids,'status',case when orphan_sales_creator_ids=0 then 'EXACT' else 'REVIEW' end
  ));
  checks:=checks||jsonb_build_array(jsonb_build_object(
    'key','sample_hpp_coverage','label','Sent samples have HPP or product value',
    'actual',sample_unmapped,'status',case when sample_unmapped=0 then 'EXACT' else 'REVIEW' end
  ));
  checks:=checks||jsonb_build_array(jsonb_build_object(
    'key','shipping_cost_coverage','label','Operations Shipping rows have cost data',
    'actual',shipping_no_cost,'status',case when shipping_no_cost=0 then 'EXACT' else 'REVIEW' end
  ));
  checks:=checks||jsonb_build_array(jsonb_build_object(
    'key','affiliate_live_separation','label','Affiliate cost function does not reference Live tables',
    'actual',live_ref,'status',case when not coalesce(live_ref,false) then 'EXACT' else 'DIFFERENCE' end
  ));

  return jsonb_build_object(
    'period',jsonb_build_object('start',p_start_date,'end',p_end_date,'platform',p_platform,'store',p_store_name),
    'canonical',to_jsonb(cost),
    'checks',checks,
    'difference_count',(select count(*) from jsonb_array_elements(checks) x where x->>'status'='DIFFERENCE'),
    'review_count',(select count(*) from jsonb_array_elements(checks) x where x->>'status'='REVIEW'),
    'checked_at',now()
  );
end
$$;

revoke all on function public.luma_data_reconciliation_v1(uuid,date,date,text,text) from public,anon;
grant execute on function public.luma_data_reconciliation_v1(uuid,date,date,text,text) to authenticated,service_role;


create or replace function public.get_creator_360_v2(
  p_workspace_id uuid,
  p_creator_id bigint,
  p_start_date date default null,
  p_end_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_creator jsonb;
  v_identity text;
  v_manual jsonb;
  v_kpi jsonb;
  v_products jsonb;
  v_samples jsonb;
  v_stores jsonb;
  v_agreement jsonb;
  v_top_category text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then raise exception 'Workspace access denied' using errcode='42501'; end if;

  select to_jsonb(c),coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))
  into v_creator,v_identity
  from public.creators c
  where c.id=p_creator_id and c.workspace_id=p_workspace_id;
  if v_creator is null then raise exception 'Creator not found'; end if;

  select to_jsonb(x)-'id'-'workspace_id'-'creator_id' into v_manual
  from public.creator_360_profiles x
  where x.workspace_id=p_workspace_id
    and x.creator_id in (
      select c.id from public.creators c
      where c.workspace_id=p_workspace_id
        and coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))=v_identity
    )
  order by x.updated_at desc nulls last limit 1;
  v_manual:=coalesce(v_manual,'{"favorite":false,"rating":0,"program_status":"Not Joined","top_creator":false,"ads_support":0,"target_sales":0,"target_live":0,"target_video":0,"video_links":[]}'::jsonb);

  with creator_ids as (
    select c.id,c.name
    from public.creators c
    where c.workspace_id=p_workspace_id
      and coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))=v_identity
  ),
  fs as (
    select s.* from public.sales s
    where s.workspace_id=p_workspace_id
      and s.creator_id in (select id from creator_ids)
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
  ),
  sale_kpi as (
    select coalesce(sum(qty),0) qty,coalesce(sum(orders),0) orders,coalesce(sum(gmv),0) gmv,
      coalesce(sum(commission),0) commission,coalesce(sum(refund),0) refund,
      coalesce(sum(live_gmv),0) live_gmv,coalesce(sum(video_gmv),0) video_gmv,
      coalesce(sum(showcase_gmv),0) showcase_gmv,
      coalesce(sum(case when coalesce(points,0)<>0 then points else coalesce(qty,0)*coalesce(pm.point_per_unit,0) end),0) points
    from fs left join public.product_master pm on pm.workspace_id=p_workspace_id and pm.sku_normalized=lower(coalesce(fs.sku,''))
  ),
  samp as (
    select coalesce(sum(coalesce(cs.product_value,0)),0) product_value_sent,
      count(*) filter(where lower(coalesce(cs.sample_status,'')) not in ('cancelled','rejected')) samples_sent
    from public.creator_samples cs
    where cs.workspace_id=p_workspace_id
      and (
        cs.creator_id in (select id from creator_ids)
        or (cs.creator_id is null and lower(coalesce(cs.creator_name,'')) in (select lower(coalesce(name,'')) from creator_ids))
      )
      and (p_start_date is null or cs.sent_date>=p_start_date)
      and (p_end_date is null or cs.sent_date<=p_end_date)
  ),
  ship as (
    select coalesce(sum(coalesce(sh.shipping_cost,0)),0) shipping_cost
    from public.shipping sh
    where sh.workspace_id=p_workspace_id
      and (
        sh.creator_id in (select id from creator_ids)
        or (sh.creator_id is null and lower(coalesce(sh.creator_name,'')) in (select lower(coalesce(name,'')) from creator_ids))
      )
      and (p_start_date is null or sh.data_date>=p_start_date)
      and (p_end_date is null or sh.data_date<=p_end_date)
  )
  select jsonb_build_object(
    'qty',sale_kpi.qty,'orders',sale_kpi.orders,'gmv',sale_kpi.gmv,'commission',sale_kpi.commission,
    'refund',sale_kpi.refund,'live_gmv',sale_kpi.live_gmv,'video_gmv',sale_kpi.video_gmv,
    'showcase_gmv',sale_kpi.showcase_gmv,'points',sale_kpi.points,
    'product_value_sent',samp.product_value_sent,'samples_sent',samp.samples_sent,'shipping_cost',ship.shipping_cost
  ) into v_kpi
  from sale_kpi,samp,ship;

  with creator_ids as (
    select c.id,c.name from public.creators c
    where c.workspace_id=p_workspace_id
      and coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))=v_identity
  )
  select coalesce(jsonb_agg(to_jsonb(q) order by q.gmv desc),'[]'::jsonb) into v_products
  from (
    select coalesce(nullif(s.product_name,''),nullif(s.sku,''),'Unknown Product') product_name,s.sku,
      coalesce(sum(s.qty),0) qty,coalesce(sum(s.orders),0) orders,coalesce(sum(s.gmv),0) gmv,coalesce(sum(s.commission),0) commission
    from public.sales s
    where s.workspace_id=p_workspace_id
      and s.creator_id in (select id from creator_ids)
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
      and (s.sku is not null or s.product_name is not null)
    group by coalesce(nullif(s.product_name,''),nullif(s.sku,''),'Unknown Product'),s.sku
    order by gmv desc limit 10
  ) q;

  with creator_ids as (
    select c.id,c.name from public.creators c
    where c.workspace_id=p_workspace_id
      and coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))=v_identity
  )
  select coalesce(jsonb_agg(to_jsonb(q) order by q.sent_date desc nulls last),'[]'::jsonb) into v_samples
  from (
    select cs.id,cs.sent_date,cs.product_name,cs.sku,cs.qty,cs.product_value,cs.sample_status,cs.tracking
    from public.creator_samples cs
    where cs.workspace_id=p_workspace_id
      and (
        cs.creator_id in (select id from creator_ids)
        or (cs.creator_id is null and lower(coalesce(cs.creator_name,'')) in (select lower(coalesce(name,'')) from creator_ids))
      )
      and (p_start_date is null or cs.sent_date>=p_start_date)
      and (p_end_date is null or cs.sent_date<=p_end_date)
    order by cs.sent_date desc nulls last limit 25
  ) q;

  with creator_ids as (
    select c.id from public.creators c
    where c.workspace_id=p_workspace_id
      and coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))=v_identity
  )
  select category into v_top_category
  from public.sales s
  where s.workspace_id=p_workspace_id
    and s.creator_id in (select id from creator_ids)
    and category is not null
    and (p_start_date is null or data_date>=p_start_date)
    and (p_end_date is null or data_date<=p_end_date)
  group by category order by sum(gmv) desc nulls last limit 1;

  with creator_names as (
    select lower(coalesce(c.name,'')) name
    from public.creators c
    where c.workspace_id=p_workspace_id
      and coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))=v_identity
  )
  select jsonb_build_object('status',coalesce(a.document_status,'Not Active'),'agreement_id',a.agreement_id,'start_date',a.start_date,'end_date',a.end_date,'support_status',a.support_status)
  into v_agreement
  from public.agreements a
  where a.workspace_id=p_workspace_id
    and lower(coalesce(a.creator_name,'')) in (select name from creator_names)
    and (a.end_date is null or a.end_date>=coalesce(p_start_date,current_date))
  order by a.start_date desc nulls last,a.id desc limit 1;
  v_agreement:=coalesce(v_agreement,'{"status":"Not Active"}'::jsonb);

  with creator_ids as (
    select c.id from public.creators c
    where c.workspace_id=p_workspace_id
      and coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))=v_identity
  )
  select coalesce(jsonb_agg(to_jsonb(q) order by q.gmv desc),'[]'::jsonb) into v_stores
  from (
    select a.store_name,a.platform,
      case when coalesce(sum(s.gmv),0)>0 or coalesce(sum(s.orders),0)>0 then 'Active' else 'Inactive' end status,
      coalesce(sum(s.gmv),0) gmv,coalesce(sum(s.orders),0) orders,coalesce(sum(s.qty),0) qty
    from public.creator_store_affiliations a
    left join public.sales s on s.workspace_id=a.workspace_id and s.creator_id=a.creator_id
      and s.platform=a.platform and s.store_name=a.store_name
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
    where a.workspace_id=p_workspace_id and a.creator_id in (select id from creator_ids)
    group by a.store_name,a.platform
  ) q;

  return jsonb_build_object(
    'creator',v_creator,'manual_profile',v_manual,'kpi',v_kpi,'top_products',v_products,
    'samples',v_samples,'stores',v_stores,'agreement',v_agreement,'top_category',v_top_category
  );
end
$$;

revoke all on function public.get_creator_360_v2(uuid,bigint,date,date) from public,anon;
grant execute on function public.get_creator_360_v2(uuid,bigint,date,date) to authenticated,service_role;
