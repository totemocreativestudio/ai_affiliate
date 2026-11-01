# README — Folder Desain

Status pekerjaan aktif: **DashStack Restyle** (REVIEW — deploy, tunggu feedback owner)

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
| Font Nunito Sans | `public/fonts/nunito-sans-latin-vf.woff2` (`@font-face` di `app/lumaway-dashstack-restyle.css`) |
| PWA cache | `public/sw.js` — `CACHE_VERSION` naik ke `v7` |

## Status

- [x] Intake referensi (Figma DashStack dari owner)
- [x] Visual direction & design spec (REVIEW)
- [x] Implementasi layer CSS (additive)
- [ ] Feedback owner setelah deploy → label jadi `APPROVED` kalau disetujui/revisi `REVISION`
