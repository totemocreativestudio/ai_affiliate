# Lumaway Production Migration Manifest

Captured and reconciled in PR #42 on 2026-09-25.

This manifest is the source-of-truth map between **Supabase production migration history** and **GitHub migration files**. It does not contain customer/business row data.

## Current state

- Registry rows: **84**
- Repository-backed production migrations: **32**
- Production legacy migrations without original GitHub SQL: **51**
- Repository migration whose production state was applied manually: **1**
- PR42 baseline snapshot: `supabase/baseline/20260925/`

The 51 `production_legacy` entries are historical migrations that already exist in production but their original SQL files were not preserved in the repository. PR42 does **not** invent replacement history. Instead, the current production schema is snapshotted under `supabase/baseline/20260925/` for disaster recovery, and all future changes must use versioned migration files.

## Status meanings

- `repository_migration`: applied in production and represented by a migration file in GitHub.
- `production_legacy`: applied in production before repository migration discipline; original migration source is unavailable in GitHub.
- `repository_manual_state`: GitHub SQL exists, but the production state was historically applied outside Supabase migration history.
- `baseline_snapshot`: schema snapshot reference, not a migration to re-run on existing production.

## Migration registry

| Version | Migration | Status | Repository path | Production |
| --- | --- | --- | --- | ---: |
| `0001` | `luma_core` | production_legacy | — | Yes |
| `0002` | `luma_rls` | production_legacy | — | Yes |
| `0003` | `luma_multitenancy` | production_legacy | — | Yes |
| `0004` | `luma_production_hardening` | production_legacy | — | Yes |
| `0005` | `luma_auth_profile_trigger` | production_legacy | — | Yes |
| `0006` | `product_master` | production_legacy | — | Yes |
| `0007` | `product_master_hardening` | production_legacy | — | Yes |
| `0008` | `listings_hardening` | production_legacy | — | Yes |
| `0009` | `ratecard_master` | production_legacy | — | Yes |
| `0010` | `shipping_sample_hardening` | production_legacy | — | Yes |
| `0011` | `creator_ranking_rls_fix` | production_legacy | — | Yes |
| `20260915023043` | `customer_workspace_provisioning` | production_legacy | — | Yes |
| `20260915135343` | `restore_referral_kanban_reports_google_connections_v2` | production_legacy | — | Yes |
| `20260915144044` | `secure_server_secret_rpc` | production_legacy | — | Yes |
| `20260915155947` | `luma_affiliate_billing_profile_ai_history_v2` | production_legacy | — | Yes |
| `20260915160126` | `luma_token_packages_and_report_access` | production_legacy | — | Yes |
| `20260915160153` | `luma_complete_topup_function` | production_legacy | — | Yes |
| `20260915160205` | `luma_topup_referral_commission` | production_legacy | — | Yes |
| `20260915160249` | `luma_referral_withdrawal_function` | production_legacy | — | Yes |
| `20260915160359` | `promo_studio_v2_fields` | production_legacy | — | Yes |
| `20260915161417` | `secure_self_referral_attribution` | production_legacy | — | Yes |
| `20260915161530` | `sync_verified_auth_contacts_to_profile` | production_legacy | — | Yes |
| `20260915164900` | `add_notifications_content_hub_social_whatsapp` | production_legacy | — | Yes |
| `20260915164920` | `add_social_feed_rpc` | production_legacy | — | Yes |
| `20260915165328` | `add_whatsapp_otp_salt` | production_legacy | — | Yes |
| `20260915171649` | `creator_360_store_monitoring` | production_legacy | — | Yes |
| `20260915172005` | `owner_monitoring_and_payout_notifications` | production_legacy | — | Yes |
| `20260915172021` | `direct_notification_action_urls` | production_legacy | — | Yes |
| `20260915172059` | `owner_storage_summary` | production_legacy | — | Yes |
| `20260915172447` | `fix_owner_monitoring_social_table` | production_legacy | — | Yes |
| `20260915172508` | `fix_owner_creator_monitoring_ambiguity` | production_legacy | — | Yes |
| `20260915181525` | `workspace_internal_grid` | production_legacy | — | Yes |
| `20260915181534` | `dashboard_metrics_v2` | production_legacy | — | Yes |
| `20260915181546` | `owner_creator_monitoring_workspace_id` | production_legacy | — | Yes |
| `20260915181931` | `owner_workspace_monthly_preview` | production_legacy | — | Yes |
| `20260915182112` | `owner_grid_storage_preview` | production_legacy | — | Yes |
| `20260916050306` | `add_luma_helpdesk_support` | production_legacy | — | Yes |
| `20260916051312` | `harden_luma_support_trigger_search_path` | production_legacy | — | Yes |
| `20260916084337` | `lumaway_marketing_leads` | repository_migration | `apps/marketing/supabase/migrations/20260916084021_lumaway_marketing_leads.sql` | Yes |
| `20260916135407` | `lumaway_user_notifications_and_token_sync` | production_legacy | — | Yes |
| `20260916140749` | `lumaway_self_notification_rpc` | production_legacy | — | Yes |
| `20260916141954` | `lumaway_public_social_share_preview` | production_legacy | — | Yes |
| `20260916143802` | `fix_token_wallet_charging_and_repeat_report_download` | production_legacy | — | Yes |
| `20260916145002` | `topup_three_day_expiry_and_auto_cancel` | production_legacy | — | Yes |
| `20260916145630` | `pending_topup_expiry_reminders` | production_legacy | — | Yes |
| `20260916150202` | `secure_topup_completion_rpc` | production_legacy | — | Yes |
| `20260916150816` | `subscription_plans_promotions_and_billing` | production_legacy | — | Yes |
| `20260916151112` | `topup_promo_redemption_completion` | production_legacy | — | Yes |
| `20260916152142` | `subscription_trial_rollout_and_order_expiry` | production_legacy | — | Yes |
| `20260916154629` | `subscription_upgrade_proration` | production_legacy | — | Yes |
| `20260918055055` | `profile_completion_fields` | production_legacy | — | Yes |
| `20260918062555` | `ensure_luma_support_bucket` | production_legacy | — | Yes |
| `20260918104551` | `allow_admin_manage_subscription_plans` | repository_migration | `supabase/migrations/20260918174500_allow_admin_manage_subscription_plans.sql` | Yes |
| `20260920101520` | `lumaway_ops_intelligence_admin_v4` | repository_migration | `supabase/migrations/20260920172000_lumaway_ops_intelligence_admin_v4.sql` | Yes |
| `20260920103336` | `track_referral_provider_fees` | repository_migration | `supabase/migrations/20260920173500_track_referral_provider_fees.sql` | Yes |
| `20260920124323` | `control_center_targets_and_payment_readiness` | repository_migration | `supabase/migrations/20260920190000_control_center_targets_and_payment_readiness.sql` | Yes |
| `20260921072618` | `customer360_periodic_targets` | repository_migration | `supabase/migrations/20260921143000_customer360_periodic_targets.sql` | Yes |
| `20260921073721` | `dashboard_metrics_workspace_access` | repository_migration | `supabase/migrations/20260921152000_dashboard_metrics_workspace_access.sql` | Yes |
| `20260921080813` | `creator360_activity_rpc` | repository_migration | `supabase/migrations/20260921154500_creator360_activity_rpc.sql` | Yes |
| `20260921092628` | `dashboard_latest_date_rpc` | repository_migration | `supabase/migrations/20260921163000_dashboard_latest_date_rpc.sql` | Yes |
| `20260922031428` | `product_performance_metrics` | repository_migration | `supabase/migrations/20260922101500_product_performance_metrics.sql` | Yes |
| `20260922031433` | `creator360_extended_metrics` | repository_migration | `supabase/migrations/20260922103000_creator360_extended_metrics.sql` | Yes |
| `20260922031437` | `dashboard_product_count_no_double_gmv` | repository_migration | `supabase/migrations/20260922103500_dashboard_product_count_no_double_gmv.sql` | Yes |
| `20260922031939` | `product_performance_roi` | repository_migration | `supabase/migrations/20260922104500_product_performance_roi.sql` | Yes |
| `20260922035934` | `pr30_split_creator_and_product_ranking` | repository_migration | `supabase/migrations/20260922110000_pr30_split_creator_product_ranking.sql` | Yes |
| `20260922041307` | `pr30_product_ranking_revoke_anon` | repository_migration | `supabase/migrations/20260922110000_pr30_split_creator_product_ranking.sql` | Yes |
| `20260922051747` | `pr31_ads_support_and_dashboard_activity_metrics` | repository_migration | `supabase/migrations/20260922123000_pr31_ads_support_dashboard_metrics.sql` | Yes |
| `20260922072657` | `fix_product_ranking_ambiguous_gmv` | repository_migration | `supabase/migrations/20260922142500_fix_product_ranking_ambiguous_gmv.sql` | Yes |
| `20260922075338` | `pr32_multiplatform_product_master_variants` | repository_migration | `supabase/migrations/20260922150000_pr32_multiplatform_product_master.sql` | Yes |
| `20260922112559` | `pr33_affiliate_database_quality_summary` | repository_migration | `supabase/migrations/20260922183000_pr33_affiliate_database_quality.sql` | Yes |
| `20260923101421` | `pr34_schema_links` | repository_migration | `supabase/migrations/20260923170000_pr34_creator_product_agreement_hardening.sql` | Yes |
| `20260923105039` | `pr34_product_master_backfill_and_agreement_seal_enforcement` | repository_migration | `supabase/migrations/20260923174500_pr34_product_backfill_agreement_seal.sql` | Yes |
| `20260923110346` | `pr35_payment_gateway_orchestration` | repository_migration | `supabase/migrations/20260923190000_pr35_payment_gateway_orchestration.sql` | Yes |
| `20260923111029` | `pr35_mayar_webhook_registration_state` | repository_migration | `supabase/migrations/20260923191500_pr35_mayar_webhook_registration_state.sql` | Yes |
| `20260924145637` | `pr38_payment_idempotency_social_v2` | repository_migration | `supabase/migrations/20260924220000_pr38_payment_idempotency_social_v2.sql` | Yes |
| `20260924161732` | `pr40_user_dashboard_stability` | repository_migration | `supabase/migrations/20260924232000_pr40_user_dashboard_stability.sql` | Yes |
| `20260925040515` | `pr42_database_migration_registry` | repository_migration | `supabase/migrations/20260925100000_pr42_database_migration_registry.sql` | Yes |
| `20260925050942` | `pr43_security_performance_hardening` | repository_migration | `supabase/migrations/20260925122000_pr43_security_performance_hardening.sql` | Yes |
| `20260925051308` | `pr43_private_policy_and_rpc_scope` | repository_migration | `supabase/migrations/20260925124500_pr43_private_policy_and_rpc_scope.sql` | Yes |
| `20260925052600` | `pr44_rls_initplan_and_tenant_indexes` | repository_migration | `supabase/migrations/20260925122600_pr44_rls_initplan_and_tenant_indexes.sql` | Yes |\n| `20260925052702` | `pr44_split_redundant_all_policies` | repository_migration | `supabase/migrations/20260925122702_pr44_split_redundant_all_policies.sql` | Yes |\n| `20260925065838` | `pr45_rls_policy_query_plan_optimization` | repository_migration | `supabase/migrations/20260925135000_pr45_rls_policy_query_plan_optimization.sql` | Yes |
| `20260925070033` | `pr45_private_rls_helpers` | repository_migration | `supabase/migrations/20260925140500_pr45_private_rls_helpers.sql` | Yes |
| `repo-only-pr37` | `pr37_payment_priority` | repository_manual_state | `supabase/migrations/20260923195500_pr37_payment_priority.sql` | Yes |

## Rule from PR42 onward

Every schema change must follow this order:

1. Create a timestamped SQL file in `supabase/migrations/`.
2. Review it in a PR branch.
3. Run CI migration validation.
4. Apply the exact migration to Supabase.
5. Verify Supabase migration history and schema health.
6. Only then merge/release application code that depends on the schema.

Do not execute production DDL only through ad-hoc SQL without also committing the matching migration file.
