# PR #81E — Backup & Disaster Recovery Readiness

Lumaway now records **logical verification checkpoints** for restore rehearsals. These checkpoints are not physical backups and do not replace Supabase backups or PITR.

## Targets
- RPO target: <= 24 hours while PITR is not independently verified.
- RTO target: <= 4 hours for full application recovery.
- Once PITR is enabled and verified at provider level, the operational RPO can be tightened.

## Checkpoint workflow
1. Create a **pre_restore** checkpoint.
2. Restore only into a Supabase branch/recovery project.
3. Run auth/workspace/import/payment smoke tests.
4. Create a **post_restore** checkpoint.
5. Compare critical counts and latest activity.
6. Record mismatches before declaring the rehearsal successful.

## Critical logical counts
- profiles
- workspaces
- workspace members
- sales
- creators
- product master
- imports
- campaigns
- subscriptions
- subscription orders
- top-up orders
- promo redemptions

## Important
A successful logical checkpoint only proves that application data can be counted and compared. It does **not** prove that Supabase physical backups or PITR are enabled. Provider-level backup configuration must be verified separately in Supabase.
