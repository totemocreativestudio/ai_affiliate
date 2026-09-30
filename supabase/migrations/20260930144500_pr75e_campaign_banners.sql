-- PR75E: Campaign banner carousel storage + metadata
alter table public.campaign_trackers
  add column if not exists banner_urls jsonb not null default '[]'::jsonb,
  add column if not exists banner_storage_paths jsonb not null default '[]'::jsonb;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'luma-campaigns',
  'luma-campaigns',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp']::text[]
)
on conflict (id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists luma_campaigns_insert on storage.objects;
create policy luma_campaigns_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='luma-campaigns'
  and (
    public.luma_is_admin()
    or exists (
      select 1 from public.workspace_members wm
      where wm.user_id=auth.uid()
        and wm.workspace_id::text=(storage.foldername(name))[1]
    )
  )
);

drop policy if exists luma_campaigns_update on storage.objects;
create policy luma_campaigns_update
on storage.objects for update to authenticated
using (
  bucket_id='luma-campaigns'
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
  bucket_id='luma-campaigns'
  and (
    public.luma_is_admin()
    or exists (
      select 1 from public.workspace_members wm
      where wm.user_id=auth.uid()
        and wm.workspace_id::text=(storage.foldername(name))[1]
    )
  )
);

drop policy if exists luma_campaigns_delete on storage.objects;
create policy luma_campaigns_delete
on storage.objects for delete to authenticated
using (
  bucket_id='luma-campaigns'
  and (
    public.luma_is_admin()
    or exists (
      select 1 from public.workspace_members wm
      where wm.user_id=auth.uid()
        and wm.workspace_id::text=(storage.foldername(name))[1]
    )
  )
);

comment on column public.campaign_trackers.banner_urls is
'Up to 3 campaign banner public URLs rendered as a 10-second auto carousel.';

comment on column public.campaign_trackers.banner_storage_paths is
'Storage object paths backing campaign banner_urls in the luma-campaigns bucket.';
