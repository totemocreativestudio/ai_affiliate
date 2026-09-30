-- PR77B: Automatically sync Campaign Tracker creator performance from Affiliate Performance sales

alter table public.campaign_tracker_creators
  add column if not exists performance_source text not null default 'auto',
  add column if not exists performance_synced_at timestamptz;

create index if not exists idx_sales_campaign_sync
  on public.sales(workspace_id,creator_id,data_date,platform,sku)
  where data_type='performance' and creator_id is not null;

create or replace function public.luma_sync_campaign_performance_v1(
  p_workspace_id uuid,
  p_campaign_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_campaign public.campaign_trackers%rowtype;
  v_rows integer:=0;
  v_gmv numeric:=0;
  v_orders numeric:=0;
  v_commission numeric:=0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not public.luma_has_workspace(p_workspace_id) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  select * into v_campaign
  from public.campaign_trackers
  where id=p_campaign_id and workspace_id=p_workspace_id;

  if not found then
    raise exception 'Campaign not found';
  end if;

  with aggregates as (
    select
      ctc.id,
      coalesce(sum(s.orders),0)::numeric as orders,
      coalesce(sum(s.gmv),0)::numeric as gmv,
      coalesce(sum(s.commission),0)::numeric as commission
    from public.campaign_tracker_creators ctc
    left join public.sales s
      on s.workspace_id=ctc.workspace_id
     and s.data_type='performance'
     and s.creator_id=ctc.creator_id
     and s.data_date between coalesce(v_campaign.start_date,v_campaign.created_at::date)
                         and coalesce(v_campaign.end_date,current_date)
     and (
       nullif(trim(coalesce(ctc.platform,'')),'') is null
       or lower(trim(coalesce(s.platform,'')))=lower(trim(ctc.platform))
     )
     and (
       nullif(trim(coalesce(ctc.sku,'')),'') is null
       or lower(trim(coalesce(s.sku,'')))=lower(trim(ctc.sku))
       or lower(trim(coalesce(s.product_code,'')))=lower(trim(ctc.sku))
     )
    where ctc.workspace_id=p_workspace_id
      and ctc.campaign_id=p_campaign_id
      and ctc.creator_id is not null
      and coalesce(ctc.performance_source,'auto')='auto'
    group by ctc.id
  )
  update public.campaign_tracker_creators ctc
  set
    orders=a.orders,
    gmv=a.gmv,
    commission=a.commission,
    performance_synced_at=now(),
    updated_at=now()
  from aggregates a
  where ctc.id=a.id;

  get diagnostics v_rows = row_count;

  select
    coalesce(sum(orders),0),
    coalesce(sum(gmv),0),
    coalesce(sum(commission),0)
  into v_orders,v_gmv,v_commission
  from public.campaign_tracker_creators
  where workspace_id=p_workspace_id and campaign_id=p_campaign_id;

  update public.campaign_trackers
  set actual_orders=v_orders,actual_gmv=v_gmv,updated_at=now()
  where id=p_campaign_id and workspace_id=p_workspace_id;

  return jsonb_build_object(
    'ok',true,
    'campaign_id',p_campaign_id,
    'synced_creator_rows',v_rows,
    'actual_orders',v_orders,
    'actual_gmv',v_gmv,
    'commission',v_commission,
    'synced_at',now()
  );
end
$$;

revoke all on function public.luma_sync_campaign_performance_v1(uuid,bigint) from public,anon;
grant execute on function public.luma_sync_campaign_performance_v1(uuid,bigint) to authenticated;

comment on column public.campaign_tracker_creators.performance_source is
'auto = GMV/orders/commission synchronized from sales Affiliate Performance; manual = user-entered override.';
comment on column public.campaign_tracker_creators.performance_synced_at is
'Last successful automatic performance synchronization timestamp.';
