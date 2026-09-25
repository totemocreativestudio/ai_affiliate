-- Lumaway production schema baseline snapshot
-- Captured from Supabase production on 2026-09-25.
-- Disaster-recovery reference only. DO NOT apply to the existing production database.
-- Customer/business row data is intentionally excluded.

-- affiliate_ads_support
alter table public.affiliate_ads_support enable row level security;

-- agreements
alter table public.agreements enable row level security;

-- ai_analysis_logs
alter table public.ai_analysis_logs enable row level security;

-- ai_analysis_runs
alter table public.ai_analysis_runs enable row level security;

-- ai_insights
alter table public.ai_insights enable row level security;

-- audit_log
alter table public.audit_log enable row level security;

-- creator_360_profiles
alter table public.creator_360_profiles enable row level security;

-- creator_360_targets
alter table public.creator_360_targets enable row level security;

-- creator_documents
alter table public.creator_documents enable row level security;

-- creator_history
alter table public.creator_history enable row level security;

-- creator_samples
alter table public.creator_samples enable row level security;

-- creator_store_affiliations
alter table public.creator_store_affiliations enable row level security;

-- creator_tasks
alter table public.creator_tasks enable row level security;

-- creator_user_access
alter table public.creator_user_access enable row level security;

-- creators
alter table public.creators enable row level security;

-- daily
alter table public.daily enable row level security;

-- google_sheet_connections
alter table public.google_sheet_connections enable row level security;

-- google_sheet_sync_history
alter table public.google_sheet_sync_history enable row level security;

-- google_sheet_sync_state
alter table public.google_sheet_sync_state enable row level security;

-- imports
alter table public.imports enable row level security;

-- kpi_targets
alter table public.kpi_targets enable row level security;

-- listings
alter table public.listings enable row level security;

-- luma_api_usage_events
alter table public.luma_api_usage_events enable row level security;

-- luma_blog_posts
alter table public.luma_blog_posts enable row level security;

-- luma_business_monthly_targets
alter table public.luma_business_monthly_targets enable row level security;

-- luma_community_likes
alter table public.luma_community_likes enable row level security;

-- luma_community_posts
alter table public.luma_community_posts enable row level security;

-- luma_community_saves
alter table public.luma_community_saves enable row level security;

-- luma_community_subscriptions
alter table public.luma_community_subscriptions enable row level security;

-- luma_content_events
alter table public.luma_content_events enable row level security;

-- luma_expense_records
alter table public.luma_expense_records enable row level security;

-- luma_financial_reports
alter table public.luma_financial_reports enable row level security;

-- luma_hpp_scenarios
alter table public.luma_hpp_scenarios enable row level security;

-- luma_issue_logs
alter table public.luma_issue_logs enable row level security;

-- luma_knowledge_documents
alter table public.luma_knowledge_documents enable row level security;

-- luma_notification_reads
alter table public.luma_notification_reads enable row level security;

-- luma_notifications
alter table public.luma_notifications enable row level security;

-- luma_otp_challenges
alter table public.luma_otp_challenges enable row level security;

-- luma_payment_checkout_intents
alter table public.luma_payment_checkout_intents enable row level security;

-- luma_payment_provider_settings
alter table public.luma_payment_provider_settings enable row level security;

-- luma_payment_routing
alter table public.luma_payment_routing enable row level security;

-- luma_payment_webhook_events
alter table public.luma_payment_webhook_events enable row level security;

-- luma_pdf_downloads
alter table public.luma_pdf_downloads enable row level security;

-- luma_pdf_reports
alter table public.luma_pdf_reports enable row level security;

-- luma_platform_settings
alter table public.luma_platform_settings enable row level security;

-- luma_promo_codes
alter table public.luma_promo_codes enable row level security;

-- luma_promo_redemptions
alter table public.luma_promo_redemptions enable row level security;

-- luma_provider_accounts
alter table public.luma_provider_accounts enable row level security;

-- luma_schema_migration_registry
alter table public.luma_schema_migration_registry enable row level security;

-- luma_social_archives
alter table public.luma_social_archives enable row level security;

-- luma_subscription_orders
alter table public.luma_subscription_orders enable row level security;

-- luma_subscription_plans
alter table public.luma_subscription_plans enable row level security;

-- luma_support_messages
alter table public.luma_support_messages enable row level security;

-- luma_support_tickets
alter table public.luma_support_tickets enable row level security;

-- luma_system_controls
alter table public.luma_system_controls enable row level security;

-- luma_system_events
alter table public.luma_system_events enable row level security;

-- luma_token_packages
alter table public.luma_token_packages enable row level security;

-- luma_token_transactions
alter table public.luma_token_transactions enable row level security;

-- luma_token_wallets
alter table public.luma_token_wallets enable row level security;

-- luma_topup_orders
alter table public.luma_topup_orders enable row level security;
