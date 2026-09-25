# PR46 Release Audit — 2026-09-25

## Scope

PR46 covers billing revenue verification, subscription plan expansion, internal duration adjustment, multi-store imports and filters, Community Profile editing, AI Analytics simplification, richer AI report documents, weekly email infrastructure, and Google + email/password account access.

## Production database status

Applied migrations:

- `20260925075042 pr46_billing_multistore_social_account`
- `20260925082452 pr46_fix_community_profile_rpc`

Verified production state:

- 12 Months subscription plan exists as sort order 4.
- Paid token orders are visible to the canonical Owner revenue RPC.
- 2026 paid revenue smoke test returned Rp5.000 in September from one paid top-up order.
- Internal subscription extension RPC passed rollback testing.
- Community Profile RPC passed rollback testing after the follow-up ambiguity fix.
- AI period context returned complete period aggregation with `sampling=false` in the tested production workspace.
- Authenticated dashboard store filtering RPCs are present; existing legacy imports without store metadata remain unscoped until new store-aware uploads are imported.

## Email integration status

Application support is implemented using Resend:

- weekly scheduler: `/api/cron/weekly-insights`
- Admin connection status: `/api/admin/email-status`
- Monday schedule: 01:00 UTC / 08:00 WIB
- delivery audit: `luma_weekly_email_deliveries`
- email preference: `profiles.weekly_email_enabled`

Current production secure-config audit at release time:

- Supabase secure-vault `luma_resend_api_key`: not configured.
- `email_from` platform setting: not configured.
- Resend API usage history: 0 rows.

Therefore the weekly email workflow is deployed and observable but must remain marked **not connected** until a valid Resend credential and verified sender address are configured. No credential is invented or committed to GitHub.

## User-facing behavior

- Payment method logos use one normalized local SVG set.
- Store-aware upload preserves each store scope and dashboard supports a Toko dropdown.
- Community Profile name/photo is editable via a controlled authenticated RPC.
- AI Analytics exposes only:
  1. Rekomendasi
  2. Performa Analisis
  3. Produk Analisis
  4. Creator Analisis
- AI period context is aggregated in PostgreSQL for the requested period rather than truncating to client-side row samples.
- Generated reports request 6–12 pages and render database-backed KPI charts/tables.
- OAuth users must configure a password to complete account readiness, preserving both Google login and email + password login.
- Admin can extend subscription duration with an internal audit trail; no user notification is emitted by this adjustment flow.

## Remaining external dependency

Configure a Resend API key plus verified sender address in secure production configuration before weekly email delivery can send successfully.
