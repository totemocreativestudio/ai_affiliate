# PR #81G — Operational Alert Center

Build a practical owner-only alerting layer on top of Lumaway observability.

Metrics:
- API error rate 15m
- P95 latency 24h
- failed imports 24h
- failed payment webhooks 24h
- stale checkout intents
- open issue count

Behavior:
- configurable thresholds
- active/pause
- open/resolved event lifecycle
- no duplicate open event for the same rule
- optional Resend email notification
- cron evaluation every 15 minutes
- Owner Platform Health UI with rules and event history
