-- PR81B: RLS / policy performance cleanup
-- Remove overlapping ALL+SELECT permissive policies by splitting admin writes
-- into INSERT/UPDATE/DELETE policies. Preserve existing SELECT policies.
-- Drop one confirmed duplicate product_master index.

-- Content categories
drop policy if exists luma_content_categories_admin_write on public.luma_content_categories;
create policy luma_content_categories_admin_insert on public.luma_content_categories
for insert to authenticated with check(public.luma_is_admin());
create policy luma_content_categories_admin_update on public.luma_content_categories
for update to authenticated using(public.luma_is_admin()) with check(public.luma_is_admin());
create policy luma_content_categories_admin_delete on public.luma_content_categories
for delete to authenticated using(public.luma_is_admin());

-- Content media
drop policy if exists luma_content_media_admin_write on public.luma_content_media;
create policy luma_content_media_admin_insert on public.luma_content_media
for insert to authenticated with check(public.luma_is_admin());
create policy luma_content_media_admin_update on public.luma_content_media
for update to authenticated using(public.luma_is_admin()) with check(public.luma_is_admin());
create policy luma_content_media_admin_delete on public.luma_content_media
for delete to authenticated using(public.luma_is_admin());

-- Promo codes
drop policy if exists promo_codes_admin_all on public.luma_promo_codes;
create policy promo_codes_admin_insert on public.luma_promo_codes
for insert to authenticated with check(public.luma_is_admin());
create policy promo_codes_admin_update on public.luma_promo_codes
for update to authenticated using(public.luma_is_admin()) with check(public.luma_is_admin());
create policy promo_codes_admin_delete on public.luma_promo_codes
for delete to authenticated using(public.luma_is_admin());

-- Promo reservations
drop policy if exists promo_reservations_admin_manage on public.luma_promo_reservations;
create policy promo_reservations_admin_insert on public.luma_promo_reservations
for insert to authenticated with check(public.luma_is_admin());
create policy promo_reservations_admin_update on public.luma_promo_reservations
for update to authenticated using(public.luma_is_admin()) with check(public.luma_is_admin());
create policy promo_reservations_admin_delete on public.luma_promo_reservations
for delete to authenticated using(public.luma_is_admin());

-- Tutorial steps
drop policy if exists luma_tutorial_steps_admin_write on public.luma_tutorial_steps;
create policy luma_tutorial_steps_admin_insert on public.luma_tutorial_steps
for insert to authenticated with check(public.luma_is_admin());
create policy luma_tutorial_steps_admin_update on public.luma_tutorial_steps
for update to authenticated using(public.luma_is_admin()) with check(public.luma_is_admin());
create policy luma_tutorial_steps_admin_delete on public.luma_tutorial_steps
for delete to authenticated using(public.luma_is_admin());

-- Confirmed duplicate of idx_product_master_sku on (workspace_id, sku_normalized)
drop index if exists public.idx_product_master_workspace_sku;
