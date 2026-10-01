# PR #84B — Unified Live Import Engine (Shopee + TikTok)

Implement PR #84A and the supplied TikTok file as one platform-aware import engine inside Lumaway > Live Streaming > Upload Center.

## TikTok reference export
File: Live Performance Core Stats_20261001112101.xlsx
Sheet: Sheet1
Structure:
- row 1: Date Range: YYYY-MM-DD ~ YYYY-MM-DD
- row 2: blank
- row 3: canonical source headers
- row 4+: one row per day
Reference range: 2026-09-01 ~ 2026-09-30
Reference rows: 30 daily rows

Headers:
- Waktu
- GMV dari LIVE (Rp)
- GMV LIVE (Rp)
- GMV tidak langsung dari LIVE (Rp)
- Tampilkan GPM (Rp)
- Siaran LIVE
- Jumlah Siaran LIVE yang menghasilkan GMV.
- Produk yang terjual melalui LIVE
- Produk yang terjual dari LIVE
- Produk yang terjual dari LIVE secara tidak langsung
- Pesanan SKU teratribusi
- Pesanan SKU dari LIVE
- Pesanan SKU tidak langsung dari LIVE
- Pembeli (Pencarian)
- Rasio klik tayang (LIVE)
- CTOR (pesanan SKU) (LIVE)
- Tayangan LIVE
- Durasi menonton rata-rata (Siaran LIVE)

Canonical TikTok daily fields:
- metric_date
- gmv_attributed
- gmv_direct
- gmv_indirect
- display_gpm
- live_stream_count
- live_streams_with_gmv
- products_sold_attributed
- products_sold_direct
- products_sold_indirect
- sku_orders_attributed
- sku_orders_direct
- sku_orders_indirect
- buyers_search
- live_ctr_pct
- live_ctor_order_pct
- live_impressions
- avg_watch_duration_seconds

Reference totals for parser QA:
- GMV attributed = 8,028,942
- GMV direct = 6,927,925
- GMV indirect = 1,101,017
- display GPM = 2,105
- Siaran LIVE = 3,151
- streams with GMV = 38
- products sold attributed = 50
- products sold direct = 43
- products sold indirect = 7
- attributed SKU orders = 48
- direct SKU orders = 41
- indirect SKU orders = 7
- buyers search = 41
- LIVE impressions = 16,647,603

Important semantic rule:
TikTok daily rows are daily aggregate data, NOT individual internal host sessions.
Do not fabricate thousands of live_sessions from Siaran LIVE.
Store them in dedicated live_daily_performance.

## Unified auto detection
Classify without filename dependence:
- Shopee Live Session List
- Shopee Live Product List
- Shopee Live Overview
- TikTok Live Core Stats
- Generic Live Manual Mapping fallback

UI must display detected platform, detected dataset, parser version and confidence.

## Universal parsing
Must support:
- Indonesian and international thousands/decimal punctuation
- percentage comma or dot
- CSV comma/semicolon/tab/pipe
- RFC4180 quoted values and escaped quotes
- UTF-8 BOM
- multi-header Shopee overview
- Excel numeric/date cells
- DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
- Shopee durations HH:MM:SS and 78j57m4d style

No naive line.split(",").

## Data isolation
Shopee/TikTok Live data stays fully isolated from Affiliate tables.

## No data loss
Persist platform-specific fields even when generic Live schema cannot represent them.
Keep raw payload and parser metadata for audit.

## Idempotency
- file hash blocks identical file reimport
- dataset natural keys prevent duplicates when equivalent exports have different filenames/hashes

## Import UX
File -> Auto Detect -> Normalize -> Preview -> Warnings -> Import -> Reconciliation/Data Health.
