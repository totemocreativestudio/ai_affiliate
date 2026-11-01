# Design Spec — Lumaway "DashStack Edition" (Light)

Status: **REVIEW** · Tanggal: 2026-11-01
Implementasi: `app/lumaway-dashstack-restyle.css` (layer additive, import terakhir)
Font: `Nunito Sans` self-host (variable font di `public/fonts/nunito-sans-latin-vf.woff2`)
Referensi: DashStack UI Kit (`references/figma-link.md`)

## 1. Design tokens (`--ds-*`)

| Token | Nilai | Pemakaian |
| --- | --- | --- |
| `--ds-bg` | `#f7f8fa` | Latar halaman |
| `--ds-card` | `#ffffff` | Kartu, sidebar, topbar |
| `--ds-line` | `#e6eaf1` | Border utama kartu/sidebar/topbar |
| `--ds-line-soft` | `#eef1f6` | Divider internal kartu, border tabel |
| `--ds-ink` | `#141b2d` | Teks tubuh |
| `--ds-ink-head` | `#101828` | Judul h1/h2/h3 |
| `--ds-muted` / `--ds-muted-2` | `#667085` / `#98a2b3` | Teks sekunder/tertiary |
| `--ds-primary` | `#4880FF` | Aksen: tombol primary, item aktif, eyebrow |
| `--ds-primary-hover` | `#3a6ef0` | Hover tombol primary |
| `--ds-primary-soft` | `#ecf2ff` | Item menu aktif di sidebar |
| `--ds-success(+soft)` | `#12b76a` / `#ecfdf3` | Status paid/jalan |
| `--ds-warning(+soft)` | `#f79009` / `#fef4e6` | Status pending |
| `--ds-danger(+soft)` | `#f04438` / `#fef3f2` | Status gagal |
| `--ds-info(+soft)` | `#0ea5e9` / `#f0f9ff` | Status processing |
| `--ds-radius` | `16px` | Kartu & panel |
| `--ds-radius-sm` | `10px` | Tombol, input, item menu |
| `--ds-shadow` / `--ds-shadow-sm` | 0 1px 3px + 0 6px 16px / 0 1px 2px | Elevation kartu, lembut |

## 2. Komponen

| Komponen | Spesifikasi |
| --- | --- |
| Sidebar | Letak fixed kiri 252px, putih, border kanan `--ds-line`; item 40px, radius 10px; **aktif = bg `--ds-primary-soft`, teks primary, ikon tile biru putih** |
| Topbar | Putih 66px, garis bawah, tanpa blur/glow |
| Kartu | Putih, radius 16px, border 1px, shadow lembut (KPI card & owner-metric ikut) |
| Tombol primary | Solid `--ds-primary`, teks putih 700, radius 10px, shadow biru halus, tanpa animasi transform |
| Tombol sekunder | Putih, border `--border-strong`, radius 10px (mewarisi base) |
| Input | Putih, border `#d5dbe7`, radius 10px; **focus: ring 2px `rgba(72,128,255,.35)`** |
| Tabel | thead bg `#f7f8fa` teks abu 750; baris hover `#f8fafd`; garis vertikal soft |
| Status pill | Pastel: paid→hijau, pending→amber, gagal→merah, processing→biru informasi |
| Halaman auth | Latar gradient biru DashStack (`#4880FF→#2f5fd8`), kartu putih radius 20px shadow besar |

## 3. Cakupan file & risiko

- File baru: `app/lumaway-dashstack-restyle.css` (~250 rule, 11 section berkomentar).
- File diubah: `app/layout.tsx` (font + import akhir + themeColor), `app/LumawayWorkspaceApp.tsx` (import akhir), `public/sw.js` (cache v7).
- Risiko: CSS legacy lama banyak `!important` — layer ini menang cascade karena di-import terakhir dan memakai `!important` setara. Kalau ada 1–2 komponen khusus modul yang masih menampilkan warna lama, tambah kecilkan ke section 5–9 file ini.
- Tidak ada perubahan markup, data, logika fitur — murni presentasi.

