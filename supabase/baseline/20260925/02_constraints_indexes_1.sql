-- Lumaway production schema baseline snapshot
-- Captured from Supabase production on 2026-09-25.
-- Disaster-recovery reference only. DO NOT apply to the existing production database.
-- Customer/business row data is intentionally excluded.

-- affiliate_ads_support
alter table affiliate_ads_support add constraint affiliate_ads_support_valid_period CHECK (end_date >= start_date);

-- affiliate_ads_support
alter table affiliate_ads_support add constraint affiliate_ads_support_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- affiliate_ads_support
alter table affiliate_ads_support add constraint affiliate_ads_support_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- affiliate_ads_support
alter table affiliate_ads_support add constraint affiliate_ads_support_period_unique UNIQUE (workspace_id, start_date, end_date, platform);

-- affiliate_ads_support
alter table affiliate_ads_support add constraint affiliate_ads_support_pkey PRIMARY KEY (id);

-- affiliate_ads_support
alter table affiliate_ads_support add constraint affiliate_ads_support_amount_check CHECK (amount >= 0::numeric);

-- agreements
alter table agreements add constraint agreements_agreement_id_key UNIQUE (agreement_id);

-- agreements
alter table agreements add constraint agreements_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- agreements
alter table agreements add constraint agreements_product_master_id_fkey FOREIGN KEY (product_master_id) REFERENCES product_master(id) ON DELETE SET NULL;

-- agreements
alter table agreements add constraint agreements_pkey PRIMARY KEY (id);

-- agreements
alter table agreements add constraint agreements_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE SET NULL;

-- ai_analysis_logs
alter table ai_analysis_logs add constraint ai_analysis_logs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- ai_analysis_logs
alter table ai_analysis_logs add constraint ai_analysis_logs_run_id_fkey FOREIGN KEY (run_id) REFERENCES ai_analysis_runs(run_id) ON DELETE CASCADE;

-- ai_analysis_logs
alter table ai_analysis_logs add constraint ai_analysis_logs_pkey PRIMARY KEY (id);

-- ai_analysis_runs
alter table ai_analysis_runs add constraint ai_analysis_runs_pkey PRIMARY KEY (id);

-- ai_analysis_runs
alter table ai_analysis_runs add constraint ai_analysis_runs_run_id_key UNIQUE (run_id);

-- ai_analysis_runs
alter table ai_analysis_runs add constraint ai_analysis_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- ai_insights
alter table ai_insights add constraint ai_insights_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- ai_insights
alter table ai_insights add constraint ai_insights_pkey PRIMARY KEY (id);

-- ai_insights
alter table ai_insights add constraint ai_insights_run_id_fkey FOREIGN KEY (run_id) REFERENCES ai_analysis_runs(run_id) ON DELETE CASCADE;

-- audit_log
alter table audit_log add constraint audit_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- audit_log
alter table audit_log add constraint audit_log_pkey PRIMARY KEY (id);

-- creator_360_profiles
alter table creator_360_profiles add constraint creator_360_profiles_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE;

-- creator_360_profiles
alter table creator_360_profiles add constraint creator_360_profiles_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- creator_360_profiles
alter table creator_360_profiles add constraint creator_360_profiles_workspace_id_creator_id_key UNIQUE (workspace_id, creator_id);

-- creator_360_profiles
alter table creator_360_profiles add constraint creator_360_profiles_pkey PRIMARY KEY (id);

-- creator_360_profiles
alter table creator_360_profiles add constraint creator_360_profiles_rating_check CHECK (rating >= 0::numeric AND rating <= 5::numeric);

-- creator_360_targets
alter table creator_360_targets add constraint creator_360_targets_target_live_check CHECK (target_live >= 0::numeric);

-- creator_360_targets
alter table creator_360_targets add constraint creator_360_targets_target_video_check CHECK (target_video >= 0::numeric);

-- creator_360_targets
alter table creator_360_targets add constraint creator_360_targets_pkey PRIMARY KEY (id);

