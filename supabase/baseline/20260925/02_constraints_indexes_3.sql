-- Lumaway production schema baseline snapshot
-- Captured from Supabase production on 2026-09-25.
-- Disaster-recovery reference only. DO NOT apply to the existing production database.
-- Customer/business row data is intentionally excluded.

-- luma_support_tickets
alter table luma_support_tickets add constraint luma_support_tickets_ticket_code_key UNIQUE (ticket_code);

-- luma_support_tickets
alter table luma_support_tickets add constraint luma_support_tickets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- luma_support_tickets
alter table luma_support_tickets add constraint luma_support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- luma_system_controls
alter table luma_system_controls add constraint luma_system_controls_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_system_controls
alter table luma_system_controls add constraint luma_system_controls_id_check CHECK (id = 1);

-- luma_system_controls
alter table luma_system_controls add constraint luma_system_controls_mode_check CHECK (mode = ANY (ARRAY['normal'::text, 'maintenance'::text, 'degraded'::text, 'outage'::text]));

-- luma_system_controls
alter table luma_system_controls add constraint luma_system_controls_pkey PRIMARY KEY (id);

-- luma_system_events
alter table luma_system_events add constraint luma_system_events_pkey PRIMARY KEY (id);

-- luma_system_events
alter table luma_system_events add constraint luma_system_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_token_packages
alter table luma_token_packages add constraint luma_token_packages_price_check CHECK (price >= 0::numeric);

-- luma_token_packages
alter table luma_token_packages add constraint luma_token_packages_pkey PRIMARY KEY (id);

-- luma_token_packages
alter table luma_token_packages add constraint luma_token_packages_tokens_check CHECK (tokens > 0);

-- luma_token_transactions
alter table luma_token_transactions add constraint luma_token_transactions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- luma_token_transactions
alter table luma_token_transactions add constraint luma_token_transactions_pkey PRIMARY KEY (id);

-- luma_token_transactions
alter table luma_token_transactions add constraint luma_token_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- luma_token_wallets
alter table luma_token_wallets add constraint luma_token_wallets_pkey PRIMARY KEY (user_id);

-- luma_token_wallets
alter table luma_token_wallets add constraint luma_token_wallets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- luma_token_wallets
alter table luma_token_wallets add constraint luma_token_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- luma_topup_orders
alter table luma_topup_orders add constraint luma_topup_orders_checkout_intent_id_fkey FOREIGN KEY (checkout_intent_id) REFERENCES luma_payment_checkout_intents(id) ON DELETE SET NULL;

-- luma_topup_orders
alter table luma_topup_orders add constraint luma_topup_orders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- luma_topup_orders
alter table luma_topup_orders add constraint luma_topup_orders_pkey PRIMARY KEY (id);

-- luma_topup_orders
alter table luma_topup_orders add constraint luma_topup_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- luma_topup_orders
alter table luma_topup_orders add constraint luma_topup_orders_order_code_key UNIQUE (order_code);

-- luma_topup_orders
alter table luma_topup_orders add constraint luma_topup_orders_promo_id_fkey FOREIGN KEY (promo_id) REFERENCES luma_promo_codes(id) ON DELETE SET NULL;

-- luma_tutorial_progress
alter table luma_tutorial_progress add constraint luma_tutorial_progress_pkey PRIMARY KEY (id);

-- luma_tutorial_progress
alter table luma_tutorial_progress add constraint luma_tutorial_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- luma_tutorial_progress
alter table luma_tutorial_progress add constraint luma_tutorial_progress_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- luma_tutorial_progress
alter table luma_tutorial_progress add constraint luma_tutorial_progress_tutorial_id_fkey FOREIGN KEY (tutorial_id) REFERENCES tutorials(id) ON DELETE CASCADE;

-- luma_tutorial_progress
alter table luma_tutorial_progress add constraint luma_tutorial_progress_user_id_tutorial_id_key UNIQUE (user_id, tutorial_id);

-- luma_user_subscriptions
alter table luma_user_subscriptions add constraint luma_user_subscriptions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;