## 4. Kalibrasi cepat

Ganti nilai token di `:root` file restyle untuk seluruh dampaknya. Contoh:
owner minta primary lebih tunggal → ubah `--ds-primary`. Bukan edit-belak-file
CSS lama.

## 5. Migrasi penuh warna legacy (2026-11-01)

Setelah owner meminta "ganti semua desain lama", seluruh warna aksen legacy di
`app/*.css` dipetakan ke DashStack lewat sweep berbasis HSL (skrip one-off,
tidak di-commit):

| Kelompok legacy | Kriteria (HSL) | Tujuan DashStack |
| --- | --- | --- |
| Violet/indigo terang | h 228–320, chroma ≥ 12 | l ≥ 91 → `#ecf2ff`, l ≥ 70 → `#6e9aff`, l ≥ 58 → `#4880ff`, l ≥ 40 → `#3a6ef0` |
| Indigo-biru legacy (link/navy-blue) | h 205–228, s ≥ 55, l 36–78 | `#4880ff` |
| Tint near-white keunguan | h 235–320, chroma 4–12, l ≥ 88 | `#ecf2ff` |
| Teks ungu gelap | h 240–320, chroma ≥ 35, l 15–40 | ink `#141b2d` |
| oklch coral (hue 48, chroma ≥ 0.05) | per lightness | `rgba(72,128,255,α)` / tier sesuai l |
| Brand gradient `--lwv5-orange` / stop oranye | `#ff9f43` | `#6e9aff` |

**Dipertahankan (tidak dipetakan):** warna netral abu (chroma kecil),
`#fff/f8fafc/e4e7ec` dll., status semantik hijau/merah/amber/teal, background &
teks gelap navy non-ungu (h < 228), aturan `html[data-theme="dark"]`
(dormant — app light-only), dan aksen pink magenta (h > 320, scope terpisah).

Total: ±1.275 penggantian di 42 file CSS + perbaikan token root
(`--luma-deep` → `#3a6ef0`, `--ui-accent`, `--lw4-violet`, `--lwv5-violet`,
`--lwv5-purple`, `--lh-accent`, `--lh-focus`). Verifikasi: scan HSL akhir tanpa
sisa violet saturasi; `npm run verify` + `npm run build` hijau.

## 6. Layout & Tipografi rapih (2026-11-01)

Permintaan owner: "perbaiki layout dan penempatannya, rapih dan mudah dipahami".
Ditemukan 889 rule `font-size: 6–9.5px` di 36 file (mikroskopis). Perbaikan via
layer restyle (section 9–17):

| Area | Sebelum | Sesudah |
| --- | --- | --- |
| Spacing | acak | token `--ds-space-1..12` (4px grid) |
| Tipografi body | 12–14px tidak konsisten | base 14px, line-height 1.65 |
| Heading | ukuran acak, margin tidak ada | skala 34/28/22/18/16px, margin-top rhythm |
| Paragraph | tanpa spasi vertikal | `margin-top: 16px` antar p/h2/h3 |
| Page header | tidak ada / header acak | `.page-head` flex eyebrow+h1 kiri, action kanan, border-b |
| Section head | tidak konsisten | `.section-head` flex heading+meta kiri, action kanan |
| Grid kartu | gap acak | `.dashboard-grid` 2-kolom, `.kpi-grid` 4-kolom, gap 16px, responsive |
| Card padding | 12–20px acak | 20px (space-5) |
| Tabel cell | padding tipis, font 8–9px | padding 12×16px, font 13px, header 13px weight 750 |
| Empty state | tidak ada / tersembunyi | centered icon+h3+p+CTA, border dashed, radius 16px |
| Scrollbar | default browser | 8px track transparan, thumb `#e6eaf1` |
| Focus keyboard | outline tidak terlihat | ring biru `#4880ff` offset 2px |
| Touch target | < 44px | ≥ 44×44px (pointer: coarse) |

Semua via layer additive — tidak menyentuh CSS lama.
