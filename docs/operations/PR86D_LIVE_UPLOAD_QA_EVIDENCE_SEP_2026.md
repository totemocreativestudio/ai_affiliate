# PR #86D — QA/QC Evidence for Uploaded Live Files

Period: 2026-09-01 through 2026-09-30

## Shopee Overview
- GMV Created: 31,702,701
- GMV Ready to Ship: 23,583,555
- Orders Created: 138
- Orders Ready to Ship: 119
- Qty Created: 156
- Qty Ready to Ship: 135
- Livestreams: 41
- Total duration: 78h57m04s
- Average livestream duration: 1h55m32s
- Viewers: 8,947
- Period Active Viewers: 580
- Views: 10,425
- Peak Viewers: 31
- Average watch duration: 27s
- Add to Cart: 548
- Product Clicks: 627
- Likes: 12,354
- Shares: 12
- Comments: 656
- New Followers: 97

## Shopee Session List
- Rows / sessions: 41
- GMV Created: 31,702,701 — EXACT vs Overview
- GMV Ready: 23,583,555 — EXACT
- Orders Created: 138 — EXACT
- Orders Ready: 119 — EXACT
- Qty Created: 156 — EXACT
- Qty Ready: 135 — EXACT
- Viewers: 8,947 — EXACT
- Add to Cart: 548 — EXACT
- Comments: 656 — EXACT
- Sum Active Viewers: 614 — NOT COMPARABLE to period-unique Active Viewers 580
- Sum duration: 78h56m46s vs Overview 78h57m04s — 18 second source difference

## Shopee Product List
- Product rows: 69
- GMV Created: 31,702,701 — EXACT vs Overview
- GMV Ready: 23,583,555 — EXACT
- Qty Created: 156 — EXACT
- Qty Ready: 135 — EXACT
- Add to Cart: 548 — EXACT
- Product-order attribution sum: 151 / 131 — NOT unique orders; must not replace Overview Orders 138 / 119
- Product click attribution sum: 1,457 — NOT forced to equal Overview Product Clicks 627

## TikTok Live Performance Core Stats
- Daily rows: 30
- GMV Attributed: 8,028,942
- GMV Direct: 6,927,925
- GMV Indirect: 1,101,017
- Direct + Indirect = Attributed — EXACT
- SKU Orders Attributed: 48
- Products Sold Attributed: 50
- Source field "Siaran LIVE" aggregated: 3,151
- Rows with GMV: 38
- Impressions: 16,647,603

## Canonical Unified Live
Do not add Shopee Overview + Session + Product because they are different views of the same Shopee activity.

Canonical:
- Shopee = Overview period metrics
- TikTok = Daily Core Stats attributed metrics

Expected unified totals for this period:
- GMV: 39,731,643
- Orders: 186
- Qty: 206

## QA conclusion
Financial/order/qty source files are internally consistent for Shopee where semantics are additive-compatible.
Known semantic exceptions:
- Active Viewer period metric vs sum per session
- Product order attribution vs unique orders
- Product click attribution vs period overview clicks
- Total duration differs by 18 seconds between Overview and Session export and should be shown as a source-level difference, not silently overwritten.
