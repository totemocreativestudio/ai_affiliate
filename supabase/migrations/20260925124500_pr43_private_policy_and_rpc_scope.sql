-- PR43 phase 2: scope private RLS policies to authenticated users
-- and remove anonymous EXECUTE from internal/auth helper functions.

-- Private dashboard tables should never rely on the implicit "public" role.
alter policy luma_creator_samples_select on public.creator_samples to authenticated;
alter policy luma_creator_samples_write on public.creator_samples to authenticated;

alter policy luma_listings_write on public.listings to authenticated;
alter policy luma_shipping_write on public.shipping to authenticated;

alter policy product_platform_items_select on public.product_platform_items to authenticated;
alter policy product_platform_items_insert on public.product_platform_items to authenticated;
alter policy product_platform_items_update on public.product_platform_items to authenticated;
alter policy product_platform_items_delete on public.product_platform_items to authenticated;

alter policy product_variants_select on public.product_variants to authenticated;
alter policy product_variants_insert on public.product_variants to authenticated;
alter policy product_variants_update on public.product_variants to authenticated;
alter policy product_variants_delete on public.product_variants to authenticated;

alter policy ratecard_master_insert on public.ratecard_master to authenticated;
alter policy ratecard_master_update on public.ratecard_master to authenticated;
alter policy ratecard_master_delete on public.ratecard_master to authenticated;

alter policy luma_community_saves_read on public.luma_community_saves to authenticated;

-- Signup/referral internals.
revoke execute on function public.luma_apply_referral_from_metadata(uuid,text) from public, anon, authenticated;
grant execute on function public.luma_apply_referral_from_metadata(uuid,text) to service_role;

revoke execute on function public.luma_generate_referral_code() from public, anon, authenticated;
grant execute on function public.luma_generate_referral_code() to service_role;

revoke execute on function public.luma_generate_social_alias() from public, anon, authenticated;
grant execute on function public.luma_generate_social_alias() to service_role;

-- Authenticated self-service helpers.
revoke execute on function public.luma_ensure_referral_profile(uuid,uuid) from public, anon;
grant execute on function public.luma_ensure_referral_profile(uuid,uuid) to authenticated, service_role;

revoke execute on function public.luma_ensure_social_identity(uuid) from public, anon;
grant execute on function public.luma_ensure_social_identity(uuid) to authenticated, service_role;

revoke execute on function public.luma_get_my_social_identity() from public, anon;
grant execute on function public.luma_get_my_social_identity() to authenticated, service_role;

-- RLS/auth helpers are needed by logged-in users, not anonymous callers.
revoke execute on function public.luma_can_creator(bigint) from public, anon;
grant execute on function public.luma_can_creator(bigint) to authenticated, service_role;

revoke execute on function public.luma_can_manage_workspace(uuid) from public, anon;
grant execute on function public.luma_can_manage_workspace(uuid) to authenticated, service_role;

revoke execute on function public.luma_has_workspace(uuid) from public, anon;
grant execute on function public.luma_has_workspace(uuid) to authenticated, service_role;

revoke execute on function public.luma_is_admin() from public, anon;
grant execute on function public.luma_is_admin() to authenticated, service_role;

revoke execute on function public.luma_is_manager_or_admin() from public, anon;
grant execute on function public.luma_is_manager_or_admin() to authenticated, service_role;

revoke execute on function public.luma_is_workspace_admin(uuid) from public, anon;
grant execute on function public.luma_is_workspace_admin(uuid) to authenticated, service_role;

revoke execute on function public.luma_is_workspace_member(uuid) from public, anon;
grant execute on function public.luma_is_workspace_member(uuid) to authenticated, service_role;

revoke execute on function public.luma_workspace_role(uuid) from public, anon;
grant execute on function public.luma_workspace_role(uuid) to authenticated, service_role;

-- DDL/event-trigger utility is never a public RPC.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;

-- Intentionally public and unchanged:
-- public.luma_get_public_share_post(bigint)
-- public.luma_get_social_feed(integer,integer)
