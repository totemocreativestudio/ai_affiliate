# Lumaway Database Migration Policy

Effective from PR #42.

## Mandatory workflow

Database schema changes must never be treated as an invisible production-side change.

1. Add a timestamped migration file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`.
2. Keep migrations forward-only and reviewable. Do not rewrite an already-applied production migration.
3. Application code that requires new columns/functions/policies must be released only after the migration is applied successfully.
4. After applying a migration, verify Supabase migration history, RLS/security advisors, and any critical RPC/table behavior.
5. Record unusual legacy/manual state in `supabase/PRODUCTION_MIGRATION_MANIFEST.md`.
6. Never put service-role keys, API keys, passwords, customer exports, or business row data in migration files or baseline snapshots.

## Historical baseline

PR42 reconciles historical drift using:
- `supabase/PRODUCTION_MIGRATION_MANIFEST.md`
- `supabase/baseline/20260925/`
- `public.luma_schema_migration_registry`

The baseline is for recovery/reference and is not intended to be run against the live database.
