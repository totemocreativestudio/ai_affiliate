# PR #85D — Action Center 2.0

## Goal
Turn Lumaway Action Center into the daily operating queue for workspace users.

The user should be able to answer:
- Apa yang perlu saya kerjakan sekarang?
- Mana yang paling mendesak?
- Ke menu mana saya harus pergi?
- Apakah masalahnya data, creator, campaign, shipping, product, atau Live?

## Sources
Use workspace-scoped operational signals:
- luma_action_items
- listing follow-up actions
- campaign deadlines
- creator samples
- shipping
- product HPP gaps
- Live Data Health / reconciliation issues where available
- automation-created actions

Do not expose owner/admin-only information.

## Priority model
Score combines:
- severity
- overdue
- due today
- due <= 3 days
- due <= 7 days
- source criticality

Labels:
- Kritis
- Perlu Ditindaklanjuti
- Dijadwalkan
- Informasi

## UI
Dashboard Action Center 2.0:
- top summary: Critical / Today / This Week / Open
- source filters
- top prioritized actions
- CTA per item based on action_route
- Mark Done
- Dismiss
- Open detail
- source badge
- due label
- no identity leakage from owner/admin

## Smart empty state
If no open actions:
- say that there are no pending actions
- recommend next productive step based on workspace data:
  Upload Data / Review Dashboard / Create Campaign / Add Listing / Review Live Data
Do not show generic "No data".

## Interaction
- optimistic status update
- refresh on lumaway-database-updated and lumaway-live-updated
- keyboard accessible
- mobile-friendly

## Acceptance
1. Uses luma_action_items as the main action source, not creator_tasks only.
2. Existing task/kanban remains available but is not the sole source.
3. Action CTA opens the correct section.
4. Done/dismissed actions disappear immediately.
5. No owner/admin data is returned.
