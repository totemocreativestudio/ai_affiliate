# Lumaway Marketing Website

Website marketing berbahasa Indonesia, terpisah dari aplikasi Lumaway yang tetap berada di root repository.

## Menjalankan

```bash
cd apps/marketing
npm ci
cp .env.example .env.local
npm run dev
```

Produksi: `npm run build` lalu `npm start`. Validasi: `npm run typecheck` dan `npm test`.

Stack: Next.js 16.3.5 App Router, React 19, TypeScript, Tailwind CSS 4. Font DM Sans di-host lokal via next/font, bersumber dari paket @fontsource/dm-sans. Ikon Lucide. Logo merupakan salinan byte-for-byte public/luma-mark.png pada repository aplikasi.

## Struktur dan isolasi

- `app/`: route server, metadata, API leads, sitemap, robots, OG image.
- `components/`: navigation, footer, UI, cerita produk, audiens, workflow, formulir, analytics.
- `content/`: kemampuan produk, audiens, FAQ, artikel Indonesia, halaman perusahaan dan informasi kebijakan.
- `lib/config.ts`: URL, plan komersial, bukti pelanggan, token dasar.
- `supabase/migrations/`: tabel lead dan outbox terpisah dari tabel aplikasi.
- `tests/`: validasi dan perilaku kegagalan API leads.

Dashboard tetap di root. Root tsconfig mengecualikan apps/marketing agar dua aplikasi tidak memeriksa tipe satu sama lain. Tidak ada perubahan dependency root atau pemindahan app. Tahap berikutnya bisa memindahkan root app ke apps/web dan mengekstrak packages/brand, ui, analytics, config, types setelah konfigurasi deployment lama dipastikan.

## Halaman

Beranda; 9 kemampuan produk; 7 solusi audiens; product; solutions; pricing; insights; 3 artikel; resources; about; contact; roadmap; integrations; enterprise; customers; changelog; security; privacy; terms; cookies.

Customer stories belum dipublikasikan karena tidak ada bukti pelanggan terverifikasi. Pricing tidak memakai harga rekaan. Modul Beta memiliki implementasi di source, bukan klaim bahwa layanan produksi telah diuji. Market/Competitor/Marketing Intelligence dan Smart Alerts ditandai Direncanakan. Screenshot rekaan tidak dipakai: visual produk dilabeli ilustrasi alur.

Artikel menggunakan typed content dengan metadata, tanggal, kategori, related links dan schema. Tambahkan penulis/reviewer serta cover asli bila tersedia. Halaman SEO tambahan seperti shopee-research tidak dipublikasikan sebelum cakupan kemampuan dan materi unik tersedia.

## Formulir dan database

1. Migration `supabase/migrations/20260916084021_lumaway_marketing_leads.sql` membuat marketing_leads, marketing_lead_outbox, dan RPC marketing_capture_lead.
2. Migration ini telah diterapkan pada project Supabase `lumaway ai` (lbibiofoyejwwsxfbbcs) pada 16 September 2026. Jangan jalankan ulang sebagai migration baru pada project itu. Cocokkan migration history remote jika memakai Supabase CLI.
3. Isi server environment pada project Vercel marketing: MARKETING_SUPABASE_URL, MARKETING_SUPABASE_SECRET_KEY, LEAD_RATE_LIMIT_SALT. Secret tidak pernah menggunakan NEXT_PUBLIC_. Jangan masukkan rahasia ke source, PR, atau chat.
4. Gunakan secret key server dari project yang sama. API mendukung sb_secret_ melalui header apikey dan legacy service_role JWT melalui apikey + Authorization.
5. Uji submit dari domain preview yang benar. Pastikan record tersimpan dan success muncul. Matikan konfigurasi sementara untuk menguji failure. Tanpa ketiga env server, form terlihat tetapi submit dinonaktifkan dan endpoint mengembalikan 503.

Fitur: validasi tipe/panjang, consent terpisah, honeypot, same-origin, body maksimum 16 KiB, timeout, request UUID idempotent, rate limit atomik 5 pengiriman/fingerprint/jam, atribusi campaign, error yang tidak mengekspos database, no-store response. Fingerprint IP memakai HMAC; di luar Vercel digunakan email tersamar sebagai fallback. Penyimpanan hanya server; anon dan authenticated tidak bisa membaca lead atau mengeksekusi RPC. RLS aktif tanpa policy publik adalah deny-by-default yang disengaja; service_role memiliki akses eksplisit.

Outbox disiapkan untuk integrasi CRM/email, belum mengirim pesan otomatis. Atur consumer setelah tujuan, kredensial, jadwal, dan persetujuan pengiriman ditentukan. Pengiriman newsletter tidak diklaim langsung berjalan. Panduan resource tersedia setelah penyimpanan dikonfirmasi, tetapi file publiknya memang bukan dokumen rahasia/paywall.

Gunakan Supabase Dashboard dengan akses admin untuk meninjau leads. Kebijakan retensi, kontak resmi pengelola data, dan prosedur permintaan data perlu difinalisasi sebelum produksi. Halaman kebijakan merupakan naskah operasional awal untuk ditinjau pemilik layanan, bukan klaim kepatuhan hukum.

## Analytics

Event terpusat di lib/analytics.ts. GA4 atau GTM (GTM mendapat prioritas), Meta Pixel, Vercel Analytics hanya dimuat jika dikonfigurasi dan pengunjung mengizinkan. Jangan menambahkan GA4/Meta kedua kali di GTM dan konfigurasi langsung. Form values dan PII tidak masuk event. Campaign attribution disimpan per sesi secara first-party dan dikirim bersama formulir. Tidak mengklaim hasil konversi nyata sebelum provider terhubung dan divalidasi.

## Vercel

Buat project marketing terpisah dengan Git repository yang sama:

- Framework: Next.js
- Root Directory: `apps/marketing`
- Install: `npm ci`
- Build: `npm run build`
- Output: default Next.js
- Production branch: `main` setelah PR ditinjau/merge
- Preview branch: branch PR marketing
- Isi environment development/preview/production terpisah.

Gunakan auto-deploy Git bawaan Vercel setelah project terhubung. vercel.json tidak diperlukan. Project dashboard tetap Root Directory lama; jangan ubah sebelum migrasi disengaja.

Urutan domain:

1. Pastikan aplikasi lama tetap berjalan pada deployment yang diketahui.
2. Hubungkan `app.lumaway.online` ke project dashboard. Sesuaikan URL Supabase Auth/OAuth callback, NEXT_PUBLIC_APP_URL, dan konfigurasi pihak ketiga pada app.
3. Validasi login, signup, verifikasi email, dan Google OAuth di subdomain app.
4. Deploy marketing preview; validasi endpoint leads dan kebijakan produk.
5. Baru hubungkan `lumaway.online` ke project marketing. Hindari memindahkan domain sebelum app subdomain siap.
6. Tetapkan MARKETING_INDEXABLE=true hanya ketika domain produksi, status fitur, kebijakan, forms, serta auth links sudah diverifikasi. Preview selalu noindex (VERCEL_ENV=preview).

Root routes `/login` dan `/register` ditambahkan sebagai redirect ke layar auth yang sudah ada. `/register` memakai `?auth=signup`, dibaca oleh satu tambahan kecil pada effect root app. Login/daftar website menuju subdomain app; website tidak bergantung pada rendering dashboard.

## Verifikasi dan batas saat handoff

Baca VALIDATION.md untuk hasil build, pengujian, serta kondisi deployment terakhir. Belum ada harga, testimoni, jumlah pengguna, hasil omzet, integrasi marketplace langsung, atau sertifikasi yang direkayasa.
