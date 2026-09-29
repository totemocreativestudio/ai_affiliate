-- PR69: restore full workspace visibility for workspace owners while preserving creator-scoped RLS for members.
-- The previous sales SELECT policy only treated profile.role manager/admin as full readers.
-- Customer workspace owners use membership_role='owner' with profile.role='staff', so affiliate rows
-- with creator_id were hidden while creator_id-null Product Performance remained visible.

create or replace function private.luma_can_read_all_sales(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.luma_is_admin()
    or exists (
      select 1
      from public.workspace_members wm
      where wm.user_id = auth.uid()
        and wm.workspace_id = p_workspace_id
        and lower(coalesce(wm.membership_role,'')) in ('owner','admin','manager')
    );
$$;

revoke all on function private.luma_can_read_all_sales(uuid) from public;
revoke all on function private.luma_can_read_all_sales(uuid) from anon;
grant execute on function private.luma_can_read_all_sales(uuid) to authenticated;

drop policy if exists pr45_sales_select_auth on public.sales;

create policy pr69_sales_select_auth
on public.sales
for select
to authenticated
using (
  public.luma_is_admin()
  or (
    workspace_id = any((select private.luma_my_workspace_ids())::uuid[])
    and (
      creator_id is null
      or private.luma_can_read_all_sales(workspace_id)
      or creator_id = any((select private.luma_my_allowed_creator_ids())::bigint[])
    )
  )
);

-- Aggregated ranking remains explicitly workspace-scoped even if row-level policy changes later.
create or replace function public.get_creator_ranking_v2(
  p_workspace_id uuid,
  p_start_date date default null,
  p_end_date date default null,
  p_platform text default null,
  p_store_name text default null,
  p_creator_id bigint default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns table(
  rank bigint, creator_id bigint, creator_code text, creator_name text, username text,
  platform text, qty numeric, orders numeric, gmv numeric, commission numeric, total_rows bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not (
    public.luma_is_admin()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()
    )
  ) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  return query
  with ranked as (
    select s.creator_id,max(s.creator_name) sales_creator_name,max(s.username) sales_username,max(s.platform) sales_platform,
           coalesce(sum(s.qty),0) qty,coalesce(sum(s.orders),0) orders,coalesce(sum(s.gmv),0) gmv,coalesce(sum(s.commission),0) commission
    from public.sales s
    where s.workspace_id=p_workspace_id
      and s.data_type in ('performance','sales')
      and (p_start_date is null or s.data_date>=p_start_date)
      and (p_end_date is null or s.data_date<=p_end_date)
      and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform))
      and (p_store_name is null or p_store_name='' or lower(coalesce(s.store_name,''))=lower(p_store_name))
      and (p_creator_id is null or s.creator_id=p_creator_id)
    group by s.creator_id
  ),
  joined as (
    select r.creator_id,coalesce(c.creator_code,'') creator_code,
           coalesce(c.name,r.sales_creator_name,'') creator_name,
           coalesce(c.username,r.sales_username,'') username,
           coalesce(r.sales_platform,c.platform,'') platform,
           r.qty,r.orders,r.gmv,r.commission
    from ranked r
    left join public.creators c on c.id=r.creator_id and c.workspace_id=p_workspace_id
    where p_search is null or p_search=''
       or coalesce(c.name,r.sales_creator_name,'') ilike '%'||p_search||'%'
       or coalesce(c.username,r.sales_username,'') ilike '%'||p_search||'%'
       or coalesce(c.creator_code,'') ilike '%'||p_search||'%'
  ),
  numbered as (
    select row_number() over(order by j.gmv desc,j.orders desc,j.qty desc,j.creator_id asc) row_rank,j.*
    from joined j
  )
  select n.row_rank,n.creator_id,n.creator_code,n.creator_name,n.username,n.platform,n.qty,n.orders,n.gmv,n.commission,
         count(*) over()
  from numbered n
  order by n.row_rank
  limit greatest(1,least(coalesce(p_page_size,50),100))
  offset greatest(0,coalesce(p_page,1)-1)*greatest(1,least(coalesce(p_page_size,50),100));
end
$$;

revoke all on function public.get_creator_ranking_v2(uuid,date,date,text,text,bigint,text,integer,integer) from public;
revoke all on function public.get_creator_ranking_v2(uuid,date,date,text,text,bigint,text,integer,integer) from anon;
grant execute on function public.get_creator_ranking_v2(uuid,date,date,text,text,bigint,text,integer,integer) to authenticated;

create or replace function public.get_dashboard_store_options(
  p_workspace_id uuid,
  p_platform text default null
)
returns table(store_name text,store_id text,platform text,row_count bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not (
    public.luma_is_admin()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()
    )
  ) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  return query
  select s.store_name,max(s.store_id),max(s.platform),count(*)::bigint
  from public.sales s
  where s.workspace_id=p_workspace_id
    and nullif(trim(s.store_name),'') is not null
    and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform))
  group by s.store_name
  order by lower(s.store_name);
end
$$;

revoke all on function public.get_dashboard_store_options(uuid,text) from public;
revoke all on function public.get_dashboard_store_options(uuid,text) from anon;
grant execute on function public.get_dashboard_store_options(uuid,text) to authenticated;
