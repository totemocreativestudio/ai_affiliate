-- Lumaway production schema baseline snapshot
-- Captured from Supabase production on 2026-09-25.
-- Disaster-recovery reference only. DO NOT apply to the existing production database.
-- Customer/business row data is intentionally excluded.

-- luma_community_posts
alter table luma_community_posts add constraint luma_community_posts_pkey PRIMARY KEY (id);

-- luma_community_posts
alter table luma_community_posts add constraint luma_community_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- luma_community_posts
alter table luma_community_posts add constraint luma_community_content_present CHECK (COALESCE(length(TRIM(BOTH FROM body)), 0) > 0 OR image_url IS NOT NULL);

-- luma_community_posts
alter table luma_community_posts add constraint luma_community_body_safe CHECK (body IS NULL OR luma_social_text_allowed(body));

-- luma_community_saves
alter table luma_community_saves add constraint luma_community_saves_pkey PRIMARY KEY (post_id, user_id);

-- luma_community_saves
alter table luma_community_saves add constraint luma_community_saves_post_id_fkey FOREIGN KEY (post_id) REFERENCES luma_community_posts(id) ON DELETE CASCADE;

-- luma_community_saves
alter table luma_community_saves add constraint luma_community_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- luma_community_subscriptions
alter table luma_community_subscriptions add constraint luma_community_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- luma_community_subscriptions
alter table luma_community_subscriptions add constraint luma_community_subscriptions_pkey PRIMARY KEY (user_id, subscribed_user_id);

