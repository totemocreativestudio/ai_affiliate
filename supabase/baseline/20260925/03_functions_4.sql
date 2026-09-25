-- Lumaway production schema baseline snapshot
-- Captured from Supabase production on 2026-09-25.
-- Disaster-recovery reference only. DO NOT apply to the existing production database.
-- Customer/business row data is intentionally excluded.

-- luma_seed_free_trial()
CREATE OR REPLACE FUNCTION public.luma_seed_free_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_plan bigint; v_workspace uuid;
begin
  select id into v_plan from public.luma_subscription_plans where code='free_7' and status='active' limit 1;
  select workspace_id into v_workspace from public.workspace_members where user_id=new.id order by created_at asc limit 1;
  if v_plan is not null and not exists(select 1 from public.luma_user_subscriptions where user_id=new.id) then
    insert into public.luma_user_subscriptions(user_id,workspace_id,plan_id,status,priority_level,starts_at,ends_at,source)
    values(new.id,v_workspace,v_plan,'trialing','trial',now(),now()+interval '7 days','signup_trial');
  end if;
  return new;
end $function$
;

-- luma_server_secret_exists(p_name text)
CREATE OR REPLACE FUNCTION public.luma_server_secret_exists(p_name text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
  select exists(select 1 from vault.secrets where name = p_name);
$function$
;

-- luma_set_server_secret(p_name text, p_secret text, p_description text)
CREATE OR REPLACE FUNCTION public.luma_set_server_secret(p_name text, p_secret text, p_description text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name limit 1;
  if v_id is null then
    v_id := vault.create_secret(p_secret, p_name, p_description, null);
  else
    perform vault.update_secret(v_id, p_secret, p_name, p_description, null);
  end if;
  return v_id;
end;
$function$
;

-- luma_social_text_allowed(p_text text)
CREATE OR REPLACE FUNCTION public.luma_social_text_allowed(p_text text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select not (
    lower(coalesce(p_text,'')) ~ '(https?://|www\.)' or
    lower(coalesce(p_text,'')) ~ '[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}' or
    coalesce(p_text,'') ~ '(\+?62|0)[ .\-]?[0-9]{2,4}([ .\-]?[0-9]){6,12}'
  );
$function$
;

-- luma_sync_agreement_creator_status()
CREATE OR REPLACE FUNCTION public.luma_sync_agreement_creator_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.creator_id is not null and new.workspace_id is not null then
    insert into public.creator_360_profiles(workspace_id,creator_id,program_status,updated_at)
    values(new.workspace_id,new.creator_id,'Active',now())
    on conflict(workspace_id,creator_id)
    do update set program_status='Active',updated_at=now();
  end if;
  return new;
end
$function$
;

-- luma_sync_auth_contacts()
CREATE OR REPLACE FUNCTION public.luma_sync_auth_contacts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.profiles
  set email=coalesce(new.email,email),
      phone=case when new.phone is not null and new.phone<>'' then new.phone else phone end,
      phone_verified_at=case when new.phone_confirmed_at is not null then new.phone_confirmed_at else phone_verified_at end,
      updated_at=now()
  where id=new.id;
  return new;
end;
$function$
;

-- luma_sync_creator_identity_key()
CREATE OR REPLACE FUNCTION public.luma_sync_creator_identity_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.identity_key := public.luma_creator_identity_key(new.username,new.name,new.creator_code,new.platform);
  return new;
end
$function$
;

-- luma_sync_workspace_creator_master(p_workspace_id uuid)
CREATE OR REPLACE FUNCTION public.luma_sync_workspace_creator_master(p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not (public.luma_is_admin() or exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()))
  then raise exception 'Workspace access denied' using errcode='42501'; end if;
  return public.luma_sync_workspace_creator_master_internal(p_workspace_id);
end
$function$
;

-- luma_sync_workspace_creator_master_internal(p_workspace_id uuid)
CREATE OR REPLACE FUNCTION public.luma_sync_workspace_creator_master_internal(p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_inserted bigint:=0;v_linked bigint:=0;
begin
  with source as (
    select distinct s.workspace_id,coalesce(nullif(s.platform,''),'Other') platform,
      nullif(s.creator_name,'') creator_name,nullif(s.username,'') username
    from public.sales s
    where s.workspace_id=p_workspace_id
      and s.data_type='performance'
      and s.creator_id is null
      and coalesce(nullif(s.username,''),nullif(s.creator_name,'')) is not null
  ), missing as (
    select src.* from source src where not exists (
      select 1 from public.creators c
      where c.workspace_id=src.workspace_id
        and lower(coalesce(c.platform,''))=lower(src.platform)
        and ((src.username is not null and lower(coalesce(c.username,''))=lower(src.username))
          or (src.creator_name is not null and lower(coalesce(c.name,''))=lower(src.creator_name)))
    )
  ), ins as (
    insert into public.creators(workspace_id,creator_code,name,username,platform,status,updated_at)
    select m.workspace_id,
      'CR-AUTO-'||upper(substr(md5(m.workspace_id::text||'|'||m.platform||'|'||coalesce(m.username,m.creator_name,'')),1,16)),
      coalesce(m.creator_name,m.username),coalesce(m.username,m.creator_name),m.platform,'Active',now()
    from missing m on conflict (creator_code) do nothing returning 1
  ) select count(*) into v_inserted from ins;

  with upd as (
    update public.sales s set creator_id=c.id
    from public.creators c
    where s.workspace_id=p_workspace_id and s.creator_id is null and s.data_type='performance'
      and c.workspace_id=s.workspace_id and lower(coalesce(c.platform,''))=lower(coalesce(s.platform,''))
      and ((nullif(s.username,'') is not null and lower(coalesce(c.username,''))=lower(s.username))
        or (nullif(s.creator_name,'') is not null and lower(coalesce(c.name,''))=lower(s.creator_name)))
    returning 1
  ) select count(*) into v_linked from upd;
  return jsonb_build_object('inserted',v_inserted,'linked_sales',v_linked);
end
$function$
;

-- luma_touch_support_ticket()
CREATE OR REPLACE FUNCTION public.luma_touch_support_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  update public.luma_support_tickets
  set last_message_at = new.created_at, updated_at = new.created_at
  where id = new.ticket_id;
  return new;
end;
$function$
;

-- luma_trim_social_archive()
CREATE OR REPLACE FUNCTION public.luma_trim_social_archive()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.luma_social_archives a
  where a.user_id=new.user_id and a.id not in(
    select id from public.luma_social_archives where user_id=new.user_id order by created_at desc,id desc limit 6
  );
  return new;
end;
$function$
;

-- luma_update_social_identity(p_alias text, p_avatar_url text)
CREATE OR REPLACE FUNCTION public.luma_update_social_identity(p_alias text, p_avatar_url text DEFAULT NULL::text)
 RETURNS TABLE(social_alias text, social_avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_alias text := trim(coalesce(p_alias,''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if char_length(v_alias)<3 or char_length(v_alias)>30 then
    raise exception 'Nama community harus 3-30 karakter.';
  end if;
  if v_alias !~ '^[[:alnum:]_. -]+$' then
    raise exception 'Nama community hanya boleh berisi huruf, angka, spasi, titik, underscore, atau tanda minus.';
  end if;
  if not public.luma_social_text_allowed(v_alias) then
    raise exception 'Nama community tidak boleh berisi kontak atau link.';
  end if;
  if exists(select 1 from public.profiles p where lower(p.social_alias)=lower(v_alias) and p.id<>auth.uid()) then
    raise exception 'Nama community sudah digunakan.';
  end if;

  update public.profiles
  set social_alias=v_alias,
      social_avatar_url=coalesce(nullif(trim(p_avatar_url),''),social_avatar_url),
      updated_at=now()
  where id=auth.uid();

  return query
  select p.social_alias,p.social_avatar_url from public.profiles p where p.id=auth.uid();
end
$function$
;

-- luma_workspace_role(p_workspace_id uuid)
CREATE OR REPLACE FUNCTION public.luma_workspace_role(p_workspace_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT wm.membership_role
    FROM public.workspace_members wm
    JOIN public.profiles p
      ON p.id = wm.user_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
      AND p.active = true
    LIMIT 1;
$function$
;

-- marketing_capture_lead(p_payload jsonb, p_fingerprint text)
CREATE OR REPLACE FUNCTION public.marketing_capture_lead(p_payload jsonb, p_fingerprint text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_request uuid := (p_payload->>'requestId')::uuid;
 v_existing public.marketing_leads%rowtype;
 v_id uuid;
 v_count integer;
begin
 if current_user not in ('service_role','postgres') then raise exception 'marketing_forbidden'; end if;
 if length(p_fingerprint)<>64 or p_payload->>'consent'<>'true'
    or p_payload->>'email' is null or length(p_payload->>'email')>254
    or jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>16000
 then raise exception 'marketing_invalid_payload'; end if;
 perform pg_advisory_xact_lock(hashtextextended('marketing-request:'||v_request::text,0));
 select * into v_existing from public.marketing_leads where request_id=v_request;
 if found then
  if v_existing.payload<>p_payload then raise exception 'marketing_idempotency_conflict'; end if;
  return v_existing.id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('marketing-rate:'||p_fingerprint,0));
 select count(*) into v_count from public.marketing_leads where fingerprint=p_fingerprint and created_at>now()-interval '1 hour';
 if v_count>=5 then raise exception 'marketing_rate_limit'; end if;
 insert into public.marketing_leads(request_id,kind,email,name,company,consent,marketing_consent,payload,fingerprint)
 values(v_request,p_payload->>'kind',lower(p_payload->>'email'),coalesce(p_payload->>'name',''),coalesce(p_payload->>'company',''),true,coalesce((p_payload->>'marketingConsent')::boolean,false),p_payload,p_fingerprint)
 returning id into v_id;
 insert into public.marketing_lead_outbox(lead_id) values(v_id);
 return v_id;
end;
$function$
;

-- notify_withdrawal_status()
CREATE OR REPLACE FUNCTION public.notify_withdrawal_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if tg_op='UPDATE' and new.status is distinct from old.status then
   insert into public.user_notifications(workspace_id,user_id,title,message,kind,is_read,action_url,created_at)
   values(new.workspace_id,new.user_id,
     case lower(new.status) when 'paid' then 'Pencairan referral berhasil' when 'processing' then 'Pencairan referral sedang diproses' when 'rejected' then 'Pencairan referral ditolak' when 'failed' then 'Pencairan referral gagal' else 'Status pencairan referral diperbarui' end,
     'Pengajuan pencairan #'||new.id||' sebesar Rp '||to_char(new.amount,'FM999G999G999G999')||' berstatus '||upper(new.status)||'.',
     'referral_withdrawal',false,'#luma-affiliate',now());
 end if;
 return new;
end $function$
;

-- rls_auto_enable()
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

-- set_affiliate_ads_support(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text, p_amount numeric, p_notes text)
CREATE OR REPLACE FUNCTION public.set_affiliate_ads_support(p_workspace_id uuid, p_start_date date, p_end_date date, p_platform text, p_amount numeric, p_notes text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id bigint;
  v_platform text := coalesce(nullif(trim(p_platform),''),'ALL');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not (
    public.luma_is_admin()
    or exists(
      select 1 from public.workspace_members wm
      where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()
    )
  ) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Periode Ads Spend Support tidak valid' using errcode='22007';
  end if;
  if coalesce(p_amount,0) < 0 then
    raise exception 'Ads Spend Support tidak boleh negatif' using errcode='22003';
  end if;

  insert into public.affiliate_ads_support(
    workspace_id,start_date,end_date,platform,amount,notes,created_by,updated_at
  )
  values(
    p_workspace_id,p_start_date,p_end_date,v_platform,coalesce(p_amount,0),nullif(trim(p_notes),''),
    auth.uid(),now()
  )
  on conflict (workspace_id,start_date,end_date,platform)
  do update set
    amount=excluded.amount,
    notes=excluded.notes,
    updated_at=now(),
    created_by=auth.uid()
  returning id into v_id;

  return v_id;
end
$function$
;

-- sync_creator_store_affiliation()
CREATE OR REPLACE FUNCTION public.sync_creator_store_affiliation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.creator_id is not null and nullif(trim(coalesce(new.store_name,'')),'') is not null then
    insert into public.creator_store_affiliations(workspace_id,creator_id,platform,store_name,store_id,source_import_id,first_seen_at,last_seen_at)
    values(new.workspace_id,new.creator_id,coalesce(nullif(new.platform,''),'Other'),trim(new.store_name),new.store_id,new.import_id,now(),now())
    on conflict(workspace_id,creator_id,platform,store_name) do update set
      store_id=coalesce(excluded.store_id,public.creator_store_affiliations.store_id),
      source_import_id=coalesce(excluded.source_import_id,public.creator_store_affiliations.source_import_id),
      last_seen_at=now();
  end if;
  return new;
end $function$
;
