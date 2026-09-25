-- Lumaway production schema baseline snapshot
-- Captured from Supabase production on 2026-09-25.
-- Disaster-recovery reference only. DO NOT apply to the existing production database.
-- Customer/business row data is intentionally excluded.

-- luma_tutorial_progress
alter table public.luma_tutorial_progress enable row level security;

-- luma_user_subscriptions
alter table public.luma_user_subscriptions enable row level security;

-- marketing_lead_outbox
alter table public.marketing_lead_outbox enable row level security;

-- marketing_leads
alter table public.marketing_leads enable row level security;

-- owner_service_subscriptions
alter table public.owner_service_subscriptions enable row level security;

-- product_hpp_history
alter table public.product_hpp_history enable row level security;

-- product_master
alter table public.product_master enable row level security;

-- product_platform_items
alter table public.product_platform_items enable row level security;

-- product_variants
alter table public.product_variants enable row level security;

-- products
alter table public.products enable row level security;

-- profiles
alter table public.profiles enable row level security;

-- promo_generations
alter table public.promo_generations enable row level security;

-- ratecard_master
alter table public.ratecard_master enable row level security;

-- referral_events
alter table public.referral_events enable row level security;

-- referral_profiles
alter table public.referral_profiles enable row level security;

-- referral_withdrawals
alter table public.referral_withdrawals enable row level security;

-- sales
alter table public.sales enable row level security;

-- shipping
alter table public.shipping enable row level security;

-- tutorials
alter table public.tutorials enable row level security;

-- user_notifications
alter table public.user_notifications enable row level security;

-- user_payout_methods
alter table public.user_payout_methods enable row level security;

-- user_permissions
alter table public.user_permissions enable row level security;

-- workspace_grid_rows
alter table public.workspace_grid_rows enable row level security;

-- workspace_grid_sheets
alter table public.workspace_grid_sheets enable row level security;

-- workspace_members
alter table public.workspace_members enable row level security;

-- workspaces
alter table public.workspaces enable row level security;

-- agreements
create policy luma_agreements_select on public.agreements as permissive for select to authenticated using (luma_has_workspace(workspace_id));

-- agreements
create policy luma_agreements_write on public.agreements as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin())) with check ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin()));

-- ai_analysis_logs
create policy luma_ai_logs_select on public.ai_analysis_logs as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND (EXISTS ( SELECT 1
   FROM ai_analysis_runs r
  WHERE ((r.run_id = ai_analysis_logs.run_id) AND (r.workspace_id = ai_analysis_logs.workspace_id) AND ((r.created_by = (auth.uid())::text) OR luma_is_manager_or_admin()))))));

-- ai_analysis_logs
create policy luma_ai_logs_write on public.ai_analysis_logs as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin())) with check ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin()));

-- ai_analysis_runs
create policy luma_ai_runs_select on public.ai_analysis_runs as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND ((created_by = (auth.uid())::text) OR luma_is_manager_or_admin())));

-- ai_analysis_runs
create policy luma_ai_runs_write on public.ai_analysis_runs as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND ((created_by = (auth.uid())::text) OR luma_is_manager_or_admin()))) with check ((luma_has_workspace(workspace_id) AND ((created_by = (auth.uid())::text) OR luma_is_manager_or_admin())));

-- ai_insights
create policy luma_ai_insights_select on public.ai_insights as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND (EXISTS ( SELECT 1
   FROM ai_analysis_runs r
  WHERE ((r.run_id = ai_insights.run_id) AND (r.workspace_id = ai_insights.workspace_id) AND ((r.created_by = (auth.uid())::text) OR luma_is_manager_or_admin()))))));

-- ai_insights
create policy luma_ai_insights_write on public.ai_insights as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin())) with check ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin()));

-- audit_log
create policy luma_audit_admin on public.audit_log as permissive for all to authenticated using ((luma_is_admin() AND luma_has_workspace(workspace_id))) with check ((luma_is_admin() AND luma_has_workspace(workspace_id)));

-- creator_360_profiles
create policy creator_360_select on public.creator_360_profiles as permissive for select to authenticated using (luma_has_workspace(workspace_id));

-- creator_360_profiles
create policy creator_360_write on public.creator_360_profiles as permissive for all to authenticated using (luma_has_workspace(workspace_id)) with check (luma_has_workspace(workspace_id));

-- creator_360_targets
create policy creator_360_targets_select on public.creator_360_targets as permissive for select to authenticated using (luma_has_workspace(workspace_id));

