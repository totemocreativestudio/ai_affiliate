-- PR87I · Immutable paid/approved calculation windows & controlled import deletion.
create or replace function public.luma_affiliate_guard_claimed_performance_v2()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_old boolean:=false;v_new boolean:=false;
begin
 if tg_op in ('UPDATE','DELETE') then
  select exists(select 1 from public.luma_affiliate_reward_claims c
    where c.program_id=old.program_id and c.creator_id=old.creator_id
      and c.status in ('pending','approved','paid')
      and old.metric_date between c.period_start and c.period_end) into v_old;
 end if;
 if tg_op in ('UPDATE','INSERT') then
  select exists(select 1 from public.luma_affiliate_reward_claims c
    where c.program_id=new.program_id and c.creator_id=new.creator_id
      and c.status in ('pending','approved','paid')
      and new.metric_date between c.period_start and c.period_end) into v_new;
 end if;
 if v_old or v_new then
  raise exception 'Performa pada periode klaim pending/approved/paid tidak boleh diubah atau dihapus' using errcode='23514';
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists luma_affiliate_performance_claim_lock on public.luma_affiliate_program_performance;
create trigger luma_affiliate_performance_claim_lock
 before insert or update or delete on public.luma_affiliate_program_performance
 for each row execute function public.luma_affiliate_guard_claimed_performance_v2();

create or replace function public.luma_affiliate_guard_claimed_program_v2()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.luma_affiliate_reward_claims c
   where c.program_id=old.id and c.status in ('pending','approved','paid'))
   and (new.workspace_id,new.kind,new.metric,new.platform,new.channel,new.store_id,
        new.product_master_id,new.target_value,new.reward_type,new.reward_value,
        new.reward_product_master_id,new.extra_incentive_per_unit,new.tier_rules,
        new.start_date,new.end_date,new.claim_deadline,new.claim_limit)
     is distinct from
       (old.workspace_id,old.kind,old.metric,old.platform,old.channel,old.store_id,
        old.product_master_id,old.target_value,old.reward_type,old.reward_value,
        old.reward_product_master_id,old.extra_incentive_per_unit,old.tier_rules,
        old.start_date,old.end_date,old.claim_deadline,old.claim_limit) then
    raise exception 'Program sudah memiliki klaim; aturan reward terkunci untuk menjaga audit' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists luma_affiliate_program_claim_lock on public.luma_affiliate_programs;
create trigger luma_affiliate_program_claim_lock
 before update on public.luma_affiliate_programs for each row
 execute function public.luma_affiliate_guard_claimed_program_v2();

create or replace function public.luma_affiliate_delete_import_v2(
 p_workspace_id uuid,p_import_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare imp public.luma_affiliate_program_imports%rowtype;v_removed bigint;
begin
 if auth.uid() is null or not public.luma_is_workspace_admin(p_workspace_id) then
   raise exception 'Only owner/admin workspace can delete imported reports' using errcode='42501';
 end if;
 select * into imp from public.luma_affiliate_program_imports
 where id=p_import_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'Laporan tidak ditemukan';end if;
 perform 1 from public.luma_affiliate_programs p where p.id=imp.program_id
    and p.workspace_id=p_workspace_id for update;
 if exists (select 1 from public.luma_affiliate_reward_claims c
  where c.program_id=imp.program_id and c.status in ('pending','approved','paid')) then
   raise exception 'Batalkan/selesaikan review klaim dahulu; laporan program dengan klaim terkunci tidak bisa dihapus';
 end if;
 select count(*) into v_removed from public.luma_affiliate_program_performance perf
 where perf.import_id=imp.id and perf.workspace_id=p_workspace_id;
 -- FK cascades performance rows; import metadata is also removed.
 delete from public.luma_affiliate_program_imports where id=imp.id and workspace_id=p_workspace_id;
 return jsonb_build_object('ok',true,'removed_rows',v_removed,'import_id',p_import_id);
end $$;
revoke all on function public.luma_affiliate_delete_import_v2(uuid,uuid) from public,anon;
grant execute on function public.luma_affiliate_delete_import_v2(uuid,uuid) to authenticated;
