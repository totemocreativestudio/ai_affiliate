# PR #85G — Saved Views & Personal Workspace

## Goal
Make Lumaway remember how each individual user works without changing other users in the same workspace.

## Privacy / isolation
All preferences are:
- workspace scoped
- user scoped
- invisible to other members unless a future explicit sharing feature is added

Never store owner/admin identity in member-facing saved views.

## Saved Views
A Saved View stores:
- name
- section
- filter_json
- sort_json
- ui_state_json
- is_pinned
- last_used_at

Initial integration:
- Dashboard Affiliate filters: start, end, platform, store, period preset
- Live Streaming active section/date context via generic route saved views
- Listings and other pages may adopt the same contract incrementally

Dashboard Saved View examples:
- Shopee 30 Hari
- TikTok Bulan Ini
- Semua Toko 7 Hari
- Campaign Payday / creator filters when future modules connect

## Personal Workspace
Dashboard top area should expose:
- Pinned Views
- Pinned Modules
- Recently Opened
- My Actions shortcut

## Pins
Per-user module shortcuts:
- Dashboard
- Upload Center
- Listings
- Campaign Tracker
- Live Streaming
- Affiliate 360
- Product Master
- Shipping
- Spending
- Goal & Forecast
- Automation
- Scheduled Report

Default pins for new users:
Dashboard, Upload Center, Listings, Live Streaming.

## Recent activity
Track only navigation metadata:
- section key
- title
- last_opened_at
No business row data is copied into recent history.

## Interaction contract
Saved view application dispatches:
`lumaway-apply-saved-view`
with:
- section
- filter_json
- ui_state_json

Feature pages listen only for their own section.

## UX
- Save Current View
- pin/unpin
- rename
- delete
- apply
- compact personal workspace card
- mobile horizontal scrolling
- keyboard accessible

## Acceptance
1. User A cannot read User B saved views/pins.
2. Saved Dashboard filter restores period/platform/store correctly.
3. Applying a saved view navigates to its section.
4. Recent modules update automatically on route changes.
5. No cross-workspace leakage.
