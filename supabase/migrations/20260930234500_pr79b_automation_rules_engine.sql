-- PR79B: Automation / Rules Engine
create table if not exists public.luma_automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  trigger_type text not null default 'manual' check(trigger_type in ('manual','daily_brief','metric','record_state')),
  trigger_config jsonb not null default '{}'::jsonb,
  condition_config jsonb not null default '{}'::jsonb,
  action_type text not null default 'create_action' check(action_type in ('create_action','notification')),
  action_config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.luma_automation_runs (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rule_id uuid not null references public.luma_automation_rules(id) on delete cascade,
  status text not null default 'completed' check(status in ('completed','skipped','failed')),
  matched_count integer not null default 0,
  action_count integer not null default 0,
  reason text,
  context jsonb not null default '{}'::jsonb,
  ran_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_luma_automation_rules_workspace_active on public.luma_automation_rules(workspace_id,active,updated_at desc);
create index if not exists idx_luma_automation_runs_workspace_rule on public.luma_automation_runs(workspace_id,rule_id,created_at desc);

alter table public.luma_automation_rules enable row level security;
alter table public.luma_automation_runs enable row level security;

drop policy if exists luma_automation_rules_select on public.luma_automation_rules;
create policy luma_automation_rules_select on public.luma_automation_rules for select to authenticated using(public.luma_has_workspace(workspace_id));
drop policy if exists luma_automation_rules_insert on public.luma_automation_rules;
create policy luma_automation_rules_insert on public.luma_automation_rules for insert to authenticated with check(public.luma_has_workspace(workspace_id));
drop policy if exists luma_automation_rules_update on public.luma_automation_rules;
create policy luma_automation_rules_update on public.luma_automation_rules for update to authenticated using(public.luma_has_workspace(workspace_id)) with check(public.luma_has_workspace(workspace_id));
drop policy if exists luma_automation_rules_delete on public.luma_automation_rules;
create policy luma_automation_rules_delete on public.luma_automation_rules for delete to authenticated using(public.luma_has_workspace(workspace_id));
drop policy if exists luma_automation_runs_select on public.luma_automation_runs;
create policy luma_automation_runs_select on public.luma_automation_runs for select to authenticated using(public.luma_has_workspace(workspace_id));

create or replace function public.luma_run_automation_rule_v1(p_workspace_id uuid,p_rule_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  r public.luma_automation_rules%rowtype;
  v_match boolean:=false;
  v_reason text:='';
  v_count integer:=0;
  v_action_id bigint;
  v_threshold numeric;
  v_days integer;
  v_metric numeric:=0;
  v_title text;
  v_desc text;
  v_route text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) then raise exception 'Workspace access denied' using errcode='42501'; end if;
  select * into r from public.luma_automation_rules where id=p_rule_id and workspace_id=p_workspace_id;
  if not found then raise exception 'Rule not found'; end if;
  if not r.active then
    insert into public.luma_automation_runs(workspace_id,rule_id,status,reason) values(p_workspace_id,p_rule_id,'skipped','Rule paused');
    return jsonb_build_object('ok',true,'matched',false,'reason','Rule paused');
  end if;

  if r.trigger_type in ('manual','daily_brief','record_state') then
    case coalesce(r.condition_config->>'kind','')
      when 'campaign_due' then
        v_days:=coalesce((r.condition_config->>'days')::int,3);
        select count(*) into v_count from public.campaign_tracker_creators ctc
        join public.campaign_trackers c on c.id=ctc.campaign_id and c.workspace_id=ctc.workspace_id
        where ctc.workspace_id=p_workspace_id and lower(coalesce(c.status,''))='active'
          and ctc.due_date is not null and ctc.due_date<=current_date+v_days
          and lower(coalesce(ctc.deliverable_status,'')) not in ('closed','live finished','video uploaded');
        v_match:=v_count>0; v_reason:=v_count||' campaign deliverable perlu perhatian'; v_route:='campaign-tracker';
      when 'sample_followup' then
        v_days:=coalesce((r.condition_config->>'days')::int,3);
        select count(*) into v_count from public.creator_samples
        where workspace_id=p_workspace_id and lower(coalesce(sample_status,'')) in ('sent','received','content_pending','pending')
          and coalesce(sent_date,current_date)<=current_date-v_days;
        v_match:=v_count>0; v_reason:=v_count||' sample perlu follow up'; v_route:='creator-samples';
      when 'shipping_missing_tracking' then
        select count(*) into v_count from public.shipping
        where workspace_id=p_workspace_id and lower(coalesce(status,'')) not in ('delivered','completed','cancelled','canceled')
          and nullif(trim(coalesce(tracking,'')),'') is null;
        v_match:=v_count>0; v_reason:=v_count||' shipping belum memiliki resi'; v_route:='shipping';
      when 'missing_hpp' then
        select count(*) into v_count from public.product_master
        where workspace_id=p_workspace_id and coalesce(cost_price,0)<=0 and lower(coalesce(status,'active'))<>'inactive';
        v_match:=v_count>0; v_reason:=v_count||' produk belum memiliki HPP'; v_route:='product-master';
      else
        v_reason:='Condition belum didukung'; v_match:=false;
    end case;
  elsif r.trigger_type='metric' and coalesce(r.condition_config->>'metric','')='gmv_today_below' then
    v_threshold:=coalesce((r.condition_config->>'threshold')::numeric,0);
    select coalesce(sum(gmv),0) into v_metric from public.sales
    where workspace_id=p_workspace_id and data_type in ('performance','sales')
      and data_date=(select max(data_date) from public.sales where workspace_id=p_workspace_id and data_type in ('performance','sales'));
    v_match:=v_metric<v_threshold;
    v_reason:='GMV terbaru Rp'||trim(to_char(v_metric,'FM999G999G999G999D00'))||' dibanding threshold Rp'||trim(to_char(v_threshold,'FM999G999G999G999D00'));
    v_route:='dashboard';
  end if;

  if v_match and r.action_type='create_action' then
    v_title:=coalesce(nullif(r.action_config->>'title',''),r.name);
    v_desc:=coalesce(nullif(r.action_config->>'description',''),v_reason);
    insert into public.luma_action_items(workspace_id,source_type,source_id,title,description,severity,status,action_route,metadata)
    values(p_workspace_id,'automation',r.id::text,v_title,v_desc,coalesce(nullif(r.action_config->>'severity',''),'normal'),'open',coalesce(nullif(r.action_config->>'route',''),v_route),
      jsonb_build_object('rule_id',r.id,'rule_name',r.name,'reason',v_reason,'matched_count',v_count))
    returning id into v_action_id;
  end if;

  insert into public.luma_automation_runs(workspace_id,rule_id,status,matched_count,action_count,reason,context)
  values(p_workspace_id,r.id,'completed',case when v_match then greatest(v_count,1) else 0 end,case when v_action_id is not null then 1 else 0 end,v_reason,
    jsonb_build_object('matched',v_match,'metric_value',v_metric,'action_id',v_action_id));

  return jsonb_build_object('ok',true,'matched',v_match,'reason',v_reason,'matched_count',v_count,'action_id',v_action_id);
end
$$;

revoke all on function public.luma_run_automation_rule_v1(uuid,uuid) from public,anon;
grant execute on function public.luma_run_automation_rule_v1(uuid,uuid) to authenticated,service_role;
