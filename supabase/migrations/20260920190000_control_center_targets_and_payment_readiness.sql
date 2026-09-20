-- Lumaway Control Center monthly target & forecast planning
create table if not exists public.luma_business_monthly_targets (
  id bigserial primary key,
  target_year integer not null check (target_year between 2020 and 2100),
  target_month integer not null check (target_month between 1 and 12),
  target_revenue numeric(18,2) not null default 0 check (target_revenue >= 0),
  forecast_revenue numeric(18,2) not null default 0 check (forecast_revenue >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(target_year,target_month)
);

create index if not exists luma_business_monthly_targets_period_idx
  on public.luma_business_monthly_targets(target_year,target_month);

alter table public.luma_business_monthly_targets enable row level security;
drop policy if exists business_monthly_targets_admin on public.luma_business_monthly_targets;
create policy business_monthly_targets_admin
on public.luma_business_monthly_targets
for all to authenticated
using (public.luma_is_admin())
with check (public.luma_is_admin());

-- Payment gateways start inactive until credentials + live payment flow are verified.
insert into public.luma_provider_accounts(provider,service,display_name,status,cost_config,notes)
values
  ('doku','payments','DOKU · Payments','inactive','{}'::jsonb,'Payment gateway is inactive until live credentials and webhook flow are verified.')
on conflict(provider,service) do update
set display_name=excluded.display_name,
    notes=excluded.notes,
    updated_at=now();

update public.luma_provider_accounts
set status='inactive',
    notes='Payment gateway is inactive until live credentials and a successful paid transaction are verified.',
    updated_at=now()
where provider in ('xendit','doku')
  and service='payments'
  and coalesce(last_status,'')='';
