-- PR78A: Supabase RLS and SECURITY DEFINER hardening

-- 1) Make service-only RLS intent explicit. Service role bypasses RLS; browser roles stay denied.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'affiliate_ads_support',
    'luma_otp_challenges',
    'luma_payment_checkout_intents',
    'luma_payment_provider_settings',
    'luma_payment_routing',
    'luma_payment_webhook_events',
    'luma_schema_migration_registry',
    'marketing_lead_outbox',
    'marketing_leads'
  ]
  loop
    execute format('drop policy if exists pr78a_client_deny on public.%I',v_table);
    execute format(
      'create policy pr78a_client_deny on public.%I for all to anon,authenticated using (false) with check (false)',
      v_table
    );
  end loop;
end $$;

-- 2) Trigger functions must never be callable as RPCs.
revoke execute on function public.luma_apply_promo_reservation_on_redemption() from public,anon,authenticated;
revoke execute on function public.luma_release_promo_reservation_on_order_terminal() from public,anon,authenticated;
grant execute on function public.luma_apply_promo_reservation_on_redemption() to service_role;
grant execute on function public.luma_release_promo_reservation_on_order_terminal() to service_role;

-- 3) Legacy social feed is an authenticated app feed, not an anonymous RPC.
revoke execute on function public.luma_get_social_feed(integer,integer) from public,anon;
grant execute on function public.luma_get_social_feed(integer,integer) to authenticated;

-- 4) Promo reservation is server-side only. Checkout routes call it with service role.
revoke execute on function public.luma_reserve_promo_v1(bigint,uuid,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.luma_reserve_promo_v1(bigint,uuid,uuid,text,timestamptz) to service_role;

-- 5) Self-service referral profile must not accept arbitrary user/workspace identities.
create or replace function public.luma_ensure_referral_profile(
  p_user_id uuid,
  p_workspace_id uuid default null
)
returns text
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_workspace_id uuid := p_workspace_id;
  v_code text;
  v_try integer := 0;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_user_id<>v_actor and not public.luma_is_admin() then
    raise exception 'User access denied' using errcode='42501';
  end if;

  select referral_code into v_code
  from public.referral_profiles
  where user_id=p_user_id
  limit 1;
  if v_code is not null then return v_code; end if;

  if v_workspace_id is null then
    select workspace_id into v_workspace_id
    from public.workspace_members
    where user_id=p_user_id
    order by created_at asc
    limit 1;
  end if;

  if v_workspace_id is null then
    raise exception 'Workspace not found for referral profile';
  end if;

  if not public.luma_is_admin() and not exists(
    select 1 from public.workspace_members wm
    where wm.workspace_id=v_workspace_id and wm.user_id=v_actor
  ) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  loop
    v_try:=v_try+1;
    if v_try>20 then raise exception 'Unable to generate unique referral code'; end if;
    v_code:=public.luma_generate_referral_code();
    begin
      insert into public.referral_profiles(user_id,referral_code,workspace_id,created_at,updated_at)
      values(p_user_id,v_code,v_workspace_id,now(),now());
      return v_code;
    exception when unique_violation then
      if exists(select 1 from public.referral_profiles where user_id=p_user_id) then
        select referral_code into v_code from public.referral_profiles where user_id=p_user_id limit 1;
        return v_code;
      end if;
    end;
  end loop;
end
$$;

revoke execute on function public.luma_ensure_referral_profile(uuid,uuid) from public,anon;
grant execute on function public.luma_ensure_referral_profile(uuid,uuid) to authenticated,service_role;

