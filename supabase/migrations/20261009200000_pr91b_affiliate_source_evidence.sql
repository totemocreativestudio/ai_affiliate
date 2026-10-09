-- PR91b: link source evidence to reward programs without double-counting it as daily reward performance.
create table if not exists public.luma_affiliate_program_evidence(
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 program_id uuid not null references public.luma_affiliate_programs(id) on delete cascade,
 source_import_id uuid not null references public.luma_creator_attribution_imports(id) on delete cascade,
 attached_by uuid not null references auth.users(id),
 attached_at timestamptz not null default now(),
 primary key(program_id,source_import_id)
);
create index if not exists luma_program_evidence_workspace_idx
 on public.luma_affiliate_program_evidence(workspace_id,program_id);
create or replace function public.luma_affiliate_evidence_integrity_v1()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare ws_program uuid;ws_source uuid;program_platform text;source_platform text;
begin
 select workspace_id,platform into ws_program,program_platform
 from public.luma_affiliate_programs where id=new.program_id;
 select workspace_id,platform into ws_source,source_platform
 from public.luma_creator_attribution_imports where id=new.source_import_id and import_status='completed';
 if ws_program is distinct from new.workspace_id or ws_source is distinct from new.workspace_id
  or lower(coalesce(program_platform,''))<>lower(coalesce(source_platform,'')) then
  raise exception 'Program atau sumber Excel berasal dari workspace/platform berbeda' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists luma_affiliate_evidence_guard on public.luma_affiliate_program_evidence;
create trigger luma_affiliate_evidence_guard before insert or update on public.luma_affiliate_program_evidence
 for each row execute function public.luma_affiliate_evidence_integrity_v1();
alter table public.luma_affiliate_program_evidence enable row level security;
drop policy if exists affiliate_evidence_read on public.luma_affiliate_program_evidence;
drop policy if exists affiliate_evidence_insert on public.luma_affiliate_program_evidence;
drop policy if exists affiliate_evidence_delete on public.luma_affiliate_program_evidence;
create policy affiliate_evidence_read on public.luma_affiliate_program_evidence for select to authenticated
 using(public.luma_has_workspace(workspace_id));
create policy affiliate_evidence_insert on public.luma_affiliate_program_evidence for insert to authenticated
 with check(public.luma_has_workspace(workspace_id) and attached_by=auth.uid());
create policy affiliate_evidence_delete on public.luma_affiliate_program_evidence for delete to authenticated
 using(public.luma_is_workspace_admin(workspace_id) or public.luma_workspace_role(workspace_id)='manager');
grant select,insert,delete on public.luma_affiliate_program_evidence to authenticated;
