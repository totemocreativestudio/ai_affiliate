-- PR80F: Unified Kanban domains
alter table public.creator_tasks
  add column if not exists task_domain text not null default 'affiliate',
  add column if not exists live_session_id uuid references public.live_sessions(id) on delete set null,
  add column if not exists live_campaign_id uuid references public.live_campaigns(id) on delete set null,
  add column if not exists live_host_id uuid references public.live_hosts(id) on delete set null;
do $$ begin if not exists (select 1 from pg_constraint where conname='creator_tasks_task_domain_check') then alter table public.creator_tasks add constraint creator_tasks_task_domain_check check(task_domain in ('affiliate','live_streaming')); end if; end $$;
create index if not exists creator_tasks_workspace_domain_status_idx on public.creator_tasks(workspace_id,task_domain,status,sort_order,id);
create index if not exists creator_tasks_live_refs_idx on public.creator_tasks(workspace_id,live_session_id,live_campaign_id,live_host_id);
