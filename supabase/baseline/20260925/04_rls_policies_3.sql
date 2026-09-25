-- Lumaway production schema baseline snapshot
-- Captured from Supabase production on 2026-09-25.
-- Disaster-recovery reference only. DO NOT apply to the existing production database.
-- Customer/business row data is intentionally excluded.

-- kpi_targets
create policy luma_kpi_select on public.kpi_targets as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND ((creator_id IS NULL) OR luma_can_creator(creator_id))));

-- kpi_targets
create policy luma_kpi_write on public.kpi_targets as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin())) with check ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin()));

-- listings
create policy luma_listings_select on public.listings as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND ((creator_id IS NULL) OR luma_can_creator(creator_id) OR luma_is_manager_or_admin())));

-- listings
create policy luma_listings_write on public.listings as permissive for all to public using (luma_has_workspace(workspace_id)) with check (luma_has_workspace(workspace_id));

-- luma_api_usage_events
create policy api_usage_admin_select on public.luma_api_usage_events as permissive for select to authenticated using (luma_is_admin());

-- luma_blog_posts
create policy luma_blog_admin on public.luma_blog_posts as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_blog_posts
create policy luma_blog_public_read on public.luma_blog_posts as permissive for select to anon, authenticated using (((status = 'published'::text) AND (published_at <= now())));

-- luma_business_monthly_targets
create policy business_monthly_targets_admin on public.luma_business_monthly_targets as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_community_likes
create policy luma_community_likes_read on public.luma_community_likes as permissive for select to authenticated using (true);

-- luma_community_likes
create policy luma_community_likes_self on public.luma_community_likes as permissive for all to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

-- luma_community_posts
create policy luma_community_posts_admin on public.luma_community_posts as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_community_posts
create policy luma_community_posts_insert on public.luma_community_posts as permissive for insert to authenticated with check (((user_id = auth.uid()) AND luma_social_text_allowed(body)));

-- luma_community_posts
create policy luma_community_posts_owner_update on public.luma_community_posts as permissive for update to authenticated using ((user_id = auth.uid())) with check (((user_id = auth.uid()) AND luma_social_text_allowed(body)));

-- luma_community_posts
create policy luma_community_posts_read on public.luma_community_posts as permissive for select to authenticated using (((status = 'published'::text) OR (user_id = auth.uid()) OR luma_is_admin()));

-- luma_community_saves
create policy luma_community_saves_read on public.luma_community_saves as permissive for select to public using (((user_id = auth.uid()) OR luma_is_admin()));

-- luma_community_saves
create policy luma_community_saves_self on public.luma_community_saves as permissive for all to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

-- luma_community_subscriptions
create policy luma_community_subscriptions_read on public.luma_community_subscriptions as permissive for select to authenticated using (true);

-- luma_community_subscriptions
create policy luma_community_subscriptions_self on public.luma_community_subscriptions as permissive for all to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

-- luma_content_events
create policy content_events_admin_select on public.luma_content_events as permissive for select to authenticated using (luma_is_admin());

-- luma_content_events
create policy content_events_insert on public.luma_content_events as permissive for insert to anon, authenticated with check (((content_type = ANY (ARRAY['blog'::text, 'tutorial'::text, 'marketing'::text])) AND (event_type = ANY (ARRAY['page_view'::text, 'content_click'::text, 'video_click'::text, 'cta_click'::text, 'watched'::text, 'share'::text, 'outbound_click'::text])) AND ((user_id IS NULL) OR (user_id = auth.uid()))));

-- luma_expense_records
create policy expense_admin on public.luma_expense_records as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_financial_reports
create policy financial_reports_admin on public.luma_financial_reports as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_hpp_scenarios
create policy hpp_scenarios_admin on public.luma_hpp_scenarios as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_issue_logs
create policy luma_issue_logs_admin on public.luma_issue_logs as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_issue_logs
create policy luma_issue_logs_insert on public.luma_issue_logs as permissive for insert to authenticated with check ((user_id = auth.uid()));

-- luma_knowledge_documents
create policy knowledge_admin on public.luma_knowledge_documents as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_notification_reads
create policy luma_notification_reads_self on public.luma_notification_reads as permissive for all to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

-- luma_notifications
create policy luma_notifications_admin on public.luma_notifications as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_notifications
create policy luma_notifications_read on public.luma_notifications as permissive for select to authenticated using (((status = 'published'::text) AND (published_at <= now()) AND ((workspace_id IS NULL) OR luma_has_workspace(workspace_id))));

