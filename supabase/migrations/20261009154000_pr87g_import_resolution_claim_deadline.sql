-- PR87G: claim window starts after the program closes.
-- Without explicit claim deadline, allow 30 calendar days after end_date.
create or replace function public.luma_affiliate_claim_deadline_v1(p_end_date date,p_claim_deadline date)
returns date language sql immutable strict as $$
 select coalesce(p_claim_deadline, p_end_date + 30)
$$;
-- non-STRICT overload because p_claim_deadline is allowed to be null
create or replace function public.luma_affiliate_claim_deadline_effective_v1(p_end_date date,p_claim_deadline date)
returns date language sql immutable as $$
 select coalesce(p_claim_deadline,p_end_date+30)
$$;
alter table public.luma_affiliate_programs
 add constraint luma_affiliate_claim_deadline_check
 check(claim_deadline is null or claim_deadline>end_date);
create or replace function public.luma_affiliate_resolve_import_master_v2(
 p_workspace_id uuid,p_program_id uuid,p_creator_tokens jsonb,p_sku_tokens jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_creators jsonb;v_products jsonb;v_count int;
begin
 if auth.uid() is null or (not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin()) then
   raise exception 'Workspace access denied' using errcode='42501';
 end if;
 if not exists(select 1 from public.luma_affiliate_programs
   where id=p_program_id and workspace_id=p_workspace_id) then
   raise exception 'Program not found';
 end if;
 if jsonb_typeof(p_creator_tokens)<>'array' or jsonb_typeof(p_sku_tokens)<>'array'
    or jsonb_array_length(p_creator_tokens)>5000 or jsonb_array_length(p_sku_tokens)>5000 then
    raise exception 'Token import tidak valid atau terlalu banyak';
 end if;
 with tokens as(
   select distinct regexp_replace(lower(btrim(x)),'[^a-z0-9]+','','g') token
   from jsonb_array_elements_text(p_creator_tokens) x
 ), aliases as (
   select distinct t.token,c.id
   from public.luma_affiliate_program_participants pp
   join public.creators c on c.id=pp.creator_id and c.workspace_id=p_workspace_id
   cross join lateral (values(c.name),(c.username),(c.creator_code),(c.affiliate_id)) z(raw)
   join tokens t on t.token=regexp_replace(lower(coalesce(z.raw,'')),'[^a-z0-9]+','','g')
   where pp.program_id=p_program_id and pp.workspace_id=p_workspace_id and pp.status='active' and t.token<>''
 ), valid as (
   select token,min(id) id from aliases group by token having count(distinct id)=1
 )
 select coalesce(jsonb_object_agg(token,id),'{}'::jsonb) into v_creators from valid;
 with tokens as(
   select distinct regexp_replace(lower(btrim(x)),'[^a-z0-9]+','','g') token
   from jsonb_array_elements_text(p_sku_tokens) x
 ), valid as (
  select t.token,min(pm.id) id
  from tokens t join public.product_master pm on pm.workspace_id=p_workspace_id
    and t.token=regexp_replace(lower(coalesce(pm.sku,'')),'[^a-z0-9]+','','g')
  where t.token<>''
  group by t.token having count(distinct pm.id)=1
 )
 select coalesce(jsonb_object_agg(token,id),'{}'::jsonb) into v_products from valid;
 return jsonb_build_object('creator_ids',v_creators,'product_ids',v_products);
end $$;
revoke all on function public.luma_affiliate_resolve_import_master_v2(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.luma_affiliate_resolve_import_master_v2(uuid,uuid,jsonb,jsonb) to authenticated;

-- Faster workspace/store/channel scoped reward aggregation.
create index if not exists luma_program_perf_filter_idx
 on public.luma_affiliate_program_performance(program_id,creator_id,metric_date,source_channel,store_id,product_master_id);
