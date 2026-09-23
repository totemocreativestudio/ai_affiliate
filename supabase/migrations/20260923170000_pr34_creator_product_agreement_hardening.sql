-- PR34 shared hardening for all existing and future workspaces.

alter table public.agreements
  add column if not exists creator_id bigint references public.creators(id) on delete set null,
  add column if not exists product_master_id bigint references public.product_master(id) on delete set null,
  add column if not exists product_hpp numeric not null default 0,
  add column if not exists e_stamp_id text,
  add column if not exists signed_by_name text,
  add column if not exists signed_at timestamptz,
  add column if not exists pdf_generated_at timestamptz;

alter table public.listings
  add column if not exists product_hpp numeric not null default 0;

create unique index if not exists uq_agreements_workspace_estamp
  on public.agreements(workspace_id,e_stamp_id) where e_stamp_id is not null;
create index if not exists idx_agreements_workspace_creator
  on public.agreements(workspace_id,creator_id);

create index if not exists idx_sales_perf_workspace_username
  on public.sales(workspace_id, lower(platform), lower(username))
  where data_type='performance' and username is not null;
create index if not exists idx_sales_perf_workspace_creator_name
  on public.sales(workspace_id, lower(platform), lower(creator_name))
  where data_type='performance' and creator_name is not null;
create index if not exists idx_creators_workspace_platform_username
  on public.creators(workspace_id, lower(platform), lower(username))
  where username is not null;
create index if not exists idx_creators_workspace_platform_name
  on public.creators(workspace_id, lower(platform), lower(name))
  where name is not null;

update public.agreements a
set creator_id=c.id
from public.creators c
where a.creator_id is null
  and a.workspace_id=c.workspace_id
  and lower(coalesce(a.platform,''))=lower(coalesce(c.platform,''))
  and (lower(coalesce(a.creator_name,''))=lower(coalesce(c.name,''))
    or lower(coalesce(a.creator_name,''))=lower(coalesce(c.username,'')));

-- Repair rows imported before PR34 where a GMV header was incorrectly inferred as a count.
update public.sales s set live_count=0
where s.data_type='performance' and coalesce(s.live_count,0)<>0
  and exists(select 1 from public.imports i
    where i.workspace_id=s.workspace_id and i.import_id=s.import_id
      and coalesce(i.message,'') like '%"liveCount":"Affiliate LIVE GMV"%');

update public.sales s set live_count=0
where s.data_type='performance' and coalesce(s.live_count,0)>1000
  and exists(select 1 from public.imports i
    where i.workspace_id=s.workspace_id and i.import_id=s.import_id
      and coalesce(i.message,'') not like '%universal-v10-pr34%');

update public.sales s set refund_qty=0
where s.data_type='performance' and coalesce(s.refund_qty,0)<>0
  and exists(select 1 from public.imports i
    where i.workspace_id=s.workspace_id and i.import_id=s.import_id
      and coalesce(i.message,'') like '%"refundQty":"Items sold"%');

create or replace function public.luma_sync_workspace_creator_master_internal(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_inserted bigint:=0; v_linked bigint:=0;
begin
  with source as (
    select distinct s.workspace_id,coalesce(nullif(s.platform,''),'Other') platform,
      nullif(s.creator_name,'') creator_name,nullif(s.username,'') username
    from public.sales s
    where s.workspace_id=p_workspace_id and s.data_type='performance'
      and coalesce(nullif(s.username,''),nullif(s.creator_name,'')) is not null
  ), missing as (
    select src.* from source src where not exists (
      select 1 from public.creators c
      where c.workspace_id=src.workspace_id
        and lower(coalesce(c.platform,''))=lower(src.platform)
        and ((src.username is not null and lower(coalesce(c.username,''))=lower(src.username))
          or (src.creator_name is not null and lower(coalesce(c.name,''))=lower(src.creator_name)))
    )
  ), ins as (
    insert into public.creators(workspace_id,creator_code,name,username,platform,status,updated_at)
    select m.workspace_id,
      'CR-AUTO-'||upper(substr(md5(m.workspace_id::text||'|'||m.platform||'|'||coalesce(m.username,m.creator_name,'')),1,16)),
      coalesce(m.creator_name,m.username),coalesce(m.username,m.creator_name),m.platform,'Active',now()
    from missing m on conflict (creator_code) do nothing returning 1
  ) select count(*) into v_inserted from ins;

  with upd as (
    update public.sales s set creator_id=c.id
    from public.creators c
    where s.workspace_id=p_workspace_id and s.creator_id is null and s.data_type='performance'
      and c.workspace_id=s.workspace_id and lower(coalesce(c.platform,''))=lower(coalesce(s.platform,''))
      and ((nullif(s.username,'') is not null and lower(coalesce(c.username,''))=lower(s.username))
        or (nullif(s.creator_name,'') is not null and lower(coalesce(c.name,''))=lower(s.creator_name)))
    returning 1
  ) select count(*) into v_linked from upd;
  return jsonb_build_object('inserted',v_inserted,'linked_sales',v_linked);
end
$function$;

create or replace function public.luma_sync_workspace_creator_master(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not (public.luma_is_admin() or exists(
    select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()
  )) then raise exception 'Workspace access denied' using errcode='42501'; end if;
  return public.luma_sync_workspace_creator_master_internal(p_workspace_id);
end
$function$;

revoke all on function public.luma_sync_workspace_creator_master_internal(uuid) from public,anon,authenticated;
grant execute on function public.luma_sync_workspace_creator_master_internal(uuid) to service_role;
revoke all on function public.luma_sync_workspace_creator_master(uuid) from public,anon;
grant execute on function public.luma_sync_workspace_creator_master(uuid) to authenticated;

create or replace function public.get_creator_ranking_summary(
  p_workspace_id uuid,p_start_date date default null,p_end_date date default null,p_platform text default null
)
returns table(total_creators bigint,active_creators bigint)
language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not (public.luma_is_admin() or exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()))
  then raise exception 'Workspace access denied' using errcode='42501'; end if;
  return query select count(distinct s.creator_id)::bigint,
    count(distinct s.creator_id) filter(where coalesce(s.gmv,0)<>0 or coalesce(s.orders,0)<>0 or coalesce(s.qty,0)<>0 or coalesce(s.commission,0)<>0)::bigint
  from public.sales s
  where s.workspace_id=p_workspace_id and s.data_type in ('performance','sales') and s.creator_id is not null
    and (p_start_date is null or s.data_date>=p_start_date)
    and (p_end_date is null or s.data_date<=p_end_date)
    and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform));
