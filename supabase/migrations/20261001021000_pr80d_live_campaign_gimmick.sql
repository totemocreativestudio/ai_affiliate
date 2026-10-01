-- PR80D: Live Campaign Tracker + Gimmick Intelligence

alter table public.live_sessions add column if not exists campaign_id uuid references public.live_campaigns(id) on delete set null;

create table if not exists public.live_gimmicks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  category text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists live_gimmicks_ws_name_uq on public.live_gimmicks(workspace_id,lower(name));
alter table public.live_gimmicks enable row level security;

drop policy if exists live_gimmicks_select on public.live_gimmicks;
create policy live_gimmicks_select on public.live_gimmicks for select to authenticated using(public.luma_has_workspace(workspace_id));
drop policy if exists live_gimmicks_insert on public.live_gimmicks;
create policy live_gimmicks_insert on public.live_gimmicks for insert to authenticated with check(public.luma_has_workspace(workspace_id));
drop policy if exists live_gimmicks_update on public.live_gimmicks;
create policy live_gimmicks_update on public.live_gimmicks for update to authenticated using(public.luma_has_workspace(workspace_id)) with check(public.luma_has_workspace(workspace_id));
drop policy if exists live_gimmicks_delete on public.live_gimmicks;
create policy live_gimmicks_delete on public.live_gimmicks for delete to authenticated using(public.luma_has_workspace(workspace_id));

create or replace function public.luma_live_campaign_overview_v1(p_workspace_id uuid,p_start date,p_end date)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) then raise exception 'Workspace access denied' using errcode='42501'; end if;

  with session_perf as (
    select s.id session_id,s.campaign_id,s.campaign_name,s.gimmick,s.session_date,s.status,s.target_gmv,s.target_orders,s.ads_budget,s.host_cost,s.studio_cost,s.production_cost,s.other_cost,
      coalesce(sum(p.gmv),0) gmv,coalesce(sum(p.orders),0) orders,coalesce(sum(p.qty),0) qty,coalesce(sum(p.duration_minutes),0) duration_minutes,
      coalesce(avg(nullif(p.avg_viewers,0)),0) avg_viewers
    from public.live_sessions s
    left join public.live_session_performance p on p.session_id=s.id and p.workspace_id=s.workspace_id
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
    group by c.id
    order by gmv desc
  ),
  gimmicks as (
    select coalesce(nullif(trim(gimmick),''),'Tanpa Gimmick') gimmick,
      count(*) sessions,coalesce(sum(gmv),0) gmv,coalesce(sum(orders),0) orders,
      coalesce(avg(nullif(avg_viewers,0)),0) avg_viewers,
      case when sum(duration_minutes)>0 then round(sum(gmv)/(sum(duration_minutes)/60),2) else 0 end revenue_per_hour
    from session_perf group by coalesce(nullif(trim(gimmick),''),'Tanpa Gimmick') order by gmv desc
  )
  select jsonb_build_object(
    'campaigns',coalesce((select jsonb_agg(to_jsonb(c)) from campaigns c),'[]'::jsonb),
    'gimmicks',coalesce((select jsonb_agg(to_jsonb(g)) from gimmicks g),'[]'::jsonb)
  ) into v;
  return coalesce(v,'{}'::jsonb);
end $$;

revoke all on function public.luma_live_campaign_overview_v1(uuid,date,date) from public,anon;
grant execute on function public.luma_live_campaign_overview_v1(uuid,date,date) to authenticated,service_role;
