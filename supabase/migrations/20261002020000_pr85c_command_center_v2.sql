-- PR85C Universal Command Center 2.0

create or replace function public.luma_global_search_v2(
  p_workspace_id uuid,
  p_query text,
  p_limit integer default 32
)
returns table(
  entity_type text,
  entity_id text,
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
  v_limit integer:=least(greatest(coalesce(p_limit,32),1),60);
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) then raise exception 'Workspace access denied' using errcode='42501'; end if;
  if length(v_query)<2 then return; end if;

  return query
  select x.entity_type,x.entity_id,x.title,x.subtitle,x.meta,x.section,x.score
  from (
    select 'creator'::text,c.id::text,
      coalesce(nullif(c.name,''),nullif(c.username,''),nullif(c.creator_code,''),'Creator')::text,
      concat_ws(' · ',nullif(c.username,''),nullif(c.affiliate_id,''))::text,
      concat_ws(' · ',nullif(c.platform,''),nullif(c.status,''))::text,
      'listings'::text,
      case when lower(coalesce(c.username,''))=v_query or lower(coalesce(c.creator_code,''))=v_query then 1 when lower(coalesce(c.name,''))=v_query then 2 else 8 end::integer
    from public.creators c
    where c.workspace_id=p_workspace_id and (
      lower(coalesce(c.name,'')) like '%'||v_query||'%' or lower(coalesce(c.username,'')) like '%'||v_query||'%' or
      lower(coalesce(c.creator_code,'')) like '%'||v_query||'%' or lower(coalesce(c.affiliate_id,'')) like '%'||v_query||'%'
    )

    union all

    select 'product'::text,p.id::text,coalesce(nullif(p.product_name,''),p.sku,'Product')::text,p.sku::text,
      concat_ws(' · ',nullif(p.category,''),nullif(p.status,''))::text,'product-master'::text,
      case when lower(coalesce(p.sku,''))=v_query then 1 when lower(coalesce(p.product_name,''))=v_query then 2 else 9 end::integer
    from public.product_master p
    where p.workspace_id=p_workspace_id and (
      lower(coalesce(p.sku,'')) like '%'||v_query||'%' or lower(coalesce(p.product_name,'')) like '%'||v_query||'%' or lower(coalesce(p.category,'')) like '%'||v_query||'%'
    )

    union all

    select 'campaign'::text,c.id::text,c.name::text,
      concat_ws(' · ',nullif(c.brand_name,''),nullif(c.campaign_type,''))::text,
      concat_ws(' · ',nullif(c.platform,''),nullif(c.status,''))::text,'campaign-tracker'::text,
      case when lower(c.name)=v_query then 2 else 10 end::integer
    from public.campaign_trackers c
    where c.workspace_id=p_workspace_id and (
      lower(coalesce(c.name,'')) like '%'||v_query||'%' or lower(coalesce(c.brand_name,'')) like '%'||v_query||'%' or lower(coalesce(c.platform,'')) like '%'||v_query||'%'
    )

    union all

    select 'shipping'::text,s.id::text,
      coalesce(nullif(s.reference_no,''),nullif(s.tracking,''),'Shipping #'||s.id::text)::text,
      concat_ws(' · ',nullif(s.receiver_name,''),nullif(s.creator_name,''))::text,
      concat_ws(' · ',nullif(s.courier,''),nullif(s.status,''))::text,'shipping'::text,
      case when lower(coalesce(s.tracking,''))=v_query or lower(coalesce(s.reference_no,''))=v_query then 1 else 11 end::integer
    from public.shipping s
    where s.workspace_id=p_workspace_id and (
      lower(coalesce(s.reference_no,'')) like '%'||v_query||'%' or lower(coalesce(s.tracking,'')) like '%'||v_query||'%' or
      lower(coalesce(s.receiver_name,'')) like '%'||v_query||'%' or lower(coalesce(s.creator_name,'')) like '%'||v_query||'%' or lower(coalesce(s.product_name,'')) like '%'||v_query||'%'
    )

    union all

    select 'task'::text,t.id::text,t.title::text,coalesce(nullif(t.description,''),'Task')::text,
      concat_ws(' · ',nullif(t.priority,''),nullif(t.status,''),case when t.due_date is not null then 'Due '||t.due_date::text else null end)::text,
      'kanban'::text,case when lower(t.title)=v_query then 3 else 12 end::integer
    from public.creator_tasks t
    where t.workspace_id=p_workspace_id and (
      lower(coalesce(t.title,'')) like '%'||v_query||'%' or lower(coalesce(t.description,'')) like '%'||v_query||'%' or lower(coalesce(t.creator_name,'')) like '%'||v_query||'%'
    )

    union all

    select 'listing'::text,l.id::text,coalesce(nullif(l.creator_name,''),'Listing #'||l.id::text)::text,
      concat_ws(' · ',nullif(l.product_name,''),nullif(l.sku,''))::text,
      concat_ws(' · ',nullif(l.platform,''),nullif(l.stage,''))::text,'listings'::text,13::integer
    from public.listings l
    where l.workspace_id=p_workspace_id and (
      lower(coalesce(l.creator_name,'')) like '%'||v_query||'%' or lower(coalesce(l.product_name,'')) like '%'||v_query||'%' or
      lower(coalesce(l.sku,'')) like '%'||v_query||'%' or lower(coalesce(l.next_action,'')) like '%'||v_query||'%'
    )

    union all

    select 'live_host'::text,h.id::text,coalesce(nullif(h.name,''),nullif(h.username,''),'Live Host')::text,
      nullif(h.username,'')::text,concat_ws(' · ',nullif(h.platform,''),nullif(h.host_type,''),nullif(h.status,''))::text,
      'live-streaming'::text,
      case when lower(coalesce(h.username,''))=v_query then 1 when lower(coalesce(h.name,''))=v_query then 2 else 7 end::integer
    from public.live_hosts h
    where h.workspace_id=p_workspace_id and (
      lower(coalesce(h.name,'')) like '%'||v_query||'%' or lower(coalesce(h.username,'')) like '%'||v_query||'%'
    )

    union all

    select 'live_session'::text,s.id::text,coalesce(nullif(s.title,''),'Live Session')::text,
      coalesce(s.session_date::text,'')::text,concat_ws(' · ',nullif(s.platform,''),nullif(s.status,''),nullif(s.campaign_name,''))::text,
      'live-streaming'::text,
      case when lower(coalesce(s.title,''))=v_query then 2 else 8 end::integer
    from public.live_sessions s
    where s.workspace_id=p_workspace_id and (
      lower(coalesce(s.title,'')) like '%'||v_query||'%' or lower(coalesce(s.campaign_name,'')) like '%'||v_query||'%' or lower(coalesce(s.gimmick,'')) like '%'||v_query||'%'
    )

    union all

    select 'live_product'::text,lp.id::text,
      coalesce(nullif(lp.mapped_product_name,''),nullif(lp.product_name_raw,''),'Live Product')::text,
      coalesce(nullif(lp.mapped_sku,''),nullif(lp.source_sku,''),'SKU belum mapped')::text,
      concat_ws(' · ',nullif(lp.platform,''),case when lp.product_master_id is null then 'Belum mapped' else 'Mapped' end)::text,
      'live-streaming'::text,9::integer
    from public.live_product_performance lp
    where lp.workspace_id=p_workspace_id and (
      lower(coalesce(lp.product_name_raw,'')) like '%'||v_query||'%' or lower(coalesce(lp.mapped_product_name,'')) like '%'||v_query||'%' or
      lower(coalesce(lp.source_sku,'')) like '%'||v_query||'%' or lower(coalesce(lp.mapped_sku,'')) like '%'||v_query||'%'
    )

    union all

    select 'saved_view'::text,v.id::text,v.name::text,
      'Saved View pribadi'::text,initcap(replace(v.section,'-',' '))::text,
      v.section::text,4::integer
    from public.luma_saved_views v
    where v.workspace_id=p_workspace_id and v.user_id=auth.uid() and lower(v.name) like '%'||v_query||'%'

    union all

    select 'module'::text,m.section::text,m.title::text,'Menu Lumaway'::text,m.description::text,m.section::text,5::integer
    from (values
      ('dashboard','Dashboard','Overview dan Action Center'),
      ('upload','Upload Center','Import data marketplace'),
      ('listings','Listings','Creator follow-up dan pipeline'),
      ('campaign-tracker','Campaign Tracker','Campaign creator dan target'),
      ('live-streaming','Live Streaming','Shopee/TikTok Live intelligence'),
      ('affiliate-360','Affiliate 360','Search creator dan relationship'),
      ('product-master','Product Master','SKU, HPP dan master product'),
      ('shipping','Shipping','Pengiriman dan tracking'),
      ('spending','Spending','Cost dan spending center'),
      ('goal-forecast','Goal & Forecast','Actual vs Target vs Forecast'),
      ('automation-rules','Automation','Rules dan workflow'),
      ('scheduled-reports','Scheduled Report','Report dan calendar'),
      ('tutorial','Tutorial','Panduan penggunaan Lumaway')
    ) m(section,title,description)
    where lower(m.title) like '%'||v_query||'%' or lower(m.description) like '%'||v_query||'%' or lower(m.section) like '%'||v_query||'%'
  ) x
  order by x.score,x.title
  limit v_limit;
end
$$;

revoke all on function public.luma_global_search_v2(uuid,text,integer) from public,anon;
grant execute on function public.luma_global_search_v2(uuid,text,integer) to authenticated,service_role;
