# 04 — Visual Direction — Lumaway Restyle "DashStack Edition"

Status: **REVIEW** (menunggu feedback owner setelah deploy preview/production)
Tanggal: 2026-11-01
Sumber referensi: `desain/references/figma-link.md` → DashStack — Free Admin
Dashboard UI Kit (Figma Community, oleh Seju).

## FACT

- Referensi yang dipilih owner adalah DashStack UI Kit (file Figma di `figma-link.md`).
- Karakter DashStack yang terverifikasi dari port publiknya (FilamentYahoo/HTML):
  primary `#4880FF`, font `Nunito Sans`, halaman abu muda + kartu putih,
  grid 4px, tersedia light & dark (light dipakai Lumaway).
- Lumaway saat ini: light-only, shell `.luma-app / .sidebar / .topbar / .content`,
  CSS legacy banyak layer dengan beberapa rule `!important` pada
  `product-ui.css`, `lumaway-experience-v2.css`, `lumaway-visual-system-v5.css`.

## DECISION (status REVIEW — belum APPROVED sampai owner menyetujui)

| Keputusan | Alasan | Ref DashStack |
| --- | --- | --- |
| Font jadi **Nunito Sans** (self-host: `public/fonts/nunito-sans-latin-vf.woff2`, fallback Inter) | Identitas font DashStack; self-host agar tidak menambah request pihak ketiga | Font theme DashStack |
| Primary color **#4880FF** menggantikan coral/violet | Warna aksen DashStack; kontras AA pada tombol teks putih | Primary kit |
| Halaman: abu muda `#f7f8fa`; kartu putih radius 16px, shadow lembut | Pola kartu DashStack; memperjelas hierarki konten | 4px grid, card |
| Sidebar **putih** dengan item aktif biru lembut (`#ecf2ff`) | Sidebar DashStack yaitu putih, bukan navy seperti versi Lumaway saat ini | Sidebar kit |
| Tombol primary solid biru radius 10px, sekunder putih border halus | Konsisten dengan komponen button kit | Button kit |
| Tabel: head abu muda, baris hover sangat halus | Damen tampilan data-dense DashStack | Table kit |
| Status pills pastel (success/warning/danger/info) | Membaca status cepat tanpa warna keras | Badge kit |
| Halaman auth: latar gradient biru DashStack + kartu putih | Menyamakan identitas login dengan kit | Sample login page |
| Implementasi = **1 layer additive** `app/lumaway-dashstack-restyle.css` di-import terakhir | Rapih, reversible, tidak menyentuh/menghapus CSS lama (aturan owner: jangan hapus apa pun) | — |
| PWA cache naik ke `v7` | Per its own instruction: wajib naikkan versi saat ada perubahan visual penting | — |

## UNKNOWN

- Nilai token persis di file Figma (komponen internal seperti spacing antar
  kartu di frame tertentu). Token di `design-spec.md` diambil dari port publik
  DashStack + screenshot komunitas; bisa dikalibrasi nanti dengan cukup
  mengganti nilai `--ds-*` di `app/lumaway-dashstack-restyle.css` — satu file.
- Preferensi owner untuk dark mode DashStack (kit punya dark theme; Lumaway
  saat ini memaksa light).

## Langkah persetujuan

1. Deploy preview (Vercel otomatis dari PR).
2. Owner mengevaluasi: font, warna biru, sidebar putih, kartu, tabel.
3. Feedback per bagian → revisi hanya di token/section file restyle.
