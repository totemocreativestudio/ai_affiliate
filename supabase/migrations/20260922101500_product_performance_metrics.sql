-- Product Performance metrics + import deletion support
alter table public.sales add column if not exists refund_qty numeric not null default 0;
alter table public.sales add column if not exists sales_creator numeric not null default 0;
alter table public.sales add column if not exists flat_fee numeric not null default 0;

create index if not exists sales_workspace_import_idx
  on public.sales(workspace_id, import_id);

create index if not exists imports_workspace_period_idx
  on public.imports(workspace_id, data_type, platform, start_date, end_date);
