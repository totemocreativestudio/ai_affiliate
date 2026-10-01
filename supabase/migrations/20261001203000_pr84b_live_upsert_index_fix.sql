-- PR84B hotfix: PostgREST upsert needs inferable non-partial unique indexes.
drop index if exists public.live_sessions_source_natural_key_uq;
create unique index live_sessions_source_natural_key_uq
  on public.live_sessions(workspace_id,platform,source_natural_key);

drop index if exists public.live_perf_source_row_key_uq;
create unique index live_perf_source_row_key_uq
  on public.live_session_performance(workspace_id,source_row_key);