-- luma_community_subscriptions
alter table luma_community_subscriptions add constraint luma_community_subscriptions_subscribed_user_id_fkey FOREIGN KEY (subscribed_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- luma_community_subscriptions
alter table luma_community_subscriptions add constraint luma_community_no_self_subscribe CHECK (user_id <> subscribed_user_id);

-- luma_content_events
alter table luma_content_events add constraint luma_content_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_content_events
alter table luma_content_events add constraint luma_content_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;

-- luma_content_events
alter table luma_content_events add constraint luma_content_events_pkey PRIMARY KEY (id);

-- luma_expense_records
alter table luma_expense_records add constraint luma_expense_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_expense_records
alter table luma_expense_records add constraint luma_expense_records_pkey PRIMARY KEY (id);

-- luma_financial_reports
alter table luma_financial_reports add constraint luma_financial_reports_pkey PRIMARY KEY (id);

-- luma_financial_reports
alter table luma_financial_reports add constraint luma_financial_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_hpp_scenarios
alter table luma_hpp_scenarios add constraint luma_hpp_scenarios_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_hpp_scenarios
alter table luma_hpp_scenarios add constraint luma_hpp_scenarios_pkey PRIMARY KEY (id);

-- luma_issue_logs
alter table luma_issue_logs add constraint luma_issue_logs_pkey PRIMARY KEY (id);

-- luma_issue_logs
alter table luma_issue_logs add constraint luma_issue_logs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;

-- luma_issue_logs
alter table luma_issue_logs add constraint luma_issue_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_knowledge_documents
alter table luma_knowledge_documents add constraint luma_knowledge_documents_status_check CHECK (status = ANY (ARRAY['active'::text, 'draft'::text, 'archived'::text]));

-- luma_knowledge_documents
alter table luma_knowledge_documents add constraint luma_knowledge_documents_pkey PRIMARY KEY (id);

-- luma_knowledge_documents
alter table luma_knowledge_documents add constraint luma_knowledge_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_notification_reads
alter table luma_notification_reads add constraint luma_notification_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- luma_notification_reads
alter table luma_notification_reads add constraint luma_notification_reads_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES luma_notifications(id) ON DELETE CASCADE;

-- luma_notification_reads
alter table luma_notification_reads add constraint luma_notification_reads_pkey PRIMARY KEY (notification_id, user_id);

-- luma_notifications
alter table luma_notifications add constraint luma_notifications_pkey PRIMARY KEY (id);

-- luma_otp_challenges
alter table luma_otp_challenges add constraint luma_otp_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- luma_otp_challenges
alter table luma_otp_challenges add constraint luma_otp_challenges_pkey PRIMARY KEY (id);

-- luma_payment_checkout_intents
alter table luma_payment_checkout_intents add constraint luma_payment_checkout_intents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- luma_payment_checkout_intents
alter table luma_payment_checkout_intents add constraint luma_payment_checkout_intents_kind_check CHECK (kind = ANY (ARRAY['token'::text, 'subscription'::text]));

-- luma_payment_checkout_intents
alter table luma_payment_checkout_intents add constraint luma_payment_checkout_intents_order_code_key UNIQUE (order_code);

-- luma_payment_checkout_intents
alter table luma_payment_checkout_intents add constraint luma_payment_checkout_intents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- luma_payment_checkout_intents
alter table luma_payment_checkout_intents add constraint luma_payment_checkout_intents_status_check CHECK (status = ANY (ARRAY['processing'::text, 'ready'::text, 'failed'::text, 'paid'::text, 'expired'::text]));

-- luma_payment_checkout_intents
alter table luma_payment_checkout_intents add constraint luma_payment_checkout_intents_amount_check CHECK (amount >= 0::numeric);

-- luma_payment_checkout_intents
alter table luma_payment_checkout_intents add constraint luma_payment_checkout_intents_pkey PRIMARY KEY (id);

-- luma_payment_checkout_intents
alter table luma_payment_checkout_intents add constraint luma_payment_checkout_intents_idempotency_key_key UNIQUE (idempotency_key);

-- luma_payment_provider_settings
alter table luma_payment_provider_settings add constraint luma_payment_provider_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_payment_provider_settings
alter table luma_payment_provider_settings add constraint luma_payment_provider_settings_weight_check CHECK (weight >= 1 AND weight <= 100);

-- luma_payment_provider_settings
alter table luma_payment_provider_settings add constraint luma_payment_provider_settings_provider_check CHECK (provider = ANY (ARRAY['mayar'::text, 'xendit'::text, 'midtrans'::text]));

-- luma_payment_provider_settings
alter table luma_payment_provider_settings add constraint luma_payment_provider_settings_priority_check CHECK (priority >= 1 AND priority <= 999);

-- luma_payment_provider_settings
alter table luma_payment_provider_settings add constraint luma_payment_provider_settings_health_status_check CHECK (health_status = ANY (ARRAY['unknown'::text, 'healthy'::text, 'degraded'::text, 'error'::text]));

-- luma_payment_provider_settings
alter table luma_payment_provider_settings add constraint luma_payment_provider_settings_pkey PRIMARY KEY (provider);

-- luma_payment_routing
alter table luma_payment_routing add constraint luma_payment_routing_id_check CHECK (id = 1);

-- luma_payment_routing
alter table luma_payment_routing add constraint luma_payment_routing_mode_check CHECK (mode = ANY (ARRAY['priority_fallback'::text, 'weighted'::text]));

-- luma_payment_routing
alter table luma_payment_routing add constraint luma_payment_routing_pkey PRIMARY KEY (id);

-- luma_payment_routing
alter table luma_payment_routing add constraint luma_payment_routing_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_payment_webhook_events
alter table luma_payment_webhook_events add constraint uq_luma_payment_webhook_event UNIQUE (provider, event_key);

-- luma_payment_webhook_events
alter table luma_payment_webhook_events add constraint luma_payment_webhook_events_pkey PRIMARY KEY (id);

-- luma_pdf_downloads
alter table luma_pdf_downloads add constraint luma_pdf_downloads_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- luma_pdf_downloads
alter table luma_pdf_downloads add constraint luma_pdf_downloads_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- luma_pdf_downloads
alter table luma_pdf_downloads add constraint luma_pdf_downloads_report_id_fkey FOREIGN KEY (report_id) REFERENCES luma_pdf_reports(id) ON DELETE CASCADE;

-- luma_pdf_downloads
alter table luma_pdf_downloads add constraint luma_pdf_downloads_pkey PRIMARY KEY (id);

-- luma_pdf_reports
alter table luma_pdf_reports add constraint luma_pdf_reports_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- luma_pdf_reports
alter table luma_pdf_reports add constraint luma_pdf_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- luma_pdf_reports
alter table luma_pdf_reports add constraint luma_pdf_reports_pkey PRIMARY KEY (id);

-- luma_platform_settings
alter table luma_platform_settings add constraint luma_platform_settings_pkey PRIMARY KEY (setting_key);

-- luma_promo_codes
alter table luma_promo_codes add constraint luma_promo_codes_value_check CHECK (value > 0::numeric);

-- luma_promo_codes
alter table luma_promo_codes add constraint luma_promo_codes_pkey PRIMARY KEY (id);

-- luma_promo_codes
alter table luma_promo_codes add constraint luma_promo_codes_promo_type_check CHECK (promo_type = ANY (ARRAY['subscription_percent'::text, 'subscription_amount'::text, 'token_percent'::text, 'token_amount'::text, 'free_tokens'::text, 'extend_days'::text]));

-- luma_promo_codes
alter table luma_promo_codes add constraint luma_promo_codes_code_key UNIQUE (code);

-- luma_promo_redemptions
alter table luma_promo_redemptions add constraint luma_promo_redemptions_pkey PRIMARY KEY (id);

-- luma_promo_redemptions
alter table luma_promo_redemptions add constraint luma_promo_redemptions_promo_id_fkey FOREIGN KEY (promo_id) REFERENCES luma_promo_codes(id) ON DELETE CASCADE;

-- luma_promo_redemptions
alter table luma_promo_redemptions add constraint luma_promo_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- luma_promo_redemptions
alter table luma_promo_redemptions add constraint luma_promo_redemptions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;

-- luma_provider_accounts
alter table luma_provider_accounts add constraint luma_provider_accounts_status_check CHECK (status = ANY (ARRAY['active'::text, 'warning'::text, 'paused'::text, 'error'::text, 'inactive'::text]));

-- luma_provider_accounts
alter table luma_provider_accounts add constraint luma_provider_accounts_pkey PRIMARY KEY (id);

-- luma_provider_accounts
alter table luma_provider_accounts add constraint luma_provider_accounts_provider_service_key UNIQUE (provider, service);

-- luma_provider_accounts
alter table luma_provider_accounts add constraint luma_provider_accounts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_schema_migration_registry
alter table luma_schema_migration_registry add constraint luma_schema_migration_registry_source_status_check CHECK (source_status = ANY (ARRAY['repository_migration'::text, 'production_legacy'::text, 'repository_manual_state'::text, 'baseline_snapshot'::text]));

-- luma_schema_migration_registry
alter table luma_schema_migration_registry add constraint luma_schema_migration_registry_pkey PRIMARY KEY (migration_version, migration_name);

-- luma_social_archives
alter table luma_social_archives add constraint luma_social_archives_community_post_id_fkey FOREIGN KEY (community_post_id) REFERENCES luma_community_posts(id) ON DELETE SET NULL;

-- luma_social_archives
alter table luma_social_archives add constraint luma_social_archives_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- luma_social_archives
alter table luma_social_archives add constraint luma_social_archives_pkey PRIMARY KEY (id);

-- luma_subscription_orders
alter table luma_subscription_orders add constraint luma_subscription_orders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;

-- luma_subscription_orders
alter table luma_subscription_orders add constraint luma_subscription_orders_checkout_intent_id_fkey FOREIGN KEY (checkout_intent_id) REFERENCES luma_payment_checkout_intents(id) ON DELETE SET NULL;

-- luma_subscription_orders
alter table luma_subscription_orders add constraint luma_subscription_orders_pkey PRIMARY KEY (id);

-- luma_subscription_orders
alter table luma_subscription_orders add constraint luma_subscription_orders_order_code_key UNIQUE (order_code);

-- luma_subscription_orders
alter table luma_subscription_orders add constraint luma_subscription_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- luma_subscription_orders
alter table luma_subscription_orders add constraint luma_subscription_orders_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES luma_subscription_plans(id);

-- luma_subscription_orders
alter table luma_subscription_orders add constraint luma_subscription_orders_promo_id_fkey FOREIGN KEY (promo_id) REFERENCES luma_promo_codes(id) ON DELETE SET NULL;

-- luma_subscription_orders
alter table luma_subscription_orders add constraint luma_subscription_orders_upgrade_from_subscription_id_fkey FOREIGN KEY (upgrade_from_subscription_id) REFERENCES luma_user_subscriptions(id) ON DELETE SET NULL;

-- luma_subscription_plans
alter table luma_subscription_plans add constraint luma_subscription_plans_code_key UNIQUE (code);

-- luma_subscription_plans
alter table luma_subscription_plans add constraint luma_subscription_plans_duration_days_check CHECK (duration_days > 0);

-- luma_subscription_plans
alter table luma_subscription_plans add constraint luma_subscription_plans_priority_level_check CHECK (priority_level = ANY (ARRAY['trial'::text, 'normal'::text, 'medium'::text, 'high'::text]));

-- luma_subscription_plans
alter table luma_subscription_plans add constraint luma_subscription_plans_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'draft'::text]));

-- luma_subscription_plans
alter table luma_subscription_plans add constraint luma_subscription_plans_pkey PRIMARY KEY (id);

-- luma_support_messages
alter table luma_support_messages add constraint luma_support_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_support_messages
alter table luma_support_messages add constraint luma_support_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- luma_support_messages
alter table luma_support_messages add constraint luma_support_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- luma_support_messages
alter table luma_support_messages add constraint luma_support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES luma_support_tickets(id) ON DELETE CASCADE;

-- luma_support_messages
alter table luma_support_messages add constraint luma_support_messages_pkey PRIMARY KEY (id);

-- luma_support_messages
alter table luma_support_messages add constraint luma_support_messages_sender_type_check CHECK (sender_type = ANY (ARRAY['user'::text, 'agent'::text, 'owner'::text, 'system'::text, 'whatsapp'::text]));

-- luma_support_tickets
alter table luma_support_tickets add constraint luma_support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_support_tickets
alter table luma_support_tickets add constraint luma_support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- luma_support_tickets
alter table luma_support_tickets add constraint luma_support_tickets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- luma_support_tickets
alter table luma_support_tickets add constraint luma_support_tickets_ticket_code_key UNIQUE (ticket_code);
