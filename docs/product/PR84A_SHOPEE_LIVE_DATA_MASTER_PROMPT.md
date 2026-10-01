# PR #84A — SHOPEE LIVE DATA MASTER PROMPT
## Live Streaming Intelligence · Import, Normalization, Reconciliation, Dashboard Foundation

> Scope PR ini khusus **Shopee Live**. TikTok Live akan dipetakan pada prompt/PR terpisah setelah format file TikTok diberikan.
>
> Prinsip utama: **Shopee Live tetap berada pada domain Live Streaming dan tidak boleh digabungkan ke Affiliate Performance.**

---

# 1. SOURCE FILE YANG HARUS DIDUKUNG

Implementasi harus otomatis mengenali tiga export Shopee berikut tanpa user wajib memilih tipe file secara manual.

## A. Shopee Live — Live List
Contoh workbook:
- sheet: `Live List`
- contoh ukuran file: 41 session + 1 header
- grain: **1 row = 1 sesi livestream**

Header yang ditemukan pada file referensi:
1. Periode Data
2. User Id
3. No.
4. Nama Livestream
5. Start Time
6. Durasi:
7. Penonton Aktif
8. Komentar
9. Tambah ke Keranjang
10. Rata-rata durasi ditonton
11. Penonton
12. Pesanan(Pesanan Dibuat)
13. Pesanan(Pesanan Siap Dikirim)
14. Produk Terjual(Pesanan Dibuat)
15. Produk Terjual(Pesanan Siap Dikirim)
16. Penjualan(Pesanan Dibuat)
17. Penjualan(Pesanan Siap Dikirim)

Canonical mapping:
- source_period
- source_user_id
- source_rank_no
- session_title
- started_at
- duration_seconds
- active_viewers
- comments
- add_to_cart
- avg_watch_duration_seconds
- viewers
- orders_created
- orders_ready_to_ship
- qty_created
- qty_ready_to_ship
- gmv_created
- gmv_ready_to_ship

### Session identity / idempotency
Do not use row number alone.

Preferred session natural key:
`workspace_id + platform(shopee) + source_user_id + started_at + normalized_session_title`

If the same file is re-uploaded:
- file hash prevents duplicate import
- natural key prevents duplicate session persistence when a different export contains the same session

---

## B. Shopee Live — Product List
Example:
- sheet: `Product List`
- grain: **1 row = 1 product performance row for selected period**

Headers in the reference file:
1. Periode Data
2. User Id
3. Ranking
4. Produk
5. Klik Produk
6. Tambah ke Keranjang
7. Pesanan(Pesanan Dibuat)
8. Pesanan(Pesanan Siap Dikirim)
9. Produk Terjual(Pesanan Dibuat)
10. Produk Terjual(Pesanan Siap Dikirim)
11. Penjualan(Pesanan Dibuat)
12. Penjualan(Pesanan Siap Dikirim)

Canonical mapping:
- period_start
- period_end
- source_user_id
- ranking
- product_name
- product_clicks
- add_to_cart
- product_orders_created
- product_orders_ready_to_ship
- qty_created
- qty_ready_to_ship
- gmv_created
- gmv_ready_to_ship

This data must be stored in a **dedicated Shopee Live product-performance table/domain**, not in Affiliate product performance.

Product matching:
1. Exact platform product ID if a future Shopee export provides it.
2. Master SKU mapping if user manually links it.
3. Normalized product name fallback.
4. Never silently overwrite Master Product.

---

## C. Shopee Live — Overview CSV
Example:
`overview-v2_1m_YYYY-MM-DD_*.csv`

The reference CSV is **not a normal one-header CSV**.

Structure:
- row 1: metric group headings
- row 2: metric names
- row 3: period summary values
- additional rows: repeated traffic-source blocks

Primary group headings observed:
- Transaksi – Tinjauan
- Kunjungan - Performa
- Kunjungan - Sumber Penonton - Semua Sumber Penonton
- Konversi - Performa
- Konversi - Alur Konversi
- Interaksi
- Promosi

Primary period-summary metrics observed:

