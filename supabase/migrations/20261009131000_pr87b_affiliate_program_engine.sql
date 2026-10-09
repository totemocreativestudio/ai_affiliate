-- PR 87B · Multi-tenant Affiliate Support, Challenge, performance and reward tracker.
create table if not exists public.luma_affiliate_programs(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 program_name text not null check(length(btrim(program_name))>2),
 kind text not null check(kind in ('reward','incentive','spark_ads','challenge','sampling')),
 theme text not null default 'Custom',
 platform text not null default 'TikTok',
 channel text not null default 'all' check(channel in ('all','video','live','product','ads')),
 store_name text,
 store_id text,
 product_master_id bigint references public.product_master(id) on delete set null,
 metric text not null default 'qty_net' check(metric in ('qty_net','gmv_net','orders','videos','live_count','views','ads_spend')),
 target_value numeric not null default 0 check(target_value>=0),
 reward_type text not null default 'cash' check(reward_type in ('cash','product','ads_credit','sample','other')),
 reward_value numeric not null default 0 check(reward_value>=0),
 reward_product_master_id bigint references public.product_master(id) on delete set null,
 extra_incentive_per_unit numeric not null default 0 check(extra_incentive_per_unit>=0),
 tier_rules jsonb not null default '[]'::jsonb check(jsonb_typeof(tier_rules)='array'),
 claim_limit int not null default 1 check(claim_limit between 1 and 24),
 start_date date not null,
 end_date date not null,
 claim_deadline date,
 status text not null default 'draft' check(status in ('draft','active','paused','closed')),
 description text,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint luma_affiliate_program_date_check check(end_date>=start_date)
);
create index if not exists luma_affiliate_program_workspace_idx on public.luma_affiliate_programs(workspace_id,status,start_date,end_date);
alter table public.luma_affiliate_programs enable row level security;
create policy luma_affiliate_program_read on public.luma_affiliate_programs for select to authenticated
 using (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy luma_affiliate_program_insert on public.luma_affiliate_programs for insert to authenticated
 with check ((public.luma_has_workspace(workspace_id) or public.luma_is_admin()) and created_by=auth.uid());
create policy luma_affiliate_program_update on public.luma_affiliate_programs for update to authenticated
 using (public.luma_has_workspace(workspace_id) or public.luma_is_admin())
 with check (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy luma_affiliate_program_delete on public.luma_affiliate_programs for delete to authenticated
 using (public.luma_is_workspace_admin(workspace_id) or public.luma_is_admin());
grant select,insert,update,delete on public.luma_affiliate_programs to authenticated;

create table if not exists public.luma_affiliate_program_participants(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 program_id uuid not null references public.luma_affiliate_programs(id) on delete cascade,
 creator_id bigint not null references public.creators(id) on delete cascade,
 agreement_id bigint references public.agreements(id) on delete set null,
 enrolled_at timestamptz not null default now(),
 status text not null default 'active' check(status in ('active','withdrawn','disqualified')),
 created_by uuid references auth.users(id) on delete set null,
 unique(program_id,creator_id)
);
create index if not exists luma_affiliate_program_participants_workspace_idx on public.luma_affiliate_program_participants(workspace_id,creator_id);
alter table public.luma_affiliate_program_participants enable row level security;
create policy luma_affiliate_program_participants_read on public.luma_affiliate_program_participants for select to authenticated
 using (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy luma_affiliate_program_participants_insert on public.luma_affiliate_program_participants for insert to authenticated
 with check (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy luma_affiliate_program_participants_update on public.luma_affiliate_program_participants for update to authenticated
 using (public.luma_has_workspace(workspace_id) or public.luma_is_admin())
 with check (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy luma_affiliate_program_participants_delete on public.luma_affiliate_program_participants for delete to authenticated
 using (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
grant select,insert,update,delete on public.luma_affiliate_program_participants to authenticated;

create table if not exists public.luma_affiliate_program_imports(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 program_id uuid not null references public.luma_affiliate_programs(id) on delete cascade,
 platform text not null,
 filename text not null,
 file_hash text not null,
 rows_total int not null default 0,
 rows_imported int not null default 0,
 rows_rejected int not null default 0,
 status text not null default 'processing' check(status in ('processing','completed','partial','failed')),
 imported_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(program_id,file_hash)
);
create index if not exists luma_affiliate_program_imports_workspace_idx on public.luma_affiliate_program_imports(workspace_id,program_id,created_at desc);
alter table public.luma_affiliate_program_imports enable row level security;
create policy luma_affiliate_program_imports_read on public.luma_affiliate_program_imports for select to authenticated
 using (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy luma_affiliate_program_imports_insert on public.luma_affiliate_program_imports for insert to authenticated
 with check ((public.luma_has_workspace(workspace_id) or public.luma_is_admin()) and imported_by=auth.uid());
create policy luma_affiliate_program_imports_update on public.luma_affiliate_program_imports for update to authenticated
 using (imported_by=auth.uid() and public.luma_has_workspace(workspace_id))
 with check (imported_by=auth.uid() and public.luma_has_workspace(workspace_id));
grant select,insert,update on public.luma_affiliate_program_imports to authenticated;

create table if not exists public.luma_affiliate_program_performance(
 id bigint generated always as identity primary key,
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 program_id uuid not null references public.luma_affiliate_programs(id) on delete cascade,
 creator_id bigint not null references public.creators(id) on delete cascade,
 import_id uuid not null references public.luma_affiliate_program_imports(id) on delete cascade,
 platform text not null,
 row_key text not null,
 order_id text,
 store_id text,
 product_master_id bigint references public.product_master(id) on delete set null,
 metric_date date not null,
 qty_gross numeric not null default 0,
 qty_net numeric not null default 0,
 refund_qty numeric not null default 0,
 orders numeric not null default 0,
 gmv_net numeric not null default 0,
 commission numeric not null default 0,
 videos numeric not null default 0,
 live_count numeric not null default 0,
 views numeric not null default 0,
 ads_spend numeric not null default 0,
 created_at timestamptz not null default now(),
 unique(program_id,row_key)
);
create index if not exists luma_affiliate_program_performance_rank_idx on public.luma_affiliate_program_performance(workspace_id,program_id,creator_id,metric_date);
create index if not exists luma_affiliate_program_performance_import_idx on public.luma_affiliate_program_performance(import_id);
alter table public.luma_affiliate_program_performance enable row level security;
create policy luma_affiliate_program_performance_read on public.luma_affiliate_program_performance for select to authenticated
 using (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy luma_affiliate_program_performance_insert on public.luma_affiliate_program_performance for insert to authenticated
 with check (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy luma_affiliate_program_performance_update on public.luma_affiliate_program_performance for update to authenticated
 using (public.luma_has_workspace(workspace_id) or public.luma_is_admin())
 with check (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
grant select,insert,update on public.luma_affiliate_program_performance to authenticated;
grant usage,select on sequence public.luma_affiliate_program_performance_id_seq to authenticated;

create table if not exists public.luma_affiliate_reward_claims(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 program_id uuid not null references public.luma_affiliate_programs(id) on delete cascade,
 creator_id bigint not null references public.creators(id) on delete cascade,
 claim_no int not null default 1,
 bonus_amount numeric not null default 0 check(bonus_amount>=0),
 reward_type text not null default 'cash',
 status text not null default 'pending' check(status in ('pending','approved','paid','rejected','expired')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(program_id,creator_id,claim_no)
);
alter table public.luma_affiliate_reward_claims enable row level security;
create policy luma_affiliate_reward_claims_read on public.luma_affiliate_reward_claims for select to authenticated
 using (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy luma_affiliate_reward_claims_insert on public.luma_affiliate_reward_claims for insert to authenticated
 with check (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy luma_affiliate_reward_claims_update on public.luma_affiliate_reward_claims for update to authenticated
 using (public.luma_is_workspace_admin(workspace_id) or public.luma_is_admin())
 with check (public.luma_is_workspace_admin(workspace_id) or public.luma_is_admin());
grant select,insert,update on public.luma_affiliate_reward_claims to authenticated;

alter table public.agreements add column if not exists store_name text;
alter table public.agreements add column if not exists store_id text;
alter table public.agreements add column if not exists program_id uuid references public.luma_affiliate_programs(id) on delete set null;
alter table public.listings add column if not exists program_id uuid references public.luma_affiliate_programs(id) on delete set null;

-- Enforce all connected records belong to the same workspace and prevent cross-tenant ID spoofing.
create or replace function public.luma_affiliate_program_validate_workspace_v1()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_program uuid;v_creator uuid;v_agreement uuid;v_product uuid;
begin
 select workspace_id into v_program from public.luma_affiliate_programs where id=new.program_id;
 if v_program is distinct from new.workspace_id then raise exception 'Program workspace mismatch' using errcode='23514';end if;
 if to_jsonb(new)?'creator_id' then
   select workspace_id into v_creator from public.creators where id=new.creator_id;
   if v_creator is distinct from new.workspace_id then raise exception 'Creator workspace mismatch' using errcode='23514';end if;
 end if;
 if tg_table_name='luma_affiliate_program_participants' and new.agreement_id is not null then
   select workspace_id into v_agreement from public.agreements where id=new.agreement_id;
   if v_agreement is distinct from new.workspace_id then raise exception 'Agreement workspace mismatch' using errcode='23514';end if;
 end if;
 if tg_table_name='luma_affiliate_program_performance' then
   select workspace_id into v_product from public.luma_affiliate_program_imports where id=new.import_id;
   if v_product is distinct from new.workspace_id then raise exception 'Import workspace mismatch' using errcode='23514';end if;
 end if;
 return new;
end $$;
drop trigger if exists luma_affiliate_participant_workspace_guard on public.luma_affiliate_program_participants;
create trigger luma_affiliate_participant_workspace_guard before insert or update on public.luma_affiliate_program_participants
for each row execute function public.luma_affiliate_program_validate_workspace_v1();
drop trigger if exists luma_affiliate_performance_workspace_guard on public.luma_affiliate_program_performance;
create trigger luma_affiliate_performance_workspace_guard before insert or update on public.luma_affiliate_program_performance
for each row execute function public.luma_affiliate_program_validate_workspace_v1();
drop trigger if exists luma_affiliate_claim_workspace_guard on public.luma_affiliate_reward_claims;
create trigger luma_affiliate_claim_workspace_guard before insert or update on public.luma_affiliate_reward_claims
for each row execute function public.luma_affiliate_program_validate_workspace_v1();

create or replace function public.luma_affiliate_program_leaderboard_v1(p_workspace_id uuid,p_program_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p record; v_result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
   raise exception 'Workspace access denied' using errcode='42501';end if;
 select * into p from public.luma_affiliate_programs
 where id=p_program_id and workspace_id=p_workspace_id;
 if not found then raise exception 'Program not found' using errcode='22023';end if;
 with activity as(
   select a.creator_id,
    coalesce(sum(perf.qty_net),0) qty_net,coalesce(sum(perf.gmv_net),0) gmv_net,
    coalesce(sum(perf.orders),0) orders,coalesce(sum(perf.videos),0) videos,
    coalesce(sum(perf.live_count),0) live_count,coalesce(sum(perf.views),0) views,
    coalesce(sum(perf.ads_spend),0) ads_spend,coalesce(sum(perf.commission),0) platform_commission
   from public.luma_affiliate_program_participants a
   left join public.luma_affiliate_program_performance perf
    on perf.program_id=a.program_id and perf.creator_id=a.creator_id
    and perf.metric_date between p.start_date and p.end_date
    and (p.product_master_id is null or perf.product_master_id=p.product_master_id)
    and (p.store_id is null or perf.store_id=p.store_id)
   where a.program_id=p.id and a.workspace_id=p_workspace_id and a.status='active'
   group by a.creator_id
 ), scored as(
  select a.*,
   case p.metric when 'qty_net' then a.qty_net when 'gmv_net' then a.gmv_net
        when 'orders' then a.orders when 'videos' then a.videos
        when 'live_count' then a.live_count when 'views' then a.views
        when 'ads_spend' then a.ads_spend else 0 end actual
  from activity a
 ), ranked as (
  select s.*,coalesce(c.name,c.username,c.creator_code,'Creator') creator_name,
   coalesce((select (r->>'reward_value')::numeric from jsonb_array_elements(p.tier_rules) r
       where (r->>'target')::numeric<=s.actual
       order by (r->>'target')::numeric desc limit 1),
       case when s.actual>=p.target_value and p.target_value>0 then p.reward_value else 0 end) tier_reward,
   coalesce((select r->>'tier' from jsonb_array_elements(p.tier_rules) r
       where (r->>'target')::numeric<=s.actual
       order by (r->>'target')::numeric desc limit 1),'') tier_name
  from scored s left join public.creators c on c.id=s.creator_id
 ), final as (
  select r.*,case when r.tier_reward>0 then r.tier_reward+
       (case when p.metric='qty_net' then r.qty_net*p.extra_incentive_per_unit else 0 end) else 0 end
       estimated_reward,
    case when r.tier_reward>0 and current_date>coalesce(p.claim_deadline,p.end_date) then 'claim_expired'
         when r.tier_reward>0 then 'qualified'
         when current_date>p.end_date then 'not_qualified'
         else 'in_progress' end qualification
  from ranked r
 )
 select jsonb_build_object(
  'program',jsonb_build_object('id',p.id,'name',p.program_name,'metric',p.metric,'target',p.target_value,'start_date',p.start_date,'end_date',p.end_date,'claim_deadline',coalesce(p.claim_deadline,p.end_date),'status',p.status,'claim_limit',p.claim_limit),
  'leaderboard',coalesce((select jsonb_agg(to_jsonb(f) order by f.actual desc,f.creator_name) from final f),'[]'::jsonb),
  'summary',jsonb_build_object('participants',(select count(*) from final),
    'qualified',(select count(*) from final where qualification='qualified'),
    'expired',(select count(*) from final where qualification='claim_expired'),
    'estimated_bonus',(select coalesce(sum(estimated_reward),0) from final where qualification='qualified'))
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.luma_affiliate_program_leaderboard_v1(uuid,uuid) from public,anon;
grant execute on function public.luma_affiliate_program_leaderboard_v1(uuid,uuid) to authenticated;
