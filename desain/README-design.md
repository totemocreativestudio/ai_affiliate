# README — Folder Desain

Status pekerjaan aktif: **DashStack Restyle — migrasi penuh warna** (REVIEW — tunggu feedback owner)

## Cara membaca

| File | Isi |
| --- | --- |
| `CONTEXT.md` | Workflow desain (Input → Process → Output) — baca dulu sebelum kerja desain |
| `references/figma-link.md` | Link Figma referensi dari owner (DashStack UI Kit) |
| `04-visual-direction.md` | Arah visual, keputusan + alasan, FACT/UNKNOWN |
| `design-spec.md` | Token komponen, cakupan file, cara kalibrasi |

## Semua file yang terhubung dengan implementasi

| Implementasi | File |
| --- | --- |
| Layer CSS desain | `app/lumaway-dashstack-restyle.css` (import terakhir) |
| Migrasi warna legacy | `app/*.css` — 42 file, ±1.275 nilai warna dipetakan ke DashStack |
| Font Nunito Sans | `public/fonts/nunito-sans-latin-vf.woff2` (`@font-face` di `app/lumaway-dashstack-restyle.css`) |
| PWA cache | `public/sw.js` — `CACHE_VERSION` naik ke `v7` |

## Status

- [x] Intake referensi (Figma DashStack dari owner)
- [x] Visual direction & design spec (REVIEW)
- [x] Implementasi layer CSS (additive)
- [x] **Migrasi penuh warna legacy** (2026-11-01) — semua hex violet/indigo/indigo-biru
  di 42 file `app/*.css` dipetakan ke DashStack (`#4880ff` / `#3a6ef0` / `#6e9aff`
  / `#ecf2ff`) via HSL-gated sweep; warna netral (abu), semantik
  (hijau/merah/kuning), background navy gelap, dan `html[data-theme="dark"]`
  (dormant, app light-only) dipertahankan. Token root ikut di-set
  (`--luma`/`--luma-deep`/`--luma-soft`, `--ui-accent`, `--lw4-violet`,
  `--lwv5-violet/purple`, `--lh-accent/focus`, brand gradient `--lwv5-*` → biru).
- [ ] Feedback owner setelah deploy → label jadi `APPROVED` kalau disetujui/revisi `REVISION`
