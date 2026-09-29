-- PR72 Product Master Visual Catalog
alter table public.product_master
  add column if not exists image_url text,
  add column if not exists image_alt text,
  add column if not exists gallery_images jsonb not null default '[]'::jsonb;

alter table public.product_variants
  add column if not exists image_url text;

alter table public.product_platform_items
  add column if not exists image_url text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'luma-products',
  'luma-products',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp']::text[]
)
on conflict(id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists luma_products_select on storage.objects;
drop policy if exists luma_products_insert on storage.objects;
drop policy if exists luma_products_update on storage.objects;
drop policy if exists luma_products_delete on storage.objects;

create policy luma_products_select
on storage.objects
for select
to authenticated
using (
  bucket_id='luma-products'
  and (
    public.luma_is_admin()
    or exists (
      select 1 from public.workspace_members wm
      where wm.user_id=auth.uid()
        and wm.workspace_id::text=(storage.foldername(name))[1]
    )
  )
);

create policy luma_products_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='luma-products'
  and (
    public.luma_is_admin()
    or exists (
      select 1 from public.workspace_members wm
      where wm.user_id=auth.uid()
        and wm.workspace_id::text=(storage.foldername(name))[1]
    )
  )
);

create policy luma_products_update
on storage.objects
for update
to authenticated
using (
  bucket_id='luma-products'
  and (
    public.luma_is_admin()
    or exists (
      select 1 from public.workspace_members wm
      where wm.user_id=auth.uid()
        and wm.workspace_id::text=(storage.foldername(name))[1]
    )
  )
)
with check (
  bucket_id='luma-products'
  and (
    public.luma_is_admin()
    or exists (
      select 1 from public.workspace_members wm
      where wm.user_id=auth.uid()
        and wm.workspace_id::text=(storage.foldername(name))[1]
    )
  )
);

create policy luma_products_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id='luma-products'
  and (
    public.luma_is_admin()
    or exists (
      select 1 from public.workspace_members wm
      where wm.user_id=auth.uid()
        and wm.workspace_id::text=(storage.foldername(name))[1]
    )
  )
);

comment on column public.product_master.image_url is 'Primary product image. Prefer luma-products public URL.';
comment on column public.product_master.gallery_images is 'Optional JSON array of additional product image URLs.';
comment on column public.product_variants.image_url is 'Optional variant-specific product image.';
comment on column public.product_platform_items.image_url is 'Optional marketplace-specific product image.';
