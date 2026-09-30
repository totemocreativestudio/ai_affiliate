-- PR77A/77C: Learning CMS + SEO content + promotion campaign engine

-- BLOG / ARTICLE ------------------------------------------------------------
alter table public.luma_blog_posts
  add column if not exists content_type text not null default 'article',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists hero_gif_url text,
  add column if not exists short_video_url text,
  add column if not exists is_featured boolean not null default false,
  add column if not exists is_global boolean not null default true,
  add column if not exists reading_minutes integer not null default 5,
  add column if not exists faq_json jsonb not null default '[]'::jsonb,
  add column if not exists canonical_url text;

create index if not exists idx_luma_blog_posts_published_category
  on public.luma_blog_posts(status,category,published_at desc);

-- TUTORIAL / LEARNING --------------------------------------------------------
alter table public.tutorials
  alter column youtube_url drop not null,
  alter column embed_url drop not null;

alter table public.tutorials
  add column if not exists slug text,
  add column if not exists cover_image_url text,
  add column if not exists cover_gif_url text,
  add column if not exists short_video_url text,
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text,
  add column if not exists is_global boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists difficulty text not null default 'Pemula',
  add column if not exists estimated_minutes integer not null default 5,
  add column if not exists feature_route text,
  add column if not exists author_name text not null default 'Lumaway',
  add column if not exists published_at timestamptz,
  add column if not exists seo_title text,
  add column if not exists seo_description text;

create unique index if not exists uq_tutorial_slug_global
  on public.tutorials(slug)
  where slug is not null and is_global=true;

create table if not exists public.luma_tutorial_steps (
  id bigserial primary key,
  tutorial_id bigint not null references public.tutorials(id) on delete cascade,
  step_no integer not null,
  title text not null,
  description text,
  image_url text,
  gif_url text,
  short_video_url text,
  cta_label text,
  cta_route text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tutorial_id,step_no)
);

create index if not exists idx_luma_tutorial_steps_tutorial
  on public.luma_tutorial_steps(tutorial_id,step_no);

alter table public.luma_tutorial_steps enable row level security;

drop policy if exists luma_tutorial_steps_select on public.luma_tutorial_steps;
create policy luma_tutorial_steps_select
on public.luma_tutorial_steps for select to authenticated
using (
  exists (
    select 1 from public.tutorials t
    where t.id=tutorial_id
      and (
        (t.is_global=true and lower(coalesce(t.status,''))='published')
        or public.luma_is_admin()
        or (t.workspace_id is not null and public.luma_has_workspace(t.workspace_id))
      )
  )
);

drop policy if exists luma_tutorial_steps_admin_write on public.luma_tutorial_steps;
create policy luma_tutorial_steps_admin_write
on public.luma_tutorial_steps for all to authenticated
using (public.luma_is_admin())
with check (public.luma_is_admin());

-- Global tutorials must be readable by every authenticated user.
drop policy if exists pr45_tutorials_select_auth on public.tutorials;
create policy pr45_tutorials_select_auth
on public.tutorials for select to authenticated
using (
  public.luma_is_admin()
  or (is_global=true and lower(coalesce(status,''))='published')
  or (workspace_id is not null and public.luma_has_workspace(workspace_id))
);

-- MEDIA LIBRARY -------------------------------------------------------------
create table if not exists public.luma_content_media (
  id bigserial primary key,
  content_type text not null check(content_type in ('article','tutorial','promotion','general')),
  content_id bigint,
  media_type text not null check(media_type in ('image','gif','video','embed','poster_portrait','poster_landscape')),
  title text,
  url text not null,
  thumbnail_url text,
  alt_text text,
  platform text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_luma_content_media_content
  on public.luma_content_media(content_type,content_id,sort_order);

alter table public.luma_content_media enable row level security;

drop policy if exists luma_content_media_read on public.luma_content_media;
create policy luma_content_media_read
on public.luma_content_media for select to authenticated
using (is_active=true or public.luma_is_admin());

drop policy if exists luma_content_media_admin_write on public.luma_content_media;
create policy luma_content_media_admin_write
on public.luma_content_media for all to authenticated
using (public.luma_is_admin())
with check (public.luma_is_admin());

-- PROMOTION CAMPAIGN ENGINE -------------------------------------------------
alter table public.luma_promo_codes
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists campaign_label text,
  add column if not exists max_discount_amount numeric not null default 12000,
  add column if not exists min_purchase_amount numeric not null default 0,
  add column if not exists new_user_only boolean not null default false,
  add column if not exists renewal_only boolean not null default false,
  add column if not exists valid_weekdays smallint[] not null default '{}'::smallint[],
  add column if not exists is_published boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists banner_portrait_url text,
  add column if not exists banner_landscape_url text,
  add column if not exists short_terms text,
  add column if not exists terms_json jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='luma_promo_max_discount_guard') then
    alter table public.luma_promo_codes
      add constraint luma_promo_max_discount_guard
      check (max_discount_amount between 0 and 12000);
  end if;
  if not exists(select 1 from pg_constraint where conname='luma_promo_amount_guard') then
    alter table public.luma_promo_codes
      add constraint luma_promo_amount_guard
      check (
        promo_type not in ('subscription_amount','token_amount')
        or value between 0 and 12000
      );
  end if;
