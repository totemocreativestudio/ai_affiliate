# PR #78E — Load, Backup & Disaster Recovery Runbook

## Load readiness

Use `node scripts/lumaway-load-test.mjs`.

Environment:
- `LOAD_URL`
- `LOAD_REQUESTS` (default 100)
- `LOAD_CONCURRENCY` (default 10)
- `LOAD_TIMEOUT_MS`
- `LOAD_AUTH_BEARER` or `LOAD_COOKIE` for authenticated flows
- `LOAD_METHOD` and `LOAD_BODY` for API tests

Acceptance baseline before a mass rollout:
- HTTP error rate <= 1% for steady-state tests
- p95 page/API response <= 1.5s for ordinary reads
- no database saturation or connection exhaustion
- import APIs must remain idempotent under retries
- dashboard/Customer 360 must remain paginated and workspace scoped

## Large import stress

Test in staging or a disposable workspace, not against customer production data:
1. 10k rows Affiliate Performance.
2. 50k rows Affiliate Performance.
3. 100k rows split into client batches.
4. retry the final batch once to verify record-key idempotency.
5. verify Import History counts equal persisted sales rows.
6. verify Campaign Tracker auto-refresh after the completed import.
7. verify Data Health does not report false 0-row success.

## Backup policy

Provider-level database backups remain the primary disaster-recovery mechanism. Application code must not attempt to replace physical backups with copies inside the same database.

Recommended production target:
- RPO: <= 24h until point-in-time recovery is enabled; <= 15 minutes when PITR is enabled.
- RTO: <= 4h for full service recovery.
- Retain a documented off-platform export for critical business configuration if compliance requires it.

## Restore verification

After every restore rehearsal:
1. compare `luma_owner_backup_readiness_v1()` critical row counts with the recorded pre-restore snapshot;
2. verify auth/profile/workspace membership;
3. verify latest imports + sales;
4. verify subscription orders and active subscriptions;
5. verify promo redemptions/reservations;
6. verify server secrets/integrations are configured in the target environment;
7. run payment webhook replay against a non-production order;
8. run dashboard/Customer 360/Data Health smoke tests.

Never perform a destructive restore on production merely to test the runbook. Use a Supabase branch / recovery project when available.