### Transaksi – Tinjauan
- Periode Data
- User Id
- Penjualan(Pesanan Dibuat)
- Penjualan(Pesanan Siap Dikirim)
- Penjualan dari Pembeli Baru(Pesanan Dibuat)
- Penjualan dari Pembeli Baru(Pesanan Siap Dikirim)
- Penjualan dari Pembeli Lama(Pesanan Dibuat)
- Penjualan dari Pembeli Lama(Pesanan Siap Dikirim)
- Pesanan(Pesanan Dibuat)
- Pesanan(Pesanan Siap Dikirim)
- Produk Terjual(Pesanan Dibuat)
- Produk Terjual(Pesanan Siap Dikirim)
- Nilai Penjualan per Pesanan(Pesanan Dibuat)
- Nilai Penjualan per Pesanan(Pesanan Siap Dikirim)
- Penjualan per Pembeli(Pesanan Dibuat)
- Penjualan per Pembeli(Pesanan Siap Dikirim)

### Kunjungan - Performa
- Jumlah Livestream
- Jumlah Durasi Livestream
- Rata-rata durasi Livestream
- Penonton
- Penonton Aktif
- Dilihat
- Penonton Tertinggi
- Rata-rata durasi ditonton

### Kunjungan - Sumber Penonton - Semua Sumber Penonton
- Rasio Live Ditonton
- Rasio Penonton Live
- Rasio Penonton Aktif
- Live Ditonton
- Penonton Live
- Penonton Aktif

### Konversi - Performa
- Persentase Klik
- Pembeli(Pesanan Dibuat)
- Pembeli(Pesanan Siap Dikirim)
- Pesanan per Klik(Pesanan Dibuat)
- Pesanan per Klik(Pesanan Siap Dikirim)
- Tambah ke Keranjang
- Penjualan per mil(Pesanan Dibuat)
- Penjualan per mil(Pesanan Siap Dikirim)

### Konversi - Alur Konversi
- Jumlah Produk Dilihat
- Persentase Klik
- Klik Produk
- Persentase Pesanan(Pesanan Dibuat)
- Persentase Pesanan(Pesanan Siap Dikirim)
- Pesanan Dibuat
- Pesanan Terkonfirmasi

### Interaksi
- Suka
- Share
- Komentar
- Pengikut Baru dari Livestream

### Promosi
- Voucher Toko Diklaim
- Voucher Spesial Live Diklaim
- Koin Diklaim

---

# 2. TRAFFIC SOURCE BLOCK PARSER

Overview CSV contains repeated three-row source blocks.

Observed source headings:
- Toko Saya
- Pencarian
- Keranjang
- Rekomendasi
- Riwayat Pesanan Pembeli
- Tab Live & Video
- Beranda
- Chat
- Video
- Lainnya

Pattern:
1. group row: `Kunjungan - Sumber Penonton - {SOURCE}`
2. next row: source metric names
3. next row: source metric values

Metrics per source:
- Rasio Live Ditonton
- Rasio Penonton Live
- Rasio Penonton Aktif
- Live Ditonton
- Penonton Live
- Penonton Aktif

Do NOT parse these source blocks as additional period-summary rows.

Persist them as:
`live_traffic_sources`
with:
- workspace_id
- platform = shopee
- source_user_id
- period_start
- period_end
- traffic_source
- live_view_ratio_pct
- live_viewer_ratio_pct
- active_viewer_ratio_pct
- live_views
- live_viewers
- active_viewers
- source_import_id

Traffic-source names must be stored as normalized code + raw label.

Example:
- raw: `Riwayat Pesanan Pembeli`
- code: `buyer_order_history`

Unknown future sources:
- do not reject file
- normalize to `other:{normalized_label}`
- retain raw source label

---

# 3. LOCALE-AWARE UNIVERSAL VALUE NORMALIZATION

This is mandatory.

Shopee exports may differ by browser locale, OS locale, CSV version, Excel version, and seller-center export version.

The parser MUST NOT assume that:
- comma always means decimal
- dot always means thousand separator
- comma always means CSV delimiter

Build a field-semantic normalization layer.

## 3.1 Currency / monetary values

All of these must normalize correctly:

Indonesian:
- `Rp31.702.701` -> 31702701
- `Rp 31.702.701` -> 31702701
- `31.702.701` -> 31702701
- `Rp1.234.567,89` -> 1234567.89

International:
- `Rp31,702,701` -> 31702701
- `31,702,701` -> 31702701
- `1,234,567.89` -> 1234567.89

Also accept:
- IDR
- `Rp.`
- non-breaking spaces
- normal spaces
- quoted values
- Excel numeric cells

Never parse monetary data by simply deleting every comma/dot.

