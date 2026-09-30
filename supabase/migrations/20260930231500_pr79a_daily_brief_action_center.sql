-- PR79A: Daily Brief & Action Center

create table if not exists public.luma_action_items (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_type text,
  source_id text,
  title text not null,
  description text,
  severity text not null default 'normal' check(severity in ('low','normal','high','urgent')),
  status text not null default 'open' check(status in ('open','in_progress','done','dismissed')),
  due_date date,
  action_route text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_luma_action_items_workspace_status
  on public.luma_action_items(workspace_id,status,due_date,updated_at desc);

alter table public.luma_action_items enable row level security;

drop policy if exists luma_action_items_workspace_select on public.luma_action_items;
create policy luma_action_items_workspace_select
on public.luma_action_items for select to authenticated
using (public.luma_has_workspace(workspace_id));

drop policy if exists luma_action_items_workspace_insert on public.luma_action_items;
create policy luma_action_items_workspace_insert
on public.luma_action_items for insert to authenticated
with check (public.luma_has_workspace(workspace_id));

drop policy if exists luma_action_items_workspace_update on public.luma_action_items;
create policy luma_action_items_workspace_update
on public.luma_action_items for update to authenticated
using (public.luma_has_workspace(workspace_id))
with check (public.luma_has_workspace(workspace_id));

drop policy if exists luma_action_items_workspace_delete on public.luma_action_items;
create policy luma_action_items_workspace_delete
on public.luma_action_items for delete to authenticated
using (public.luma_has_workspace(workspace_id));

create or replace function public.luma_daily_brief_v1(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_latest date;
  v_prev date;
  v_gmv numeric:=0;
  v_prev_gmv numeric:=0;
  v_orders numeric:=0;
  v_prev_orders numeric:=0;
  v_campaigns bigint:=0;
  v_campaign_due bigint:=0;
  v_samples bigint:=0;
  v_shipping bigint:=0;
  v_hpp bigint:=0;
  v_listings bigint:=0;
  v_actions jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not public.luma_has_workspace(p_workspace_id) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  select max(data_date) into v_latest
  from public.sales
  where workspace_id=p_workspace_id
    and data_type in ('performance','sales');

  if v_latest is null then v_latest:=current_date; end if;

  select max(data_date) into v_prev
  from public.sales
  where workspace_id=p_workspace_id
    and data_type in ('performance','sales')
    and data_date<v_latest;

  select coalesce(sum(gmv),0),coalesce(sum(orders),0)
  into v_gmv,v_orders
  from public.sales
  where workspace_id=p_workspace_id
    and data_type in ('performance','sales')
    and data_date=v_latest;

  if v_prev is not null then
    select coalesce(sum(gmv),0),coalesce(sum(orders),0)
    into v_prev_gmv,v_prev_orders
    from public.sales
    where workspace_id=p_workspace_id
      and data_type in ('performance','sales')
      and data_date=v_prev;
  end if;

  select count(*) into v_campaigns
  from public.campaign_trackers
  where workspace_id=p_workspace_id and lower(coalesce(status,''))='active';

  select count(*) into v_campaign_due
  from public.campaign_tracker_creators ctc
  join public.campaign_trackers c on c.id=ctc.campaign_id and c.workspace_id=ctc.workspace_id
  where ctc.workspace_id=p_workspace_id
    and lower(coalesce(c.status,''))='active'
    and ctc.due_date is not null
    and ctc.due_date<=current_date+interval '3 day'
    and lower(coalesce(ctc.deliverable_status,'')) not in ('closed','live finished','video uploaded');

  select count(*) into v_samples
  from public.creator_samples
  where workspace_id=p_workspace_id
    and lower(coalesce(sample_status,'')) in ('sent','received','content_pending','pending')
    and coalesce(sent_date,current_date)<=current_date-interval '3 day';

  select count(*) into v_shipping
  from public.shipping
  where workspace_id=p_workspace_id
    and lower(coalesce(status,'')) not in ('delivered','completed','cancelled','canceled')
    and (
      nullif(trim(coalesce(tracking,'')),'') is null
      or coalesce(shipped_at,data_date,current_date)<=current_date-interval '5 day'
    );

  select count(*) into v_hpp
  from public.product_master
  where workspace_id=p_workspace_id
    and coalesce(cost_price,0)<=0
    and lower(coalesce(status,'active'))<>'inactive';

  select count(*) into v_listings
  from public.listings
  where workspace_id=p_workspace_id
    and lower(coalesce(stage,'')) not in ('closed','done','completed','rejected')
    and updated_at<now()-interval '3 day';

  with candidates as (
    select 1 priority,'campaign' source_type,ctc.id::text source_id,
      'Campaign mendekati deadline' title,
      coalesce(ctc.creator_name,'Creator')||' · '||coalesce(c.name,'Campaign')||' · due '||to_char(ctc.due_date,'DD Mon') description,
      case when ctc.due_date<current_date then 'urgent' else 'high' end severity,
      'campaign-tracker' action_route,
      ctc.due_date due_date
    from public.campaign_tracker_creators ctc
    join public.campaign_trackers c on c.id=ctc.campaign_id and c.workspace_id=ctc.workspace_id
    where ctc.workspace_id=p_workspace_id
      and lower(coalesce(c.status,''))='active'
      and ctc.due_date is not null
      and ctc.due_date<=current_date+interval '3 day'
      and lower(coalesce(ctc.deliverable_status,'')) not in ('closed','live finished','video uploaded')
    union all
    select 2,'sample',cs.id::text,'Sample perlu follow up',
      coalesce(cs.creator_name,'Creator')||' · '||coalesce(cs.product_name,cs.sku,'Produk')||
        ' · '||coalesce(cs.sample_status,'Pending'),
      'high','creator-samples',coalesce(cs.return_date,current_date)
    from public.creator_samples cs
    where cs.workspace_id=p_workspace_id
      and lower(coalesce(cs.sample_status,'')) in ('sent','received','content_pending','pending')
      and coalesce(cs.sent_date,current_date)<=current_date-interval '3 day'
    union all
    select 3,'shipping',s.id::text,'Shipping perlu perhatian',
      coalesce(s.creator_name,'Creator')||' · '||coalesce(s.tracking,'Resi belum tersedia')||
        ' · '||coalesce(s.status,'Pending'),
      case when nullif(trim(coalesce(s.tracking,'')),'') is null then 'high' else 'normal' end,
      'shipping',coalesce(s.shipped_at,s.data_date,current_date)
    from public.shipping s
    where s.workspace_id=p_workspace_id
      and lower(coalesce(s.status,'')) not in ('delivered','completed','cancelled','canceled')
      and (nullif(trim(coalesce(s.tracking,'')),'') is null or coalesce(s.shipped_at,s.data_date,current_date)<=current_date-interval '5 day')
    union all
    select 4,'product',p.id::text,'HPP produk belum lengkap',
      coalesce(p.sku,'SKU')||' · '||coalesce(p.product_name,'Nama produk belum tersedia'),
      'normal','product-master',current_date
    from public.product_master p
    where p.workspace_id=p_workspace_id and coalesce(p.cost_price,0)<=0 and lower(coalesce(p.status,'active'))<>'inactive'
    union all
    select 5,'listing',l.id::text,'Listing belum ditindaklanjuti',
      coalesce(l.creator_name,'Creator')||' · '||coalesce(l.stage,'No stage')||
        case when nullif(trim(coalesce(l.next_action,'')),'') is not null then ' · '||l.next_action else '' end,
      'normal','listings',coalesce(l.posting_date,l.data_date,current_date)
    from public.listings l
    where l.workspace_id=p_workspace_id
      and lower(coalesce(l.stage,'')) not in ('closed','done','completed','rejected')
      and l.updated_at<now()-interval '3 day'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'source_type',source_type,'source_id',source_id,'title',title,'description',description,
    'severity',severity,'action_route',action_route,'due_date',due_date
  ) order by priority,due_date asc nulls last),'[]'::jsonb)
  into v_actions
  from (select * from candidates order by priority,due_date asc nulls last limit 12) q;

  return jsonb_build_object(
    'generated_at',now(),
    'latest_data_date',v_latest,
    'previous_data_date',v_prev,
    'performance',jsonb_build_object(
      'gmv',v_gmv,'previous_gmv',v_prev_gmv,
      'gmv_change_pct',case when v_prev_gmv<>0 then round(((v_gmv-v_prev_gmv)/v_prev_gmv)*100,2) else null end,
      'orders',v_orders,'previous_orders',v_prev_orders,
      'orders_change_pct',case when v_prev_orders<>0 then round(((v_orders-v_prev_orders)/v_prev_orders)*100,2) else null end
    ),
    'attention',jsonb_build_object(
      'active_campaigns',v_campaigns,
      'campaign_due',v_campaign_due,
      'samples_followup',v_samples,
      'shipping_attention',v_shipping,
      'products_missing_hpp',v_hpp,
      'stale_listings',v_listings
    ),
    'actions',v_actions
  );
end
$$;

revoke all on function public.luma_daily_brief_v1(uuid) from public,anon;
grant execute on function public.luma_daily_brief_v1(uuid) to authenticated,service_role;

comment on function public.luma_daily_brief_v1(uuid) is
'Workspace-scoped daily operational briefing across performance, campaigns, samples, shipping, product HPP and listings.';