end
$function$;
revoke all on function public.get_creator_ranking_summary(uuid,date,date,text) from public,anon;
grant execute on function public.get_creator_ranking_summary(uuid,date,date,text) to authenticated;

create or replace function public.get_dashboard_metrics_v4(
  p_workspace_id uuid,p_start_date date default null,p_end_date date default null,p_platform text default null
)
returns table(
  total_creators bigint,total_sales_records bigint,total_qty numeric,total_orders numeric,total_gmv numeric,total_commission numeric,
  total_products bigint,total_cost_product numeric,total_shipping numeric,total_ads_spend numeric,total_spend numeric,roi numeric,
  aov numeric,avg_daily_creator_sales numeric,referral_commission numeric,total_live_streams numeric,total_videos numeric
)
language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not (public.luma_is_admin() or exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()))
  then raise exception 'Workspace access denied' using errcode='42501'; end if;
  return query
  with affiliate_base as (
    select s.* from public.sales s where s.workspace_id=p_workspace_id and s.data_type in ('performance','sales')
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform))
  ), product_count as (
    select count(distinct nullif(coalesce(s.sku,s.product_name),''))::bigint products from public.sales s
    where s.workspace_id=p_workspace_id and s.data_type in ('product_performance','sales')
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform))
  ), agg as (
    select count(distinct creator_id) filter(where coalesce(gmv,0)<>0 or coalesce(orders,0)<>0 or coalesce(qty,0)<>0 or coalesce(commission,0)<>0)::bigint active_creators,
      count(*)::bigint rows,coalesce(sum(qty),0) qty,coalesce(sum(orders),0) orders,coalesce(sum(gmv),0) gmv,
      coalesce(sum(commission),0) commission,coalesce(sum(cost_product),0) cost_product,coalesce(sum(shipping_cost),0) shipping,
      coalesce(sum(live_count),0) live_streams,coalesce(sum(video_count),0) videos,
      count(distinct data_date) filter(where data_date is not null) days from affiliate_base
  ), ads_support as (
    select coalesce(max(a.amount),0)::numeric amount from public.affiliate_ads_support a
    where a.workspace_id=p_workspace_id and p_start_date is not null and p_end_date is not null
      and a.start_date=p_start_date and a.end_date=p_end_date
      and lower(a.platform)=lower(coalesce(nullif(p_platform,''),'ALL'))
  ), ref as (
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
$function$;
revoke all on function public.get_dashboard_metrics_v4(uuid,date,date,text) from public,anon;
grant execute on function public.get_dashboard_metrics_v4(uuid,date,date,text) to authenticated;

create or replace function public.luma_sync_agreement_creator_status()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
begin
  if new.creator_id is not null and new.workspace_id is not null then
    insert into public.creator_360_profiles(workspace_id,creator_id,program_status,updated_at)
    values(new.workspace_id,new.creator_id,'Active',now())
    on conflict(workspace_id,creator_id) do update set program_status='Active',updated_at=now();
  end if;
  return new;
end
$function$;
drop trigger if exists trg_agreement_creator_status on public.agreements;
create trigger trg_agreement_creator_status
after insert or update of creator_id,document_status,support_status on public.agreements
for each row execute function public.luma_sync_agreement_creator_status();

insert into public.creator_360_profiles(workspace_id,creator_id,program_status,updated_at)
select distinct a.workspace_id,a.creator_id,'Active',now() from public.agreements a
where a.workspace_id is not null and a.creator_id is not null
on conflict(workspace_id,creator_id) do update set program_status='Active',updated_at=now();
