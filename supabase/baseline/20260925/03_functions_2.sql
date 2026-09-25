-- Lumaway production schema baseline snapshot
-- Captured from Supabase production on 2026-09-25.
-- Disaster-recovery reference only. DO NOT apply to the existing production database.
-- Customer/business row data is intentionally excluded.

-- luma_apply_referral_from_metadata(p_user_id uuid, p_code text)
CREATE OR REPLACE FUNCTION public.luma_apply_referral_from_metadata(p_user_id uuid, p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_ref uuid; begin
  if nullif(trim(coalesce(p_code,'')),'') is null then return; end if;
  select user_id into v_ref from public.referral_profiles where referral_code=upper(trim(p_code)) limit 1;
  if v_ref is null or v_ref=p_user_id then return; end if;
  update public.referral_profiles set referred_by_user_id=v_ref,referred_by_code=upper(trim(p_code)),updated_at=now() where user_id=p_user_id and referred_by_user_id is null;
end; $function$
;

-- luma_can_creator(p_creator_id bigint)
CREATE OR REPLACE FUNCTION public.luma_can_creator(p_creator_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.luma_is_admin()
  or (
    exists (
      select 1
      from public.creators c
      join public.workspace_members wm
        on wm.workspace_id = c.workspace_id and wm.user_id = auth.uid()
      join public.profiles p on p.id = wm.user_id
      where c.id = p_creator_id and p.active = true
    )
    and (
      exists (
        select 1 from public.user_permissions up
        where up.user_id = auth.uid()
          and up.permission = 'creator.view_all'
          and up.enabled = true
      )
      or exists (
        select 1 from public.creator_user_access a
        where a.user_id = auth.uid() and a.creator_id = p_creator_id
      )
    )
  );
$function$
;

-- luma_can_manage_workspace(p_workspace_id uuid)
CREATE OR REPLACE FUNCTION public.luma_can_manage_workspace(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT
        public.luma_is_admin()
        OR public.luma_workspace_role(p_workspace_id)
           IN ('owner', 'admin', 'manager');
$function$
;

-- luma_complete_subscription(p_order_code text, p_payment_reference text, p_provider_payload jsonb)
CREATE OR REPLACE FUNCTION public.luma_complete_subscription(p_order_code text, p_payment_reference text DEFAULT NULL::text, p_provider_payload jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order public.luma_subscription_orders%rowtype;
  v_plan public.luma_subscription_plans%rowtype;
  v_sub public.luma_user_subscriptions%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_month text:=to_char(current_date,'YYYY-MM');
  v_wallet public.luma_token_wallets%rowtype;
  v_is_upgrade boolean:=false;
begin
  select * into v_order from public.luma_subscription_orders where order_code=p_order_code for update;
  if not found then raise exception 'Subscription order not found'; end if;
  if lower(coalesce(v_order.status,''))='paid' then
    return jsonb_build_object('already_paid',true,'plan_id',v_order.plan_id);
  end if;

  select * into v_plan from public.luma_subscription_plans where id=v_order.plan_id;
  if not found then raise exception 'Subscription plan not found'; end if;

  update public.luma_subscription_orders
    set status='paid',
        payment_reference=coalesce(p_payment_reference,payment_reference),
        provider_payload=case
          when p_provider_payload is null then provider_payload
          when provider_payload is null then p_provider_payload
          else provider_payload || p_provider_payload
        end,
        paid_at=now()
  where id=v_order.id;

  if v_order.upgrade_from_subscription_id is not null then
    select * into v_sub
    from public.luma_user_subscriptions
    where id=v_order.upgrade_from_subscription_id
      and user_id=v_order.user_id
    for update;

    if found then
      v_is_upgrade:=true;
      v_start:=now();
      v_end:=now()+make_interval(days=>v_plan.duration_days);
      update public.luma_user_subscriptions
      set workspace_id=coalesce(v_order.workspace_id,workspace_id),
          plan_id=v_plan.id,
          status='active',
          priority_level=v_plan.priority_level,
          starts_at=v_start,
          ends_at=v_end,
          source='upgrade',
          order_code=v_order.order_code,
          updated_at=now()
      where id=v_sub.id;
    end if;
  end if;

  if not v_is_upgrade then
    select * into v_sub
    from public.luma_user_subscriptions
    where user_id=v_order.user_id and status in ('trialing','active')
    order by ends_at desc limit 1 for update;

    if found then
      v_start:=least(v_sub.starts_at,now());
      v_end:=greatest(v_sub.ends_at,now()) + make_interval(days=>v_plan.duration_days);
      update public.luma_user_subscriptions
      set workspace_id=coalesce(v_order.workspace_id,workspace_id),
          plan_id=v_plan.id,
          status='active',
          priority_level=v_plan.priority_level,
          starts_at=v_start,
          ends_at=v_end,
          source='paid',
          order_code=v_order.order_code,
          updated_at=now()
      where id=v_sub.id;
    else
      v_start:=now();
      v_end:=now()+make_interval(days=>v_plan.duration_days);
      insert into public.luma_user_subscriptions(user_id,workspace_id,plan_id,status,priority_level,starts_at,ends_at,source,order_code)
      values(v_order.user_id,v_order.workspace_id,v_plan.id,'active',v_plan.priority_level,v_start,v_end,'paid',v_order.order_code);
    end if;
  end if;

  if v_plan.bonus_tokens>0 then
    insert into public.luma_token_wallets(user_id,workspace_id,month,monthly_limit,used_tokens,bonus_tokens)
    values(v_order.user_id,v_order.workspace_id,v_month,50,0,v_plan.bonus_tokens)
    on conflict(user_id) do update
      set workspace_id=coalesce(excluded.workspace_id,public.luma_token_wallets.workspace_id),
          month=excluded.month,
          used_tokens=case when public.luma_token_wallets.month is distinct from excluded.month then 0 else coalesce(public.luma_token_wallets.used_tokens,0) end,
          bonus_tokens=coalesce(public.luma_token_wallets.bonus_tokens,0)+excluded.bonus_tokens,
          updated_at=now();
    select * into v_wallet from public.luma_token_wallets where user_id=v_order.user_id;
    insert into public.luma_token_transactions(user_id,workspace_id,transaction_type,amount,balance_monthly,balance_bonus,reference,description,created_by)
    values(v_order.user_id,v_order.workspace_id,'subscription_bonus',v_plan.bonus_tokens,greatest(coalesce(v_wallet.monthly_limit,0)-coalesce(v_wallet.used_tokens,0),0),coalesce(v_wallet.bonus_tokens,0),v_order.order_code,'Bonus token langganan '||v_plan.name,'system');
  end if;

  if v_order.promo_id is not null then
    insert into public.luma_promo_redemptions(promo_id,user_id,workspace_id,target_type,target_reference,discount_amount,status,applied_at)
    values(v_order.promo_id,v_order.user_id,v_order.workspace_id,'subscription',v_order.order_code,v_order.discount_amount,'applied',now());
  end if;

  perform public.luma_notify_user(
    v_order.user_id,
    v_order.workspace_id,
    case when v_is_upgrade then 'Upgrade Lumaway aktif' else 'Langganan Lumaway aktif' end,
    case when v_is_upgrade
      then 'Upgrade ke paket '||v_plan.name||' aktif sampai '||to_char(v_end at time zone 'Asia/Jakarta','DD Mon YYYY HH24:MI')||' WIB.'
      else 'Paket '||v_plan.name||' aktif sampai '||to_char(v_end at time zone 'Asia/Jakarta','DD Mon YYYY HH24:MI')||' WIB.'
    end,
    'subscription_paid',
    '#billing'
  );

  return jsonb_build_object(
    'already_paid',false,
    'plan_id',v_plan.id,
    'plan',v_plan.name,
    'ends_at',v_end,
    'bonus_tokens',v_plan.bonus_tokens,
    'user_id',v_order.user_id,
    'workspace_id',v_order.workspace_id,
    'is_upgrade',v_is_upgrade,
    'upgrade_credit_amount',coalesce(v_order.upgrade_credit_amount,0),
    'upgrade_credit_days',coalesce(v_order.upgrade_credit_days,0)
  );
end $function$
;

-- luma_complete_topup(p_order_code text, p_payment_reference text, p_provider_payload jsonb)
CREATE OR REPLACE FUNCTION public.luma_complete_topup(p_order_code text, p_payment_reference text DEFAULT NULL::text, p_provider_payload jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order public.luma_topup_orders%rowtype;
  v_month text:=to_char(current_date,'YYYY-MM');
  v_wallet public.luma_token_wallets%rowtype;
  v_referrer uuid;
  v_commission numeric;
begin
  select * into v_order from public.luma_topup_orders where order_code=p_order_code for update;
  if not found then raise exception 'Topup order not found'; end if;
  if lower(coalesce(v_order.status,''))='paid' then return jsonb_build_object('already_paid',true,'tokens',v_order.package_tokens); end if;
  update public.luma_topup_orders set status='paid',payment_reference=coalesce(p_payment_reference,payment_reference),provider_payload=coalesce(p_provider_payload,provider_payload),paid_at=now() where id=v_order.id;
  insert into public.luma_token_wallets(user_id,workspace_id,month,monthly_limit,used_tokens,bonus_tokens)
  values(v_order.user_id,v_order.workspace_id,v_month,50,0,v_order.package_tokens)
  on conflict(user_id) do update set workspace_id=coalesce(excluded.workspace_id,public.luma_token_wallets.workspace_id),month=excluded.month,used_tokens=case when public.luma_token_wallets.month is distinct from excluded.month then 0 else coalesce(public.luma_token_wallets.used_tokens,0) end,bonus_tokens=coalesce(public.luma_token_wallets.bonus_tokens,0)+excluded.bonus_tokens,updated_at=now();
  select * into v_wallet from public.luma_token_wallets where user_id=v_order.user_id;
  insert into public.luma_token_transactions(user_id,workspace_id,transaction_type,amount,balance_monthly,balance_bonus,reference,description,created_by)
  values(v_order.user_id,v_order.workspace_id,'topup',v_order.package_tokens,greatest(coalesce(v_wallet.monthly_limit,0)-coalesce(v_wallet.used_tokens,0),0),coalesce(v_wallet.bonus_tokens,0),v_order.order_code,'Token top up paid via '||coalesce(v_order.payment_provider,'payment gateway'),'system');
  if v_order.promo_id is not null then
    insert into public.luma_promo_redemptions(promo_id,user_id,workspace_id,target_type,target_reference,discount_amount,status,applied_at)
    values(v_order.promo_id,v_order.user_id,v_order.workspace_id,'token',v_order.order_code,coalesce(v_order.discount_amount,0),'applied',now());
  end if;
  select referred_by_user_id into v_referrer from public.referral_profiles where user_id=v_order.user_id;
  if v_referrer is not null and coalesce(v_order.amount,0)>0 then
    v_commission:=round((v_order.amount*0.05)::numeric,2);
    insert into public.referral_events(workspace_id,referrer_user_id,referred_user_id,reference,base_amount,commission_rate,commission_amount,status,notes,created_at)
    select rp.workspace_id,v_referrer,v_order.user_id,v_order.order_code,v_order.amount,0.05,v_commission,'confirmed','Commission from paid LUMAWAY order',now()
    from public.referral_profiles rp where rp.user_id=v_referrer
    on conflict(referrer_user_id,reference) do nothing;
  end if;
  return jsonb_build_object('already_paid',false,'tokens',v_order.package_tokens,'user_id',v_order.user_id,'workspace_id',v_order.workspace_id,'referral_commission',coalesce(v_commission,0));
end $function$
;

-- luma_consume_tokens(p_user_id uuid, p_workspace_id uuid, p_amount integer, p_reference text, p_description text)
CREATE OR REPLACE FUNCTION public.luma_consume_tokens(p_user_id uuid, p_workspace_id uuid, p_amount integer, p_reference text, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_month text := to_char(current_date,'YYYY-MM');
  v_wallet public.luma_token_wallets%rowtype;
  v_monthly_remaining integer;
  v_from_monthly integer;
  v_from_bonus integer;
  v_total integer;
begin
  if p_amount <= 0 then raise exception 'Token amount must be positive'; end if;

  insert into public.luma_token_wallets(user_id,workspace_id,month,monthly_limit,used_tokens,bonus_tokens)
  values(p_user_id,p_workspace_id,v_month,50,0,0)
  on conflict (user_id) do update
  set workspace_id = coalesce(excluded.workspace_id, public.luma_token_wallets.workspace_id),
      month = excluded.month,
      used_tokens = case when public.luma_token_wallets.month is distinct from excluded.month then 0 else coalesce(public.luma_token_wallets.used_tokens,0) end,
      updated_at = now();

  select * into v_wallet
  from public.luma_token_wallets
  where user_id=p_user_id
  for update;

  v_monthly_remaining := greatest(coalesce(v_wallet.monthly_limit,0)-coalesce(v_wallet.used_tokens,0),0);
  v_total := v_monthly_remaining + coalesce(v_wallet.bonus_tokens,0);
  if v_total < p_amount then raise exception 'Token tidak cukup'; end if;

  v_from_monthly := least(v_monthly_remaining,p_amount);
  v_from_bonus := p_amount-v_from_monthly;

  update public.luma_token_wallets
  set workspace_id=coalesce(p_workspace_id,workspace_id),
      month=v_month,
      used_tokens=coalesce(used_tokens,0)+v_from_monthly,
      bonus_tokens=coalesce(bonus_tokens,0)-v_from_bonus,
      updated_at=now()
  where user_id=p_user_id;

  insert into public.luma_token_transactions(user_id,workspace_id,transaction_type,amount,balance_monthly,balance_bonus,reference,description,created_by)
  values(p_user_id,p_workspace_id,'usage',-p_amount,
         greatest(coalesce(v_wallet.monthly_limit,0)-(coalesce(v_wallet.used_tokens,0)+v_from_monthly),0),
         coalesce(v_wallet.bonus_tokens,0)-v_from_bonus,p_reference,p_description,'system');

  return jsonb_build_object('spent',p_amount,'remaining',v_total-p_amount);
end;
$function$
;

-- luma_creator_identity_key(p_username text, p_name text, p_creator_code text, p_platform text)
CREATE OR REPLACE FUNCTION public.luma_creator_identity_key(p_username text, p_name text, p_creator_code text, p_platform text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select lower(coalesce(nullif(trim(p_username),''),nullif(trim(p_name),''),nullif(trim(p_creator_code),''),'unknown'))
         || '|' ||
         lower(coalesce(nullif(trim(p_platform),''),'other'));
$function$
;

-- luma_ensure_referral_profile(p_user_id uuid, p_workspace_id uuid)
CREATE OR REPLACE FUNCTION public.luma_ensure_referral_profile(p_user_id uuid, p_workspace_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_workspace_id uuid := p_workspace_id;
  v_code text;
  v_try integer := 0;
begin
  select referral_code into v_code
  from public.referral_profiles
  where user_id = p_user_id
  limit 1;

  if v_code is not null then return v_code; end if;

  if v_workspace_id is null then
    select workspace_id into v_workspace_id
    from public.workspace_members
    where user_id = p_user_id
    order by created_at asc
    limit 1;
  end if;

  if v_workspace_id is null then raise exception 'Workspace not found for referral profile'; end if;

  loop
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'Unable to generate unique referral code'; end if;
    v_code := public.luma_generate_referral_code();
    begin
      insert into public.referral_profiles(user_id, referral_code, workspace_id, created_at, updated_at)
      values (p_user_id, v_code, v_workspace_id, now(), now());
      return v_code;
    exception when unique_violation then
      if exists (select 1 from public.referral_profiles where user_id = p_user_id) then
        select referral_code into v_code from public.referral_profiles where user_id = p_user_id limit 1;
        return v_code;
      end if;
    end;
  end loop;
end;
$function$
;

-- luma_ensure_social_identity(p_user_id uuid)
CREATE OR REPLACE FUNCTION public.luma_ensure_social_identity(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  mascots text[] := array['dino','nailong','dragon','gecko'];
  colors text[] := array['emerald','violet','amber','sky','coral','mint'];
  moods text[] := array['happy','sleepy','curious','cool','cheerful','focused'];
begin
  update public.profiles
  set social_alias=coalesce(social_alias,public.luma_generate_social_alias()),
      social_avatar_key=coalesce(social_avatar_key,
        mascots[1+floor(random()*array_length(mascots,1))::int]||'-'||
        colors[1+floor(random()*array_length(colors,1))::int]||'-'||
        moods[1+floor(random()*array_length(moods,1))::int])
  where id=p_user_id;
end;
$function$
;

-- luma_expire_pending_subscription_orders()
CREATE OR REPLACE FUNCTION public.luma_expire_pending_subscription_orders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; n integer:=0;
begin
  for r in update public.luma_subscription_orders set status='expired' where status in ('pending','processing') and expires_at is not null and expires_at<=now() returning user_id,workspace_id,order_code loop
    n:=n+1;
    perform public.luma_notify_user(r.user_id,r.workspace_id,'Checkout langganan kedaluwarsa','Order '||r.order_code||' otomatis dibatalkan karena pembayaran belum selesai.','subscription_checkout_expired','#billing');
  end loop;
  return n;
end $function$
;

-- luma_expire_pending_topups()
CREATE OR REPLACE FUNCTION public.luma_expire_pending_topups()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_count integer := 0;
begin
  insert into public.user_notifications(user_id,workspace_id,title,message,kind,is_read,action_url,created_at)
  select o.user_id,o.workspace_id,'Pembayaran token akan kedaluwarsa',
         'Order '||o.order_code||' belum dibayar dan akan otomatis dibatalkan pada '||to_char(o.expires_at at time zone 'Asia/Jakarta','DD Mon YYYY HH24:MI')||' WIB.',
         'payment_pending',false,'#billing',now()
  from public.luma_topup_orders o
  where lower(coalesce(o.status,'')) in ('pending','processing')
    and o.expires_at is not null
    and o.expires_at > now()
    and o.expires_at <= now() + interval '24 hours'
    and o.expiry_reminder_sent_at is null;

  update public.luma_topup_orders
  set expiry_reminder_sent_at=now()
  where lower(coalesce(status,'')) in ('pending','processing')
    and expires_at is not null
    and expires_at > now()
    and expires_at <= now() + interval '24 hours'
    and expiry_reminder_sent_at is null;

  update public.luma_topup_orders
  set status='expired',
      notes=case when coalesce(notes,'')='' then 'Auto-expired after 3 days.' else notes||' | Auto-expired after 3 days.' end
  where lower(coalesce(status,'')) in ('pending','processing')
    and expires_at is not null
    and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$
;

-- luma_expire_subscriptions()
CREATE OR REPLACE FUNCTION public.luma_expire_subscriptions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  update public.luma_user_subscriptions set status='expired',updated_at=now()
  where status in ('trialing','active') and ends_at<=now();
  get diagnostics n=row_count;
  return n;
end $function$
;

-- luma_generate_referral_code()
CREATE OR REPLACE FUNCTION public.luma_generate_referral_code()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
$function$
;

-- luma_generate_social_alias()
CREATE OR REPLACE FUNCTION public.luma_generate_social_alias()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a text[] := array['Ceria','Lincah','Pintar','Santai','Fokus','Maju','Kreatif','Ramah','Tangkas','Berani','Jeli','Rapi'];
  n text[] := array['Dino','Naga','Komet','Bambu','Orbit','Pixel','Lemon','Panda','Kaktus','Meteor','Piko','Mochi'];
  candidate text;
  i int:=0;
begin
  loop
    i:=i+1;
    candidate := a[1+floor(random()*array_length(a,1))::int] || n[1+floor(random()*array_length(n,1))::int] || lpad((floor(random()*9999)+1)::int::text,4,'0');
    exit when not exists(select 1 from public.profiles where lower(social_alias)=lower(candidate));
    if i>50 then candidate := 'Luma' || upper(substr(encode(gen_random_bytes(6),'hex'),1,8)); exit; end if;
  end loop;
  return candidate;
end;
$function$
;

-- luma_get_master_creators_unique(p_workspace_id uuid, p_search text, p_page integer, p_page_size integer)
CREATE OR REPLACE FUNCTION public.luma_get_master_creators_unique(p_workspace_id uuid, p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 100)
 RETURNS TABLE(id bigint, creator_code text, name text, username text, platform text, affiliate_id text, phone text, payment_type text, ratecard numeric, status text, total_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with ranked as (
    select
      c.*,
      row_number() over(
        partition by c.workspace_id,coalesce(c.identity_key,public.luma_creator_identity_key(c.username,c.name,c.creator_code,c.platform))
        order by c.updated_at desc nulls last,c.id desc
      ) as rn
    from public.creators c
    where c.workspace_id=p_workspace_id
  ),
  filtered as (
    select *
    from ranked r
    where r.rn=1
      and (
        nullif(trim(coalesce(p_search,'')),'') is null
        or coalesce(r.name,'') ilike '%'||trim(p_search)||'%'
        or coalesce(r.username,'') ilike '%'||trim(p_search)||'%'
        or coalesce(r.platform,'') ilike '%'||trim(p_search)||'%'
      )
  )
  select
    f.id,f.creator_code,f.name,f.username,f.platform,f.affiliate_id,f.phone,
    f.payment_type,f.ratecard,f.status,count(*) over() as total_count
  from filtered f
  order by lower(coalesce(nullif(trim(f.username),''),nullif(trim(f.name),''),f.creator_code)),lower(coalesce(f.platform,''))
  limit greatest(1,least(coalesce(p_page_size,100),200))
  offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,100),200));
$function$
;

-- luma_get_my_social_identity()
CREATE OR REPLACE FUNCTION public.luma_get_my_social_identity()
 RETURNS TABLE(social_alias text, social_avatar_key text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.social_alias,p.social_avatar_key from public.profiles p where p.id=auth.uid();
$function$
;

-- luma_get_my_social_identity_v2()
CREATE OR REPLACE FUNCTION public.luma_get_my_social_identity_v2()
 RETURNS TABLE(social_alias text, social_avatar_key text, social_avatar_url text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    coalesce(nullif(trim(p.social_alias),''),'LumaUser'),
    coalesce(nullif(trim(p.social_avatar_key),''),'dino-emerald-happy'),
    p.social_avatar_url
  from public.profiles p
  where p.id=auth.uid();
$function$
;

-- luma_get_public_share_post(p_post_id bigint)
CREATE OR REPLACE FUNCTION public.luma_get_public_share_post(p_post_id bigint)
 RETURNS TABLE(id bigint, body text, image_url text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id,p.body,p.image_url,p.created_at
  from public.luma_community_posts p
  where p.id=p_post_id and p.status='published'
  limit 1;
$function$
;

-- luma_get_server_secret(p_name text)
CREATE OR REPLACE FUNCTION public.luma_get_server_secret(p_name text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$function$
;

-- luma_get_social_feed(p_limit integer, p_offset integer)
CREATE OR REPLACE FUNCTION public.luma_get_social_feed(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS TABLE(id bigint, user_id uuid, body text, image_url text, created_at timestamp with time zone, social_alias text, social_avatar_key text, like_count bigint, liked_by_me boolean, subscribed_by_me boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id,p.user_id,p.body,p.image_url,p.created_at,
         coalesce(pr.social_alias,'LumaUser') as social_alias,
         coalesce(pr.social_avatar_key,'dino-emerald-happy') as social_avatar_key,
         (select count(*) from public.luma_community_likes l where l.post_id=p.id) as like_count,
         exists(select 1 from public.luma_community_likes l where l.post_id=p.id and l.user_id=auth.uid()) as liked_by_me,
         exists(select 1 from public.luma_community_subscriptions s where s.user_id=auth.uid() and s.subscribed_user_id=p.user_id) as subscribed_by_me
  from public.luma_community_posts p
  join public.profiles pr on pr.id=p.user_id
  where p.status='published'
  order by p.created_at desc
  limit greatest(1,least(coalesce(p_limit,30),100))
  offset greatest(coalesce(p_offset,0),0);
$function$
;

-- luma_get_social_feed_v2(p_limit integer, p_offset integer, p_scope text)
CREATE OR REPLACE FUNCTION public.luma_get_social_feed_v2(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0, p_scope text DEFAULT 'for_you'::text)
 RETURNS TABLE(id bigint, user_id uuid, body text, image_url text, image_urls jsonb, created_at timestamp with time zone, social_alias text, social_avatar_key text, social_avatar_url text, like_count bigint, save_count bigint, liked_by_me boolean, saved_by_me boolean, subscribed_by_me boolean, subscriber_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    p.id,
    p.user_id,
    p.body,
    p.image_url,
    case
      when jsonb_typeof(p.image_urls)='array' and jsonb_array_length(p.image_urls)>0 then p.image_urls
      when p.image_url is not null then jsonb_build_array(p.image_url)
      else '[]'::jsonb
    end as image_urls,
    p.created_at,
    coalesce(nullif(trim(pr.social_alias),''),'LumaUser') as social_alias,
    coalesce(nullif(trim(pr.social_avatar_key),''),'dino-emerald-happy') as social_avatar_key,
    pr.social_avatar_url,
    (select count(*) from public.luma_community_likes l where l.post_id=p.id) as like_count,
    (select count(*) from public.luma_community_saves sv where sv.post_id=p.id) as save_count,
    exists(select 1 from public.luma_community_likes l where l.post_id=p.id and l.user_id=auth.uid()) as liked_by_me,
    exists(select 1 from public.luma_community_saves sv where sv.post_id=p.id and sv.user_id=auth.uid()) as saved_by_me,
    exists(select 1 from public.luma_community_subscriptions s where s.user_id=auth.uid() and s.subscribed_user_id=p.user_id) as subscribed_by_me,
    (select count(*) from public.luma_community_subscriptions s where s.subscribed_user_id=p.user_id) as subscriber_count
  from public.luma_community_posts p
  join public.profiles pr on pr.id=p.user_id
  where p.status='published'
    and (
      lower(coalesce(p_scope,'for_you'))<>'following'
      or p.user_id=auth.uid()
      or exists(
        select 1 from public.luma_community_subscriptions s
        where s.user_id=auth.uid() and s.subscribed_user_id=p.user_id
      )
    )
  order by p.created_at desc
  limit greatest(1,least(coalesce(p_limit,30),100))
  offset greatest(coalesce(p_offset,0),0);
$function$
;

-- luma_has_workspace(p_workspace_id uuid)
CREATE OR REPLACE FUNCTION public.luma_has_workspace(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT
        public.luma_is_admin()
        OR public.luma_is_workspace_member(p_workspace_id);
$function$
;

-- luma_is_admin()
CREATE OR REPLACE FUNCTION public.luma_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active = true
  );
$function$
;

-- luma_is_manager_or_admin()
CREATE OR REPLACE FUNCTION public.luma_is_manager_or_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','manager') and p.active = true
  );
$function$
;

-- luma_is_workspace_admin(p_workspace_id uuid)
CREATE OR REPLACE FUNCTION public.luma_is_workspace_admin(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT
        public.luma_is_admin()
        OR public.luma_workspace_role(p_workspace_id)
           IN ('owner', 'admin');
$function$
;
