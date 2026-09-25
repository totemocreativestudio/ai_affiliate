-- PR #44: RLS performance optimization
-- 1) Convert auth.uid() in RLS expressions to initPlan form recommended by Supabase.
DO $pr44$
DECLARE
  p record;
  new_qual text;
  new_check text;
  stmt text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual,'') LIKE '%auth.uid()%'
        OR coalesce(with_check,'') LIKE '%auth.uid()%'
      )
  LOOP
    new_qual := CASE WHEN p.qual IS NULL THEN NULL ELSE replace(p.qual, 'auth.uid()', '(select auth.uid())') END;
    new_check := CASE WHEN p.with_check IS NULL THEN NULL ELSE replace(p.with_check, 'auth.uid()', '(select auth.uid())') END;

    stmt := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);

    IF p.cmd IN ('SELECT','DELETE') AND new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    ELSIF p.cmd = 'INSERT' AND new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    ELSIF p.cmd IN ('UPDATE','ALL') THEN
      IF new_qual IS NOT NULL THEN
        stmt := stmt || format(' USING (%s)', new_qual);
      END IF;
      IF new_check IS NOT NULL THEN
        stmt := stmt || format(' WITH CHECK (%s)', new_check);
      END IF;
    END IF;

    EXECUTE stmt;
  END LOOP;
END
$pr44$;

-- 2) Add leading indexes for user/tenant columns used by RLS policies.
CREATE INDEX IF NOT EXISTS idx_ai_analysis_logs_workspace_id_rls ON public.ai_analysis_logs (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_workspace_id_rls ON public.ai_insights (workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_id_rls ON public.audit_log (workspace_id);
CREATE INDEX IF NOT EXISTS idx_creator_documents_workspace_id_rls ON public.creator_documents (workspace_id);
CREATE INDEX IF NOT EXISTS idx_creator_history_workspace_id_rls ON public.creator_history (workspace_id);
CREATE INDEX IF NOT EXISTS idx_creator_tasks_workspace_id_rls ON public.creator_tasks (workspace_id);
CREATE INDEX IF NOT EXISTS idx_creator_user_access_workspace_id_rls ON public.creator_user_access (workspace_id);
CREATE INDEX IF NOT EXISTS idx_daily_workspace_id_rls ON public.daily (workspace_id);
CREATE INDEX IF NOT EXISTS idx_google_sheet_sync_history_workspace_id_rls ON public.google_sheet_sync_history (workspace_id);
CREATE INDEX IF NOT EXISTS idx_google_sheet_sync_state_workspace_id_rls ON public.google_sheet_sync_state (workspace_id);
CREATE INDEX IF NOT EXISTS idx_luma_community_likes_user_id_rls ON public.luma_community_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_luma_community_posts_user_id_rls ON public.luma_community_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_luma_community_saves_user_id_rls ON public.luma_community_saves (user_id);
CREATE INDEX IF NOT EXISTS idx_luma_content_events_user_id_rls ON public.luma_content_events (user_id);
CREATE INDEX IF NOT EXISTS idx_luma_issue_logs_user_id_rls ON public.luma_issue_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_luma_notification_reads_user_id_rls ON public.luma_notification_reads (user_id);
CREATE INDEX IF NOT EXISTS idx_luma_notifications_workspace_id_rls ON public.luma_notifications (workspace_id);
CREATE INDEX IF NOT EXISTS idx_luma_pdf_downloads_workspace_id_rls ON public.luma_pdf_downloads (workspace_id);
CREATE INDEX IF NOT EXISTS idx_luma_social_archives_user_id_rls ON public.luma_social_archives (user_id);
CREATE INDEX IF NOT EXISTS idx_luma_support_messages_user_id_rls ON public.luma_support_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_luma_support_tickets_workspace_id_rls ON public.luma_support_tickets (workspace_id);
CREATE INDEX IF NOT EXISTS idx_luma_token_transactions_workspace_id_rls ON public.luma_token_transactions (workspace_id);
CREATE INDEX IF NOT EXISTS idx_luma_tutorial_progress_workspace_id_rls ON public.luma_tutorial_progress (workspace_id);
CREATE INDEX IF NOT EXISTS idx_promo_generations_user_id_rls ON public.promo_generations (user_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_workspace_id_rls ON public.referral_events (workspace_id);
CREATE INDEX IF NOT EXISTS idx_referral_profiles_workspace_id_rls ON public.referral_profiles (workspace_id);
CREATE INDEX IF NOT EXISTS idx_referral_withdrawals_user_id_rls ON public.referral_withdrawals (user_id);
CREATE INDEX IF NOT EXISTS idx_tutorials_workspace_id_rls ON public.tutorials (workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_workspace_id_rls ON public.user_notifications (workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_payout_methods_workspace_id_rls ON public.user_payout_methods (workspace_id);
