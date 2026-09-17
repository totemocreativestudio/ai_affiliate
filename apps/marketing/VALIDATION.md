# Validasi LUMAWAY Marketing

Target publik: `https://lumaway.online/web/home`. Seluruh route marketing berada di bawah `/web/*`; dashboard dan route aplikasi lain tetap di luar namespace tersebut.

Tanggal validasi: 16 September 2026

## Hasil build dan test

- `npm run build`: lulus; 42 halaman/rute berhasil dibuat, termasuk route `/home` yang dipublikasikan sebagai `/web/home`.
- `npm test`: lulus; 5 skenario untuk consent, atribusi, same-origin, batas payload, kegagalan penyimpanan, rate limit, idempotensi, dan respons sukses.
- TypeScript/Next.js production build: lulus tanpa error.

## Pemeriksaan browser

Pemeriksaan dilakukan terhadap production build lokal dengan Chromium.

- Hanya satu heading `h1` pada halaman utama.
- Tidak ada horizontal overflow pada lebar 375, 430, 768, 1024, 1280, 1440, dan 1920 piksel.
- Navigasi desktop, mega menu Produk, navigasi mobile, tab alur produk, pilihan audiens, dan FAQ berfungsi.
- Halaman kapabilitas dapat dibuka dari navigasi mobile.
- Font lokal DM Sans termuat.
- Tidak ditemukan page error pada konsol browser.
- Form lead tetap nonaktif ketika konfigurasi server belum tersedia; UI tidak menampilkan sukses palsu.

## Data dan keamanan

- Migrasi `lumaway_marketing_leads` berhasil diterapkan pada project Supabase LUMAWAY.
- Tabel lead dan outbox memakai RLS deny-by-default dan tidak memiliki policy untuk client publik.
- Fungsi penyimpanan hanya dapat dipanggil oleh `service_role` atau `postgres`.
- Idempotensi request dan batas 5 submission per fingerprint per jam diterapkan secara atomik di database.
- Attribution dibatasi ke URL yang sudah disanitasi; form tidak mengirim query string atau PII ke analytics.

## Preview deployment

- Preview Vercel dibuat untuk review sebelum produksi.
- Preview memakai noindex dan berada di balik Vercel Authentication.
- Domain produksi belum dipindahkan.
- Submission lead end-to-end pada Vercel belum dapat diaktifkan sampai `MARKETING_SUPABASE_URL`, `MARKETING_SUPABASE_SECRET_KEY`, dan `LEAD_RATE_LIMIT_SALT` tersedia sebagai server-only environment variables pada project marketing.

## Gate sebelum produksi

1. Tambahkan environment variables server-only ke Vercel Preview dan Production.
2. Jalankan satu submission lead nyata dan pastikan ID tersimpan serta outbox terbentuk.
3. Verifikasi `https://app.lumaway.online/login` dan `/register`, termasuk redirect/callback autentikasi.
4. Review konten dan status Beta/Direncanakan oleh pemilik produk.
5. Isi `MARKETING_ORIGIN` pada project dashboard dengan origin deployment marketing (bukan `lumaway.online`) dan verifikasi rewrite `/web/*`.
6. Set `MARKETING_INDEXABLE=true` hanya pada Production setelah `https://lumaway.online/web/home`, formulir, dan robots root domain terverifikasi.
