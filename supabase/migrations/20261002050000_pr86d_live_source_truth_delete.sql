-- PR86D Live Source Truth, Full Import Delete & Campaign UX

create or replace function public.luma_delete_live_import_v1(
  p_workspace_id uuid,
  p_import_id text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_daily int:=0; v_product int:=0; v_overview int:=0; v_traffic int:=0;
  v_session_perf int:=0; v_sessions int:=0; v_imports int:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;
  if nullif(trim(coalesce(p_import_id,'')),'') is null then raise exception 'Import ID required'; end if;

  delete from public.live_daily_performance
  where workspace_id=p_workspace_id and source_import_id=p_import_id;
  get diagnostics v_daily=row_count;

  delete from public.live_product_performance
  where workspace_id=p_workspace_id and source_import_id=p_import_id;
  get diagnostics v_product=row_count;

  delete from public.live_traffic_sources
  where workspace_id=p_workspace_id and source_import_id=p_import_id;
  get diagnostics v_traffic=row_count;

  delete from public.live_period_overview
  where workspace_id=p_workspace_id and source_import_id=p_import_id;
  get diagnostics v_overview=row_count;

  delete from public.live_session_performance
  where workspace_id=p_workspace_id and source_import_id=p_import_id;
  get diagnostics v_session_perf=row_count;

  delete from public.live_sessions s
  where s.workspace_id=p_workspace_id
    and s.source_import_id=p_import_id
    and not exists(
      select 1 from public.live_session_performance p
      where p.workspace_id=s.workspace_id and p.session_id=s.id
    );
  get diagnostics v_sessions=row_count;

  delete from public.live_imports
  where workspace_id=p_workspace_id and import_id=p_import_id;
  get diagnostics v_imports=row_count;

  if v_imports=0 then raise exception 'Import not found or already deleted'; end if;

  return jsonb_build_object(
    'ok',true,'import_id',p_import_id,
    'deleted',jsonb_build_object(
      'daily_performance',v_daily,
      'product_performance',v_product,
      'period_overview',v_overview,
      'traffic_sources',v_traffic,
      'session_performance',v_session_perf,
      'sessions',v_sessions,
      'import_history',v_imports
    )
  );
end
$$;

revoke all on function public.luma_delete_live_import_v1(uuid,text) from public,anon;
grant execute on function public.luma_delete_live_import_v1(uuid,text) to authenticated,service_role;


create or replace function public.luma_live_source_summary_v2(
  p_workspace_id uuid,
  p_start date,
  p_end date
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then raise exception 'Workspace access denied' using errcode='42501'; end if;

 with tt as (
   select count(*) days,
     coalesce(sum(gmv_attributed),0)::numeric gmv,
     coalesce(sum(gmv_direct),0)::numeric direct_gmv,
     coalesce(sum(gmv_indirect),0)::numeric indirect_gmv,
     coalesce(sum(sku_orders_attributed),0)::numeric orders,
     coalesce(sum(products_sold_attributed),0)::numeric qty,
     coalesce(sum(live_stream_count),0)::numeric live_streams_source,
     coalesce(sum(live_streams_with_gmv),0)::numeric live_streams_with_gmv,
     coalesce(sum(live_impressions),0)::numeric impressions,
     coalesce(avg(avg_watch_duration_seconds),0)::numeric avg_watch_duration_seconds
   from public.live_daily_performance
   where workspace_id=p_workspace_id and lower(platform)='tiktok'
     and metric_date between p_start and p_end
 ),
 sh_overview as (
   select count(*) source_count,
     coalesce(sum(gmv_created),0)::numeric gmv_created,
     coalesce(sum(gmv_ready_to_ship),0)::numeric gmv_ready,
     coalesce(sum(orders_created),0)::numeric orders_created,
     coalesce(sum(orders_ready_to_ship),0)::numeric orders_ready,
     coalesce(sum(qty_created),0)::numeric qty_created,
     coalesce(sum(qty_ready_to_ship),0)::numeric qty_ready,
     coalesce(sum(livestream_count),0)::numeric sessions,
     coalesce(sum(viewers),0)::numeric viewers,
     coalesce(sum(period_active_viewers),0)::numeric period_active_viewers,
     coalesce(sum(peak_viewers),0)::numeric peak_viewers
   from public.live_period_overview
   where workspace_id=p_workspace_id and lower(platform)='shopee'
     and period_start<=p_end and period_end>=p_start
 ),
 sh_session as (
   select count(distinct lsp.session_id)::numeric sessions,
     coalesce(sum(lsp.gmv_created),0)::numeric gmv_created,
     coalesce(sum(lsp.gmv_ready_to_ship),0)::numeric gmv_ready,
     coalesce(sum(lsp.orders_created),0)::numeric orders_created,
     coalesce(sum(lsp.orders_ready_to_ship),0)::numeric orders_ready,
     coalesce(sum(lsp.qty_created),0)::numeric qty_created,
     coalesce(sum(lsp.qty_ready_to_ship),0)::numeric qty_ready,
     coalesce(sum(lsp.viewers),0)::numeric viewers,
     coalesce(max(lsp.active_viewers),0)::numeric peak_active_viewers,
     coalesce(sum(lsp.duration_minutes),0)::numeric duration_minutes
   from public.live_session_performance lsp
   join public.live_sessions ls on ls.id=lsp.session_id and ls.workspace_id=lsp.workspace_id
   where lsp.workspace_id=p_workspace_id and lower(ls.platform)='shopee'
     and lsp.metric_date between p_start and p_end
 ),
 sh as (
   select
     case when o.source_count>0 then o.gmv_created else s.gmv_created end gmv_created,
     case when o.source_count>0 then o.gmv_ready else s.gmv_ready end gmv_ready,
     case when o.source_count>0 then o.orders_created else s.orders_created end orders_created,
     case when o.source_count>0 then o.orders_ready else s.orders_ready end orders_ready,
     case when o.source_count>0 then o.qty_created else s.qty_created end qty_created,
     case when o.source_count>0 then o.qty_ready else s.qty_ready end qty_ready,
     case when o.source_count>0 then o.sessions else s.sessions end sessions,
     case when o.source_count>0 then o.viewers else s.viewers end viewers,
     o.period_active_viewers,
     o.peak_viewers,
     s.duration_minutes,
     o.source_count>0 overview_used
   from sh_overview o cross join sh_session s
 )
 select jsonb_build_object(
   'tiktok',to_jsonb(tt),
   'shopee',to_jsonb(sh),
   'unified',jsonb_build_object(
     'gmv',tt.gmv+sh.gmv_created,
     'orders',tt.orders+sh.orders_created,
     'qty',tt.qty+sh.qty_created,
     'platforms_with_data',(case when tt.days>0 then 1 else 0 end)+(case when sh.sessions>0 or sh.gmv_created>0 then 1 else 0 end)
   )
 ) into v from tt cross join sh;
 return coalesce(v,'{}'::jsonb);
end
$$;

revoke all on function public.luma_live_source_summary_v2(uuid,date,date) from public,anon;
grant execute on function public.luma_live_source_summary_v2(uuid,date,date) to authenticated,service_role;


create or replace function public.luma_live_overview_v2(
  p_workspace_id uuid,
  p_start date,
  p_end date
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then raise exception 'Workspace access denied' using errcode='42501'; end if;

 with
 tk_daily as (
   select metric_date,
     coalesce(gmv_attributed,0)::numeric gmv,
     coalesce(sku_orders_attributed,0)::numeric orders,
     coalesce(products_sold_attributed,0)::numeric qty
   from public.live_daily_performance
   where workspace_id=p_workspace_id and lower(platform)='tiktok'
     and metric_date between p_start and p_end
 ),
 sh_daily as (
   select lsp.metric_date,
     coalesce(sum(lsp.gmv_created),0)::numeric gmv,
     coalesce(sum(lsp.orders_created),0)::numeric orders,
     coalesce(sum(lsp.qty_created),0)::numeric qty,
     coalesce(sum(lsp.duration_minutes),0)::numeric duration_minutes
   from public.live_session_performance lsp
   join public.live_sessions ls on ls.id=lsp.session_id and ls.workspace_id=lsp.workspace_id
   where lsp.workspace_id=p_workspace_id and lower(ls.platform)='shopee'
     and lsp.metric_date between p_start and p_end
   group by lsp.metric_date
 ),
 daily as (
   select d metric_date,
     coalesce((select sum(gmv) from tk_daily where metric_date=d),0)+coalesce((select sum(gmv) from sh_daily where metric_date=d),0) gmv,
     coalesce((select sum(orders) from tk_daily where metric_date=d),0)+coalesce((select sum(orders) from sh_daily where metric_date=d),0) orders
   from generate_series(p_start,p_end,interval '1 day') g(d)
   where exists(select 1 from tk_daily where metric_date=d) or exists(select 1 from sh_daily where metric_date=d)
 ),
 source as (
   select public.luma_live_source_summary_v2(p_workspace_id,p_start,p_end) j
 ),
 session_stats as (
   select
     count(*)::numeric total_sessions,
     count(*) filter(where status='completed')::numeric completed_sessions,
     coalesce(sum(ads_budget+host_cost+studio_cost+production_cost+other_cost),0)::numeric session_cost
   from public.live_sessions
   where workspace_id=p_workspace_id and session_date between p_start and p_end
 ),
 sh_viewers as (
   select
     coalesce(max(lsp.active_viewers),0)::numeric peak_viewers,
     coalesce(avg(nullif(lsp.active_viewers,0)),0)::numeric avg_viewers,
     coalesce(sum(lsp.duration_minutes),0)::numeric duration_minutes
   from public.live_session_performance lsp
   join public.live_sessions ls on ls.id=lsp.session_id and ls.workspace_id=lsp.workspace_id
   where lsp.workspace_id=p_workspace_id and lower(ls.platform)='shopee'
     and lsp.metric_date between p_start and p_end
 ),
 host_perf as (
   select h.id,h.name,h.username,h.host_type,
     coalesce(sum(p.gmv_created),0)::numeric gmv,
     coalesce(sum(p.orders_created),0)::numeric orders,
     coalesce(sum(p.duration_minutes),0)::numeric duration_minutes
   from public.live_hosts h
   left join public.live_sessions s on s.host_id=h.id and s.workspace_id=h.workspace_id
   left join public.live_session_performance p on p.session_id=s.id and p.workspace_id=s.workspace_id
     and p.metric_date between p_start and p_end
   where h.workspace_id=p_workspace_id
   group by h.id,h.name,h.username,h.host_type
   order by gmv desc limit 10
 ),
 totals as (
   select
     coalesce((src.j->'unified'->>'gmv')::numeric,0) gmv,
     coalesce((src.j->'unified'->>'orders')::numeric,0) orders,
     coalesce((src.j->'unified'->>'qty')::numeric,0) qty,
     sv.peak_viewers,sv.avg_viewers,sv.duration_minutes,
     ss.session_cost,total_sessions,completed_sessions
   from source src cross join sh_viewers sv cross join session_stats ss
 )
 select jsonb_build_object(
   'totals',jsonb_build_object(
     'gmv',t.gmv,'orders',t.orders,'qty',t.qty,
     'peak_viewers',t.peak_viewers,'avg_viewers',round(t.avg_viewers,2),
     'duration_minutes',t.duration_minutes,
     'revenue_per_hour',case when t.duration_minutes>0 then round(t.gmv/(t.duration_minutes/60),2) else 0 end,
     'orders_per_hour',case when t.duration_minutes>0 then round(t.orders/(t.duration_minutes/60),2) else 0 end,
     'total_cost',t.session_cost,'contribution_margin',t.gmv-t.session_cost
   ),
   'sessions',jsonb_build_object('total',t.total_sessions,'completed',t.completed_sessions),
   'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.metric_date) from daily d),'[]'::jsonb),
   'hosts',coalesce((select jsonb_agg(to_jsonb(h)) from host_perf h),'[]'::jsonb),
   'source_summary',(select j from source)
 ) into v from totals t;
 return coalesce(v,'{}'::jsonb);
end
$$;

revoke all on function public.luma_live_overview_v2(uuid,date,date) from public,anon;
grant execute on function public.luma_live_overview_v2(uuid,date,date) to authenticated,service_role;


create or replace function public.luma_live_analytics_v2(
  p_workspace_id uuid,
  p_start date,
  p_end date
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then raise exception 'Workspace access denied' using errcode='42501'; end if;

 with
 tk as (
   select metric_date,
     coalesce(gmv_attributed,0)::numeric gmv,
     coalesce(sku_orders_attributed,0)::numeric orders,
     coalesce(products_sold_attributed,0)::numeric qty
   from public.live_daily_performance
   where workspace_id=p_workspace_id and lower(platform)='tiktok'
     and metric_date between p_start and p_end
 ),
 sh as (
   select lsp.metric_date,
     coalesce(sum(lsp.gmv_created),0)::numeric gmv,
     coalesce(sum(lsp.orders_created),0)::numeric orders,
     coalesce(sum(lsp.qty_created),0)::numeric qty,
     coalesce(sum(lsp.duration_minutes),0)::numeric duration_minutes
   from public.live_session_performance lsp
   join public.live_sessions ls on ls.id=lsp.session_id and ls.workspace_id=lsp.workspace_id
   where lsp.workspace_id=p_workspace_id and lower(ls.platform)='shopee'
     and lsp.metric_date between p_start and p_end
   group by lsp.metric_date
 ),
 by_day as (
   select d metric_date,
     coalesce((select sum(gmv) from tk where metric_date=d),0)+coalesce((select sum(gmv) from sh where metric_date=d),0) gmv,
     coalesce((select sum(orders) from tk where metric_date=d),0)+coalesce((select sum(orders) from sh where metric_date=d),0) orders,
     0::numeric avg_viewers,
     coalesce((select sum(duration_minutes) from sh where metric_date=d),0) duration_minutes
   from generate_series(p_start,p_end,interval '1 day') g(d)
   where exists(select 1 from tk where metric_date=d) or exists(select 1 from sh where metric_date=d)
 ),
 sh_perf as (
   select p.*,s.host_id,s.gimmick,s.platform,s.title,h.name host_name,h.username host_username
   from public.live_session_performance p
   join public.live_sessions s on s.id=p.session_id and s.workspace_id=p.workspace_id
   left join public.live_hosts h on h.id=s.host_id and h.workspace_id=s.workspace_id
   where p.workspace_id=p_workspace_id and lower(s.platform)='shopee'
     and p.metric_date between p_start and p_end
 ),
 by_hour as (
   select hour_bucket,coalesce(sum(gmv_created),0) gmv,coalesce(sum(orders_created),0) orders,
     coalesce(avg(nullif(active_viewers,0)),0) avg_viewers,coalesce(sum(duration_minutes),0) duration_minutes
   from sh_perf where hour_bucket is not null group by hour_bucket order by hour_bucket
 ),
 by_host as (
   select host_id,coalesce(host_name,'Belum di-assign') host_name,coalesce(host_username,'') host_username,
     coalesce(sum(gmv_created),0) gmv,coalesce(sum(orders_created),0) orders,coalesce(sum(qty_created),0) qty,
     coalesce(sum(duration_minutes),0) duration_minutes,coalesce(avg(nullif(active_viewers,0)),0) avg_viewers
   from sh_perf group by host_id,host_name,host_username order by gmv desc
 ),
 by_gimmick as (
   select coalesce(nullif(trim(gimmick),''),'Tanpa Gimmick') gimmick,
     coalesce(sum(gmv_created),0) gmv,coalesce(sum(orders_created),0) orders,
     coalesce(avg(nullif(active_viewers,0)),0) avg_viewers,coalesce(sum(duration_minutes),0) duration_minutes
   from sh_perf group by coalesce(nullif(trim(gimmick),''),'Tanpa Gimmick') order by gmv desc
 ),
 source as (
   select public.luma_live_source_summary_v2(p_workspace_id,p_start,p_end) j
 ),
 by_platform as (
   select 'Shopee'::text platform,coalesce((j->'shopee'->>'gmv_created')::numeric,0) gmv,coalesce((j->'shopee'->>'orders_created')::numeric,0) orders from source
   union all
   select 'TikTok',coalesce((j->'tiktok'->>'gmv')::numeric,0),coalesce((j->'tiktok'->>'orders')::numeric,0) from source
 ),
 by_session as (
   select p.session_id,max(p.title) title,max(p.host_name) host_name,max(p.gimmick) gimmick,
     coalesce(sum(p.gmv_created),0) gmv,coalesce(sum(p.orders_created),0) orders,coalesce(sum(p.qty_created),0) qty,
     coalesce(max(p.active_viewers),0) peak_viewers,coalesce(avg(nullif(p.active_viewers,0)),0) avg_viewers,
     coalesce(sum(p.duration_minutes),0) duration_minutes
   from sh_perf p group by p.session_id order by gmv desc limit 50
 )
 select jsonb_build_object(
   'by_day',coalesce((select jsonb_agg(to_jsonb(x) order by x.metric_date) from by_day x),'[]'::jsonb),
   'by_hour',coalesce((select jsonb_agg(to_jsonb(x)) from by_hour x),'[]'::jsonb),
   'by_host',coalesce((select jsonb_agg(to_jsonb(x)) from by_host x),'[]'::jsonb),
   'by_gimmick',coalesce((select jsonb_agg(to_jsonb(x)) from by_gimmick x),'[]'::jsonb),
   'by_platform',coalesce((select jsonb_agg(to_jsonb(x) order by x.gmv desc) from by_platform x where x.gmv<>0 or x.orders<>0),'[]'::jsonb),
   'by_session',coalesce((select jsonb_agg(to_jsonb(x)) from by_session x),'[]'::jsonb)
 ) into v;
 return coalesce(v,'{}'::jsonb);
end
$$;

revoke all on function public.luma_live_analytics_v2(uuid,date,date) from public,anon;
grant execute on function public.luma_live_analytics_v2(uuid,date,date) to authenticated,service_role;


create or replace function public.luma_live_source_truth_qc_v1(
  p_workspace_id uuid,
  p_start date,
  p_end date
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare rec jsonb; summary jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then raise exception 'Workspace access denied' using errcode='42501'; end if;

 rec:=public.luma_live_reconciliation_v1(p_workspace_id,p_start,p_end);
 summary:=public.luma_live_source_summary_v2(p_workspace_id,p_start,p_end);

 return jsonb_build_object(
   'range',jsonb_build_object('start',p_start,'end',p_end),
   'canonical',summary,
   'reconciliation',rec,
   'expected_semantics',jsonb_build_object(
      'shopee_period','Overview when available; Session fallback',
      'shopee_session','Session List for per-session/per-day',
      'shopee_product','Product List for product attribution only',
      'tiktok','Daily Core Stats; attributed is primary'
   ),
   'status',case
     when coalesce((rec->'imports'->>'failed')::int,0)>0 or coalesce((rec->'imports'->>'partial')::int,0)>0 then 'REVIEW'
     when exists(select 1 from jsonb_array_elements(coalesce(rec->'shopee'->'checks','[]'::jsonb)) x where x->>'status'='DIFFERENCE')
       or exists(select 1 from jsonb_array_elements(coalesce(rec->'tiktok'->'checks','[]'::jsonb)) x where x->>'status'='DIFFERENCE')
       then 'DIFFERENCE'
     else 'EXACT'
   end,
   'checked_at',now()
 );
end
$$;

revoke all on function public.luma_live_source_truth_qc_v1(uuid,date,date) from public,anon;
grant execute on function public.luma_live_source_truth_qc_v1(uuid,date,date) to authenticated,service_role;


create or replace function public.luma_live_campaign_overview_v2(
  p_workspace_id uuid,
  p_start date,
  p_end date
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then raise exception 'Workspace access denied' using errcode='42501'; end if;

  with session_perf as (
    select s.id session_id,s.campaign_id,s.campaign_name,
      coalesce(nullif(trim(s.gimmick),''),nullif(trim(s.title),''),'Tanpa Gimmick') gimmick_label,
      s.session_date,s.status,s.target_gmv,s.target_orders,s.ads_budget,s.host_cost,s.studio_cost,s.production_cost,s.other_cost,
      coalesce(sum(p.gmv_created),0) gmv,coalesce(sum(p.orders_created),0) orders,coalesce(sum(p.qty_created),0) qty,
      coalesce(sum(p.duration_minutes),0) duration_minutes,
      coalesce(avg(nullif(p.active_viewers,0)),0) avg_viewers
    from public.live_sessions s
    left join public.live_session_performance p on p.session_id=s.id and p.workspace_id=s.workspace_id
      and p.metric_date between p_start and p_end
    where s.workspace_id=p_workspace_id and s.session_date between p_start and p_end
    group by s.id
  ),
  campaigns as (
    select c.id,c.name,c.start_date,c.end_date,c.target_gmv,c.target_orders,c.budget,c.status,
      count(sp.session_id) sessions,coalesce(sum(sp.gmv),0) gmv,coalesce(sum(sp.orders),0) orders,
      coalesce(sum(sp.ads_budget+sp.host_cost+sp.studio_cost+sp.production_cost+sp.other_cost),0) actual_cost
    from public.live_campaigns c
    left join session_perf sp on sp.campaign_id=c.id or (sp.campaign_id is null and lower(sp.campaign_name)=lower(c.name))
    where c.workspace_id=p_workspace_id
      and c.start_date<=p_end and c.end_date>=p_start
    group by c.id
    order by gmv desc
  ),
  gimmicks as (
    select gimmick_label gimmick,count(*) sessions,coalesce(sum(gmv),0) gmv,coalesce(sum(orders),0) orders,
      coalesce(avg(nullif(avg_viewers,0)),0) avg_viewers,
      case when sum(duration_minutes)>0 then round(sum(gmv)/(sum(duration_minutes)/60),2) else 0 end revenue_per_hour
    from session_perf
    group by gimmick_label
    order by gmv desc
  )
  select jsonb_build_object(
    'campaigns',coalesce((select jsonb_agg(to_jsonb(c)) from campaigns c),'[]'::jsonb),
    'gimmicks',coalesce((select jsonb_agg(to_jsonb(g)) from gimmicks g),'[]'::jsonb)
  ) into v;
  return coalesce(v,'{}'::jsonb);
end
$$;

revoke all on function public.luma_live_campaign_overview_v2(uuid,date,date) from public,anon;
grant execute on function public.luma_live_campaign_overview_v2(uuid,date,date) to authenticated,service_role;