Algorithm:
1. strip currency symbol/text and whitespace
2. detect last separator
3. inspect digit groups
4. use target field semantic = money
5. distinguish decimal separator from thousands separators
6. return numeric
7. store raw string for audit if parsing confidence is low

---

## 3.2 Integer/count metrics

Examples:
- `8.947` -> 8947
- `8,947` -> 8947
- `10.425` -> 10425
- `12.354` -> 12354
- `627` -> 627
- numeric Excel `8947` -> 8947

For count fields, a single separator followed by exactly three digits should normally be treated as a thousands separator.

Count semantics apply to:
- viewers
- active viewers
- views
- product clicks
- comments
- likes
- shares
- followers
- orders
- qty
- vouchers
- coins
- add-to-cart
- livestream count
etc.

---

## 3.3 Percentage metrics

Accept:
- `13,98%`
- `13.98%`
- `13,98`
- `13.98`
- numeric Excel values

Canonical storage for current Lumaway Live schema:
**percentage points**

Examples:
- `13,98%` -> 13.98
- UI -> `13,98%`

Do not divide by 100 on import unless source cell is a true Excel fractional percentage value and cell metadata indicates it.

Fields:
- CTR
- CVR
- Persentase Klik
- Rasio Live Ditonton
- Rasio Penonton Live
- Rasio Penonton Aktif
- Persentase Pesanan

---

## 3.4 Missing/null values

Recognize:
- empty
- `-`
- `—`
- `–`
- N/A
- NA
- null
- None

Rules:
- unavailable ratio/source metric -> NULL, not 0
- actual explicit `0` -> numeric 0
- do not convert missing metric to zero when this would change meaning

---

# 4. CSV DELIMITER + QUOTING NORMALIZATION

Current LiveUploadPanel uses naive `split(",")`. This must be replaced.

Auto-detect:
- comma `,`
- semicolon `;`
- tab
- pipe `|`

Must support:
- quoted CSV fields
- comma inside product/session name
- escaped quote `""`
- UTF-8 BOM
- CRLF / LF
- empty columns
- duplicate header labels
- multi-header Shopee overview CSV

Never parse CSV rows with `line.split(",")`.

---

# 5. HEADER NORMALIZATION

Header matching must be:
- case-insensitive
- punctuation-insensitive
- whitespace-insensitive
- Unicode dash tolerant
- colon tolerant
- parentheses tolerant
- slash tolerant

Examples considered equivalent:
- `Durasi:`
- `Durasi`
- `durasi `

- `Pesanan(Pesanan Dibuat)`
- `Pesanan (Pesanan Dibuat)`
- `PESANAN - PESANAN DIBUAT`

Normalize Indonesian accents/dashes/Unicode punctuation before matching.

Do not depend only on fuzzy contains.
Use:
1. exact canonical alias
2. normalized exact alias
3. token similarity with confidence threshold
4. manual mapping fallback

Import preview must show:
- source header
- canonical field
- confidence
- sample raw value
- normalized sample value

Low-confidence fields require user review before Import.

---

# 6. DATE / TIME NORMALIZATION

## Period
Reference:
`01-09-2026 - 30-09-2026`

Also support:
- `01/09/2026 - 30/09/2026`
- `2026-09-01 - 2026-09-30`
- Excel date cells

Store:
- period_start
- period_end

Do not split period text using a naive single hyphen because the date itself contains hyphens.

## Session start
Reference:
`30-09-2026 16:01`

Also support:
- DD/MM/YYYY HH:mm
- YYYY-MM-DD HH:mm
- Excel datetime serial
- optional seconds

Canonical timezone:
`Asia/Jakarta`

Store:
- started_at timestamptz
- session_date Jakarta-local date
- start_hour Jakarta-local hour

---

# 7. DURATION NORMALIZATION

Reference formats found:

Live List:
- `02:00:23`
- `00:31:50`
- `00:00:17`

Overview CSV:
- `78j57m4d`
- `1j55m32d`
- `27d`

Where:
- j = jam
- m = menit
- d = detik

Also support:
- 78h57m4s
- 78 h 57 m 4 s
- 02:00:23
- 2:00:23
- 31:50 for MM:SS when field semantic confirms duration

Canonical:
- duration_seconds
- duration_minutes derived = duration_seconds / 60

Never feed `02:00:23` into a generic numeric parser.

---

# 8. DATABASE MODEL — DO NOT LOSE SHOPEE SEMANTICS

Current generic Live schema has:
- gmv
- orders
- qty

