# Lumaway Production Migration Manifest

Captured and reconciled in PR #42 on 2026-09-25.
Reconciliation checkpoint for the batch September–Oktober 2026 ditambahkan pada **2026-11-01** — lihat bagian [Checkpoint 2026-11-01](#checkpoint-2026-11-01-batch-oktober-2026) di bawah.

This manifest is the source-of-truth map between **Supabase production migration history** and **GitHub migration files**. It does not contain customer/business row data.

## Current state

- Registry rows: **88**
- Repository-backed production migrations: **36**
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
| `20260925075042` | `pr46_billing_multistore_social_account` | repository_migration | `supabase/migrations/20260925151500_pr46_billing_multistore_social_account.sql` | Yes |
| `20260925082452` | `pr46_fix_community_profile_rpc` | repository_migration | `supabase/migrations/20260925153500_pr46_fix_community_profile_rpc.sql` | Yes |
| `20260928073232` | `pr47_auth_community_weekly_mayar_only` | repository_migration | `supabase/migrations/20260928143000_pr47_auth_community_weekly_mayar_only.sql` | Yes |
| `20260928081233` | `pr48_resend_transport_defaults` | repository_migration | `supabase/migrations/20260928160000_pr48_resend_transport_defaults.sql` | Yes |
| `repo-only-pr37` | `pr37_payment_priority` | repository_manual_state | `supabase/migrations/20260923195500_pr37_payment_priority.sql` | Yes |

## Checkpoint 2026-11-01 (batch Oktober 2026)

Manifest lama berhenti di status migrasi sampai **PR48 (2026-09-28)**. Batch
migrasi di bawah ini sudah ada di repo tapi **belum direkonsiliasi** dengan
Supabase migration history produksi. Status per file *belum diverifikasi satu
per satu* — pengecualian ditandai.

Fakta terverifikasi dari probe read-only produksi **2026-10-11**:

| Objek | State produksi | Kesimpulan |
| --- | --- | --- |
| `luma_resolve_listing_creator_v1`, `luma_listing_creator_link_report_v1` | EXISTS | Inti PR87 ✅ sudah applied di prod |
| `luma_safe_workspace_assignees_v1` | EXISTS, versi lama (label "Saya") | PR88b PIC realname fix ⏳ pending |
| `public.luma_channel_contacts` | **MISSING (PGRST205)** | PR88 ⏳ pending — jalankan `supabase/PR88_CHANNEL_CONTACTS_APPLY_READY.sql` |

Prosedur rekonsiliasi: jalankan `select * from supabase.list_migrations();` di
SQL Editor, cocokkan versinya dengan tabel di bawah, lalu perbarui tabel ini.
Langkah apply lihat `docs/operations/PR87_PR88_PRODUCTION_APPLY_RUNBOOK.md`.

Batch migrasi repo pasca-PR48 (semua di `supabase/migrations/`, status default
`pending_prod_verification` kecuali dicatat lain):

| PR | File migrasi | Status |
| --- | --- | --- |
| PR57 | `20260929103000_pr57_daily_trend_v2.sql`, `20260929104000_pr57_daily_trend_permissions.sql` | pending_prod_verification |
| PR58 | `20260929110500_pr58_user_access_isolation.sql` | pending_prod_verification |
| PR69 | `20260929133000_pr69_dashboard_data_recovery.sql`, `20260929133500_pr69_dashboard_platform_mix.sql` | pending_prod_verification |
| PR70 | `20260929140500_pr70_daily_trend_v2.sql`, `20260929141000_pr70_platform_mix_v2.sql` | pending_prod_verification |
| PR75 | `20260930121500` … `20260930152000_pr75f_social_profile_v3.sql` (a–f) | pending_prod_verification |
| PR76 | `20260930152400` … `20260930193000_pr76f_identity_confidence_social_profiles.sql` (a–f) | pending_prod_verification |
| PR77 | `20260930202000_pr77_learning_promotion_engine.sql`, `20260930204500_pr77_content_seed.sql`, `20260930211500_pr77b_content_promo_hardening.sql` | pending_prod_verification |
| PR78 | `20260930213000_pr78a_security_rls_hardening.sql`, `20260930214500_pr78c_payment_promo_guardrails.sql`, `20260930215000_pr78c_webhook_updated_at.sql`, `20260930220500_pr78d_observability_system_health.sql`, `20260930222500_pr78e_performance_load_readiness.sql` | pending_prod_verification |
| PR79 | `20260930231500_pr79a_daily_brief_action_center.sql` … `20261001002500_pr79d_scheduled_reports_calendar.sql` | pending_prod_verification |
| PR80 | `20261001010000_pr80a_live_streaming_foundation.sql` … `20261001034500_pr80k_live_data_health.sql` | pending_prod_verification |
| PR81 | `20261001041000_pr81a_security_definer_hardening.sql` … `20261001084500_pr81j_release_gate.sql` | pending_prod_verification |
| PR82 | `20261001093000_pr82a_auth_recovery_reliability.sql` … `20261001191000_pr82q_contact_readiness.sql`, termasuk `20261001161000_host_crud_database_latest_indexes.sql`, `20261001170000_pr86h_fix_production_qa_harness.sql` | pending_prod_verification |
| PR84 | `20261001201500_pr84b_unified_live_import_engine.sql` … `20261001223000_pr84h_live_product_intelligence.sql` | pending_prod_verification |
| PR85 | `20261002020000_pr85c_command_center_v2.sql` … `20261002013000_pr85m_product_experience_qa.sql` | pending_prod_verification |
| PR86 | `20261002024500_pr86a_production_validation.sql` … `20261002093000_pr86i2_production_readiness_snapshots.sql`, `20261003110000_fix_signup_trigger_auth_guard.sql` | pending_prod_verification |
| PR87 | `20261004090000_pr87_listing_creator_link_flow.sql` + batch `20261009130000` … `20261009162000_pr87l_canonical_channel_metrics.sql` (a–l) | inti applied ✅ (probe 10-11); batch a–l pending_prod_verification |
| PR88 | `20261004103000_pr88_followup_channel_contacts.sql` (backfill: `20261010090000_pr89_channel_contact_backfill.sql`; fix: `20261011140000_pr88b_pic_realname_fix.sql`; readiness: `20261011190000_pr88c_readiness_channel_contacts.sql`) | **pending — tabel MISSING**, jalankan apply-ready |
| PR88a/88b realtime & spark | `20261009170000_pr88a_agreement_seal_spark_codes.sql`, `20261009171000_pr88b_social_realtime.sql` | pending_prod_verification |
| PR89 | `20261009183000_pr89_creator_attribution_sources.sql`, `20261009184500_pr89b_creator_matching.sql` | pending_prod_verification |
| PR90 | `20261009193000_pr90a_workspace_creator_agreement_terms.sql` | pending_prod_verification |
| PR91 | `20261009195000_pr91_affiliate_participant_enroll.sql`, `20261009200000_pr91b_affiliate_source_evidence.sql` | pending_prod_verification |

Aturan tidak berubah: setiap perubahan produksi tetap wajib punya file migrasi
di `supabase/migrations/` dan file "apply-ready" hanya konsolidasi temporer.

## Rule from PR42 onward

Every schema change must follow this order:

1. Create a timestamped SQL file in `supabase/migrations/`.
2. Review it in a PR branch.
3. Run CI migration validation.
4. Apply the exact migration to Supabase.
5. Verify Supabase migration history and schema health.
6. Only then merge/release application code that depends on the schema.

Do not execute production DDL only through ad-hoc SQL without also committing the matching migration file.
