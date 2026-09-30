-- PR75B: Shipping Center V2
alter table public.shipping
  add column if not exists reference_no text,
  add column if not exists receiver_name text,
  add column if not exists receiver_phone text,
  add column if not exists receiver_address text,
  add column if not exists sender_name text,
  add column if not exists sender_phone text,
  add column if not exists sender_address text,
  add column if not exists service text,
  add column if not exists branch text,
  add column if not exists weight numeric default 0,
  add column if not exists insurance_amount numeric default 0,
  add column if not exists cod_amount numeric default 0,
  add column if not exists package_contents text,
  add column if not exists notes text,
  add column if not exists shipped_at date,
  add column if not exists delivered_at date;

create index if not exists idx_shipping_workspace_status_date
  on public.shipping(workspace_id,status,data_date desc);

create index if not exists idx_shipping_workspace_reference
  on public.shipping(workspace_id,reference_no)
  where reference_no is not null;

create index if not exists idx_shipping_workspace_tracking
  on public.shipping(workspace_id,tracking)
  where tracking is not null;

update public.shipping
set reference_no = coalesce(reference_no, 'LUMA-' || id::text),
    receiver_name = coalesce(receiver_name, creator_name),
    package_contents = coalesce(package_contents, product_name),
    shipped_at = coalesce(shipped_at, case when lower(coalesce(status,'')) in ('shipped','delivery','delivered','finish') then data_date else null end),
    delivered_at = coalesce(delivered_at, case when lower(coalesce(status,'')) in ('delivered','finish') then data_date else null end)
where reference_no is null
   or receiver_name is null
   or package_contents is null
   or shipped_at is null
   or delivered_at is null;

comment on table public.shipping is
'Workspace-scoped shipping operations for creator samples/products, including internal label preview metadata.';
