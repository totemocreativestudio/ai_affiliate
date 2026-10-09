-- PR91: atomic workspace-safe affiliate participant enrollment with explicit identity resolution.
create or replace function public.luma_affiliate_enroll_master_creator_v3(
 p_workspace_id uuid,p_program_id uuid,p_creator_id bigint,p_username text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_creator bigint;v_found bigint;v_count integer;
begin
 if auth.uid() is null or not (
   public.luma_is_workspace_admin(p_workspace_id) or
   public.luma_workspace_role(p_workspace_id)='manager'
 ) then raise exception 'Hanya owner/admin/manager workspace yang dapat mengelola peserta' using errcode='42501';end if;
 if not exists(select 1 from public.luma_affiliate_programs p
   where p.id=p_program_id and p.workspace_id=p_workspace_id)
 then raise exception 'Program tidak ditemukan di workspace aktif' using errcode='23514';end if;
 select id into v_creator from public.creators
 where workspace_id=p_workspace_id and id=p_creator_id
   and merged_into_creator_id is null and lower(coalesce(status,''))<>'merged';
 if v_creator is null and nullif(btrim(coalesce(p_username,'')),'') is not null then
   select count(*),min(id) into v_count,v_found
   from public.creators
   where workspace_id=p_workspace_id
    and lower(btrim(coalesce(username,'')))=lower(btrim(regexp_replace(p_username,'^@+','')))
    and merged_into_creator_id is null and lower(coalesce(status,''))<>'merged';
   if v_count=1 then v_creator:=v_found;end if;
 end if;
 if v_creator is null then
  raise exception 'Creator tidak tercatat dalam Master Creator workspace aktif. Cari creator pada workspace saat ini, lalu pilih dari dropdown.'
    using errcode='23514';
 end if;
 insert into public.luma_affiliate_program_participants(
 workspace_id,program_id,creator_id,status,created_by)
 values(p_workspace_id,p_program_id,v_creator,'active',auth.uid())
 on conflict(program_id,creator_id)
 do update set status='active';
 return jsonb_build_object('ok',true,'creator_id',v_creator,'program_id',p_program_id);
end $$;
revoke all on function public.luma_affiliate_enroll_master_creator_v3(uuid,uuid,bigint,text) from public,anon;
grant execute on function public.luma_affiliate_enroll_master_creator_v3(uuid,uuid,bigint,text) to authenticated;
