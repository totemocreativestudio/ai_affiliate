# Supabase Advisor Audit — 2026-09-25

Captured after PR42 database baseline/migration registry changes.

## Security advisor

Notable findings:

- 9 tables have RLS enabled with no policy. Several are intentionally server/service-role-only tables (for example payment orchestration and the PR42 migration registry), so these should not be "fixed" by adding broad authenticated policies.
- 2 functions have mutable `search_path`: `luma_ratecard_master_updated_at` and `luma_social_text_allowed`.
- Multiple SECURITY DEFINER functions are currently executable by `anon`. This requires a dedicated permissions review because revoking blindly can break auth/public flows.

Supabase remediation reference:
https://supabase.com/docs/guides/database/database-linter

## Performance advisor

Notable findings:

- Duplicate indexes were detected on:
  - `creator_samples`
  - `luma_topup_orders`
  - `referral_profiles` (two duplicate index pairs)
- Several tables have overlapping permissive RLS policies. These should be consolidated carefully in a dedicated hardening PR after behavior tests.

## PR42 decision

PR42 records these findings but does not perform broad permission/index removal because its purpose is **baseline and migration synchronization**, and destructive/security behavior changes require isolated testing.

Recommended follow-up: a dedicated Database Security & Performance Hardening PR.
