-- Lumaway Ops Intelligence Admin v4
alter table public.luma_api_usage_events
  add column if not exists cost_usd numeric(18,8) not null default 0,
  add column if not exists cost_idr numeric(18,2) not null default 0;

alter table public.luma_blog_posts
  add column if not exists author_name text not null default 'Lumaway',
  add column if not exists video_embed_url text,
  add column if not exists image_prompt text,
  add column if not exists image_alt text;

create table if not exists public.luma_tutorial_progress (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tutorial_id bigint not null references public.tutorials(id) on delete cascade,
  completed boolean not null default true,
  watched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,tutorial_id)
);
alter table public.luma_tutorial_progress enable row level security;
drop policy if exists tutorial_progress_select on public.luma_tutorial_progress;
create policy tutorial_progress_select on public.luma_tutorial_progress for select to authenticated
using (user_id=auth.uid() or public.luma_is_admin());
drop policy if exists tutorial_progress_insert on public.luma_tutorial_progress;
create policy tutorial_progress_insert on public.luma_tutorial_progress for insert to authenticated
with check ((user_id=auth.uid() and public.luma_has_workspace(workspace_id)) or public.luma_is_admin());
drop policy if exists tutorial_progress_update on public.luma_tutorial_progress;
create policy tutorial_progress_update on public.luma_tutorial_progress for update to authenticated
using (user_id=auth.uid() or public.luma_is_admin())
with check (user_id=auth.uid() or public.luma_is_admin());
drop policy if exists tutorial_progress_delete on public.luma_tutorial_progress;
create policy tutorial_progress_delete on public.luma_tutorial_progress for delete to authenticated
using (user_id=auth.uid() or public.luma_is_admin());

