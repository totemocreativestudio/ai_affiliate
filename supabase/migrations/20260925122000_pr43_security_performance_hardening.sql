-- PR43 Supabase Security & Performance Hardening
-- Non-destructive privilege/search_path hardening plus removal of redundant indexes.

-- 1) Lock function search_path.
alter function public.luma_ratecard_master_updated_at()
  set search_path = public, pg_temp;

alter function public.luma_social_text_allowed(text)
  set search_path = public, pg_temp;

-- 2) Remove duplicate indexes while preserving constraint-backed indexes.
drop index if exists public.idx_samples_creator;
drop index if exists public.luma_topup_order_code_uidx;
drop index if exists public.referral_profiles_code_uidx;
drop index if exists public.referral_profiles_user_uidx;

-- 3) Authenticated dashboard RPCs: not callable anonymously.
revoke execute on function public.get_creator_360(uuid,bigint,date,date) from public, anon;
grant execute on function public.get_creator_360(uuid,bigint,date,date) to authenticated, service_role;

revoke execute on function public.get_creator_360_activity(uuid,bigint,date,date) from public, anon;
grant execute on function public.get_creator_360_activity(uuid,bigint,date,date) to authenticated, service_role;

revoke execute on function public.get_dashboard_latest_date(uuid,text) from public, anon;
grant execute on function public.get_dashboard_latest_date(uuid,text) to authenticated, service_role;

revoke execute on function public.get_dashboard_metrics_v2(uuid,date,date,text) from public, anon;
grant execute on function public.get_dashboard_metrics_v2(uuid,date,date,text) to authenticated, service_role;

revoke execute on function public.get_store_dashboard(uuid,date,date,text) from public, anon;
grant execute on function public.get_store_dashboard(uuid,date,date,text) to authenticated, service_role;

revoke execute on function public.luma_apply_my_referral(text) from public, anon;
grant execute on function public.luma_apply_my_referral(text) to authenticated, service_role;

revoke execute on function public.luma_notify_self(uuid,text,text,text,text) from public, anon;
grant execute on function public.luma_notify_self(uuid,text,text,text,text) to authenticated, service_role;

revoke execute on function public.luma_request_referral_withdrawal(uuid,numeric,text,text,text,text) from public, anon;
grant execute on function public.luma_request_referral_withdrawal(uuid,numeric,text,text,text,text) to authenticated, service_role;

-- 4) Owner/admin monitoring RPCs: authenticated admin checks still run inside each function.
revoke execute on function public.get_owner_creator_monitoring(integer) from public, anon;
grant execute on function public.get_owner_creator_monitoring(integer) to authenticated, service_role;

revoke execute on function public.get_owner_grid_storage_preview(integer) from public, anon;
grant execute on function public.get_owner_grid_storage_preview(integer) to authenticated, service_role;

revoke execute on function public.get_owner_monitoring_summary() from public, anon;
grant execute on function public.get_owner_monitoring_summary() to authenticated, service_role;

revoke execute on function public.get_owner_storage_summary() from public, anon;
grant execute on function public.get_owner_storage_summary() to authenticated, service_role;

revoke execute on function public.get_owner_store_monitoring() from public, anon;
grant execute on function public.get_owner_store_monitoring() to authenticated, service_role;

revoke execute on function public.get_owner_user_360(uuid) from public, anon;
grant execute on function public.get_owner_user_360(uuid) to authenticated, service_role;

revoke execute on function public.get_owner_workspace_monthly_preview(integer) from public, anon;
grant execute on function public.get_owner_workspace_monthly_preview(integer) to authenticated, service_role;

-- 5) Server-only token/report/notification primitives.
revoke execute on function public.luma_consume_tokens(uuid,uuid,integer,text,text) from public, anon, authenticated;
grant execute on function public.luma_consume_tokens(uuid,uuid,integer,text,text) to service_role;

revoke execute on function public.luma_report_preview(bigint,uuid,uuid) from public, anon, authenticated;
grant execute on function public.luma_report_preview(bigint,uuid,uuid) to service_role;

revoke execute on function public.luma_report_download(bigint,uuid,uuid) from public, anon, authenticated;
grant execute on function public.luma_report_download(bigint,uuid,uuid) to service_role;

revoke execute on function public.luma_report_remove_watermark(bigint,uuid,uuid) from public, anon, authenticated;
grant execute on function public.luma_report_remove_watermark(bigint,uuid,uuid) to service_role;

revoke execute on function public.luma_notify_user(uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.luma_notify_user(uuid,uuid,text,text,text,text) to service_role;

-- 6) Trigger/internal SECURITY DEFINER functions are not public RPC endpoints.
revoke execute on function public.handle_new_luma_user() from public, anon, authenticated;
grant execute on function public.handle_new_luma_user() to service_role;

revoke execute on function public.luma_lock_social_identity() from public, anon, authenticated;
grant execute on function public.luma_lock_social_identity() to service_role;

revoke execute on function public.luma_notify_analysis_success() from public, anon, authenticated;
grant execute on function public.luma_notify_analysis_success() to service_role;

revoke execute on function public.luma_notify_promo() from public, anon, authenticated;
grant execute on function public.luma_notify_promo() to service_role;

revoke execute on function public.luma_notify_referral_event() from public, anon, authenticated;
grant execute on function public.luma_notify_referral_event() to service_role;

revoke execute on function public.luma_notify_report() from public, anon, authenticated;
grant execute on function public.luma_notify_report() to service_role;

revoke execute on function public.luma_notify_social_like() from public, anon, authenticated;
grant execute on function public.luma_notify_social_like() to service_role;

revoke execute on function public.luma_notify_subscription_status() from public, anon, authenticated;
grant execute on function public.luma_notify_subscription_status() to service_role;

revoke execute on function public.luma_notify_support_reply() from public, anon, authenticated;
grant execute on function public.luma_notify_support_reply() to service_role;

revoke execute on function public.luma_notify_support_ticket() from public, anon, authenticated;
grant execute on function public.luma_notify_support_ticket() to service_role;

revoke execute on function public.luma_notify_task_done() from public, anon, authenticated;
grant execute on function public.luma_notify_task_done() to service_role;

revoke execute on function public.luma_notify_token_transaction() from public, anon, authenticated;
grant execute on function public.luma_notify_token_transaction() to service_role;

revoke execute on function public.luma_notify_topup_order() from public, anon, authenticated;
grant execute on function public.luma_notify_topup_order() to service_role;

revoke execute on function public.luma_notify_withdrawal() from public, anon, authenticated;
grant execute on function public.luma_notify_withdrawal() to service_role;

revoke execute on function public.luma_seed_free_trial() from public, anon, authenticated;
grant execute on function public.luma_seed_free_trial() to service_role;

revoke execute on function public.luma_sync_agreement_creator_status() from public, anon, authenticated;
grant execute on function public.luma_sync_agreement_creator_status() to service_role;

revoke execute on function public.luma_sync_auth_contacts() from public, anon, authenticated;
grant execute on function public.luma_sync_auth_contacts() to service_role;

revoke execute on function public.luma_trim_social_archive() from public, anon, authenticated;
grant execute on function public.luma_trim_social_archive() to service_role;

revoke execute on function public.notify_withdrawal_status() from public, anon, authenticated;
grant execute on function public.notify_withdrawal_status() to service_role;

revoke execute on function public.sync_creator_store_affiliation() from public, anon, authenticated;
grant execute on function public.sync_creator_store_affiliation() to service_role;
