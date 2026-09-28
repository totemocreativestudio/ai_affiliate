-- PR47 Auth email readiness, Community Storage, Weekly plan, and Mayar-only checkout.
-- 2026-09-28

-- 1) Weekly subscription option derived from Monthly.
-- Keep the owner's current ordering intact: Monthly remains first, Weekly is inserted
-- directly after it, and later plans move down one position.
update public.luma_subscription_plans
set sort_order = sort_order + 1,
    updated_at = now()
where code <> 'weekly_35'
  and sort_order >= 2;

insert into public.luma_subscription_plans(
  code,name,duration_days,price,bonus_tokens,priority_level,
  all_access,is_trial,status,sort_order,updated_at
)
values(
  'weekly_35','Weekly',7,35000,0,'normal',
  true,false,'active',2,now()
)
on conflict(code) do update set
  name=excluded.name,
  duration_days=7,
  price=35000,
  bonus_tokens=excluded.bonus_tokens,
  priority_level=excluded.priority_level,
  all_access=true,
  is_trial=false,
  status='active',
  sort_order=2,
  updated_at=now();

-- 2) Checkout payment gateway is Mayar.id only.
-- Xendit may still be retained elsewhere for payout history/integration, but it
-- is disabled as a checkout provider. Midtrans is also disabled.
update public.luma_payment_provider_settings
set enabled = case when provider='mayar' then true else false end,
    priority = case when provider='mayar' then 1 else greatest(priority,100) end,
    updated_at = now()
where provider in ('mayar','xendit','midtrans');

update public.luma_payment_routing
set mode='priority_fallback',
    updated_at=now()
where id=1;

-- 3) App notification sender preference. This is consumed by app-side mail
-- once a verified SMTP/Resend credential is configured. Supabase Auth sender
-- itself must still be configured through Auth custom SMTP.
insert into public.luma_platform_settings(setting_key,setting_value,updated_at)
values('email_from','Lumaway <marketing@lumaway.online>',now())
on conflict(setting_key) do update set
  setting_value=excluded.setting_value,
  updated_at=now();

-- 4) Storage upsert/read prerequisite for user-owned avatar folder.
-- Browser uploads are also changed to unique insert-only files in PR47, but
-- SELECT is intentionally provided for the user's own folder so future safe
-- replacement/upsert flows have the complete INSERT + SELECT + UPDATE policy set.
drop policy if exists luma_avatar_select_own on storage.objects;
create policy luma_avatar_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id='luma-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
