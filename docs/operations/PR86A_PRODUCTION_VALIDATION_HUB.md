# PR #86A — Production Validation Hub

## Goal
After Phase 85, stop adding features blindly and validate whether Lumaway is actually production-safe, understandable, fast enough, and internally consistent.

## Validation layers
1. Product Experience QA
2. Performance budget
3. Affiliate / Live data separation
4. Import reliability
5. Live reconciliation health
6. HPP coverage
7. Multi-user privacy isolation
8. Saved View / Notification user isolation
9. Release readiness

## Rules
### BLOCKED
Any of:
- critical Product Experience QA failure
- member privacy audit failure
- Live P&L references Affiliate sales/commission
- critical release gate blocker

### REVIEW
Any of:
- pending critical manual Product Experience QA
- insufficient performance samples
- failed/partial imports in recent window
- Live HPP coverage below 100%
- stale release snapshot / QA run

### READY
No blockers and no review items from active checks.

## Data validation
Use aggregate counts only. Do not expose raw member names, owner identity, phone, email, provider credentials, or imported customer/creator row content.

## UI
Owner > Platform Health:
- Production Validation status
- blockers
- review items
- Product Experience QA summary
- Performance summary
- Affiliate/Live separation check
- import reliability
- Live HPP coverage
- latest check timestamp

## Acceptance
- Owner-only
- non-destructive
- no artificial traffic is generated
- no business row contents are copied into validation snapshots
- existing Release Gate remains intact