-- 6) Social identity creation is self-only unless an owner/admin performs it.
create or replace function public.luma_ensure_social_identity(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  mascots text[]:=array['dino','nailong','dragon','gecko'];
  colors text[]:=array['emerald','violet','amber','sky','coral','mint'];
  moods text[]:=array['happy','sleepy','curious','cool','cheerful','focused'];
  v_actor uuid:=auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_user_id<>v_actor and not public.luma_is_admin() then
    raise exception 'User access denied' using errcode='42501';
  end if;

  update public.profiles
  set social_alias=coalesce(social_alias,public.luma_generate_social_alias()),
      social_avatar_key=coalesce(
        social_avatar_key,
        mascots[1+floor(random()*array_length(mascots,1))::int]||'-'||
        colors[1+floor(random()*array_length(colors,1))::int]||'-'||
        moods[1+floor(random()*array_length(moods,1))::int]
      )
  where id=p_user_id;
end
$$;

revoke execute on function public.luma_ensure_social_identity(uuid) from public,anon;
grant execute on function public.luma_ensure_social_identity(uuid) to authenticated,service_role;

-- 7) Master Creator SECURITY DEFINER reads must validate workspace membership.
create or replace function public.luma_get_master_creators_unique(
  p_workspace_id uuid,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 100
)
returns table(
  id bigint,creator_code text,name text,username text,platform text,affiliate_id text,
  phone text,payment_type text,ratecard numeric,status text,total_count bigint
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with ranked as (
    select c.*,
      row_number() over(
        partition by c.workspace_id,coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))
        order by c.updated_at desc nulls last,c.id desc
      ) rn
    from public.creators c
    where auth.uid() is not null
      and public.luma_has_workspace(p_workspace_id)
      and c.workspace_id=p_workspace_id
      and c.merged_into_creator_id is null
      and lower(coalesce(c.status,''))<>'merged'
  ),
  filtered as (
    select * from ranked r
    where r.rn=1
      and (
        nullif(trim(coalesce(p_search,'')),'') is null
        or coalesce(r.name,'') ilike '%'||trim(p_search)||'%'
        or coalesce(r.username,'') ilike '%'||trim(p_search)||'%'
        or coalesce(r.platform,'') ilike '%'||trim(p_search)||'%'
        or coalesce(r.affiliate_id,'') ilike '%'||trim(p_search)||'%'
      )
  )
  select f.id,f.creator_code,f.name,f.username,f.platform,f.affiliate_id,f.phone,
         f.payment_type,f.ratecard,f.status,count(*) over()
  from filtered f
  order by lower(coalesce(nullif(trim(f.username),''),nullif(trim(f.name),''),f.creator_code)),
           lower(coalesce(f.platform,''))
  limit greatest(1,least(coalesce(p_page_size,100),200))
  offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,100),200));
$$;

create or replace function public.luma_get_master_creators_unique_v2(
  p_workspace_id uuid,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 100
)
returns table(
  id bigint,creator_code text,name text,username text,platform text,affiliate_id text,
  phone text,payment_type text,ratecard numeric,status text,profile_url text,avatar_url text,
  social_links jsonb,social_profile_updated_at timestamptz,total_count bigint
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with ranked as (
    select c.*,
      row_number() over(
        partition by c.workspace_id,coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))
        order by
          case when nullif(trim(coalesce(c.avatar_url,'')),'') is not null then 0 else 1 end,
          c.updated_at desc nulls last,c.id desc
      ) rn
    from public.creators c
    where auth.uid() is not null
      and public.luma_has_workspace(p_workspace_id)
      and c.workspace_id=p_workspace_id
      and c.merged_into_creator_id is null
      and lower(coalesce(c.status,''))<>'merged'
  ),
  filtered as (
    select * from ranked r
    where r.rn=1
      and (
        nullif(trim(coalesce(p_search,'')),'') is null
        or coalesce(r.name,'') ilike '%'||trim(p_search)||'%'
        or coalesce(r.username,'') ilike '%'||trim(p_search)||'%'
        or coalesce(r.platform,'') ilike '%'||trim(p_search)||'%'
        or coalesce(r.affiliate_id,'') ilike '%'||trim(p_search)||'%'
      )
  )
  select f.id,f.creator_code,f.name,f.username,f.platform,f.affiliate_id,f.phone,
         f.payment_type,f.ratecard,f.status,f.profile_url,f.avatar_url,
         coalesce(f.social_links,'{}'::jsonb),f.social_profile_updated_at,count(*) over()
  from filtered f
  order by lower(coalesce(nullif(trim(f.username),''),nullif(trim(f.name),''),f.creator_code)),
           lower(coalesce(f.platform,''))
  limit greatest(1,least(coalesce(p_page_size,100),200))
  offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,100),200));
$$;

revoke execute on function public.luma_get_master_creators_unique(uuid,text,integer,integer) from public,anon;
revoke execute on function public.luma_get_master_creators_unique_v2(uuid,text,integer,integer) from public,anon;
grant execute on function public.luma_get_master_creators_unique(uuid,text,integer,integer) to authenticated,service_role;
grant execute on function public.luma_get_master_creators_unique_v2(uuid,text,integer,integer) to authenticated,service_role;

comment on function public.luma_get_public_share_post(bigint) is
'PR78A accepted public SECURITY DEFINER exception. Returns only published post id/body/image/created_at for intentional public share URLs.';
comment on function public.luma_active_promotions_v1() is
'PR78A authenticated global catalog exception. Returns only active published promotion metadata; no tenant-private data.';