-- creator_360_targets
create policy creator_360_targets_write on public.creator_360_targets as permissive for all to authenticated using (luma_has_workspace(workspace_id)) with check (luma_has_workspace(workspace_id));

-- creator_documents
create policy luma_creator_documents_select on public.creator_documents as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND luma_can_creator(creator_id)));

-- creator_documents
create policy luma_creator_documents_write on public.creator_documents as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND (luma_is_manager_or_admin() OR luma_can_creator(creator_id)))) with check ((luma_has_workspace(workspace_id) AND (luma_is_manager_or_admin() OR luma_can_creator(creator_id))));

-- creator_history
create policy luma_creator_history_select on public.creator_history as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND luma_can_creator(creator_id)));

-- creator_history
create policy luma_creator_history_write on public.creator_history as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND (luma_is_manager_or_admin() OR luma_can_creator(creator_id)))) with check ((luma_has_workspace(workspace_id) AND (luma_is_manager_or_admin() OR luma_can_creator(creator_id))));

-- creator_samples
create policy luma_creator_samples_select on public.creator_samples as permissive for select to public using (luma_has_workspace(workspace_id));

-- creator_samples
create policy luma_creator_samples_write on public.creator_samples as permissive for all to public using (luma_has_workspace(workspace_id)) with check (luma_has_workspace(workspace_id));

-- creator_store_affiliations
create policy creator_store_select on public.creator_store_affiliations as permissive for select to authenticated using (luma_has_workspace(workspace_id));

-- creator_store_affiliations
create policy creator_store_write on public.creator_store_affiliations as permissive for all to authenticated using (luma_has_workspace(workspace_id)) with check (luma_has_workspace(workspace_id));

-- creator_tasks
create policy luma_creator_tasks_select on public.creator_tasks as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND ((creator_id IS NULL) OR luma_can_creator(creator_id) OR luma_is_manager_or_admin())));

-- creator_tasks
create policy luma_creator_tasks_write on public.creator_tasks as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND ((creator_id IS NULL) OR luma_is_manager_or_admin() OR luma_can_creator(creator_id)))) with check ((luma_has_workspace(workspace_id) AND ((creator_id IS NULL) OR luma_is_manager_or_admin() OR luma_can_creator(creator_id))));

-- creator_user_access
create policy luma_creator_access_admin_write on public.creator_user_access as permissive for all to authenticated using (luma_is_admin()) with check ((luma_is_admin() AND (EXISTS ( SELECT 1
   FROM creators c
  WHERE ((c.id = creator_user_access.creator_id) AND (c.workspace_id = creator_user_access.workspace_id))))));

-- creator_user_access
create policy luma_creator_access_select on public.creator_user_access as permissive for select to authenticated using (((user_id = auth.uid()) OR luma_is_admin()));

-- creators
create policy luma_creators_admin_write on public.creators as permissive for all to authenticated using (luma_is_admin()) with check (luma_is_admin());

-- creators
create policy luma_creators_select on public.creators as permissive for select to authenticated using ((luma_has_workspace(workspace_id) AND luma_can_creator(id)));

-- daily
create policy luma_daily_select on public.daily as permissive for select to authenticated using (luma_has_workspace(workspace_id));

-- daily
create policy luma_daily_write on public.daily as permissive for all to authenticated using ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin())) with check ((luma_has_workspace(workspace_id) AND luma_is_manager_or_admin()));

-- google_sheet_connections
create policy luma_google_sheet_connections_select on public.google_sheet_connections as permissive for select to authenticated using (((user_id = auth.uid()) AND luma_has_workspace(workspace_id)));

-- google_sheet_connections
create policy luma_google_sheet_connections_write on public.google_sheet_connections as permissive for all to authenticated using (((user_id = auth.uid()) AND luma_has_workspace(workspace_id))) with check (((user_id = auth.uid()) AND luma_has_workspace(workspace_id)));

-- google_sheet_sync_history
create policy luma_sync_history_admin on public.google_sheet_sync_history as permissive for all to authenticated using ((luma_is_admin() AND luma_has_workspace(workspace_id))) with check ((luma_is_admin() AND luma_has_workspace(workspace_id)));

-- google_sheet_sync_state
create policy luma_sync_state_admin on public.google_sheet_sync_state as permissive for all to authenticated using ((luma_is_admin() AND luma_has_workspace(workspace_id))) with check ((luma_is_admin() AND luma_has_workspace(workspace_id)));

-- imports
create policy luma_imports_admin on public.imports as permissive for all to authenticated using ((luma_is_admin() AND luma_has_workspace(workspace_id))) with check ((luma_is_admin() AND luma_has_workspace(workspace_id)));
