# PR #86E — Live Upload Context, Store/Host Attribution & Product Intelligence UX

## Goal
Make every Live upload operationally attributable and make Product Intelligence usable as a production dashboard, not a raw table.

## Upload requirements
Before import, user must provide:
- Store Name
- Store ID
- Store Username
- Host

Host source:
- active records from Live > Host 360
- if host does not exist, show CTA "Tambah Host di Host 360"
- CTA switches user to Host 360
- import cannot continue without store identity + host

Persist upload context to live_imports:
- store_name
- store_id
- store_username
- host_id

Persist store context to Live source fact rows:
- live_daily_performance
- live_product_performance
- live_period_overview
- live_session_performance
- live_sessions

Host semantics:
- Shopee Session List: selected host is applied to imported sessions.
- Aggregate files (Shopee Overview, Product List, TikTok Core Stats): selected host is upload context only and must not fabricate per-session host performance.
- Store context may be used for filtering/traceability across all Live datasets.

## Import history
Show:
- file
- platform/dataset
- period
- store name / store username / store ID
- selected host
- row count
- status
- Delete

Delete remains full cleanup by source_import_id.

## Product Intelligence UX
Current screen is too visually flat and dense. Rebuild:
- clear page hero + Live-only domain badge
- compact source/period summary
- premium filter toolbar
- KPI cards in responsive grid
- mapping coverage card
- GMV / Ready GMV / Qty / Click / Add to Cart / HPP / Contribution cards
- readable product table with sticky header and sensible widths
- product name limited to readable width with wrap/clamp
- mapping status pill
- financial values right aligned
- action button compact
- mobile converts dense table into cards / horizontal safe table
- do not render KPI cards as plain unstyled text

## Source parsing / correctness
Preserve existing canonical source truth:
- Shopee Overview is period truth
- Session List is per-session truth
- Product List is product attribution truth
- TikTok Core Stats is daily truth
- no double count between these sources

## Regression
Add store/host context check to Live Data Health:
- completed imports missing store metadata
- completed imports missing host context
- imported Shopee session rows whose session host differs from import host

## Acceptance
1. Import button disabled until Store Name, Store ID, Store Username, Host selected.
2. Store + host shown in history.
3. Host CTA routes to Host 360.
4. Shopee session imports carry host_id to live_sessions.
5. Product Intelligence is visually structured and readable on desktop/mobile.
6. Existing source-truth totals remain unchanged.
