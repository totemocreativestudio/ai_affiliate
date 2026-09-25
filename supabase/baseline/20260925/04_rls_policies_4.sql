-- Lumaway production schema baseline snapshot
-- Captured from Supabase production on 2026-09-25.
-- Disaster-recovery reference only. DO NOT apply to the existing production database.
-- Customer/business row data is intentionally excluded.

-- luma_tutorial_progress
create policy tutorial_progress_insert on public.luma_tutorial_progress as permissive for insert to authenticated with check ((((user_id = auth.uid()) AND luma_has_workspace(workspace_id)) OR luma_is_admin()));

-- luma_tutorial_progress
create policy tutorial_progress_select on public.luma_tutorial_progress as permissive for select to authenticated using (((user_id = auth.uid()) OR luma_is_admin()));

-- luma_tutorial_progress
create policy tutorial_progress_update on public.luma_tutorial_progress as permissive for update to authenticated using (((user_id = auth.uid()) OR luma_is_admin())) with check (((user_id = auth.uid()) OR luma_is_admin()));

-- luma_user_subscriptions
create policy subscriptions_user_read on public.luma_user_subscriptions as permissive for select to authenticated using (((user_id = auth.uid()) OR luma_is_admin()));

-- owner_service_subscriptions
create policy owner_service_admin on public.owner_service_subscriptions as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- product_hpp_history
create policy luma_hpp_select on public.product_hpp_history as permissive for select to authenticated using (luma_has_workspace(workspace_id));

-- product_hpp_history
create policy luma_hpp_write on public.product_hpp_history as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin())) with check ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin()));

-- product_master
create policy product_master_delete on public.product_master as permissive for delete to authenticated using ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_master.workspace_id) AND (wm.user_id = auth.uid()))))));

-- product_master
create policy product_master_insert on public.product_master as permissive for insert to authenticated with check ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_master.workspace_id) AND (wm.user_id = auth.uid()))))));

-- product_master
create policy product_master_select on public.product_master as permissive for select to authenticated using ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_master.workspace_id) AND (wm.user_id = auth.uid()))))));

-- product_master
create policy product_master_update on public.product_master as permissive for update to authenticated using ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_master.workspace_id) AND (wm.user_id = auth.uid())))))) with check ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_master.workspace_id) AND (wm.user_id = auth.uid()))))));

-- product_platform_items
create policy product_platform_items_delete on public.product_platform_items as permissive for delete to public using ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_platform_items.workspace_id) AND (wm.user_id = auth.uid()))))));

-- product_platform_items
create policy product_platform_items_insert on public.product_platform_items as permissive for insert to public with check ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_platform_items.workspace_id) AND (wm.user_id = auth.uid()))))));

-- product_platform_items
create policy product_platform_items_select on public.product_platform_items as permissive for select to public using ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_platform_items.workspace_id) AND (wm.user_id = auth.uid()))))));

-- product_platform_items
create policy product_platform_items_update on public.product_platform_items as permissive for update to public using ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_platform_items.workspace_id) AND (wm.user_id = auth.uid())))))) with check ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_platform_items.workspace_id) AND (wm.user_id = auth.uid()))))));

-- product_variants
create policy product_variants_delete on public.product_variants as permissive for delete to public using ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_variants.workspace_id) AND (wm.user_id = auth.uid()))))));

-- product_variants
create policy product_variants_insert on public.product_variants as permissive for insert to public with check ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_variants.workspace_id) AND (wm.user_id = auth.uid()))))));

-- product_variants
create policy product_variants_select on public.product_variants as permissive for select to public using ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_variants.workspace_id) AND (wm.user_id = auth.uid()))))));

-- product_variants
create policy product_variants_update on public.product_variants as permissive for update to public using ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_variants.workspace_id) AND (wm.user_id = auth.uid())))))) with check ((luma_is_admin() OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = product_variants.workspace_id) AND (wm.user_id = auth.uid()))))));

-- products
create policy luma_products_select on public.products as permissive for select to authenticated using (luma_has_workspace(workspace_id));

-- products
create policy luma_products_write on public.products as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin())) with check ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin()));

-- profiles
create policy luma_profiles_admin_write on public.profiles as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- profiles
create policy luma_profiles_select on public.profiles as permissive for select to authenticated using (((id = auth.uid()) OR luma_is_admin()));

-- profiles
create policy luma_profiles_self_update on public.profiles as permissive for update to authenticated using ((id = auth.uid())) with check ((id = auth.uid()));

-- promo_generations
create policy luma_promo_select on public.promo_generations as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- promo_generations
create policy luma_promo_write on public.promo_generations as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND (user_id = auth.uid()))) with check ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- ratecard_master
create policy ratecard_master_delete on public.ratecard_master as permissive for delete to public using (luma_has_workspace(workspace_id));

