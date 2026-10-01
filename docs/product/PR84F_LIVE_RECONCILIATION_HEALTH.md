# PR #84F — Shopee + TikTok Live Reconciliation & Data Health

## Goal
After Live Streaming upload, Lumaway must automatically validate whether imported Shopee/TikTok totals reconcile before users rely on the dashboard.

## Scope
Live Streaming only. Never write to or recalculate Affiliate Performance.

## Reconciliation status
Every check returns one of:
- EXACT
- DIFFERENCE
- SOURCE_MISSING
- NOT_APPLICABLE

Each check also returns:
- expected/source-of-truth value
- compared value
- absolute difference
- percentage difference where meaningful
- explanation
- source dataset names

## Shopee checks
Use the following semantics:

### Session List vs Overview
Expected exact:
- session count vs overview livestream_count
- GMV Created
- GMV Ready to Ship
- Orders Created
- Orders Ready to Ship
- Qty Created
- Qty Ready to Ship
- Comments
- Add to Cart
- Viewers when semantics align

Do NOT require:
- session SUM(active_viewers) == period_active_viewers

These are semantically different and must be labeled NOT_APPLICABLE.

### Product List vs Overview/Session
Expected exact or warning:
- sum product gmv_created vs overview gmv_created
- sum product gmv_ready_to_ship vs overview gmv_ready_to_ship
- sum product qty_created vs overview qty_created
- sum product qty_ready_to_ship vs overview qty_ready_to_ship
- sum product add_to_cart vs overview add_to_cart

Do NOT use product-level order sum as official period order total.
Do NOT require product_clicks sum to equal overview product_clicks.

## TikTok checks
File is daily aggregate Core Stats.

Identity checks:
- period should match min/max daily metric_date
- daily rows should be unique by metric_date
- GMV attributed = GMV direct + GMV indirect
- products sold attributed = direct + indirect
- attributed SKU orders = direct + indirect

Reference semantic checks should be performed per row and for the selected period aggregate.

Do not fabricate host/session reconciliation for TikTok Core Stats.

## Tolerance
- integer/count: exact
- currency: abs diff <= 1 accepted as exact
- percentages: abs diff <= 0.01 percentage point
- duration: tolerance <= 2 seconds per row or <= 0.1% aggregate

## Data Health UI
In Live Streaming > Data Health:
1. Overall score
2. Source completeness
3. Shopee Reconciliation
4. TikTok Integrity
5. Import parser warnings
6. Failed/partial imports
7. Click-through to Upload History

Status language:
- Sehat
- Perlu Dicek
- Sumber Belum Lengkap

Do not call business performance bad/good based on reconciliation. This is data quality only.

## Auto refresh
After a successful upload:
- dispatch lumaway-live-updated
- refresh reconciliation/data health automatically

## Acceptance
- No error if only one source file is uploaded.
- Missing companion source -> SOURCE_MISSING, not failure.
- Difference persists without deleting data.
- Checks are date-range scoped.
- Shopee and TikTok are shown separately.
- No affiliate tables are queried.
