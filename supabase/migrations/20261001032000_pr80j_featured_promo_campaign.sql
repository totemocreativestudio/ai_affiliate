-- PR80J: Featured promotion campaign > Rp350k
alter table public.luma_promo_codes drop constraint if exists luma_promo_amount_guard;
alter table public.luma_promo_codes add constraint luma_promo_amount_guard
check (
  promo_type not in ('subscription_amount','token_amount')
  or (value >= 0 and value <= 29000)
);

alter table public.luma_promo_codes drop constraint if exists luma_promo_max_discount_guard;
alter table public.luma_promo_codes add constraint luma_promo_max_discount_guard
check (max_discount_amount >= 0 and max_discount_amount <= 29000);

insert into public.luma_promo_codes(
  code,title,slug,description,campaign_label,promo_type,value,max_discount_amount,min_purchase_amount,
  starts_at,ends_at,max_uses,per_user_limit,applicable_plan_codes,applicable_token_package_ids,
  new_user_only,renewal_only,valid_weekdays,is_published,is_featured,
  banner_portrait_url,banner_landscape_url,short_terms,notes,active
)
values(
  'HEMAT829',
  'Special Checkout Deal',
  'hemat829',
  'Hemat sekitar 8% untuk transaksi mulai Rp350 ribu.',
  'SPECIAL CHECKOUT DEAL',
  'subscription_percent',
  8.29,
  29000,
  350000,
  now(),
  now()+interval '90 days',
  null,
  1,
  '{}'::text[],
  '{}'::bigint[],
  false,
  false,
  '{}'::smallint[],
  true,
  true,
  null,
  null,
  'Berlaku untuk transaksi mulai Rp350 ribu. Potongan aktual ditampilkan saat checkout.',
  'PR80J campaign. Front-end tidak menampilkan cap nominal pada materi utama; checkout tetap menunjukkan nilai diskon aktual.',
  true
)
on conflict(code) do update set
  title=excluded.title,
  slug=excluded.slug,
  description=excluded.description,
  campaign_label=excluded.campaign_label,
  promo_type=excluded.promo_type,
  value=excluded.value,
  max_discount_amount=excluded.max_discount_amount,
  min_purchase_amount=excluded.min_purchase_amount,
  ends_at=excluded.ends_at,
  per_user_limit=excluded.per_user_limit,
  is_published=true,
  is_featured=true,
  short_terms=excluded.short_terms,
  notes=excluded.notes,
  active=true,
  updated_at=now();
