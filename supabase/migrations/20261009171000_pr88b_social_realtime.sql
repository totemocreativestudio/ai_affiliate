-- Enable real-time cross-user Social updates; public posts/interactions only.
do $$
declare r record;
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  for r in
   select unnest(array['luma_community_posts','luma_community_likes','luma_community_subscriptions']) as tbl
  loop
   if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename=r.tbl
   ) then execute format('alter publication supabase_realtime add table public.%I',r.tbl);
   end if;
  end loop;
 end if;
end $$;
alter table public.luma_community_likes replica identity full;
alter table public.luma_community_subscriptions replica identity full;