Shopee contains two transaction states:
- Pesanan Dibuat
- Pesanan Siap Dikirim

Do not throw one state away.

Add canonical session metrics:
- gmv_created
- gmv_ready_to_ship
- orders_created
- orders_ready_to_ship
- qty_created
- qty_ready_to_ship

Keep generic compatibility fields:
- gmv = gmv_created
- orders = orders_created
- qty = qty_created

This makes existing Live Overview continue working while preserving Shopee detail.

Add Shopee session fields:
- source_user_id
- source_rank_no
- comments
- add_to_cart
- viewers
- avg_watch_duration_seconds
- duration_seconds

Recommended new table:
`live_product_performance`
- id
- workspace_id
- platform
- source_user_id
- period_start
- period_end
- ranking
- product_master_id nullable
- product_name_raw
- product_clicks
- add_to_cart
- product_orders_created
- product_orders_ready_to_ship
- qty_created
- qty_ready_to_ship
- gmv_created
- gmv_ready_to_ship
- source_import_id
- raw_payload jsonb
- created_at

Recommended new table:
`live_period_overview`
- workspace_id
- platform
- source_user_id
- period_start
- period_end
- transaction metrics
- visit metrics
- conversion metrics
- interaction metrics
- promo metrics
- raw_payload jsonb
- source_import_id

Recommended:
`live_traffic_sources`
as described above.

---

# 9. IMPORT TYPE CLASSIFIER

After file selection show:

`Shopee Live detected`

and one of:
- Live Session List
- Live Product List
- Live Overview
- Unknown / Manual Mapping

Detection rules must use:
- sheet name
- normalized headers
- header-group structure
- source metric signatures

Do not rely on filename alone.

Examples:
- contains `Nama Livestream` + `Start Time` + `Durasi` -> Live Session List
- contains `Ranking` + `Produk` + `Klik Produk` -> Live Product List
- two header rows + groups `Transaksi – Tinjauan` / `Kunjungan - Performa` -> Live Overview

---

# 10. DATA RECONCILIATION RULES

The three supplied Shopee files were inspected and reveal important metric semantics.

For the supplied reference period:

## Metrics that reconcile between Live List and Overview
- Session count: 41
- GMV Pesanan Dibuat: Rp31.702.701
- GMV Siap Dikirim: Rp23.583.555
- Orders Dibuat: 138
- Orders Siap Dikirim: 119
- Qty / Produk Terjual Dibuat: 156
- Qty / Produk Terjual Siap Dikirim: 135
- Penonton: 8.947
- Komentar: 656
- Tambah ke Keranjang: 548

Use these as import QA reconciliation checks.

## Metric that MUST NOT be naively summed
Overview `Penonton Aktif` = 580.

Session-level active-viewer values do not represent a safe period-level unique total.
Do not force session SUM(active_viewers) to equal the Overview unique/period metric.

Keep:
- session_active_viewers
- period_active_viewers
as semantically separate values.

## Product List reconciliation
Reference Product List:
- Product GMV sum matches period GMV
- Product qty sum matches period qty
- Add-to-cart sum matches period add-to-cart

But:
- product-level order counts can exceed period order count because one order may contain multiple products
- product click sum does not equal Overview `Klik Produk`

Therefore:
- never use SUM(product_orders) as official period order total
- never use SUM(product_clicks) as official Overview click total
- use Overview/Live List for period transaction/session totals
- Product List is for ranking/product attribution

---

# 11. RECONCILIATION UI

After import, display Data Health:

### Reconciled
- Live sessions
- GMV Created
- GMV Ready to Ship
- Orders Created
- Orders Ready
- Qty Created
- Qty Ready
- Comments
- Add to Cart

Statuses:
- Exact
- Difference
- Source Not Uploaded

Tolerance:
- count metrics = exact
- money = configurable tiny rounding tolerance only
- durations = warning tolerance because Shopee exports may round session boundaries

Important:
A mismatch does not automatically delete/reject data.
Persist valid rows and show warning.

---

# 12. SHOPEE LIVE DASHBOARD METRICS

Shopee mode should expose:

## Revenue
- GMV Pesanan Dibuat
- GMV Siap Dikirim
- confirmation ratio
- GMV / hour
- ready-to-ship GMV / hour

## Transactions
- Orders Dibuat
- Orders Siap Dikirim
- Qty Dibuat
- Qty Siap Dikirim
- AOV created
- AOV ready
- sales per buyer where available

