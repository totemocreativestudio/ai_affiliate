# PR #86D — Live Source Truth, Full Import Delete & Campaign Tracker UX

## Goal
Make Live Streaming numbers follow uploaded marketplace files exactly, keep every Live tab on one shared date range, allow full deletion per uploaded file, and rebuild Campaign Tracker into a production-grade operational screen.

## Source truth from QA files
Shopee September 2026:
- Overview: GMV Created 31,702,701; GMV Ready 23,583,555; Orders 138/119; Qty 156/135; Livestream 41.
- Session List: 41 rows and key additive transaction totals must reconcile exactly with Overview.
- Product List: 69 products; GMV 31,702,701; GMV Ready 23,583,555; Qty 156/135; Add to Cart 548.
- Product-order sum is attribution by product and must NOT replace unique Overview Orders.
- Product-click sum is attribution by product and must NOT replace Overview click metric.

TikTok Core Stats September 2026:
- 30 daily rows.
- GMV attributed 8,028,942.
- Direct 6,927,925.
- Indirect 1,101,017.
- SKU Orders attributed 48.
- Products sold attributed 50.
- Impressions 16,647,603.
- Direct + Indirect must reconcile to attributed.

## Canonical metric rules
Shopee:
1. Overview is canonical for period-level GMV / orders / qty / session count when available.
2. Session List is canonical for per-session and per-day analysis.
3. Product List is canonical for product ranking / product attribution.
4. Never sum Overview + Session + Product into one GMV total.

TikTok:
1. Daily Core Stats is canonical.
2. GMV attributed is the primary TikTok GMV.
3. Do not manufacture session rows from daily Core Stats.

Unified Live:
- Total GMV = canonical Shopee GMV + TikTok attributed GMV.
- Total Orders = canonical Shopee unique orders + TikTok attributed SKU orders.
- Total Qty = canonical Shopee qty + TikTok attributed products sold.
- Platform share must use canonical sources, not only live_session_performance.

## Shared date range
The top-level Live Streaming start/end filter is the source of truth for:
- Overview
- Analytics
- Data Health
- Product Intelligence
- Campaign Tracker
- Live P&L

Sub-tabs must not silently reset to current month.

## Full delete
Import History receives Delete.
Delete by live_imports.import_id must remove all rows owned by that import:
- live_daily_performance
- live_product_performance
- live_period_overview
- live_traffic_sources
- live_session_performance
- live_sessions created/owned by that import when no surviving imported performance depends on them
- live_imports history row itself

Return deleted row counts.
Use confirmation UI. After delete, refresh all Live modules.

## QA / Regression
Add source-truth QA:
- Shopee Overview vs Session List
- Shopee Overview vs Product List for additive-compatible metrics
- TikTok Direct + Indirect identities
- import row count vs persisted row count
- platform canonical totals
- duplicate-source prevention

## Campaign Tracker UX
Rebuild from narrow columns into responsive dashboard:
- hero/summary row
- Campaign count
- Target GMV
- Achievement GMV
- Achievement %
- Orders
- Budget / Actual Cost
- full-width campaign cards
- progress bar
- status pill
- period and session count
- compact Gimmick Intelligence ranking cards
- empty state with strong CTA
- desktop 2-column analytical layout; mobile stacked
- no tiny cramped cards.

## Acceptance
- September source truth matches uploaded files.
- Unified GMV for these four files = 39,731,643.
- Unified Orders = 186.
- Unified Qty = 206.
- Shopee source card remains 31,702,701 / 138 / 156 / 41.
- TikTok source card shows 8,028,942 / 48 / 50 and does not show zero.
- deleting one import removes its facts and history, then dashboard recomputes.
- all Live tabs use the same selected period.
