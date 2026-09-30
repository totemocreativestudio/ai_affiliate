# PR #78A — Security & RLS Hardening Audit

Audit date: 2026-09-30
Scope: production Supabase public schema, browser-facing RLS, SECURITY DEFINER RPCs, payment/auth service tables.

## SECURITY DEFINER audit

The catalog audit enumerated every SECURITY DEFINER function executable by `authenticated` and checked:
- authentication guard (`auth.uid()`)
- workspace guard (`luma_has_workspace` or equivalent workspace membership)
- admin/owner guard (`luma_is_admin`)
- intended public/global metadata exception
- intended server/service-role-only execution

Before remediation there were 69 authenticated SECURITY DEFINER findings reported by the database advisor.

### Remediated high-risk surfaces
- `luma_get_master_creators_unique`: workspace membership now required inside the function.
- `luma_get_master_creators_unique_v2`: workspace membership now required inside the function.
- `luma_ensure_referral_profile`: cannot operate on another user unless owner/admin; supplied workspace is validated.
- `luma_ensure_social_identity`: self-only unless owner/admin.
- `luma_reserve_promo_v1`: authenticated/browser execution revoked; service-role only.
- `luma_get_social_feed`: anonymous/PUBLIC execution revoked; authenticated only.
- promotion trigger functions: direct PUBLIC/anon/authenticated EXECUTE revoked.

### Explicit exceptions
- `luma_active_promotions_v1`: authenticated global catalog. It returns only active/published promotion metadata required by Content Hub.
- `luma_get_public_share_post`: intentional anonymous public-share endpoint. It returns only published post id/body/image/created_at. This remains a documented accepted public SECURITY DEFINER exception.

### Workspace/business RPCs
Remaining authenticated SECURITY DEFINER functions are app RPCs or helpers. Their definitions were catalog-audited for auth/workspace/admin checks. They remain executable because the user application depends on them. SECURITY DEFINER is not treated as safe by itself: each new RPC must include an explicit authorization boundary or be server-role only.

## Service-only RLS tables

The advisor identified nine RLS-enabled tables without policies. These tables are server/internal surfaces, so PR78A adds an explicit deny policy for `anon` and `authenticated` rather than opening browser access:

- affiliate_ads_support
- luma_otp_challenges
- luma_payment_checkout_intents
- luma_payment_provider_settings
- luma_payment_routing
- luma_payment_webhook_events
- luma_schema_migration_registry
- marketing_lead_outbox
- marketing_leads

Service-role access is unchanged.

## Required rule for future migrations

Any new SECURITY DEFINER function must satisfy one of:
1. authenticated + workspace validation,
2. authenticated + self-only validation,
3. admin/owner validation,
4. service-role-only EXECUTE,
5. a documented intentionally public endpoint returning non-sensitive published data only.

Do not grant SECURITY DEFINER RPCs to PUBLIC by default.
