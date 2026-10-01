# PR #81A — SECURITY DEFINER Audit & Hardening

## Scope
This phase hardens execution privileges without breaking existing browser RPC workflows.

### Applied
1. Revokes implicit **PUBLIC EXECUTE** from every SECURITY DEFINER function in `public`.
2. Keeps only explicit grants already assigned to `anon`, `authenticated`, or `service_role`.
3. Converts `luma_active_promotions_v1()` to **SECURITY INVOKER** because the underlying `luma_promo_codes` RLS already limits authenticated readers to active, published, in-window promotions.
4. Documents `luma_get_public_share_post(bigint)` as an intentional public-share exception. It returns only `id, body, image_url, created_at` for rows where `status='published'`.

## Audit result
All SECURITY DEFINER functions currently have an explicit `search_path`; no missing-search-path finding was observed during this audit.

The Supabase lint warning for authenticated SECURITY DEFINER functions is not automatically equivalent to an exploitable issue. Many workspace-facing RPCs intentionally use SECURITY DEFINER but perform internal access checks such as:
- `luma_has_workspace(...)`
- `luma_is_admin()`
- `auth.uid()`

Those functions remain callable in this phase to avoid breaking dashboard RPCs.

## Next phase
PR #81B consolidates overlapping RLS SELECT policies and removes a confirmed duplicate index. A later phase can progressively convert eligible read-only workspace RPCs to SECURITY INVOKER after regression tests verify their RLS behavior.