-- luma_user_subscriptions
alter table luma_user_subscriptions add constraint luma_user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- luma_user_subscriptions
alter table luma_user_subscriptions add constraint luma_user_subscriptions_priority_level_check CHECK (priority_level = ANY (ARRAY['trial'::text, 'normal'::text, 'medium'::text, 'high'::text]));

-- luma_user_subscriptions
alter table luma_user_subscriptions add constraint luma_user_subscriptions_status_check CHECK (status = ANY (ARRAY['trialing'::text, 'active'::text, 'expired'::text, 'canceled'::text]));

-- luma_user_subscriptions
alter table luma_user_subscriptions add constraint luma_user_subscriptions_pkey PRIMARY KEY (id);

-- luma_user_subscriptions
alter table luma_user_subscriptions add constraint luma_user_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES luma_subscription_plans(id);

-- marketing_lead_outbox
alter table marketing_lead_outbox add constraint marketing_lead_outbox_lead_id_key UNIQUE (lead_id);

-- marketing_lead_outbox
alter table marketing_lead_outbox add constraint marketing_lead_outbox_state_check CHECK (state = ANY (ARRAY['pending'::text, 'delivered'::text, 'failed'::text]));

-- marketing_lead_outbox
alter table marketing_lead_outbox add constraint marketing_lead_outbox_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES marketing_leads(id) ON DELETE CASCADE;

-- marketing_lead_outbox
alter table marketing_lead_outbox add constraint marketing_lead_outbox_pkey PRIMARY KEY (id);

-- marketing_leads
alter table marketing_leads add constraint marketing_leads_kind_check CHECK (kind = ANY (ARRAY['demo'::text, 'sales'::text, 'newsletter'::text, 'waitlist'::text, 'resource'::text]));

-- marketing_leads
alter table marketing_leads add constraint marketing_leads_email_check CHECK (length(email) <= 254);

-- marketing_leads
alter table marketing_leads add constraint marketing_leads_consent_check CHECK (consent = true);

-- marketing_leads
alter table marketing_leads add constraint marketing_leads_fingerprint_check CHECK (length(fingerprint) = 64);

-- marketing_leads
alter table marketing_leads add constraint marketing_leads_status_check CHECK (status = ANY (ARRAY['new'::text, 'reviewed'::text, 'contacted'::text, 'closed'::text]));

-- marketing_leads
alter table marketing_leads add constraint marketing_leads_pkey PRIMARY KEY (id);

-- marketing_leads
alter table marketing_leads add constraint marketing_leads_request_id_key UNIQUE (request_id);

-- owner_service_subscriptions
alter table owner_service_subscriptions add constraint owner_service_subscriptions_pkey PRIMARY KEY (id);

-- product_hpp_history
alter table product_hpp_history add constraint product_hpp_history_pkey PRIMARY KEY (id);

-- product_hpp_history
alter table product_hpp_history add constraint product_hpp_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- product_hpp_history
alter table product_hpp_history add constraint product_hpp_history_product_master_id_fkey FOREIGN KEY (product_master_id) REFERENCES product_master(id) ON DELETE SET NULL;

-- product_hpp_history
alter table product_hpp_history add constraint product_hpp_history_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- product_master
alter table product_master add constraint product_master_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- product_master
alter table product_master add constraint product_master_pkey PRIMARY KEY (id);

-- product_platform_items
alter table product_platform_items add constraint uq_product_platform_items_workspace_platform_code UNIQUE (workspace_id, platform, product_code);

-- product_platform_items
alter table product_platform_items add constraint product_platform_items_pkey PRIMARY KEY (id);

-- product_platform_items
alter table product_platform_items add constraint product_platform_items_variant_slot_check CHECK (variant_slot IS NULL OR variant_slot >= 1 AND variant_slot <= 15);

-- product_platform_items
alter table product_platform_items add constraint product_platform_items_product_master_id_fkey FOREIGN KEY (product_master_id) REFERENCES product_master(id) ON DELETE CASCADE;