create table if not exists public.luma_content_events (
  id bigserial primary key,
  content_type text not null,
  content_id bigint,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  session_id text,
  visitor_id text,
  path text,
  referrer text,
  utm jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists luma_content_events_content_idx on public.luma_content_events(content_type,content_id,created_at desc);
create index if not exists luma_content_events_event_idx on public.luma_content_events(event_type,created_at desc);
alter table public.luma_content_events enable row level security;
drop policy if exists content_events_admin_select on public.luma_content_events;
create policy content_events_admin_select on public.luma_content_events for select to authenticated
using (public.luma_is_admin());
drop policy if exists content_events_insert on public.luma_content_events;
create policy content_events_insert on public.luma_content_events for insert to anon,authenticated
with check (
  content_type in ('blog','tutorial','marketing')
  and event_type in ('page_view','content_click','video_click','cta_click','watched','share','outbound_click')
  and (user_id is null or user_id=auth.uid())
);

create table if not exists public.luma_system_controls (
  id integer primary key default 1 check (id=1),
  mode text not null default 'normal' check (mode in ('normal','maintenance','degraded','outage')),
  status_code integer not null default 200,
  title text not null default 'Lumaway berjalan normal',
  message text,
  block_user_access boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.luma_system_controls(id,mode,status_code,title,message,block_user_access)
values (1,'normal',200,'Lumaway berjalan normal','Semua layanan utama tersedia.',false)
on conflict (id) do nothing;
alter table public.luma_system_controls enable row level security;
drop policy if exists system_controls_read on public.luma_system_controls;
create policy system_controls_read on public.luma_system_controls for select to authenticated using (true);
drop policy if exists system_controls_admin on public.luma_system_controls;
create policy system_controls_admin on public.luma_system_controls for all to authenticated
using (public.luma_is_admin()) with check (public.luma_is_admin());

create table if not exists public.luma_system_events (
  id bigserial primary key,
  mode text not null,
  status_code integer not null,
  title text not null,
  message text,
  action text not null default 'update',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.luma_system_events enable row level security;
drop policy if exists system_events_admin on public.luma_system_events;
create policy system_events_admin on public.luma_system_events for all to authenticated
using (public.luma_is_admin()) with check (public.luma_is_admin());

create table if not exists public.luma_knowledge_documents (
  id bigserial primary key,
  source_type text not null default 'obsidian',
  source_path text,
  title text not null,
  content_markdown text not null,
  tags text[] not null default '{}',
  status text not null default 'active' check (status in ('active','draft','archived')),
  checksum text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists luma_knowledge_source_path_uq on public.luma_knowledge_documents(source_type,source_path) where source_path is not null;
alter table public.luma_knowledge_documents enable row level security;
drop policy if exists knowledge_admin on public.luma_knowledge_documents;
create policy knowledge_admin on public.luma_knowledge_documents for all to authenticated
using (public.luma_is_admin()) with check (public.luma_is_admin());

create table if not exists public.luma_provider_accounts (
  id bigserial primary key,
  provider text not null,
  service text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active','warning','paused','error','inactive')),
  balance_usd numeric(18,4) not null default 0,
  balance_idr numeric(18,2) not null default 0,
  monthly_budget_usd numeric(18,4) not null default 0,
  monthly_budget_idr numeric(18,2) not null default 0,
  alert_threshold_usd numeric(18,4) not null default 0,
  alert_threshold_idr numeric(18,2) not null default 0,
  renewal_at timestamptz,
  cost_config jsonb not null default '{}'::jsonb,
  last_status text,
  last_checked_at timestamptz,
  consecutive_failures integer not null default 0,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,service)
);
alter table public.luma_provider_accounts enable row level security;
drop policy if exists provider_accounts_admin on public.luma_provider_accounts;
create policy provider_accounts_admin on public.luma_provider_accounts for all to authenticated
using (public.luma_is_admin()) with check (public.luma_is_admin());

insert into public.luma_provider_accounts(provider,service,display_name,cost_config,notes)
values
('openai','responses','OpenAI · Responses','{"model":"gpt-5.6-sol","input_per_million_usd":4,"output_per_million_usd":20,"usd_idr_rate":17745}'::jsonb,'OpenAI GPT-5.6 Sol pricing seed + BI JISDOR reference FX at implementation.'),
('openai','images','OpenAI · Image Generation','{}'::jsonb,'Track image generation spend manually or from provider billing.'),
('flowkirim','whatsapp','FlowKirim · WhatsApp','{}'::jsonb,'Primary/backup WhatsApp provider account.'),
('convia','whatsapp','Convia · WhatsApp','{}'::jsonb,'Primary/backup WhatsApp provider account.'),
('xendit','payments','Xendit · Payments','{}'::jsonb,'Payment gateway balance/fees.'),
('hostinger','vps','Hostinger · VPS','{}'::jsonb,'Infrastructure renewal tracker.'),
('hostinger','domain','Hostinger · Domain','{}'::jsonb,'Domain renewal tracker.')
on conflict(provider,service) do nothing;

create table if not exists public.luma_expense_records (
  id bigserial primary key,
  expense_date date not null default current_date,
  category text not null default 'operational',
  vendor text,
  description text not null,
  amount numeric(18,2) not null default 0,
  currency text not null default 'IDR',
  recurring boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.luma_expense_records enable row level security;
drop policy if exists expense_admin on public.luma_expense_records;
create policy expense_admin on public.luma_expense_records for all to authenticated
using (public.luma_is_admin()) with check (public.luma_is_admin());

create table if not exists public.luma_financial_reports (
  id bigserial primary key,
  report_type text not null,
  period_start date,
  period_end date,
  title text not null,
  input_json jsonb not null default '{}'::jsonb,
  insight_json jsonb not null default '{}'::jsonb,
  model text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.luma_financial_reports enable row level security;
drop policy if exists financial_reports_admin on public.luma_financial_reports;
create policy financial_reports_admin on public.luma_financial_reports for all to authenticated
using (public.luma_is_admin()) with check (public.luma_is_admin());

create table if not exists public.luma_hpp_scenarios (
  id bigserial primary key,
  name text not null,
  sku text,
  product_name text,
  metrics jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  ai_insight jsonb,
  model text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.luma_hpp_scenarios enable row level security;
drop policy if exists hpp_scenarios_admin on public.luma_hpp_scenarios;
create policy hpp_scenarios_admin on public.luma_hpp_scenarios for all to authenticated
using (public.luma_is_admin()) with check (public.luma_is_admin());

insert into public.luma_platform_settings(setting_key,setting_value)
values
('usd_idr_rate','17745'),
('openai_primary_model','gpt-5.6-sol'),
('openai_fallback_model','gpt-5.6-luna'),
('whatsapp_failover_enabled','true'),
('whatsapp_provider_order','flowkirim,convia,meta')
on conflict(setting_key) do nothing;

update public.luma_api_usage_events
set cost_usd = round(((coalesce(input_tokens,0)::numeric * 4) + (coalesce(output_tokens,0)::numeric * 20)) / 1000000, 8),
    cost_idr = round((((coalesce(input_tokens,0)::numeric * 4) + (coalesce(output_tokens,0)::numeric * 20)) / 1000000) * 17745, 2)
where provider='openai'
  and coalesce(model,'') in ('gpt-5.6-sol','gpt-5.6')
  and coalesce(cost_usd,0)=0;
