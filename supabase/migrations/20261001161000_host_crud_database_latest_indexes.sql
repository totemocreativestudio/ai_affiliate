-- Host 360 edit/delete support and Database Center latest-snapshot performance indexes
create index if not exists sales_workspace_type_platform_date_desc_idx
  on public.sales(workspace_id,data_type,platform,data_date desc);

create index if not exists live_sessions_workspace_host_idx
  on public.live_sessions(workspace_id,host_id);

create index if not exists live_imports_workspace_host_idx
  on public.live_imports(workspace_id,host_id);
