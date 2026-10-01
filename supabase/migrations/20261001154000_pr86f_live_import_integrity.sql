-- PR86F Live import integrity, deletion and RPC hardening
create or replace function public.luma_validate_live_import_context_v1()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' then
    if nullif(btrim(coalesce(new.store_name,'')),'') is null then
      raise exception 'Nama toko wajib dipilih atau diisi sebelum import diselesaikan';
    end if;
    if nullif(btrim(coalesce(new.store_id,'')),'') is null then
      raise exception 'ID toko wajib dipilih atau diisi sebelum import diselesaikan';
    end if;
    if nullif(btrim(coalesce(new.store_username,'')),'') is null then
      raise exception 'Username toko wajib dipilih atau diisi sebelum import diselesaikan';
    end if;
    if new.host_id is null then
      raise exception 'Host wajib dipilih sebelum import diselesaikan';
    end if;
    if not exists (
      select 1 from public.live_hosts h
      where h.id=new.host_id and h.workspace_id=new.workspace_id and h.status='active'
    ) then
      raise exception 'Host tidak valid, tidak aktif, atau berasal dari workspace lain';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists trg_live_import_context_guard on public.live_imports;
create trigger trg_live_import_context_guard
before insert or update of status, store_name, store_id, store_username, host_id
on public.live_imports
for each row execute function public.luma_validate_live_import_context_v1();

create index if not exists live_daily_performance_source_import_idx on public.live_daily_performance(workspace_id,source_import_id);
create index if not exists live_product_performance_source_import_idx on public.live_product_performance(workspace_id,source_import_id);
create index if not exists live_period_overview_source_import_idx on public.live_period_overview(workspace_id,source_import_id);
create index if not exists live_session_performance_source_import_idx on public.live_session_performance(workspace_id,source_import_id);
create index if not exists live_sessions_source_import_idx on public.live_sessions(workspace_id,source_import_id);
create index if not exists live_traffic_sources_source_import_idx on public.live_traffic_sources(workspace_id,source_import_id);

create or replace function public.luma_delete_live_import_v1(p_workspace_id uuid, p_import_id text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_daily int:=0; v_product int:=0; v_overview int:=0; v_traffic int:=0;
  v_session_perf int:=0; v_sessions int:=0; v_imports int:=0;
  v_created_by uuid; v_exists boolean:=false;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;
  if nullif(trim(coalesce(p_import_id,'')),'') is null then raise exception 'Import ID required'; end if;

  select true, created_by into v_exists,v_created_by
  from public.live_imports
  where workspace_id=p_workspace_id and import_id=p_import_id limit 1;
  if not coalesce(v_exists,false) then raise exception 'Import not found'; end if;

  if v_created_by is distinct from auth.uid()
     and not public.luma_is_admin()
     and not exists(
       select 1 from public.workspace_members wm
       where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()
         and lower(coalesce(wm.membership_role,'')) in ('owner','admin')
     )
  then raise exception 'Only uploader or workspace owner can delete this import' using errcode='42501'; end if;

  delete from public.live_daily_performance where workspace_id=p_workspace_id and source_import_id=p_import_id;
  get diagnostics v_daily=row_count;
  delete from public.live_product_performance where workspace_id=p_workspace_id and source_import_id=p_import_id;
  get diagnostics v_product=row_count;
  delete from public.live_traffic_sources where workspace_id=p_workspace_id and source_import_id=p_import_id;
  get diagnostics v_traffic=row_count;
  delete from public.live_period_overview where workspace_id=p_workspace_id and source_import_id=p_import_id;
  get diagnostics v_overview=row_count;
  delete from public.live_session_performance where workspace_id=p_workspace_id and source_import_id=p_import_id;
  get diagnostics v_session_perf=row_count;
  delete from public.live_sessions s
  where s.workspace_id=p_workspace_id and s.source_import_id=p_import_id
    and not exists(select 1 from public.live_session_performance p where p.workspace_id=s.workspace_id and p.session_id=s.id);
  get diagnostics v_sessions=row_count;
  delete from public.live_imports where workspace_id=p_workspace_id and import_id=p_import_id;
  get diagnostics v_imports=row_count;
  if v_imports=0 then raise exception 'Import not found or already deleted'; end if;

  return jsonb_build_object(
    'ok',true,'hard_delete',true,'import_id',p_import_id,
    'deleted',jsonb_build_object(
      'daily_performance',v_daily,'product_performance',v_product,'period_overview',v_overview,
      'traffic_sources',v_traffic,'session_performance',v_session_perf,'sessions',v_sessions,'import_history',v_imports
    )
  );
end
$$;

revoke all on function public.luma_delete_live_import_v1(uuid,text) from public, anon;
grant execute on function public.luma_delete_live_import_v1(uuid,text) to authenticated, service_role;
revoke all on function public.luma_validate_live_import_context_v1() from public, anon;

revoke all on function public.luma_live_product_intelligence_v1(uuid,date,date,text,text) from public, anon;
grant execute on function public.luma_live_product_intelligence_v1(uuid,date,date,text,text) to authenticated, service_role;