-- creator_360_targets
alter table creator_360_targets add constraint creator_360_targets_workspace_id_creator_id_target_year_tar_key UNIQUE (workspace_id, creator_id, target_year, target_month);

-- creator_360_targets
alter table creator_360_targets add constraint creator_360_targets_target_month_check CHECK (target_month >= 0 AND target_month <= 12);

-- creator_360_targets
alter table creator_360_targets add constraint creator_360_targets_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE;

-- creator_360_targets
alter table creator_360_targets add constraint creator_360_targets_target_year_check CHECK (target_year >= 2020 AND target_year <= 2100);

-- creator_360_targets
alter table creator_360_targets add constraint creator_360_targets_target_sales_check CHECK (target_sales >= 0::numeric);

-- creator_documents
alter table creator_documents add constraint creator_documents_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE;

-- creator_documents
alter table creator_documents add constraint creator_documents_pkey PRIMARY KEY (id);

-- creator_documents
alter table creator_documents add constraint creator_documents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- creator_history
alter table creator_history add constraint creator_history_pkey PRIMARY KEY (id);

-- creator_history
alter table creator_history add constraint creator_history_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE;

-- creator_history
alter table creator_history add constraint creator_history_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- creator_samples
alter table creator_samples add constraint creator_samples_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE;

-- creator_samples
alter table creator_samples add constraint creator_samples_pkey PRIMARY KEY (id);

-- creator_samples
alter table creator_samples add constraint creator_samples_product_master_id_fkey FOREIGN KEY (product_master_id) REFERENCES product_master(id) ON DELETE SET NULL;

-- creator_samples
alter table creator_samples add constraint creator_samples_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- creator_store_affiliations
alter table creator_store_affiliations add constraint creator_store_affiliations_workspace_id_creator_id_platform_key UNIQUE (workspace_id, creator_id, platform, store_name);

-- creator_store_affiliations
alter table creator_store_affiliations add constraint creator_store_affiliations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- creator_store_affiliations
alter table creator_store_affiliations add constraint creator_store_affiliations_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE;

-- creator_store_affiliations
alter table creator_store_affiliations add constraint creator_store_affiliations_pkey PRIMARY KEY (id);

-- creator_tasks
alter table creator_tasks add constraint creator_tasks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE;

-- creator_tasks
alter table creator_tasks add constraint creator_tasks_pkey PRIMARY KEY (id);

-- creator_tasks
alter table creator_tasks add constraint creator_tasks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- creator_user_access
alter table creator_user_access add constraint creator_user_access_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE;

-- creator_user_access
alter table creator_user_access add constraint creator_user_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- creator_user_access
alter table creator_user_access add constraint creator_user_access_user_id_creator_id_key UNIQUE (user_id, creator_id);

-- creator_user_access
alter table creator_user_access add constraint creator_user_access_pkey PRIMARY KEY (id);

-- creator_user_access
alter table creator_user_access add constraint creator_user_access_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- creator_user_access
alter table creator_user_access add constraint creator_user_access_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- creators
alter table creators add constraint creators_pkey PRIMARY KEY (id);

-- creators
alter table creators add constraint creators_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- creators
alter table creators add constraint creators_creator_code_key UNIQUE (creator_code);

-- daily
alter table daily add constraint daily_pkey PRIMARY KEY (id);

-- daily
alter table daily add constraint daily_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- google_sheet_connections
alter table google_sheet_connections add constraint google_sheet_connections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- google_sheet_connections
alter table google_sheet_connections add constraint google_sheet_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- google_sheet_connections
alter table google_sheet_connections add constraint google_sheet_connections_user_id_workspace_id_key UNIQUE (user_id, workspace_id);

-- google_sheet_connections
alter table google_sheet_connections add constraint google_sheet_connections_pkey PRIMARY KEY (id);