end $$;

create unique index if not exists uq_luma_promo_codes_slug
  on public.luma_promo_codes(slug) where slug is not null;

-- Users can see only active/published promo campaign metadata.
drop policy if exists promo_codes_user_read_published on public.luma_promo_codes;
create policy promo_codes_user_read_published
on public.luma_promo_codes for select to authenticated
using (
  public.luma_is_admin()
  or (
    active=true
    and is_published=true
    and (starts_at is null or starts_at<=now())
    and (ends_at is null or ends_at>now())
  )
);

create table if not exists public.luma_promo_reservations (
  id bigserial primary key,
  promo_id bigint not null references public.luma_promo_codes(id) on delete cascade,
  user_id uuid not null,
  workspace_id uuid,
  order_code text not null,
  status text not null default 'reserved'
    check(status in ('reserved','applied','released','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_code)
);

create index if not exists idx_luma_promo_reservations_active
  on public.luma_promo_reservations(promo_id,user_id,status,expires_at);

alter table public.luma_promo_reservations enable row level security;

drop policy if exists promo_reservations_user_read on public.luma_promo_reservations;
create policy promo_reservations_user_read
on public.luma_promo_reservations for select to authenticated
using (user_id=auth.uid() or public.luma_is_admin());

drop policy if exists promo_reservations_admin_manage on public.luma_promo_reservations;
create policy promo_reservations_admin_manage
on public.luma_promo_reservations for all to authenticated
using (public.luma_is_admin())
with check (public.luma_is_admin());

create or replace function public.luma_reserve_promo_v1(
  p_promo_id bigint,
  p_user_id uuid,
  p_workspace_id uuid,
  p_order_code text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_promo public.luma_promo_codes%rowtype;
  v_used bigint:=0;
  v_user_used bigint:=0;
begin
  perform pg_advisory_xact_lock(p_promo_id);

  update public.luma_promo_reservations
  set status='expired',updated_at=now()
  where promo_id=p_promo_id and status='reserved' and expires_at<=now();

  select * into v_promo
  from public.luma_promo_codes
  where id=p_promo_id and active=true
  for update;
  if not found then raise exception 'Promo tidak aktif'; end if;

  select
    (select count(*) from public.luma_promo_redemptions r where r.promo_id=p_promo_id and r.status='applied')
    +(select count(*) from public.luma_promo_reservations r where r.promo_id=p_promo_id and r.status='reserved' and r.expires_at>now())
  into v_used;

  select
    (select count(*) from public.luma_promo_redemptions r where r.promo_id=p_promo_id and r.user_id=p_user_id and r.status='applied')
    +(select count(*) from public.luma_promo_reservations r where r.promo_id=p_promo_id and r.user_id=p_user_id and r.status='reserved' and r.expires_at>now())
  into v_user_used;

  if v_promo.max_uses is not null and v_used>=v_promo.max_uses then
    raise exception 'Kuota promo sudah habis';
  end if;
  if v_user_used>=coalesce(v_promo.per_user_limit,1) then
    raise exception 'Kode promo sudah pernah digunakan';
  end if;

  insert into public.luma_promo_reservations(
    promo_id,user_id,workspace_id,order_code,status,expires_at
  ) values (
    p_promo_id,p_user_id,p_workspace_id,p_order_code,'reserved',p_expires_at
  )
  on conflict(order_code) do update
    set promo_id=excluded.promo_id,user_id=excluded.user_id,
        workspace_id=excluded.workspace_id,status='reserved',
        expires_at=excluded.expires_at,updated_at=now();

  return jsonb_build_object('ok',true,'promo_id',p_promo_id,'order_code',p_order_code);
end
$$;

revoke all on function public.luma_reserve_promo_v1(bigint,uuid,uuid,text,timestamptz) from public,anon;
grant execute on function public.luma_reserve_promo_v1(bigint,uuid,uuid,text,timestamptz) to service_role;

-- Public/user promotion card RPC (safe fields only).
create or replace function public.luma_active_promotions_v1()
returns table(
  id bigint, code text, title text, slug text, description text,
  promo_type text, value numeric, max_discount_amount numeric,
  min_purchase_amount numeric, campaign_label text,
  starts_at timestamptz, ends_at timestamptz, max_uses integer,
  per_user_limit integer, banner_portrait_url text, banner_landscape_url text,
  short_terms text, is_featured boolean
)
language sql
security definer
set search_path=public,pg_temp
as $$
  select
    p.id,p.code,p.title,p.slug,p.description,p.promo_type,p.value,
    p.max_discount_amount,p.min_purchase_amount,p.campaign_label,
    p.starts_at,p.ends_at,p.max_uses,p.per_user_limit,
    p.banner_portrait_url,p.banner_landscape_url,p.short_terms,p.is_featured
  from public.luma_promo_codes p
  where p.active=true and p.is_published=true
    and (p.starts_at is null or p.starts_at<=now())
    and (p.ends_at is null or p.ends_at>now())
  order by p.is_featured desc,p.starts_at desc nulls last,p.id desc;
$$;
revoke all on function public.luma_active_promotions_v1() from public,anon;
grant execute on function public.luma_active_promotions_v1() to authenticated;


create or replace function public.luma_apply_promo_reservation_on_redemption()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $
begin
  if new.target_reference is not null then
    update public.luma_promo_reservations
    set status='applied',updated_at=now()
    where promo_id=new.promo_id
      and user_id=new.user_id
      and order_code=new.target_reference
      and status='reserved';
  end if;
  return new;
end
$;

drop trigger if exists trg_luma_apply_promo_reservation on public.luma_promo_redemptions;
create trigger trg_luma_apply_promo_reservation
after insert on public.luma_promo_redemptions
for each row execute function public.luma_apply_promo_reservation_on_redemption();

-- Seed 8 controlled promotion campaigns. All monetary discounts are capped <= Rp12,000.
insert into public.luma_promo_codes(
  code,title,slug,description,campaign_label,promo_type,value,max_discount_amount,
  min_purchase_amount,starts_at,ends_at,max_uses,per_user_limit,
  applicable_plan_codes,new_user_only,renewal_only,valid_weekdays,
  active,is_published,is_featured,banner_portrait_url,banner_landscape_url,
  short_terms,terms_json,notes
) values
('LUMAHEMAT5','Hemat 5% untuk Langganan','lumahemat5','Potongan ringan untuk aktivasi paket Lumaway.','LUMA SAVING','subscription_percent',5,12000,35000,now(),'2026-12-31 23:59:59+07',500,1,array['weekly_35','monthly_95','six_month_355','annual_510'],false,false,'{}',true,true,false,'/promotions/lumahemat5-portrait.svg','/promotions/lumahemat5-landscape.svg','Diskon 5% maksimal Rp12.000. 1x per user.','["Tidak dapat diuangkan.","Maksimal potongan Rp12.000.","Kuota terbatas."]'::jsonb,'Seed PR77'),
('WELCOME10','Welcome 10%','welcome10','Promo pertama untuk user baru Lumaway.','WELCOME TO LUMAWAY','subscription_percent',10,12000,35000,now(),'2026-12-31 23:59:59+07',300,1,array['weekly_35','monthly_95','six_month_355','annual_510'],true,false,'{}',true,true,true,'/promotions/welcome10-portrait.svg','/promotions/welcome10-landscape.svg','User baru: 10% maksimal Rp12.000.','["Khusus user yang belum pernah memiliki transaksi subscription paid.","1x per user.","Maksimal potongan Rp12.000."]'::jsonb,'Seed PR77'),
('LUMA7K','Potongan Rp7.000','luma7k','Potongan langsung Rp7.000 untuk paket berbayar.','LUMA DIRECT CUT','subscription_amount',7000,7000,35000,now(),'2026-12-31 23:59:59+07',400,1,array['weekly_35','monthly_95','six_month_355','annual_510'],false,false,'{}',true,true,false,'/promotions/luma7k-portrait.svg','/promotions/luma7k-landscape.svg','Potongan Rp7.000. 1x per user.','["Minimum transaksi Rp35.000.","1x per user.","Kuota terbatas."]'::jsonb,'Seed PR77'),
('LUMA10K','Potongan Rp10.000','luma10k','Potongan langsung untuk paket pilihan Lumaway.','LUMA VALUE','subscription_amount',10000,10000,75000,now(),'2026-12-31 23:59:59+07',250,1,array['monthly_95','six_month_355','annual_510'],false,false,'{}',true,true,true,'/promotions/luma10k-portrait.svg','/promotions/luma10k-landscape.svg','Potongan Rp10.000, minimum Rp75.000.','["Minimum transaksi Rp75.000.","1x per user.","Kuota terbatas."]'::jsonb,'Seed PR77'),
('WEEKEND8','Weekend 8%','weekend8','Promo akhir pekan untuk aktivasi atau perpanjangan Lumaway.','WEEKEND BOOST','subscription_percent',8,12000,35000,now(),'2026-12-31 23:59:59+07',300,1,array['weekly_35','monthly_95','six_month_355','annual_510'],false,false,array[0,6]::smallint[],true,true,false,'/promotions/weekend8-portrait.svg','/promotions/weekend8-landscape.svg','Sabtu–Minggu: 8% maksimal Rp12.000.','["Berlaku Sabtu dan Minggu.","Maksimal potongan Rp12.000.","1x per user."]'::jsonb,'Seed PR77'),
('RENEW10','Renewal Hemat Rp10.000','renew10','Potongan khusus perpanjangan paket Lumaway.','STAY WITH LUMAWAY','subscription_amount',10000,10000,75000,now(),'2026-12-31 23:59:59+07',300,1,array['monthly_95','six_month_355','annual_510'],false,true,'{}',true,true,false,'/promotions/renew10-portrait.svg','/promotions/renew10-landscape.svg','Khusus renewal: potongan Rp10.000.','["Khusus user yang sudah memiliki riwayat subscription paid.","Minimum transaksi Rp75.000.","1x per user."]'::jsonb,'Seed PR77'),
('BONUS7HARI','Bonus 7 Hari','bonus7hari','Tambahan masa aktif 7 hari untuk user Lumaway terpilih.','EXTRA DAYS','extend_days',7,0,0,now(),'2026-12-31 23:59:59+07',200,1,'{}',false,false,'{}',true,true,false,'/promotions/bonus7hari-portrait.svg','/promotions/bonus7hari-landscape.svg','Klaim 7 hari masa aktif tambahan.','["Harus memiliki subscription Lumaway.","1x per user.","Kuota terbatas."]'::jsonb,'Seed PR77'),
('BONUS14DAY','Bonus 14 Hari','bonus14day','Tambahan 14 hari masa aktif untuk campaign terbatas.','LOYALTY EXTRA','extend_days',14,0,0,now(),'2026-11-30 23:59:59+07',100,1,'{}',false,false,'{}',true,true,true,'/promotions/bonus14day-portrait.svg','/promotions/bonus14day-landscape.svg','Klaim 14 hari tambahan. Kuota sangat terbatas.','["Harus memiliki subscription Lumaway.","1x per user.","Maksimal 100 klaim."]'::jsonb,'Seed PR77')
on conflict(code) do update set
  title=excluded.title,slug=excluded.slug,description=excluded.description,
  campaign_label=excluded.campaign_label,promo_type=excluded.promo_type,value=excluded.value,
  max_discount_amount=excluded.max_discount_amount,min_purchase_amount=excluded.min_purchase_amount,
  starts_at=excluded.starts_at,ends_at=excluded.ends_at,max_uses=excluded.max_uses,
  per_user_limit=excluded.per_user_limit,applicable_plan_codes=excluded.applicable_plan_codes,
  new_user_only=excluded.new_user_only,renewal_only=excluded.renewal_only,
  valid_weekdays=excluded.valid_weekdays,active=excluded.active,is_published=excluded.is_published,
  is_featured=excluded.is_featured,banner_portrait_url=excluded.banner_portrait_url,
  banner_landscape_url=excluded.banner_landscape_url,short_terms=excluded.short_terms,
  terms_json=excluded.terms_json,updated_at=now();
