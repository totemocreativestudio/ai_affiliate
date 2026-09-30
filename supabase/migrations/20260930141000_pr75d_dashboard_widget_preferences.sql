-- PR75D: per-user dashboard widget preferences
create table if not exists public.dashboard_widget_preferences (
  id bigserial primary key,
  workspace_id uuid not null,
  user_id uuid not null,
  widget_key text not null,
  is_enabled boolean not null default true,
  display_order integer not null default 0,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,user_id,widget_key)
);

create index if not exists idx_dashboard_widget_preferences_user
  on public.dashboard_widget_preferences(workspace_id,user_id,display_order);

alter table public.dashboard_widget_preferences enable row level security;

drop policy if exists pr75d_dashboard_preferences_select on public.dashboard_widget_preferences;
create policy pr75d_dashboard_preferences_select
on public.dashboard_widget_preferences for select to authenticated
using (
  user_id = auth.uid()
  and public.luma_has_workspace(workspace_id)
);

drop policy if exists pr75d_dashboard_preferences_insert on public.dashboard_widget_preferences;
create policy pr75d_dashboard_preferences_insert
on public.dashboard_widget_preferences for insert to authenticated
with check (
  user_id = auth.uid()
  and public.luma_has_workspace(workspace_id)
);

drop policy if exists pr75d_dashboard_preferences_update on public.dashboard_widget_preferences;
create policy pr75d_dashboard_preferences_update
on public.dashboard_widget_preferences for update to authenticated
using (
  user_id = auth.uid()
  and public.luma_has_workspace(workspace_id)
)
with check (
  user_id = auth.uid()
  and public.luma_has_workspace(workspace_id)
);

drop policy if exists pr75d_dashboard_preferences_delete on public.dashboard_widget_preferences;
create policy pr75d_dashboard_preferences_delete
on public.dashboard_widget_preferences for delete to authenticated
using (
  user_id = auth.uid()
  and public.luma_has_workspace(workspace_id)
);

comment on table public.dashboard_widget_preferences is
'Per-user, per-workspace dashboard layout and widget configuration for Lumaway.';