-- google_sheet_sync_history
alter table google_sheet_sync_history add constraint google_sheet_sync_history_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- google_sheet_sync_history
alter table google_sheet_sync_history add constraint google_sheet_sync_history_sync_id_key UNIQUE (sync_id);

-- google_sheet_sync_history
alter table google_sheet_sync_history add constraint google_sheet_sync_history_pkey PRIMARY KEY (id);

-- google_sheet_sync_state
alter table google_sheet_sync_state add constraint google_sheet_sync_state_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- google_sheet_sync_state
alter table google_sheet_sync_state add constraint google_sheet_sync_state_kind_record_id_key UNIQUE (kind, record_id);

-- google_sheet_sync_state
alter table google_sheet_sync_state add constraint google_sheet_sync_state_pkey PRIMARY KEY (id);

-- imports
alter table imports add constraint imports_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- imports
alter table imports add constraint imports_import_id_key UNIQUE (import_id);

-- imports
alter table imports add constraint imports_pkey PRIMARY KEY (id);

-- kpi_targets
alter table kpi_targets add constraint kpi_targets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- kpi_targets
alter table kpi_targets add constraint kpi_targets_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE;

-- kpi_targets
alter table kpi_targets add constraint kpi_targets_scope_creator_id_period_platform_key UNIQUE (scope, creator_id, period, platform);

-- kpi_targets
alter table kpi_targets add constraint kpi_targets_pkey PRIMARY KEY (id);

-- listings
alter table listings add constraint listings_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE SET NULL;

-- listings
alter table listings add constraint listings_pkey PRIMARY KEY (id);

-- listings
alter table listings add constraint listings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- listings
alter table listings add constraint listings_product_master_id_fkey FOREIGN KEY (product_master_id) REFERENCES product_master(id) ON DELETE SET NULL;

-- luma_api_usage_events
alter table luma_api_usage_events add constraint luma_api_usage_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;

-- luma_api_usage_events
alter table luma_api_usage_events add constraint luma_api_usage_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_api_usage_events
alter table luma_api_usage_events add constraint luma_api_usage_events_pkey PRIMARY KEY (id);

-- luma_blog_posts
alter table luma_blog_posts add constraint luma_blog_posts_pkey PRIMARY KEY (id);

-- luma_blog_posts
alter table luma_blog_posts add constraint luma_blog_posts_slug_key UNIQUE (slug);

-- luma_business_monthly_targets
alter table luma_business_monthly_targets add constraint luma_business_monthly_targets_target_year_check CHECK (target_year >= 2020 AND target_year <= 2100);

-- luma_business_monthly_targets
alter table luma_business_monthly_targets add constraint luma_business_monthly_targets_target_month_check CHECK (target_month >= 1 AND target_month <= 12);

-- luma_business_monthly_targets
alter table luma_business_monthly_targets add constraint luma_business_monthly_targets_target_year_target_month_key UNIQUE (target_year, target_month);

-- luma_business_monthly_targets
alter table luma_business_monthly_targets add constraint luma_business_monthly_targets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_business_monthly_targets
alter table luma_business_monthly_targets add constraint luma_business_monthly_targets_pkey PRIMARY KEY (id);

-- luma_business_monthly_targets
alter table luma_business_monthly_targets add constraint luma_business_monthly_targets_target_revenue_check CHECK (target_revenue >= 0::numeric);

-- luma_business_monthly_targets
alter table luma_business_monthly_targets add constraint luma_business_monthly_targets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- luma_business_monthly_targets
alter table luma_business_monthly_targets add constraint luma_business_monthly_targets_forecast_revenue_check CHECK (forecast_revenue >= 0::numeric);

-- luma_community_likes
alter table luma_community_likes add constraint luma_community_likes_pkey PRIMARY KEY (post_id, user_id);

-- luma_community_likes
alter table luma_community_likes add constraint luma_community_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES luma_community_posts(id) ON DELETE CASCADE;

-- luma_community_likes
alter table luma_community_likes add constraint luma_community_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
