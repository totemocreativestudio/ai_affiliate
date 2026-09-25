-- Lumaway production schema baseline snapshot
-- Captured from Supabase production on 2026-09-25.
-- Disaster-recovery reference only. DO NOT apply to the existing production database.
-- Customer/business row data is intentionally excluded.

-- auth.users.on_auth_user_contacts_changed
CREATE TRIGGER on_auth_user_contacts_changed AFTER UPDATE OF email, phone, email_confirmed_at, phone_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION luma_sync_auth_contacts();

-- auth.users.on_auth_user_created_luma
CREATE TRIGGER on_auth_user_created_luma AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_luma_user();

-- public.agreements.trg_agreement_creator_status
CREATE TRIGGER trg_agreement_creator_status AFTER INSERT OR UPDATE OF creator_id, document_status, support_status ON agreements FOR EACH ROW EXECUTE FUNCTION luma_sync_agreement_creator_status();

-- public.agreements.trg_agreement_seal_defaults
CREATE TRIGGER trg_agreement_seal_defaults BEFORE INSERT OR UPDATE OF e_stamp_id, signed_by_name, signed_at, creator_name ON agreements FOR EACH ROW EXECUTE FUNCTION luma_agreement_seal_defaults();

-- public.ai_analysis_runs.trg_luma_notify_analysis_success
CREATE TRIGGER trg_luma_notify_analysis_success AFTER UPDATE OF status ON ai_analysis_runs FOR EACH ROW EXECUTE FUNCTION luma_notify_analysis_success();

-- public.creator_tasks.trg_luma_notify_task_done
CREATE TRIGGER trg_luma_notify_task_done AFTER UPDATE OF status ON creator_tasks FOR EACH ROW EXECUTE FUNCTION luma_notify_task_done();

-- public.creators.trg_luma_sync_creator_identity_key
CREATE TRIGGER trg_luma_sync_creator_identity_key BEFORE INSERT OR UPDATE OF username, name, creator_code, platform ON creators FOR EACH ROW EXECUTE FUNCTION luma_sync_creator_identity_key();

-- public.luma_community_likes.trg_luma_notify_social_like
CREATE TRIGGER trg_luma_notify_social_like AFTER INSERT ON luma_community_likes FOR EACH ROW EXECUTE FUNCTION luma_notify_social_like();

-- public.luma_pdf_reports.trg_luma_notify_report
CREATE TRIGGER trg_luma_notify_report AFTER INSERT ON luma_pdf_reports FOR EACH ROW EXECUTE FUNCTION luma_notify_report();

-- public.luma_social_archives.trg_luma_trim_social_archive
CREATE TRIGGER trg_luma_trim_social_archive AFTER INSERT ON luma_social_archives FOR EACH ROW EXECUTE FUNCTION luma_trim_social_archive();

-- public.luma_support_messages.trg_luma_notify_support_reply
CREATE TRIGGER trg_luma_notify_support_reply AFTER INSERT ON luma_support_messages FOR EACH ROW EXECUTE FUNCTION luma_notify_support_reply();

-- public.luma_support_messages.trg_luma_touch_support_ticket
CREATE TRIGGER trg_luma_touch_support_ticket AFTER INSERT ON luma_support_messages FOR EACH ROW EXECUTE FUNCTION luma_touch_support_ticket();

-- public.luma_support_tickets.trg_luma_notify_support_ticket
CREATE TRIGGER trg_luma_notify_support_ticket AFTER INSERT OR UPDATE OF status ON luma_support_tickets FOR EACH ROW EXECUTE FUNCTION luma_notify_support_ticket();

-- public.luma_token_transactions.trg_luma_notify_token_transaction
CREATE TRIGGER trg_luma_notify_token_transaction AFTER INSERT ON luma_token_transactions FOR EACH ROW EXECUTE FUNCTION luma_notify_token_transaction();

-- public.luma_topup_orders.trg_luma_notify_topup_order
CREATE TRIGGER trg_luma_notify_topup_order AFTER INSERT OR UPDATE OF status ON luma_topup_orders FOR EACH ROW EXECUTE FUNCTION luma_notify_topup_order();

-- public.luma_user_subscriptions.trg_luma_notify_subscription_status
CREATE TRIGGER trg_luma_notify_subscription_status AFTER UPDATE ON luma_user_subscriptions FOR EACH ROW EXECUTE FUNCTION luma_notify_subscription_status();

-- public.profiles.trg_luma_lock_social_identity
CREATE TRIGGER trg_luma_lock_social_identity BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION luma_lock_social_identity();

-- public.profiles.trg_luma_seed_free_trial
CREATE TRIGGER trg_luma_seed_free_trial AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION luma_seed_free_trial();

-- public.promo_generations.trg_luma_notify_promo
CREATE TRIGGER trg_luma_notify_promo AFTER INSERT ON promo_generations FOR EACH ROW EXECUTE FUNCTION luma_notify_promo();

-- public.ratecard_master.trg_ratecard_master_updated_at
CREATE TRIGGER trg_ratecard_master_updated_at BEFORE UPDATE ON ratecard_master FOR EACH ROW EXECUTE FUNCTION luma_ratecard_master_updated_at();

-- public.referral_events.trg_luma_notify_referral_event
CREATE TRIGGER trg_luma_notify_referral_event AFTER INSERT ON referral_events FOR EACH ROW EXECUTE FUNCTION luma_notify_referral_event();

-- public.referral_withdrawals.trg_luma_notify_withdrawal
CREATE TRIGGER trg_luma_notify_withdrawal AFTER INSERT OR UPDATE OF status ON referral_withdrawals FOR EACH ROW EXECUTE FUNCTION luma_notify_withdrawal();

-- public.referral_withdrawals.trg_notify_withdrawal_status
CREATE TRIGGER trg_notify_withdrawal_status AFTER UPDATE OF status ON referral_withdrawals FOR EACH ROW EXECUTE FUNCTION notify_withdrawal_status();

-- public.sales.trg_sync_creator_store_affiliation
CREATE TRIGGER trg_sync_creator_store_affiliation AFTER INSERT OR UPDATE OF store_name, store_id, creator_id, platform ON sales FOR EACH ROW EXECUTE FUNCTION sync_creator_store_affiliation();
