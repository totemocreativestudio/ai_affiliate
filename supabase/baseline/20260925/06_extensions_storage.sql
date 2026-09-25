-- Lumaway production schema baseline snapshot
-- Captured from Supabase production on 2026-09-25.
-- Disaster-recovery reference only. DO NOT apply to the existing production database.
-- Customer/business row data is intentionally excluded.

-- Extensions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists "uuid-ossp" with schema extensions;

-- Storage buckets
-- luma-avatars
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('luma-avatars','luma-avatars',true,5242880,'{image/png,image/jpeg,image/webp}'::text[]) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- luma-public
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('luma-public','luma-public',true,5242880,'{image/png,image/jpeg,image/webp}'::text[]) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- luma-social
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('luma-social','luma-social',false,1048576,'{image/png,image/jpeg,image/webp}'::text[]) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- luma-support
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('luma-support','luma-support',false,2097152,'{image/jpeg,image/png,image/webp}'::text[]) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Storage RLS policies
-- objects.luma_avatar_delete
create policy luma_avatar_delete on storage.objects as permissive for delete to authenticated using (((bucket_id = 'luma-avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
-- objects.luma_avatar_update
create policy luma_avatar_update on storage.objects as permissive for update to authenticated using (((bucket_id = 'luma-avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) with check (((bucket_id = 'luma-avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
-- objects.luma_avatar_upload
create policy luma_avatar_upload on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'luma-avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));