-- PR 87A · Workspace PIC, unified store directory, community author controls & discovery.
create or replace function public.luma_safe_workspace_assignees_v1(p_workspace_id uuid)
returns table(user_id uuid,safe_label text,is_self boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin()
 then raise exception 'Workspace access denied' using errcode='42501'; end if;
 return query
 select wm.user_id,
   coalesce(nullif(btrim(p.full_name),''),nullif(btrim(p.nickname),''),
            nullif(btrim(p.username),''),nullif(split_part(p.email,'@',1),''),'Anggota Tim')::text as safe_label,
   (wm.user_id=auth.uid()) as is_self
 from public.workspace_members wm
 join public.profiles p on p.id=wm.user_id
 where wm.workspace_id=p_workspace_id and p.active=true
 order by (wm.user_id=auth.uid()) desc,safe_label,wm.user_id;
end $$;
revoke all on function public.luma_safe_workspace_assignees_v1(uuid) from public,anon;
grant execute on function public.luma_safe_workspace_assignees_v1(uuid) to authenticated;

create or replace function public.luma_workspace_add_existing_member_v1(p_workspace_id uuid,p_email text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid; v_label text; v_existing boolean;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not (public.luma_is_admin() or public.luma_is_workspace_admin(p_workspace_id)) then
   raise exception 'Only workspace owner or admin can add a team member' using errcode='42501';
 end if;
 if length(btrim(coalesce(p_email,'')))<5 or position('@' in p_email)<2 then
   raise exception 'Email tidak valid';
 end if;
 select p.id,coalesce(nullif(btrim(p.full_name),''),nullif(btrim(p.nickname),''),split_part(p.email,'@',1))
 into v_user,v_label
 from public.profiles p
 where lower(btrim(p.email))=lower(btrim(p_email)) and p.active=true
 limit 1;
 if v_user is null then
   return jsonb_build_object('ok',false,'code','not_registered','message','Email belum terdaftar. Minta anggota membuat akun Lumaway lebih dulu.');
 end if;
 select exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=v_user) into v_existing;
 if not v_existing then
   insert into public.workspace_members(workspace_id,user_id,membership_role)
   values(p_workspace_id,v_user,'member')
   on conflict do nothing;
 end if;
 return jsonb_build_object('ok',true,'already_member',v_existing,'name',v_label,'user_id',v_user);
end $$;
revoke all on function public.luma_workspace_add_existing_member_v1(uuid,text) from public,anon;
grant execute on function public.luma_workspace_add_existing_member_v1(uuid,text) to authenticated;

create table if not exists public.luma_workspace_stores(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 platform text not null default 'Other',
 store_name text not null check (length(btrim(store_name))>0),
 store_id text,
 store_username text,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists luma_workspace_stores_unique_name_idx
 on public.luma_workspace_stores(workspace_id,lower(platform),lower(store_name));
create index if not exists luma_workspace_stores_lookup_idx on public.luma_workspace_stores(workspace_id,platform);
alter table public.luma_workspace_stores enable row level security;
drop policy if exists luma_workspace_stores_select on public.luma_workspace_stores;
drop policy if exists luma_workspace_stores_insert on public.luma_workspace_stores;
drop policy if exists luma_workspace_stores_update on public.luma_workspace_stores;
drop policy if exists luma_workspace_stores_delete on public.luma_workspace_stores;
create policy luma_workspace_stores_select on public.luma_workspace_stores for select to authenticated
 using (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy luma_workspace_stores_insert on public.luma_workspace_stores for insert to authenticated
 with check ((public.luma_has_workspace(workspace_id) or public.luma_is_admin()) and created_by=auth.uid());
create policy luma_workspace_stores_update on public.luma_workspace_stores for update to authenticated
 using (public.luma_has_workspace(workspace_id) or public.luma_is_admin())
 with check (public.luma_has_workspace(workspace_id) or public.luma_is_admin());
create policy luma_workspace_stores_delete on public.luma_workspace_stores for delete to authenticated
 using (public.luma_is_workspace_admin(workspace_id) or public.luma_is_admin());
grant select,insert,update,delete on public.luma_workspace_stores to authenticated;
alter table public.shipping add column if not exists store_id text;

create or replace function public.luma_workspace_store_options_v1(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_data jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
   raise exception 'Workspace access denied' using errcode='42501';
 end if;
 with collected as (
  select platform,store_name,store_id,store_username,0 source_priority from public.luma_workspace_stores where workspace_id=p_workspace_id
  union all
  select platform,store_name,store_id,null::text,1 from public.live_store_profiles where workspace_id=p_workspace_id and status='active'
  union all
  select platform,store_name,store_id,null::text,2 from public.creator_store_affiliations where workspace_id=p_workspace_id
  union all
  select platform,store_name,store_id,null::text,3 from public.sales where workspace_id=p_workspace_id
 ), valid as (
  select coalesce(nullif(btrim(platform),''),'Other') as platform,btrim(store_name) as store_name,
         nullif(btrim(store_id),'') as store_id,nullif(btrim(store_username),'') as store_username,source_priority
  from collected where nullif(btrim(store_name),'') is not null
 ), ranked as (
   select *,row_number() over (partition by lower(platform),lower(store_name) order by source_priority,store_id nulls last) rn
   from valid
 )
 select coalesce(jsonb_agg(jsonb_build_object('platform',platform,'store_name',store_name,
                      'store_id',store_id,'store_username',store_username)
           order by platform,store_name),'[]'::jsonb)
 into v_data from ranked where rn=1;
 return coalesce(v_data,'[]'::jsonb);
end $$;
revoke all on function public.luma_workspace_store_options_v1(uuid) from public,anon;
grant execute on function public.luma_workspace_store_options_v1(uuid) to authenticated;

drop policy if exists pr45_luma_community_posts_delete_auth on public.luma_community_posts;
create policy pr45_luma_community_posts_delete_auth on public.luma_community_posts
 for delete to authenticated using (user_id=(select auth.uid()) or public.luma_is_admin());

create table if not exists public.luma_community_post_events(
 id bigint generated always as identity primary key,
 post_id bigint not null references public.luma_community_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 event_type text not null check(event_type in ('view','share')),
 event_day date not null default (now() at time zone 'UTC')::date,
 created_at timestamptz not null default now(),
 unique(post_id,user_id,event_type,event_day)
);
create index if not exists luma_community_post_events_post_idx on public.luma_community_post_events(post_id,event_type);
alter table public.luma_community_post_events enable row level security;
drop policy if exists luma_community_post_events_insert on public.luma_community_post_events;
create policy luma_community_post_events_insert on public.luma_community_post_events for insert to authenticated
 with check (user_id=(select auth.uid()) and exists (
 select 1 from public.luma_community_posts p where p.id=post_id and p.status='published'));
grant insert on public.luma_community_post_events to authenticated;
grant usage,select on sequence public.luma_community_post_events_id_seq to authenticated;

create or replace function public.luma_social_discover_v1()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 with posts as (
  select p.id,p.user_id,p.body,p.created_at,coalesce(pr.social_alias,pr.full_name,'Lumaway User') author,
    (select count(*) from public.luma_community_likes l where l.post_id=p.id) likes,
    (select count(*) from public.luma_community_saves s where s.post_id=p.id) saves,
    (select count(*) from public.luma_community_post_events e where e.post_id=p.id and e.event_type='view') views,
    (select count(*) from public.luma_community_post_events e where e.post_id=p.id and e.event_type='share') shares
   from public.luma_community_posts p left join public.profiles pr on pr.id=p.user_id
   where p.status='published'
 ), ranked as (
  select id,user_id,left(coalesce(body,''),140) summary,author,likes,saves,views,shares,
         (likes*3+saves*2+views+shares*4) score
  from posts order by (likes*3+saves*2+views+shares*4) desc,created_at desc limit 5
 ), words as (
  select lower(x.token[1]) keyword,count(*) uses
  from public.luma_community_posts p cross join lateral regexp_matches(coalesce(p.body,''),'[[:alpha:]][[:alpha:][:digit:]_]{3,}','g') x(token)
  where p.status='published'
   and lower(x.token[1]) not in ('yang','dengan','untuk','dari','pada','kami','kita','anda','atau','sudah','bisa','akan','jadi','this','that','https','http','www','lumaway','saya','agar','karena','lebih','dalam','sebagai')
  group by lower(x.token[1])
  order by count(*) desc,lower(x.token[1]) limit 5
 )
 select jsonb_build_object(
  'posts',coalesce((select jsonb_agg(to_jsonb(r) order by r.score desc,r.id desc) from ranked r),'[]'::jsonb),
  'keywords',coalesce((select jsonb_agg(to_jsonb(k) order by k.uses desc,k.keyword) from words k),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.luma_social_discover_v1() from public,anon;
grant execute on function public.luma_social_discover_v1() to authenticated;