-- ratecard_master
create policy ratecard_master_insert on public.ratecard_master as permissive for insert to public with check (luma_has_workspace(workspace_id));

-- ratecard_master
create policy ratecard_master_select on public.ratecard_master as permissive for select to authenticated using ((luma_is_admin() OR luma_has_workspace(workspace_id)));

-- ratecard_master
create policy ratecard_master_update on public.ratecard_master as permissive for update to public using (luma_has_workspace(workspace_id)) with check (luma_has_workspace(workspace_id));

-- referral_events
create policy luma_referral_events_admin_write on public.referral_events as permissive for all to authenticated using ((luma_is_admin() AND luma_has_workspace(workspace_id))) with check ((luma_is_admin() AND luma_has_workspace(workspace_id)));

-- referral_events
create policy luma_referral_events_select on public.referral_events as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND ((referrer_user_id = auth.uid()) OR (referred_user_id = auth.uid()) OR luma_is_admin())));

-- referral_profiles
create policy luma_referral_profile_select on public.referral_profiles as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- referral_profiles
create policy luma_referral_profile_write on public.referral_profiles as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND (user_id = auth.uid()))) with check ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- referral_withdrawals
create policy referral_withdrawals_admin on public.referral_withdrawals as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- referral_withdrawals
create policy referral_withdrawals_insert on public.referral_withdrawals as permissive for insert to authenticated with check (((user_id = auth.uid()) AND luma_has_workspace(workspace_id)));

-- referral_withdrawals
create policy referral_withdrawals_select on public.referral_withdrawals as permissive for select to authenticated using (((user_id = auth.uid()) AND luma_has_workspace(workspace_id)));

-- sales
create policy luma_sales_select on public.sales as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND ((creator_id IS NULL) OR luma_can_creator(creator_id) OR luma_is_manager_or_admin())));

-- sales
create policy luma_sales_write on public.sales as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin())) with check ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin()));

-- shipping
create policy luma_shipping_select on public.shipping as permissive for select to authenticated using (luma_has_workspace(workspace_id));

-- shipping
create policy luma_shipping_write on public.shipping as permissive for all to public using (luma_has_workspace(workspace_id)) with check (luma_has_workspace(workspace_id));

-- tutorials
create policy luma_tutorials_admin_write on public.tutorials as permissive for all to authenticated using ((luma_is_admin() AND luma_has_workspace(workspace_id))) with check ((luma_is_admin() AND luma_has_workspace(workspace_id)));

-- tutorials
create policy luma_tutorials_select on public.tutorials as permissive for select to authenticated using (luma_has_workspace(workspace_id));

-- user_notifications
create policy luma_notifications_select on public.user_notifications as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- user_notifications
create policy luma_notifications_update on public.user_notifications as permissive for update to authenticated using ((luma_has_workspace(workspace_id) AND (user_id = auth.uid()))) with check ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- user_payout_methods
create policy user_payout_methods_self on public.user_payout_methods as permissive for all to authenticated using (((user_id = auth.uid()) AND luma_has_workspace(workspace_id))) with check (((user_id = auth.uid()) AND luma_has_workspace(workspace_id)));

-- user_permissions
create policy luma_permissions_admin_write on public.user_permissions as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- user_permissions
create policy luma_permissions_select on public.user_permissions as permissive for select to authenticated using (((user_id = auth.uid()) OR luma_is_admin()));

-- workspace_grid_rows
create policy workspace_grid_rows_access on public.workspace_grid_rows as permissive for all to authenticated using (luma_has_workspace(workspace_id)) with check (luma_has_workspace(workspace_id));

-- workspace_grid_sheets
create policy workspace_grid_sheets_access on public.workspace_grid_sheets as permissive for all to authenticated using (luma_has_workspace(workspace_id)) with check (luma_has_workspace(workspace_id));

-- workspace_members
create policy luma_workspace_members_admin_write on public.workspace_members as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- workspace_members
create policy luma_workspace_members_select on public.workspace_members as permissive for select to authenticated using ((luma_is_admin() OR (user_id = auth.uid()) OR luma_is_workspace_admin(workspace_id)));

-- workspace_members
create policy luma_workspace_members_workspace_admin_delete on public.workspace_members as permissive for delete to authenticated using (luma_is_workspace_admin(workspace_id));

-- workspace_members
create policy luma_workspace_members_workspace_admin_insert on public.workspace_members as permissive for insert to authenticated with check (luma_is_workspace_admin(workspace_id));

-- workspace_members
create policy luma_workspace_members_workspace_admin_update on public.workspace_members as permissive for update to authenticated using (luma_is_workspace_admin(workspace_id)) with check (luma_is_workspace_admin(workspace_id));

-- workspaces
create policy luma_workspaces_admin_write on public.workspaces as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- workspaces
create policy luma_workspaces_select on public.workspaces as permissive for select to authenticated using ((luma_is_admin() OR luma_is_workspace_member(id)));
