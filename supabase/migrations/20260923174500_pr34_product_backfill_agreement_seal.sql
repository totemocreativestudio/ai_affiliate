-- PR34 completion: backfill historical Product Performance into Product Master
-- and enforce a server-side 22-character alphanumeric Digital Seal for Agreements.

update public.sales
set product_code=sku
where data_type='product_performance'
  and product_code is null
  and nullif(sku,'') is not null;

with source as (
  select distinct on (s.workspace_id,lower(coalesce(s.platform,'')),lower(coalesce(s.product_code,'')))
    s.workspace_id,
    coalesce(nullif(s.product_code,''),nullif(s.sku,'')) as product_code,
    coalesce(nullif(s.product_name,''),coalesce(nullif(s.product_code,''),nullif(s.sku,''))) as product_name
  from public.sales s
  where s.data_type='product_performance'
    and coalesce(nullif(s.product_code,''),nullif(s.sku,'')) is not null
    and not exists (
      select 1 from public.product_platform_items ppi
      where ppi.workspace_id=s.workspace_id
        and lower(ppi.platform)=lower(coalesce(s.platform,''))
        and lower(ppi.product_code)=lower(coalesce(nullif(s.product_code,''),nullif(s.sku,'')))
    )
  order by s.workspace_id,lower(coalesce(s.platform,'')),lower(coalesce(s.product_code,'')),s.imported_at desc nulls last
)
insert into public.product_master(
  workspace_id,sku,sku_normalized,product_name,category,selling_price,cost_price,point_per_unit,status,notes,updated_at
)
select src.workspace_id,src.product_code,lower(src.product_code),src.product_name,null,0,0,0,'Active',
       'Auto-created from historical Product Performance',now()
from source src
on conflict (workspace_id,sku_normalized) do nothing;

with source as (
  select distinct on (s.workspace_id,lower(coalesce(s.platform,'')),lower(coalesce(s.product_code,'')))
    s.workspace_id,
    coalesce(nullif(s.platform,''),'Other') as platform,
    coalesce(nullif(s.product_code,''),nullif(s.sku,'')) as product_code,
    coalesce(nullif(s.product_name,''),coalesce(nullif(s.product_code,''),nullif(s.sku,''))) as product_name
  from public.sales s
  where s.data_type='product_performance'
    and coalesce(nullif(s.product_code,''),nullif(s.sku,'')) is not null
  order by s.workspace_id,lower(coalesce(s.platform,'')),lower(coalesce(s.product_code,'')),s.imported_at desc nulls last
)
insert into public.product_platform_items(
  workspace_id,product_master_id,sku,platform,product_code,product_name,variant_slot,variant_name,updated_at
)
select src.workspace_id,pm.id,pm.sku,src.platform,src.product_code,src.product_name,null,null,now()
from source src
join public.product_master pm
  on pm.workspace_id=src.workspace_id and pm.sku_normalized=lower(src.product_code)
where not exists (
  select 1 from public.product_platform_items ppi
  where ppi.workspace_id=src.workspace_id
    and lower(ppi.platform)=lower(src.platform)
    and lower(ppi.product_code)=lower(src.product_code)
)
on conflict (workspace_id,platform,product_code) do nothing;

create or replace function public.luma_random_alnum22()
returns text
language plpgsql
volatile
set search_path to 'public','pg_temp'
as $function$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  output text := '';
  i integer;
begin
  for i in 1..22 loop
    output := output || substr(chars, 1 + floor(random() * length(chars))::integer, 1);
  end loop;
  return output;
end
$function$;

revoke all on function public.luma_random_alnum22() from public,anon,authenticated;

create or replace function public.luma_agreement_seal_defaults()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  attempt integer := 0;
begin
  if nullif(trim(new.e_stamp_id),'') is null then
    loop
      new.e_stamp_id := public.luma_random_alnum22();
      exit when not exists (
        select 1 from public.agreements a
        where a.workspace_id=new.workspace_id and a.e_stamp_id=new.e_stamp_id
          and (tg_op='INSERT' or a.id<>new.id)
      );
      attempt := attempt + 1;
      if attempt > 10 then raise exception 'Gagal membuat Digital Seal ID unik.'; end if;
    end loop;
  end if;

  if new.e_stamp_id !~ '^[A-Za-z0-9]{22}$' then
    raise exception 'Digital Seal ID wajib tepat 22 karakter angka/huruf.';
  end if;

  if nullif(trim(new.signed_by_name),'') is null then
    new.signed_by_name := coalesce(nullif(trim(new.creator_name),''),'Creator');
  end if;
  if new.signed_at is null then new.signed_at := now(); end if;
  return new;
end
$function$;

drop trigger if exists trg_agreement_seal_defaults on public.agreements;
create trigger trg_agreement_seal_defaults
before insert or update of e_stamp_id,signed_by_name,signed_at,creator_name
on public.agreements
for each row execute function public.luma_agreement_seal_defaults();

revoke all on function public.luma_agreement_seal_defaults() from public,anon,authenticated;