-- luma_pdf_downloads
create policy luma_pdf_downloads_insert on public.luma_pdf_downloads as permissive for insert to authenticated with check ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- luma_pdf_downloads
create policy luma_pdf_downloads_select on public.luma_pdf_downloads as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- luma_pdf_reports
create policy luma_pdf_reports_insert on public.luma_pdf_reports as permissive for insert to authenticated with check ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- luma_pdf_reports
create policy luma_pdf_reports_select on public.luma_pdf_reports as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- luma_platform_settings
create policy luma_platform_settings_admin on public.luma_platform_settings as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_platform_settings
create policy luma_platform_settings_read on public.luma_platform_settings as permissive for select to authenticated using (true);

-- luma_promo_codes
create policy promo_codes_admin_all on public.luma_promo_codes as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_promo_redemptions
create policy promo_redemptions_user_read on public.luma_promo_redemptions as permissive for select to authenticated using (((user_id = auth.uid()) OR luma_is_admin()));

-- luma_provider_accounts
create policy provider_accounts_admin on public.luma_provider_accounts as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_social_archives
create policy luma_social_archives_self on public.luma_social_archives as permissive for all to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

-- luma_subscription_orders
create policy subscription_orders_user_read on public.luma_subscription_orders as permissive for select to authenticated using (((user_id = auth.uid()) OR luma_is_admin()));

-- luma_subscription_plans
create policy subscription_plans_admin on public.luma_subscription_plans as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_subscription_plans
create policy subscription_plans_read on public.luma_subscription_plans as permissive for select to authenticated using (true);

-- luma_support_messages
create policy luma_support_messages_insert on public.luma_support_messages as permissive for insert to authenticated with check ((((user_id = auth.uid()) AND (sender_type = 'user'::text) AND (sender_user_id = auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text) AND (p.active = true))))));

-- luma_support_messages
create policy luma_support_messages_read on public.luma_support_messages as permissive for select to authenticated using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text) AND (p.active = true))))));

-- luma_support_tickets
create policy luma_support_tickets_insert on public.luma_support_tickets as permissive for insert to authenticated with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = luma_support_tickets.workspace_id) AND (wm.user_id = auth.uid()))))));

-- luma_support_tickets
create policy luma_support_tickets_read on public.luma_support_tickets as permissive for select to authenticated using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text) AND (p.active = true))))));

-- luma_support_tickets
create policy luma_support_tickets_update on public.luma_support_tickets as permissive for update to authenticated using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text) AND (p.active = true)))))) with check (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text) AND (p.active = true))))));

-- luma_system_controls
create policy system_controls_admin on public.luma_system_controls as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_system_controls
create policy system_controls_read on public.luma_system_controls as permissive for select to authenticated using (true);

-- luma_system_events
create policy system_events_admin on public.luma_system_events as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_token_packages
create policy token_packages_admin on public.luma_token_packages as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- luma_token_packages
create policy token_packages_select on public.luma_token_packages as permissive for select to authenticated using (true);

-- luma_token_transactions
create policy luma_token_tx_admin_write on public.luma_token_transactions as permissive for all to authenticated using ((luma_is_admin() AND luma_has_workspace(workspace_id))) with check ((luma_is_admin() AND luma_has_workspace(workspace_id)));

-- luma_token_transactions
create policy luma_token_tx_select on public.luma_token_transactions as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- luma_token_wallets
create policy luma_wallet_select on public.luma_token_wallets as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- luma_token_wallets
create policy luma_wallet_write on public.luma_token_wallets as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND (user_id = auth.uid()))) with check ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- luma_topup_orders
create policy luma_topup_admin_update on public.luma_topup_orders as permissive for update to authenticated using ((luma_is_admin() AND luma_has_workspace(workspace_id))) with check ((luma_is_admin() AND luma_has_workspace(workspace_id)));

-- luma_topup_orders
create policy luma_topup_select on public.luma_topup_orders as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- luma_topup_orders
create policy luma_topup_user_insert on public.luma_topup_orders as permissive for insert to authenticated with check ((luma_has_workspace(workspace_id) AND (user_id = auth.uid())));

-- luma_tutorial_progress
create policy tutorial_progress_delete on public.luma_tutorial_progress as permissive for delete to authenticated using (((user_id = auth.uid()) OR luma_is_admin()));
