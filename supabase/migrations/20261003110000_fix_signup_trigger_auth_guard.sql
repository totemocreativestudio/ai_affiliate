-- Fix: signup blocked by auth.uid() guard inside handle_new_luma_user()
--
-- Symptom: every new user insert fails with GoTrue 500
--   "Database error saving new user" / "Database error creating new user".
-- Existing users are unaffected because the trigger only fires on INSERT.
--
-- Cause: 20260930213000_pr78a_security_rls_hardening.sql added a self-only
-- guard to luma_ensure_referral_profile() and luma_ensure_social_identity():
--
--   v_actor := auth.uid();
--   if v_actor is null then raise exception 'Authentication required'; end if;
--
-- handle_new_luma_user() runs as an AFTER INSERT trigger on auth.users, so no
-- JWT exists yet and auth.uid() is always NULL there. The guard aborts every
-- signup.
--
-- Fix approach: keep the client-side guard fully intact, and explicitly mark
-- the trigger context with a transaction-local GUC that only
-- handle_new_luma_user() sets.
--
-- Note: these helpers are SECURITY DEFINER, so current_user/session_user are
-- the definer/connecting role regardless of the caller. They therefore cannot
-- distinguish "called from the signup trigger" from "called by an end user".
-- An explicit flag is the only reliable discriminator.

-- 1) referral profile seeding: honour the trigger flag, otherwise unchanged.
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
  -- Only set by handle_new_luma_user() during the auth.users INSERT trigger.
  v_internal boolean := coalesce(
    current_setting('luma.signup_trigger', true), ''
  ) = 'on';
begin
  if not v_internal then
    if v_actor is null then
      raise exception 'Authentication required' using errcode='42501';
    end if;
    if p_user_id<>v_actor and not public.luma_is_admin() then
      raise exception 'User access denied' using errcode='42501';
    end if;
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

  if not v_internal
     and not public.luma_is_admin()
     and not exists(
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

-- 2) social identity seeding: honour the trigger flag, otherwise unchanged.
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
  v_internal boolean := coalesce(
    current_setting('luma.signup_trigger', true), ''
  ) = 'on';
begin
  if not v_internal then
    if v_actor is null then
      raise exception 'Authentication required' using errcode='42501';
    end if;
    if p_user_id<>v_actor and not public.luma_is_admin() then
      raise exception 'User access denied' using errcode='42501';
    end if;
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

-- 3) signup trigger: set the flag for the duration of this transaction only.
create or replace function public.handle_new_luma_user()
 returns trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_workspace_id uuid;
begin
  perform set_config('luma.signup_trigger','on',true);

  insert into public.profiles(id,email,full_name,role,active)
  values(new.id,new.email,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),nullif(new.raw_user_meta_data->>'name','')),'staff',true)
  on conflict(id) do update set email=excluded.email,full_name=coalesce(public.profiles.full_name,excluded.full_name);
  v_workspace_id:=public.luma_provision_customer_workspace(new.id);
  perform public.luma_ensure_referral_profile(new.id,v_workspace_id);
  perform public.luma_ensure_social_identity(new.id);

  perform set_config('luma.signup_trigger','off',true);
  return new;
end;
$function$
;
