-- PR42 Database Baseline & Migration Sync
-- Registry only: does not mutate customer/business data.

create table if not exists public.luma_schema_migration_registry (
  migration_version text not null,
  migration_name text not null,
  source_status text not null check (source_status in ('repository_migration','production_legacy','repository_manual_state','baseline_snapshot')),
  repo_path text,
  production_applied boolean not null default false,
  notes text,
  recorded_at timestamptz not null default now(),
  primary key (migration_version,migration_name)
);

alter table public.luma_schema_migration_registry enable row level security;
revoke all on public.luma_schema_migration_registry from anon, authenticated;
grant select, insert, update, delete on public.luma_schema_migration_registry to service_role;

insert into public.luma_schema_migration_registry
(migration_version,migration_name,source_status,repo_path,production_applied,notes)
values
('0001','luma_core','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('0002','luma_rls','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('0003','luma_multitenancy','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('0004','luma_production_hardening','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('0005','luma_auth_profile_trigger','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('0006','product_master','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('0007','product_master_hardening','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('0008','listings_hardening','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('0009','ratecard_master','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('0010','shipping_sample_hardening','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('0011','creator_ranking_rls_fix','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915023043','customer_workspace_provisioning','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915135343','restore_referral_kanban_reports_google_connections_v2','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915144044','secure_server_secret_rpc','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915155947','luma_affiliate_billing_profile_ai_history_v2','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915160126','luma_token_packages_and_report_access','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915160153','luma_complete_topup_function','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915160205','luma_topup_referral_commission','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915160249','luma_referral_withdrawal_function','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915160359','promo_studio_v2_fields','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915161417','secure_self_referral_attribution','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915161530','sync_verified_auth_contacts_to_profile','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915164900','add_notifications_content_hub_social_whatsapp','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915164920','add_social_feed_rpc','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915165328','add_whatsapp_otp_salt','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915171649','creator_360_store_monitoring','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915172005','owner_monitoring_and_payout_notifications','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915172021','direct_notification_action_urls','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915172059','owner_storage_summary','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915172447','fix_owner_monitoring_social_table','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915172508','fix_owner_creator_monitoring_ambiguity','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915181525','workspace_internal_grid','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915181534','dashboard_metrics_v2','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915181546','owner_creator_monitoring_workspace_id','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915181931','owner_workspace_monthly_preview','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260915182112','owner_grid_storage_preview','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260916050306','add_luma_helpdesk_support','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260916051312','harden_luma_support_trigger_search_path','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260916084337','lumaway_marketing_leads','repository_migration','apps/marketing/supabase/migrations/20260916084021_lumaway_marketing_leads.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260916135407','lumaway_user_notifications_and_token_sync','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260916140749','lumaway_self_notification_rpc','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260916141954','lumaway_public_social_share_preview','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260916143802','fix_token_wallet_charging_and_repeat_report_download','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260916145002','topup_three_day_expiry_and_auto_cancel','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260916145630','pending_topup_expiry_reminders','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260916150202','secure_topup_completion_rpc','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260916150816','subscription_plans_promotions_and_billing','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260916151112','topup_promo_redemption_completion','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260916152142','subscription_trial_rollout_and_order_expiry','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260916154629','subscription_upgrade_proration','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260918055055','profile_completion_fields','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260918062555','ensure_luma_support_bucket','production_legacy',null,true,'Applied in production before repository migration discipline; covered by PR42 production baseline snapshot.'),
('20260918104551','allow_admin_manage_subscription_plans','repository_migration','supabase/migrations/20260918174500_allow_admin_manage_subscription_plans.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260920101520','lumaway_ops_intelligence_admin_v4','repository_migration','supabase/migrations/20260920172000_lumaway_ops_intelligence_admin_v4.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260920103336','track_referral_provider_fees','repository_migration','supabase/migrations/20260920173500_track_referral_provider_fees.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260920124323','control_center_targets_and_payment_readiness','repository_migration','supabase/migrations/20260920190000_control_center_targets_and_payment_readiness.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260921072618','customer360_periodic_targets','repository_migration','supabase/migrations/20260921143000_customer360_periodic_targets.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260921073721','dashboard_metrics_workspace_access','repository_migration','supabase/migrations/20260921152000_dashboard_metrics_workspace_access.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260921080813','creator360_activity_rpc','repository_migration','supabase/migrations/20260921154500_creator360_activity_rpc.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260921092628','dashboard_latest_date_rpc','repository_migration','supabase/migrations/20260921163000_dashboard_latest_date_rpc.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260922031428','product_performance_metrics','repository_migration','supabase/migrations/20260922101500_product_performance_metrics.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260922031433','creator360_extended_metrics','repository_migration','supabase/migrations/20260922103000_creator360_extended_metrics.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260922031437','dashboard_product_count_no_double_gmv','repository_migration','supabase/migrations/20260922103500_dashboard_product_count_no_double_gmv.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260922031939','product_performance_roi','repository_migration','supabase/migrations/20260922104500_product_performance_roi.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260922035934','pr30_split_creator_and_product_ranking','repository_migration','supabase/migrations/20260922110000_pr30_split_creator_product_ranking.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260922041307','pr30_product_ranking_revoke_anon','repository_migration','supabase/migrations/20260922110000_pr30_split_creator_product_ranking.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260922051747','pr31_ads_support_and_dashboard_activity_metrics','repository_migration','supabase/migrations/20260922123000_pr31_ads_support_dashboard_metrics.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260922072657','fix_product_ranking_ambiguous_gmv','repository_migration','supabase/migrations/20260922142500_fix_product_ranking_ambiguous_gmv.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260922075338','pr32_multiplatform_product_master_variants','repository_migration','supabase/migrations/20260922150000_pr32_multiplatform_product_master.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260922112559','pr33_affiliate_database_quality_summary','repository_migration','supabase/migrations/20260922183000_pr33_affiliate_database_quality.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260923101421','pr34_schema_links','repository_migration','supabase/migrations/20260923170000_pr34_creator_product_agreement_hardening.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260923105039','pr34_product_master_backfill_and_agreement_seal_enforcement','repository_migration','supabase/migrations/20260923174500_pr34_product_backfill_agreement_seal.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260923110346','pr35_payment_gateway_orchestration','repository_migration','supabase/migrations/20260923190000_pr35_payment_gateway_orchestration.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260923111029','pr35_mayar_webhook_registration_state','repository_migration','supabase/migrations/20260923191500_pr35_mayar_webhook_registration_state.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260924145637','pr38_payment_idempotency_social_v2','repository_migration','supabase/migrations/20260924220000_pr38_payment_idempotency_social_v2.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('20260924161732','pr40_user_dashboard_stability','repository_migration','supabase/migrations/20260924232000_pr40_user_dashboard_stability.sql',true,'Matched to repository source; timestamp may differ from Supabase-applied version.'),
('repo-only-pr37','pr37_payment_priority','repository_manual_state','supabase/migrations/20260923195500_pr37_payment_priority.sql',true,'Repository migration exists but production state was applied manually and is not present in Supabase migration history. Current priorities verified: Mayar 10, Midtrans 20, Xendit 30.')
on conflict (migration_version,migration_name) do update
set source_status=excluded.source_status,
    repo_path=excluded.repo_path,
    production_applied=excluded.production_applied,
    notes=excluded.notes;

create or replace function public.luma_schema_sync_summary()
returns jsonb
language sql
security definer
set search_path to 'public','pg_temp'
as $function$
  select jsonb_build_object(
    'registry_rows', count(*),
    'repository_migrations', count(*) filter (where source_status='repository_migration'),
    'production_legacy', count(*) filter (where source_status='production_legacy'),
    'repository_manual_state', count(*) filter (where source_status='repository_manual_state'),
    'production_applied', count(*) filter (where production_applied)
  )
  from public.luma_schema_migration_registry;
$function$;

revoke all on function public.luma_schema_sync_summary() from public, anon, authenticated;
grant execute on function public.luma_schema_sync_summary() to service_role;
