# PR #81H — Incident Timeline + Escalation

Build an owner-only incident layer on top of Operational Alert Center.

Requirements:
- convert critical/warning alert events into incidents
- incident status: open, acknowledged, investigating, monitoring, resolved
- severity: info, warning, critical
- assignee by profile/user
- SLA target timestamps derived from severity
- acknowledgement and resolution timestamps
- timeline notes/events
- escalation level 0–3
- escalation reminder cron every 15 minutes
- no duplicate incident for the same open alert event
- optional notification to assignee
- owner UI must show SLA timer, status, assignee, timeline and escalation level
