# PR47 Release Audit — 2026-09-28

## User issues reproduced and root causes

### Email confirmation
Production Auth logs for the affected signup show:
- signup and resend both returned HTTP 200;
- Supabase sent the confirmation message;
- the sender was the built-in `noreply@mail.app.supabase.io`;
- the subsequent verification failed with `One-time token not found`.

This is consistent with a one-time confirmation URL being prefetched by an email security/link scanner before the user deliberately confirms.

PR47 adds:
- a Lumaway-owned `/auth/confirm` page;
- verification only after the user presses **Konfirmasi email saya**;
- a branded hosted-template source at `supabase/templates/confirmation.html`;
- a successful confirmation redirect/message at the Lumaway login page.

The hosted Supabase Auth sender still requires custom SMTP/Resend configuration outside PostgreSQL. Production secure-vault does not currently contain `luma_resend_api_key`. PR47 does not invent or commit credentials.

### Community Profile
Production Storage logs showed the Community image upload failed with:
- HTTP 400 / AccessDenied;
- PostgreSQL code 42501;
- `new row violates row-level security policy for table "objects"`;
- request used `x-upsert: true`.

The existing Storage policy set had INSERT/UPDATE/DELETE but no user-folder SELECT policy. Supabase Storage upsert requires INSERT + SELECT + UPDATE. PR47:
- adds authenticated SELECT access only to the user's own `luma-avatars/<user-id>/...` folder;
- changes profile/community photo uploads to unique insert-only files (`upsert:false`);
- retains the validated Community identity RPC;
- adds inline Community save/upload status.

Production data confirms the Community alias update itself was already succeeding; the avatar upload was the failing step.

## AI Analytics
Sidebar is reduced to the same four modes used by the analysis page:
1. Rekomendasi
2. Performa Analisis
3. Produk Analisis
4. Creator Analisis

Legacy Trend Analysis, Anomaly Detection, and duplicate English Recommendations entries are removed from navigation.

## Examples and creative UI
- Remaining Upload Center example `Gascomp Official` is replaced by generic `Toko Utama`.
- No customer/workspace business data is renamed or deleted.
- WhatsApp creative preview/canvas uses a light WhatsApp-like palette with dark high-contrast message text.

## Creator Search
Listings now exposes an explicit no-match action to keep the typed creator as a new creator name for the new listing. The existing listing schema continues to allow a pending creator with null `creator_id`.

## Subscription
Production verified:
- Monthly: 31 days / Rp75.000
- Weekly: **7 days / Rp35.000**
- Free 30 Days
- 6 Months
- 12 Months

Weekly is inserted immediately after the currently owner-sorted Monthly plan.

## Payment checkout
Production verified:
- Mayar: enabled, priority 1, healthy
- Midtrans: disabled
- Xendit: disabled
- DOKU: not present in the checkout provider registry

Application checkout routing is also restricted to Mayar. Historical/non-checkout payout code is not deleted.

## Advisor state
After PR47 migration:
- no new high-priority performance advisor category was introduced;
- unindexed foreign keys remain informational;
- existing intentionally reviewed SECURITY DEFINER findings remain;
- leaked-password protection remains an Auth configuration warning, unrelated to this PR.
