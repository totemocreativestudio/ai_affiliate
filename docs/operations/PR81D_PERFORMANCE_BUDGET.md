# PR #81D — Load Test & Performance Budget

## Default budgets
- Ordinary production reads: p95 <= 1500 ms
- Error rate <= 1%
- Minimum 20 samples before a pass/fail result is trusted
- AI/OpenAI: p95 <= 5000 ms
- Payment: p95 <= 2500 ms
- Import: p95 <= 5000 ms

## Local/staging runner
`node scripts/lumaway-load-test.mjs`

Optional environment:
- `LOAD_TARGETS` comma-separated URLs
- `LOAD_REQUESTS`
- `LOAD_CONCURRENCY`
- `LOAD_TIMEOUT_MS`
- `LOAD_BUDGET_P95_MS`
- `LOAD_BUDGET_ERROR_PCT`
- auth cookie/bearer variables from the existing runner

Do not run high-concurrency destructive or import tests against customer production data. Use staging or a disposable workspace for write-heavy stress tests.
