# PR #84G — Source-Aware Live Analytics

## Goal
Make Live Analytics understand Shopee and TikTok source semantics instead of forcing every dataset into session metrics.

## Tabs
- Unified
- TikTok
- Shopee

## TikTok
Use live_daily_performance:
- GMV attributed/direct/indirect
- SKU orders attributed/direct/indirect
- products sold attributed/direct/indirect
- live streams
- streams with GMV
- impressions
- CTR
- CTOR
- avg watch duration
- daily trend

No Host/session charts for TikTok Core Stats unless future TikTok session exports provide actual host/session identity.

## Shopee
Use:
- live_session_performance for session metrics
- live_period_overview for period metrics
- live_product_performance for product ranking
- live_traffic_sources for traffic attribution

Expose created vs ready-to-ship side-by-side.
Do not sum product orders as official total orders.
Do not use SUM(active_viewers) as period unique active viewers.

## Unified
Keep current generic session analytics for operational sessions and add explicit source context cards.
Never merge Live data into Affiliate Performance.

## UX
- source selector
- date filter
- cards
- daily trend
- direct vs indirect TikTok composition
- Shopee created vs ready
- Shopee product ranking
- Shopee traffic source ranking
- responsive tables/charts
