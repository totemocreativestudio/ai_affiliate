-- PR80C: Live Streaming Upload History

create table if not exists public.live_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  import_id text not null,
  filename text not null,
  file_hash text,
  platform text,
  period_start date,
  period_end date,
  row_count integer not null default 0,
  persisted_rows integer not null default 0,
  status text not null default 'processing' check(status in ('processing','completed','failed')),
  mapping jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(workspace_id,import_id)
);
create index if not exists live_imports_workspace_created_idx on public.live_imports(workspace_id,created_at desc);
alter table public.live_imports enable row level security;

drop policy if exists live_imports_select on public.live_imports;
create policy live_imports_select on public.live_imports for select to authenticated using(public.luma_has_workspace(workspace_id));
drop policy if exists live_imports_insert on public.live_imports;
create policy live_imports_insert on public.live_imports for insert to authenticated with check(public.luma_has_workspace(workspace_id));
drop policy if exists live_imports_delete on public.live_imports;
create policy live_imports_delete on public.live_imports for delete to authenticated using(public.luma_has_workspace(workspace_id));
