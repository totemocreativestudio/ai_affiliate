# PR #79B — Automation / Rules Engine + Lumaway UX Expansion Prompt

## Tujuan
Membangun Automation / Rules Engine yang mudah dipahami user baru, aman untuk multi-workspace, dan konsisten dengan Daily Brief. Rule ditampilkan transparan dengan pola **KETIKA → JIKA → LAKUKAN**.

## UX utama
- Builder 3 langkah: Trigger → Condition → Action.
- Template: campaign deadline H-3, sample belum follow up 3 hari, shipping tanpa resi, produk HPP kosong, GMV di bawah threshold.
- Rule memiliki Active/Paused, last run, matched count, run history, Run now.
- Tidak ada eksekusi tersembunyi; alasan rule selalu terlihat.
- Responsive desktop/tablet/mobile, skeleton, empty state, error state.

## Roadmap
### PR #79C — Goal & Forecast
Actual vs Target vs Forecast, pacing, target harian/mingguan/bulanan, confidence, drill-down creator/product/channel, Contribution Margin.

### PR #79D — Scheduled Report + Calendar
Scheduled report harian/mingguan/bulanan, PDF/CSV, recipients, drag-and-drop calendar, reschedule, recurring schedule, timezone workspace.

### PR #80 — Live Streaming Intelligence
Data Live Streaming wajib terpisah dari Affiliate Performance. GMV/order/viewer/live tidak boleh tercampur.
Sidebar: Overview, Upload Center, Session Planner, Host 360, Campaign Tracker, Ranking Host, Sales History, Production & Budget, Live Insights.
Metrik: GMV, Orders, Qty, Active/Peak/Avg Viewers, CTR, CVR, Duration, Revenue/Hour, Orders/Hour, Budget, Production Cost, Contribution Margin.
Visual: line, bar, donut, histogram per sesi/jam/hari; target vs achievement; schedule visual; session timeline.
Host 360: search username/name, inhouse/outhouse, platform, ratecard, session count, duration, GMV, orders, viewers, best hour, best gimmick, trend, target vs actual, history.
Kanban: satu engine dengan tab Affiliate dan Live Streaming; dataset tetap terpisah.
Insight dasar muncul otomatis dari data; generative analysis hanya opsional.

## Tutorial / Help UX
Tutorial untuk user baru harus step-by-step:
1. Capture/illustration setiap langkah.
2. Tiap langkah menjawab Apa yang dilakukan, Kenapa, Hasil yang diharapkan.
3. Flow Upload → Mapping → Preview → Import → Dashboard → drill-down.
4. Walkthrough interaktif dengan highlight target, Next/Back, progress.
5. Artikel memakai TOFU → MOFU → BOFU.
6. Layout image-first: hero, TOC, callout, screenshot card, related article, CTA.

## Promotion campaign
Transaksi > Rp350.000 ditampilkan sebagai potongan berbentuk persentase. Materi promo utama tidak menampilkan nominal maksimum Rp29.000. Guardrail nominal tetap dihitung aman di backend.
Campaign visual harus image-first, tidak flat, memakai asset internal atau royalty-free; jangan hotlink asset dengan hak pakai tidak jelas.

## UX review
Masalah utama bukan kekurangan fitur tetapi density tinggi dan banyak surface punya bobot visual sama.
Perbaiki hierarchy, progressive disclosure, sticky filter/action bar, contextual empty state, chart tooltip/crosshair, table drill-down, micro-interaction 160–220ms, dan hindari decorative AI iconography.

## Acceptance
- multi-workspace isolation
- RLS enabled
- execution history
- no affiliate/live metric cross-contamination
- non-blocking page load
- production build passes
- mobile minimum 360px
- keyboard accessible
- tutorial selalu punya visual + teks
