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


## PR43 hardening result

After PR43 production migrations:

- Mutable function `search_path` warnings: **2 → 0**.
- Duplicate index warnings: **4 → 0**.
- Anonymous-callable SECURITY DEFINER warnings: **57 → 2**.
- The two intentionally anonymous SECURITY DEFINER RPCs retained are:
  - `luma_get_public_share_post(bigint)`
  - `luma_get_social_feed(integer, integer)`
- Multiple permissive policy warnings reduced from **60 → 50** by changing private dashboard policies from `public` to `authenticated`.
- Authenticated staff smoke test for dashboard RPC succeeded.
- Authenticated admin smoke test for Owner Monitoring RPC succeeded.
- Creator Samples, Listings, Shipping, Ratecard and Product Master related RLS access was tested in a rollback transaction after the policy scope change.

Remaining advisor items are intentionally deferred because they require broader behavioral/performance testing:
- 9 RLS-enabled tables without policies; several are deliberately service-role-only.
- 38 authenticated-callable SECURITY DEFINER functions; many are expected authenticated RPCs and RLS helpers.
- 78 unindexed foreign keys; current production row counts are generally small, so indexes should be added selectively based on query growth rather than blindly.
- 65 `auth_rls_initplan` warnings and 50 overlapping permissive policy warnings; these need a dedicated RLS optimization pass.
- Auth leaked-password protection is an Auth configuration setting, not a schema migration.


## PR44 RLS performance optimization result

After PR44 production migrations:

- `auth_rls_initplan` warnings: **65 → 0** by converting RLS calls from `auth.uid()` to the initPlan form `(select auth.uid())`.
- Missing leading indexes on `workspace_id` / `user_id` columns referenced by RLS: **30 → 0**.
- Unindexed foreign-key findings: **78 → 49** because 29 of the new RLS indexes also cover foreign-key access paths.
- Multiple permissive policy warnings: **50 → 40**.
- Ten `FOR ALL` policies were split into INSERT / UPDATE / DELETE only where the existing SELECT policy had the **exact same predicate and role set**, so SELECT access semantics remain unchanged.
- The remaining 40 overlapping-policy warnings are intentionally retained for now. Several of those `FOR ALL` policies also provide broader admin/manager read paths, so removing their SELECT participation without an explicit equivalent combined policy could change authorization behavior.
- Freshly created RLS indexes may initially appear in the `unused_index` advisor because usage statistics have not accumulated yet; they should not be removed based only on the immediate post-migration snapshot.

Current PR44 performance advisor state:
- `auth_rls_initplan`: **0**
- `multiple_permissive_policies`: **40**
- `unindexed_foreign_keys`: **49**
- RLS tenant/user leading-index gaps: **0**

Further consolidation of the remaining overlapping policies should be done only with per-role/per-action access equivalence tests.


## PR45 RLS policy consolidation & query-plan optimization

Production migrations:
- `20260925065838 pr45_rls_policy_query_plan_optimization`
- `20260925070033 pr45_private_rls_helpers`

### Policy/advisor result

- Multiple permissive RLS warnings: **40 → 0**.
- `auth_rls_initplan`: remains **0**.
- Authenticated RLS overlap groups verified from `pg_policies`: **0**.
- Unindexed foreign-key findings remain **49**; PR45 does not add speculative foreign-key indexes outside the observed hot paths.
- New hot-path indexes:
  - `idx_creators_workspace_name_id`
  - `idx_sales_workspace_type_date`
- Two RLS-only SECURITY DEFINER helper functions were moved to the non-exposed `private` schema.
- Authenticated-callable SECURITY DEFINER advisor count temporarily rose from 38 to 40 after phase 1, then returned to **38** after the private-schema hardening migration.
- Public copies of the PR45 helper functions: **0**.

### Query-plan evidence

Production table sizes at audit time:
- `creators`: about **76k live rows**.
- `sales`: about **49k live rows**.
- Largest Creator workspace tested: about **52.9k creators**.

Manual EXPLAIN ANALYZE tests used the same authorization predicates as the RLS policies while setting the request user claim; they did not disable RLS or change table data.

Observed before → after:
- Creator admin list: **~285 ms → ~43 ms**.
- Creator staff/no-explicit-access on the largest workspace: **~40,116 ms → ~1,220 ms**.
- Sales admin workspace count: **~5,017 ms → ~58 ms**.

The largest gains come from moving user-global checks into initPlans and replacing repeated row-by-row creator authorization lookups with a query-global allowed-creator set. The remaining staff/no-access Creator cost is primarily the scan of a very large workspace when no rows are authorized; this is substantially lower than the old per-row helper path but is still a candidate for application/RPC-specific optimization if that access pattern becomes common.

### Authorization preservation

The policy consolidation is based on PostgreSQL permissive-policy semantics: existing permissive expressions were combined with logical OR into a single per-action authenticated policy. Restrictive policies were not changed. Public Blog read behavior and authenticated Community Saves behavior were preserved explicitly during cross-role normalization.
