-- PR89b: match attribution row to Master Creator only when an unambiguous workspace/platform identity exists.
create or replace function public.luma_creator_attribution_guard_v1()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_workspace uuid;v_platform text;v_source text;v_found bigint;v_candidates integer;
begin
 select workspace_id,platform,source_type into v_workspace,v_platform,v_source
 from public.luma_creator_attribution_imports where id=new.import_id;
 if v_workspace is distinct from new.workspace_id or v_platform is distinct from new.platform
    or v_source is distinct from new.source_type then
    raise exception 'Attribution source and workspace mismatch' using errcode='23514';
 end if;
 if new.creator_id is null and (nullif(btrim(coalesce(new.creator_username,'')),'') is not null
    or nullif(btrim(coalesce(new.affiliate_id,'')),'') is not null) then
   with candidates as (
     select distinct c.id
     from public.creators c
     where c.workspace_id=new.workspace_id and lower(coalesce(c.platform,''))=lower(new.platform)
       and (
         (nullif(btrim(coalesce(new.creator_username,'')),'') is not null
           and lower(btrim(coalesce(c.username,'')))=lower(btrim(new.creator_username)))
         or (nullif(btrim(coalesce(new.affiliate_id,'')),'') is not null
           and lower(btrim(coalesce(c.affiliate_id,'')))=lower(btrim(new.affiliate_id)))
       )
   )
   select count(*),min(id) into v_candidates,v_found from candidates;
   if v_candidates=1 then new.creator_id:=v_found;end if;
 end if;
 if new.creator_id is not null and not exists(select 1 from public.creators c
  where c.id=new.creator_id and c.workspace_id=new.workspace_id) then
    raise exception 'Attribution creator belongs to another workspace' using errcode='23514';
 end if;
 return new;
end $$;
create index if not exists luma_creator_attribution_rows_creator_idx
 on public.luma_creator_attribution_rows(workspace_id,creator_id,source_type);