## Live Performance
- Total Livestream
- Total Live Duration
- Avg Live Duration
- Viewers
- Active Viewers (period overview)
- Views
- Peak Viewers
- Avg Watch Duration
- Comments
- Likes
- Shares
- New Followers

## Conversion
- Add to Cart
- Product Click
- Click %
- Orders per Click
- Order %
- Sales per mil

## Promotion
- Store Voucher Claimed
- Special Live Voucher Claimed
- Coins Claimed

## Traffic Sources
- source contribution donut
- Live Views
- Live Viewers
- Active Viewers
- ratios per traffic source

## Product Performance
- Ranking
- Product
- clicks
- add to cart
- qty
- GMV
- ready-to-ship GMV
- conversion signals

---

# 13. CURRENT LIVE SCHEMA COMPATIBILITY

Do NOT combine this Shopee data with Affiliate Performance.

Live generic dashboards may use:
- `gmv = gmv_created`
- `orders = orders_created`
- `qty = qty_created`
- platform = `Shopee`

Shopee-specific panels must still preserve and expose ready-to-ship metrics separately.

Host data:
The supplied Shopee export does NOT contain host identity.

Therefore:
- do not invent Host
- do not create `Unknown Host` as if it were a real host profile
- session can remain host_id = NULL
- user can later assign a Host manually
- source seller User Id is not a Host ID

This is important.

---

# 14. RAW DATA RETENTION

Every imported dataset must preserve:
- raw filename
- file hash
- import ID
- detected type
- detected platform
- source sheet
- raw header list
- mapping
- parser version
- locale inference
- raw row JSON where practical
- warnings
- import timestamp

Reason:
Shopee may change export format later.

Parser must be versioned:
`shopee_live_parser_v1`

Never overwrite old parser audit metadata.

---

# 15. IMPORT PREVIEW UX

Flow:

1. Select file
2. Detect platform = Shopee
3. Detect dataset type
4. Detect delimiter / sheet / header rows
5. Show mapping confidence
6. Show raw vs normalized sample
7. Show parser warnings
8. Preview first 5–10 rows
9. Import
10. Reconciliation
11. Data Health
12. Dashboard refresh

Preview examples:

| Source | Canonical | Raw | Normalized |
|---|---|---|---|
| Penjualan(Pesanan Dibuat) | gmv_created | Rp31.702.701 | 31,702,701 |
| Penonton | viewers | 8.947 | 8,947 |
| Persentase Klik | click_rate_pct | 13,98% | 13.98 |
| Jumlah Durasi Livestream | duration_seconds | 78j57m4d | 284,224 sec |

---

# 16. FILE-PARSER TEST MATRIX

Automated tests must include:

## Number variants
- Rp31.702.701
- Rp31,702,701
- Rp 1.234.567,89
- Rp 1,234,567.89
- 8.947
- 8,947
- 13,98%
- 13.98%
- 0
- -
- blank

## CSV variants
- comma delimiter
- semicolon delimiter
- tab delimiter
- quoted field containing comma
- UTF-8 BOM
- CRLF
- LF

## Dates
- DD-MM-YYYY
- DD/MM/YYYY
- YYYY-MM-DD
- Excel serial
- datetime with/without seconds

## Durations
- 02:00:23
- 2:00:23
- 78j57m4d
- 1j55m32d
- 27d
- 78h57m4s

## Header variants
- punctuation changes
- extra whitespace
- colon removed
- parentheses spacing
- Unicode dash vs ASCII dash
- capitalization changes

---

# 17. ACCEPTANCE CRITERIA

Shopee Live PR is accepted only when:

1. All three supplied reference files are automatically classified correctly.
2. No manual remapping is required for the supplied files.
3. `Rp31.702.701`, `8.947`, `13,98%`, `78j57m4d`, and `02:00:23` normalize correctly.
4. CSV does not use naive string split.
5. session-level Shopee created/ready metrics are both preserved.
6. Product List does not inflate official total orders/clicks.
7. active-viewer semantics are kept separate between session and period overview.
8. Host is not fabricated from Shopee User Id.
9. import is idempotent.
10. Data Health shows reconciliation status across uploaded Shopee files.
11. Shopee data remains completely separate from Affiliate.
12. Existing Live Streaming generic dashboard continues working.
13. parser is ready to coexist with a future `tiktok_live_parser_v1`.
14. no TikTok assumptions are hardcoded into canonical field names.
