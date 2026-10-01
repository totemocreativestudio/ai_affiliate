-- PR82K: Follow-up message templates

create table if not exists public.luma_followup_message_templates (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  channel text not null,
  stage text,
  body text not null,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists luma_followup_templates_workspace_idx
  on public.luma_followup_message_templates(workspace_id,channel,stage,active);

alter table public.luma_followup_message_templates enable row level security;

drop policy if exists luma_followup_templates_select on public.luma_followup_message_templates;
create policy luma_followup_templates_select on public.luma_followup_message_templates
for select to authenticated using(public.luma_has_workspace(workspace_id));

drop policy if exists luma_followup_templates_insert on public.luma_followup_message_templates;
create policy luma_followup_templates_insert on public.luma_followup_message_templates
for insert to authenticated with check(public.luma_has_workspace(workspace_id));

drop policy if exists luma_followup_templates_update on public.luma_followup_message_templates;
create policy luma_followup_templates_update on public.luma_followup_message_templates
for update to authenticated using(public.luma_has_workspace(workspace_id)) with check(public.luma_has_workspace(workspace_id));

drop policy if exists luma_followup_templates_delete on public.luma_followup_message_templates;
create policy luma_followup_templates_delete on public.luma_followup_message_templates
for delete to authenticated using(public.luma_has_workspace(workspace_id));
