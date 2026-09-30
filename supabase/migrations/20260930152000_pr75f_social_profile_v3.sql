-- PR75F: richer authenticated Community profile data for Social V3
create or replace function public.luma_get_social_profile_v3(p_user_id uuid)
returns table(
  user_id uuid,
  social_alias text,
  social_avatar_key text,
  social_avatar_url text,
  bio text,
  position_title text,
  post_count bigint,
  follower_count bigint,
  following_count bigint,
  like_count bigint,
  save_count bigint,
  subscribed_by_me boolean
)
language sql
security definer
set search_path to 'public','pg_temp'
as $function$
  select
    p.id,
    coalesce(nullif(trim(p.social_alias),''),'LumaUser'),
    coalesce(nullif(trim(p.social_avatar_key),''),'dino-emerald-happy'),
    p.social_avatar_url,
    nullif(trim(p.bio),''),
    nullif(trim(p.position_title),''),
    (select count(*) from public.luma_community_posts cp where cp.user_id=p.id and cp.status='published'),
    (select count(*) from public.luma_community_subscriptions s where s.subscribed_user_id=p.id),
    (select count(*) from public.luma_community_subscriptions s where s.user_id=p.id),
    (select count(*) from public.luma_community_likes l join public.luma_community_posts cp on cp.id=l.post_id where cp.user_id=p.id and cp.status='published'),
    (select count(*) from public.luma_community_saves sv join public.luma_community_posts cp on cp.id=sv.post_id where cp.user_id=p.id and cp.status='published'),
    exists(
      select 1 from public.luma_community_subscriptions s
      where s.user_id=auth.uid() and s.subscribed_user_id=p.id
    )
  from public.profiles p
  where p.id=p_user_id
    and auth.uid() is not null;
$function$;

revoke all on function public.luma_get_social_profile_v3(uuid) from public,anon;
grant execute on function public.luma_get_social_profile_v3(uuid) to authenticated;

create or replace function public.luma_get_social_user_posts_v3(
  p_user_id uuid,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table(
  id bigint,
  user_id uuid,
  body text,
  image_url text,
  image_urls jsonb,
  created_at timestamptz,
  social_alias text,
  social_avatar_key text,
  social_avatar_url text,
  like_count bigint,
  save_count bigint,
  liked_by_me boolean,
  saved_by_me boolean,
  subscribed_by_me boolean,
  subscriber_count bigint
)
language sql
security definer
set search_path to 'public','pg_temp'
as $function$
  select
    p.id,
    p.user_id,
    p.body,
    p.image_url,
    case
      when jsonb_typeof(p.image_urls)='array' and jsonb_array_length(p.image_urls)>0 then p.image_urls
      when p.image_url is not null then jsonb_build_array(p.image_url)
      else '[]'::jsonb
    end,
    p.created_at,
    coalesce(nullif(trim(pr.social_alias),''),'LumaUser'),
    coalesce(nullif(trim(pr.social_avatar_key),''),'dino-emerald-happy'),
    pr.social_avatar_url,
    (select count(*) from public.luma_community_likes l where l.post_id=p.id),
    (select count(*) from public.luma_community_saves sv where sv.post_id=p.id),
    exists(select 1 from public.luma_community_likes l where l.post_id=p.id and l.user_id=auth.uid()),
    exists(select 1 from public.luma_community_saves sv where sv.post_id=p.id and sv.user_id=auth.uid()),
    exists(select 1 from public.luma_community_subscriptions s where s.user_id=auth.uid() and s.subscribed_user_id=p.user_id),
    (select count(*) from public.luma_community_subscriptions s where s.subscribed_user_id=p.user_id)
  from public.luma_community_posts p
  join public.profiles pr on pr.id=p.user_id
  where p.status='published'
    and p.user_id=p_user_id
    and auth.uid() is not null
  order by p.created_at desc
  limit greatest(1,least(coalesce(p_limit,24),100))
  offset greatest(coalesce(p_offset,0),0);
$function$;

revoke all on function public.luma_get_social_user_posts_v3(uuid,integer,integer) from public,anon;
grant execute on function public.luma_get_social_user_posts_v3(uuid,integer,integer) to authenticated;
