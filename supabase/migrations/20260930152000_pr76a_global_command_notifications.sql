-- PR76A: Global Command Center + operational notifications
alter table public.user_notifications
  add column if not exists dedupe_key text;

create unique index if not exists uq_user_notifications_dedupe
  on public.user_notifications(user_id, workspace_id, dedupe_key)
  where dedupe_key is not null;

create or replace function public.luma_global_search_v1(
  p_workspace_id uuid,
  p_query text,
  p_limit integer default 24
)
returns table(
  entity_type text,
  entity_id bigint,
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
  v_limit integer:=least(greatest(coalesce(p_limit,24),1),40);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not public.luma_has_workspace(p_workspace_id) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;
  if length(v_query)<2 then
    return;
  end if;

  return query
  select x.entity_type,x.entity_id,x.title,x.subtitle,x.meta,x.section,x.score
  from (
    select
      'creator'::text,
      c.id::bigint,
      coalesce(nullif(c.name,''),nullif(c.username,''),nullif(c.creator_code,''),'Creator')::text,
      concat_ws(' · ',nullif(c.username,''),nullif(c.affiliate_id,''))::text,
      concat_ws(' · ',nullif(c.platform,''),nullif(c.status,''))::text,
      'listings'::text,
      case
        when lower(coalesce(c.username,''))=v_query or lower(coalesce(c.creator_code,''))=v_query then 1
        when lower(coalesce(c.name,''))=v_query then 2
        else 8
      end::integer
    from public.creators c
    where c.workspace_id=p_workspace_id
      and (
        lower(coalesce(c.name,'')) like '%'||v_query||'%'
        or lower(coalesce(c.username,'')) like '%'||v_query||'%'
        or lower(coalesce(c.creator_code,'')) like '%'||v_query||'%'
        or lower(coalesce(c.affiliate_id,'')) like '%'||v_query||'%'
      )
    limit 10

    union all

    select
      'product'::text,
      p.id::bigint,
      coalesce(nullif(p.product_name,''),p.sku,'Product')::text,
      p.sku::text,
      concat_ws(' · ',nullif(p.category,''),nullif(p.status,''))::text,
      'product-master'::text,
      case when lower(coalesce(p.sku,''))=v_query then 1 when lower(coalesce(p.product_name,''))=v_query then 2 else 9 end::integer
    from public.product_master p
    where p.workspace_id=p_workspace_id
      and (
        lower(coalesce(p.sku,'')) like '%'||v_query||'%'
        or lower(coalesce(p.product_name,'')) like '%'||v_query||'%'
        or lower(coalesce(p.category,'')) like '%'||v_query||'%'
      )
    limit 8

    union all

    select
      'campaign'::text,
      c.id::bigint,
      c.name::text,
      concat_ws(' · ',nullif(c.brand_name,''),nullif(c.campaign_type,''))::text,
      concat_ws(' · ',nullif(c.platform,''),nullif(c.status,''))::text,
      'campaign-tracker'::text,
      case when lower(c.name)=v_query then 2 else 10 end::integer
    from public.campaign_trackers c
    where c.workspace_id=p_workspace_id
      and (
        lower(coalesce(c.name,'')) like '%'||v_query||'%'
        or lower(coalesce(c.brand_name,'')) like '%'||v_query||'%'
        or lower(coalesce(c.platform,'')) like '%'||v_query||'%'
      )
    limit 6

    union all

    select
      'shipping'::text,
      s.id::bigint,
      coalesce(nullif(s.reference_no,''),nullif(s.tracking,''),'Shipping #'||s.id::text)::text,
      concat_ws(' · ',nullif(s.receiver_name,''),nullif(s.creator_name,''))::text,
      concat_ws(' · ',nullif(s.courier,''),nullif(s.status,''))::text,
      'shipping'::text,
      case when lower(coalesce(s.tracking,''))=v_query or lower(coalesce(s.reference_no,''))=v_query then 1 else 11 end::integer
    from public.shipping s
    where s.workspace_id=p_workspace_id
      and (
        lower(coalesce(s.reference_no,'')) like '%'||v_query||'%'
        or lower(coalesce(s.tracking,'')) like '%'||v_query||'%'
        or lower(coalesce(s.receiver_name,'')) like '%'||v_query||'%'
        or lower(coalesce(s.creator_name,'')) like '%'||v_query||'%'
        or lower(coalesce(s.product_name,'')) like '%'||v_query||'%'
      )
    limit 6

    union all

    select
      'task'::text,
      t.id::bigint,
      t.title::text,
      coalesce(nullif(t.description,''),'Task')::text,
      concat_ws(' · ',nullif(t.priority,''),nullif(t.status,''),case when t.due_date is not null then 'Due '||t.due_date::text else null end)::text,
      'kanban'::text,
      case when lower(t.title)=v_query then 3 else 12 end::integer
    from public.creator_tasks t
    where t.workspace_id=p_workspace_id
      and (
        lower(coalesce(t.title,'')) like '%'||v_query||'%'
        or lower(coalesce(t.description,'')) like '%'||v_query||'%'
        or lower(coalesce(t.creator_name,'')) like '%'||v_query||'%'
      )
    limit 6

    union all

    select
      'listing'::text,
      l.id::bigint,
      coalesce(nullif(l.creator_name,''),'Listing #'||l.id::text)::text,
      concat_ws(' · ',nullif(l.product_name,''),nullif(l.sku,''))::text,
      concat_ws(' · ',nullif(l.platform,''),nullif(l.stage,''))::text,
      'listings'::text,
      13::integer
    from public.listings l
    where l.workspace_id=p_workspace_id
      and (
        lower(coalesce(l.creator_name,'')) like '%'||v_query||'%'
        or lower(coalesce(l.product_name,'')) like '%'||v_query||'%'
        or lower(coalesce(l.sku,'')) like '%'||v_query||'%'
        or lower(coalesce(l.next_action,'')) like '%'||v_query||'%'
      )
    limit 6
  ) x
  order by x.score asc,x.title asc
  limit v_limit;
end
$$;

revoke all on function public.luma_global_search_v1(uuid,text,integer) from public;
revoke all on function public.luma_global_search_v1(uuid,text,integer) from anon;
grant execute on function public.luma_global_search_v1(uuid,text,integer) to authenticated;

create or replace function public.luma_refresh_operational_notifications_v1(
  p_workspace_id uuid
)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_inserted integer:=0;
  v_count integer:=0;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not public.luma_has_workspace(p_workspace_id) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  insert into public.user_notifications(user_id,title,message,kind,is_read,workspace_id,action_url,dedupe_key,created_at)
  select v_user,
    case when c.end_date<current_date then 'Campaign melewati deadline' else 'Deadline campaign mendekat' end,
    c.name||case when c.end_date is not null then ' · '||to_char(c.end_date,'DD Mon YYYY') else '' end,
    case when c.end_date<current_date then 'campaign_overdue' else 'campaign_due' end,
    false,p_workspace_id,'/campaign-tracker',
    'campaign:'||c.id::text||':'||coalesce(c.end_date::text,'none'),
    now()
  from public.campaign_trackers c
  where c.workspace_id=p_workspace_id
    and c.status not in ('Completed','Cancelled')
    and c.end_date is not null
    and c.end_date<=current_date+3
    and c.end_date>=current_date-14
  on conflict do nothing;
  get diagnostics v_count=row_count; v_inserted:=v_inserted+v_count;

  insert into public.user_notifications(user_id,title,message,kind,is_read,workspace_id,action_url,dedupe_key,created_at)
  select v_user,
    case when t.due_date<current_date then 'Task terlambat' else 'Task segera jatuh tempo' end,
    t.title||case when t.due_date is not null then ' · '||to_char(t.due_date,'DD Mon YYYY') else '' end,
    'task_due',false,p_workspace_id,'/kanban',
    'task:'||t.id::text||':'||coalesce(t.due_date::text,'none'),
    now()
  from public.creator_tasks t
  where t.workspace_id=p_workspace_id
    and lower(coalesce(t.status,''))<>'done'
    and t.due_date is not null
    and t.due_date<=current_date+1
    and t.due_date>=current_date-14
  on conflict do nothing;
  get diagnostics v_count=row_count; v_inserted:=v_inserted+v_count;

  insert into public.user_notifications(user_id,title,message,kind,is_read,workspace_id,action_url,dedupe_key,created_at)
  select v_user,
    'Pengiriman selesai',
    coalesce(nullif(s.receiver_name,''),nullif(s.creator_name,''),'Penerima')||
      ' · '||coalesce(nullif(s.reference_no,''),nullif(s.tracking,''),'Shipping #'||s.id::text),
    'shipping_delivered',false,p_workspace_id,'/shipping',
    'shipping-delivered:'||s.id::text||':'||coalesce(s.delivered_at::text,s.data_date::text,'none'),
    now()
  from public.shipping s
  where s.workspace_id=p_workspace_id
    and lower(coalesce(s.status,'')) in ('delivered','finish')
    and coalesce(s.delivered_at,s.data_date,current_date)>=current_date-2
  on conflict do nothing;
  get diagnostics v_count=row_count; v_inserted:=v_inserted+v_count;

  insert into public.user_notifications(user_id,title,message,kind,is_read,workspace_id,action_url,dedupe_key,created_at)
  select v_user,
    'Listing perlu follow up',
    coalesce(nullif(l.creator_name,''),'Creator')||' · '||coalesce(nullif(l.next_action,''),nullif(l.stage,''),'Follow Up'),
    'listing_follow_up',false,p_workspace_id,'/listings',
    'listing-followup:'||l.id::text||':'||coalesce(l.updated_at::date::text,l.data_date::text,'none'),
    now()
  from public.listings l
  where l.workspace_id=p_workspace_id
    and coalesce(l.stage,'') in ('Reach Out','Follow Up','Negotiation','Sample Sent','Content In Progress')
    and coalesce(l.updated_at,l.created_at,now())<=now()-interval '48 hours'
  on conflict do nothing;
  get diagnostics v_count=row_count; v_inserted:=v_inserted+v_count;

  return v_inserted;
end
$$;

revoke all on function public.luma_refresh_operational_notifications_v1(uuid) from public;
revoke all on function public.luma_refresh_operational_notifications_v1(uuid) from anon;
grant execute on function public.luma_refresh_operational_notifications_v1(uuid) to authenticated;
