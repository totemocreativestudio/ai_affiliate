## Release checklist

- [ ] Changes were developed on a branch, not directly on `main`
- [ ] Route validation passes
- [ ] TypeScript check passes
- [ ] Production build passes
- [ ] HTTP smoke test passes
- [ ] No secrets or local-only configuration are included
- [ ] If this PR changes database schema/RLS/RPC, a timestamped file exists in `supabase/migrations/`
- [ ] If this PR changes database schema/RLS/RPC, the migration was applied and verified in Supabase before dependent app code is released
- [ ] Ready to squash-merge as one production commit

### Summary

Describe the user-facing change and any database migration required.
