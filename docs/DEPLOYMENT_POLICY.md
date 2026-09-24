# Lumaway Production Deployment Policy

PR39 changes the release flow so incomplete commits are no longer pushed directly to production one-by-one.

## Required flow

1. Create a feature / fix branch from `main`.
2. Commit all work to that branch only.
3. Open a Pull Request to `main`.
4. Wait for **Lumaway CI Gate / validate** to pass:
   - route validation
   - TypeScript
   - production build
   - HTTP smoke test
5. Squash-merge the Pull Request to `main`.
6. Vercel receives one tested production commit instead of every intermediate commit.

## Important

- Do not use `main` as a working branch.
- Red Vercel deployments from older commits are historical records and are not changed by later successful deployments.
- A production release is considered valid only when the final `main` commit has both CI and Vercel success statuses.
- When a build fails on a PR branch, fix the branch and rerun CI before merging. Do not patch the failure directly on `main`.

## PR39 objective

This policy prevents the PR38 pattern where several partial commits were sent to Vercel before all dependent files were present and before build errors had been fixed.
