-- PR85D Action Center 2.0

create index if not exists luma_action_items_v2_lookup_idx
  on public.luma_action_items(workspace_id,status,severity,due_date,updated_at desc);

create or replace function public.luma_sync_operational_actions_v2(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare inserted_count int:=0; n int:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  -- Campaign deadline
  insert into public.luma_action_items(workspace_id,source_type,source_id,title,description,severity,status,due_date,action_route,metadata,created_by)
  select p_workspace_id,'campaign_due',c.id::text,
    case when c.end_date<current_date then 'Campaign melewati deadline' else 'Campaign mendekati deadline' end,
    coalesce(c.name,'Campaign')||case when c.end_date is not null then ' · due '||to_char(c.end_date,'DD Mon YYYY') else '' end,
    case when c.end_date<current_date then 'urgent' else 'high' end,
    'open',c.end_date,'campaign-tracker',
    jsonb_build_object('campaign_id',c.id,'name',c.name,'end_date',c.end_date),auth.uid()
  from public.campaign_trackers c
  where c.workspace_id=p_workspace_id
    and lower(coalesce(c.status,'')) not in ('completed','cancelled','canceled')
    and c.end_date is not null
    and c.end_date<=current_date+7
    and not exists(
      select 1 from public.luma_action_items a
      where a.workspace_id=p_workspace_id and a.source_type='campaign_due' and a.source_id=c.id::text and a.status in ('open','in_progress')
    );
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  -- Sample follow-up
  insert into public.luma_action_items(workspace_id,source_type,source_id,title,description,severity,status,due_date,action_route,metadata,created_by)
  select p_workspace_id,'sample_followup',cs.id::text,'Sample perlu follow up',
    coalesce(cs.creator_name,'Creator')||' · '||coalesce(cs.product_name,cs.sku,'Produk')||' · '||coalesce(cs.sample_status,'Pending'),
    'high','open',coalesce(cs.return_date,current_date),'creator-samples',
    jsonb_build_object('sample_id',cs.id,'creator_name',cs.creator_name,'status',cs.sample_status),auth.uid()
  from public.creator_samples cs
  where cs.workspace_id=p_workspace_id
    and lower(coalesce(cs.sample_status,'')) in ('sent','received','content_pending','pending')
    and coalesce(cs.sent_date,current_date)<=current_date-3
    and not exists(
      select 1 from public.luma_action_items a
      where a.workspace_id=p_workspace_id and a.source_type='sample_followup' and a.source_id=cs.id::text and a.status in ('open','in_progress')
    );
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  -- Shipping missing tracking / stale
  insert into public.luma_action_items(workspace_id,source_type,source_id,title,description,severity,status,due_date,action_route,metadata,created_by)
  select p_workspace_id,'shipping_attention',s.id::text,'Shipping perlu perhatian',
    coalesce(s.creator_name,s.receiver_name,'Penerima')||' · '||coalesce(nullif(s.tracking,''),'Resi belum tersedia')||' · '||coalesce(s.status,'Pending'),
    case when nullif(trim(coalesce(s.tracking,'')),'') is null then 'high' else 'normal' end,
    'open',coalesce(s.shipped_at,s.data_date,current_date),'shipping',
    jsonb_build_object('shipping_id',s.id,'tracking',s.tracking,'status',s.status),auth.uid()
  from public.shipping s
  where s.workspace_id=p_workspace_id
    and lower(coalesce(s.status,'')) not in ('delivered','completed','cancelled','canceled')
    and (nullif(trim(coalesce(s.tracking,'')),'') is null or coalesce(s.shipped_at,s.data_date,current_date)<=current_date-5)
    and not exists(
      select 1 from public.luma_action_items a
      where a.workspace_id=p_workspace_id and a.source_type='shipping_attention' and a.source_id=s.id::text and a.status in ('open','in_progress')
    );
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  -- Missing HPP
  insert into public.luma_action_items(workspace_id,source_type,source_id,title,description,severity,status,due_date,action_route,metadata,created_by)
  select p_workspace_id,'missing_hpp',p.id::text,'HPP produk belum lengkap',
    coalesce(p.sku,'SKU')||' · '||coalesce(p.product_name,'Nama produk belum tersedia'),
    'normal','open',current_date,'product-master',
    jsonb_build_object('product_id',p.id,'sku',p.sku),auth.uid()
  from public.product_master p
  where p.workspace_id=p_workspace_id
    and coalesce(p.cost_price,0)<=0
    and lower(coalesce(p.status,'active'))<>'inactive'
    and not exists(
      select 1 from public.luma_action_items a
      where a.workspace_id=p_workspace_id and a.source_type='missing_hpp' and a.source_id=p.id::text and a.status in ('open','in_progress')
    );
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  -- Stale Listing, excluding listings already handled by the dedicated scheduled follow-up action.
  insert into public.luma_action_items(workspace_id,source_type,source_id,title,description,severity,status,due_date,action_route,metadata,created_by)
  select p_workspace_id,'listing_stale',l.id::text,'Listing belum ditindaklanjuti',
    coalesce(l.creator_name,'Creator')||' · '||coalesce(l.stage,'No stage')||
      case when nullif(trim(coalesce(l.next_action,'')),'') is not null then ' · '||l.next_action else '' end,
    'normal','open',coalesce((l.next_follow_up_at at time zone 'Asia/Jakarta')::date,l.posting_date,l.data_date,current_date),'listings',
    jsonb_build_object('listing_id',l.id,'creator_name',l.creator_name,'stage',l.stage),auth.uid()
  from public.listings l
  where l.workspace_id=p_workspace_id
    and lower(coalesce(l.stage,'')) not in ('closed','done','completed','rejected','won / active','lost / inactive')
    and l.updated_at<now()-interval '3 day'
    and not exists(
      select 1 from public.luma_action_items a
      where a.workspace_id=p_workspace_id and a.source_type in ('listing_stale','listing_followup') and a.source_id=l.id::text and a.status in ('open','in_progress')
    );
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  -- Live import failed or partial: Live-only action, never Affiliate.
  insert into public.luma_action_items(workspace_id,source_type,source_id,title,description,severity,status,due_date,action_route,metadata,created_by)
  select p_workspace_id,'live_data_health',li.id::text,
    case when li.status='failed' then 'Import Live gagal' else 'Import Live perlu dicek' end,
    coalesce(li.filename,'Live upload')||' · '||coalesce(li.platform,'Unknown')||' · '||coalesce(li.dataset_type,'legacy'),
    case when li.status='failed' then 'high' else 'normal' end,
    'open',current_date,'live-streaming',
    jsonb_build_object('import_id',li.import_id,'filename',li.filename,'platform',li.platform,'dataset_type',li.dataset_type,'status',li.status),auth.uid()
  from public.live_imports li
  where li.workspace_id=p_workspace_id
    and li.created_at>=now()-interval '14 day'
    and (li.status='failed' or (li.status='completed' and coalesce(li.persisted_rows,0)<coalesce(li.row_count,0)))
    and not exists(
      select 1 from public.luma_action_items a
      where a.workspace_id=p_workspace_id and a.source_type='live_data_health' and a.source_id=li.id::text and a.status in ('open','in_progress')
    );
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  return jsonb_build_object('inserted',inserted_count,'checked_at',now());
end
$$;

revoke all on function public.luma_sync_operational_actions_v2(uuid) from public,anon;
grant execute on function public.luma_sync_operational_actions_v2(uuid) to authenticated,service_role;

create or replace function public.luma_action_center_v2(
  p_workspace_id uuid,
  p_limit int default 40
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

  perform public.luma_sync_operational_actions_v2(p_workspace_id);

  with ranked as (
    select
      a.id,a.source_type,a.source_id,a.title,a.description,a.severity,a.status,a.due_date,a.action_route,a.metadata,a.created_at,a.updated_at,
      (
        case a.severity when 'urgent' then 60 when 'high' then 40 when 'normal' then 20 else 10 end
        + case
            when a.due_date is null then 0
            when a.due_date<current_date then 60
            when a.due_date=current_date then 50
            when a.due_date<=current_date+3 then 35
            when a.due_date<=current_date+7 then 20
            else 0 end
        + case a.source_type
            when 'live_data_health' then 12
            when 'campaign_due' then 10
            when 'shipping_attention' then 8
            when 'listing_followup' then 8
            else 0 end
      )::int priority_score,
      case
        when a.severity='urgent' or (a.due_date is not null and a.due_date<current_date) then 'critical'
        when a.severity='high' or (a.due_date is not null and a.due_date<=current_date+3) then 'action'
        when a.due_date is not null and a.due_date<=current_date+7 then 'scheduled'
        else 'info'
      end action_level
    from public.luma_action_items a
    where a.workspace_id=p_workspace_id
      and a.status in ('open','in_progress')
  ),
  limited as (
    select * from ranked
    order by priority_score desc,due_date asc nulls last,updated_at desc
    limit least(greatest(coalesce(p_limit,40),1),100)
  ),
  source_counts as (
    select source_type,count(*)::int count from ranked group by source_type
  )
  select jsonb_build_object(
    'generated_at',now(),
    'summary',jsonb_build_object(
      'open',(select count(*) from ranked),
      'critical',(select count(*) from ranked where action_level='critical'),
      'today',(select count(*) from ranked where due_date=current_date),
      'this_week',(select count(*) from ranked where due_date between current_date and current_date+7),
      'overdue',(select count(*) from ranked where due_date<current_date)
    ),
    'sources',coalesce((select jsonb_agg(jsonb_build_object('source_type',source_type,'count',count) order by count desc) from source_counts),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(to_jsonb(limited) order by priority_score desc,due_date asc nulls last) from limited),'[]'::jsonb)
  ) into result;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_action_center_v2(uuid,int) from public,anon;
grant execute on function public.luma_action_center_v2(uuid,int) to authenticated,service_role;