-- product_platform_items
alter table product_platform_items add constraint product_platform_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- product_variants
alter table product_variants add constraint uq_product_variants_workspace_product_slot UNIQUE (workspace_id, product_master_id, slot);

-- product_variants
alter table product_variants add constraint product_variants_pkey PRIMARY KEY (id);

-- product_variants
alter table product_variants add constraint product_variants_slot_check CHECK (slot >= 1 AND slot <= 15);

-- product_variants
alter table product_variants add constraint product_variants_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- product_variants
alter table product_variants add constraint product_variants_product_master_id_fkey FOREIGN KEY (product_master_id) REFERENCES product_master(id) ON DELETE CASCADE;

-- products
alter table products add constraint products_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- products
alter table products add constraint products_pkey PRIMARY KEY (id);

-- products
alter table products add constraint products_sku_key UNIQUE (sku);

-- profiles
alter table profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- profiles
alter table profiles add constraint profiles_username_key UNIQUE (username);

-- profiles
alter table profiles add constraint luma_profiles_role_check CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text, 'viewer'::text]));

-- profiles
alter table profiles add constraint profiles_pkey PRIMARY KEY (id);

-- profiles
alter table profiles add constraint profiles_legacy_user_id_key UNIQUE (legacy_user_id);

-- promo_generations
alter table promo_generations add constraint promo_generations_pkey PRIMARY KEY (id);

-- promo_generations
alter table promo_generations add constraint promo_generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- promo_generations
alter table promo_generations add constraint promo_generations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- ratecard_master
alter table ratecard_master add constraint ratecard_master_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- ratecard_master
alter table ratecard_master add constraint ratecard_master_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE SET NULL;

-- ratecard_master
alter table ratecard_master add constraint ratecard_master_pkey PRIMARY KEY (id);

-- referral_events
alter table referral_events add constraint referral_events_referrer_user_id_fkey FOREIGN KEY (referrer_user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- referral_events
alter table referral_events add constraint referral_events_pkey PRIMARY KEY (id);

-- referral_events
alter table referral_events add constraint referral_events_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- referral_events
alter table referral_events add constraint referral_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- referral_profiles
alter table referral_profiles add constraint referral_profiles_referral_code_key UNIQUE (referral_code);

-- referral_profiles
alter table referral_profiles add constraint referral_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- referral_profiles
alter table referral_profiles add constraint referral_profiles_referred_by_user_id_fkey FOREIGN KEY (referred_by_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- referral_profiles
alter table referral_profiles add constraint referral_profiles_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- referral_profiles
alter table referral_profiles add constraint referral_profiles_pkey PRIMARY KEY (id);

-- referral_profiles
alter table referral_profiles add constraint referral_profiles_user_id_key UNIQUE (user_id);

-- referral_withdrawals
alter table referral_withdrawals add constraint referral_withdrawals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- referral_withdrawals
alter table referral_withdrawals add constraint referral_withdrawals_pkey PRIMARY KEY (id);

-- referral_withdrawals
alter table referral_withdrawals add constraint referral_withdrawals_amount_check CHECK (amount > 0::numeric);

-- referral_withdrawals
alter table referral_withdrawals add constraint referral_withdrawals_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- sales
alter table sales add constraint sales_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- sales
alter table sales add constraint sales_record_key_key UNIQUE (record_key);

-- sales
alter table sales add constraint sales_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE SET NULL;

-- sales
alter table sales add constraint sales_pkey PRIMARY KEY (id);

-- shipping
alter table shipping add constraint shipping_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- shipping
alter table shipping add constraint shipping_product_master_id_fkey FOREIGN KEY (product_master_id) REFERENCES product_master(id) ON DELETE SET NULL;

-- shipping
alter table shipping add constraint shipping_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE SET NULL;

-- shipping
alter table shipping add constraint shipping_pkey PRIMARY KEY (id);

-- tutorials
alter table tutorials add constraint tutorials_pkey PRIMARY KEY (id);
