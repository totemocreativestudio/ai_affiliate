-- PR87D: enforce affiliate program and import references inside the same workspace.
create or replace function public.luma_affiliate_program_enforce_master_v1()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_ws uuid;
begin
 if new.product_master_id is not null then
  select workspace_id into v_ws from public.product_master where id=new.product_master_id;
  if v_ws is distinct from new.workspace_id then raise exception 'Program product workspace mismatch' using errcode='23514';end if;
 end if;
 if new.reward_product_master_id is not null then
  select workspace_id into v_ws from public.product_master where id=new.reward_product_master_id;
  if v_ws is distinct from new.workspace_id then raise exception 'Reward product workspace mismatch' using errcode='23514';end if;
 end if;
 return new;
end $$;
drop trigger if exists luma_affiliate_program_master_guard on public.luma_affiliate_programs;
create trigger luma_affiliate_program_master_guard
 before insert or update on public.luma_affiliate_programs for each row execute function public.luma_affiliate_program_enforce_master_v1();

create or replace function public.luma_affiliate_program_enforce_import_v1()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_ws uuid;
begin
 select workspace_id into v_ws from public.luma_affiliate_programs where id=new.program_id;
 if v_ws is distinct from new.workspace_id then
  raise exception 'Import program workspace mismatch' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists luma_affiliate_program_import_guard on public.luma_affiliate_program_imports;
create trigger luma_affiliate_program_import_guard
 before insert or update on public.luma_affiliate_program_imports
 for each row execute function public.luma_affiliate_program_enforce_import_v1();

create or replace function public.luma_affiliate_program_validate_workspace_v1()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_program uuid;v_creator uuid;v_agreement uuid;v_import_ws uuid;v_import_program uuid;v_product_ws uuid;
begin
 select workspace_id into v_program from public.luma_affiliate_programs where id=new.program_id;
 if v_program is distinct from new.workspace_id then raise exception 'Program workspace mismatch' using errcode='23514';end if;
 select workspace_id into v_creator from public.creators where id=new.creator_id;
 if v_creator is distinct from new.workspace_id then raise exception 'Creator workspace mismatch' using errcode='23514';end if;
 if tg_table_name='luma_affiliate_program_participants' and new.agreement_id is not null then
   select workspace_id into v_agreement from public.agreements where id=new.agreement_id;
   if v_agreement is distinct from new.workspace_id then raise exception 'Agreement workspace mismatch' using errcode='23514';end if;
 end if;
 if tg_table_name='luma_affiliate_program_performance' then
   select workspace_id,program_id into v_import_ws,v_import_program
   from public.luma_affiliate_program_imports where id=new.import_id;
   if v_import_ws is distinct from new.workspace_id or v_import_program is distinct from new.program_id then
      raise exception 'Performance import workspace/program mismatch' using errcode='23514';
   end if;
   if new.product_master_id is not null then
     select workspace_id into v_product_ws from public.product_master where id=new.product_master_id;
     if v_product_ws is distinct from new.workspace_id then
       raise exception 'Performance SKU workspace mismatch' using errcode='23514';
     end if;
   end if;
 end if;
 return new;
end $$;
