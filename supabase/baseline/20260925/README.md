# Production Database Baseline — 2026-09-25

This directory is a **schema-only disaster-recovery snapshot** captured from the Lumaway production Supabase project during PR #42.

It intentionally excludes customer/business row data.

## Snapshot contents

- `01_tables_*.sql` — public table/column definitions.
- `02_constraints_indexes_*.sql` — primary keys, foreign keys, checks, unique constraints, and non-constraint indexes.
- `03_functions_*.sql` — public PostgreSQL functions.
- `04_rls_policies_*.sql` — RLS enablement and public-schema policies.
- `05_triggers.sql` — public/auth non-internal triggers.
- `06_extensions_storage.sql` — enabled extensions, Storage buckets, and Storage policies.
- `07_grants.sql` — table grants and function EXECUTE grants for anon/authenticated/service_role.

At capture time the public schema contained approximately **85 tables, 92 functions, 151 RLS policies, 22 non-internal triggers, and 224 indexes**.

## Important

These files are a baseline/reference for rebuilding an empty environment. **Do not apply them to the existing production database.**

Historical migrations missing from GitHub are recorded as `production_legacy` in `../PRODUCTION_MIGRATION_MANIFEST.md`. From PR42 onward, the migration directory is the forward source of truth and every production DDL change must be represented by a GitHub migration.
