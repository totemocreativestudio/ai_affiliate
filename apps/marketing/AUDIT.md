# Audit awal Lumaway — 16 September 2026

Source: totemocreativestudio/ai_affiliate, main commit d9cea1e4ba8b7eef37032f9037848c4fed20a724.

1. Struktur lama: app (page, components, API, blog), lib, public; belum monorepo.
2. Framework: package Next ^16.3.4, React ^19.2.8, TypeScript 7.0.2. Marketing memakai stable terverifikasi 16.3.5.
3. Tokens dari app/luma-production.css: --luma #635bff; --luma-deep #4f46e5; --navy #0f1728; --navy-2 #151f34; --text #101828; --muted #667085; --border #e4e7ec; --bg #f6f7fb.
4. Assets: public/luma-logo.png dan public/luma-mark.png. Mark dipakai tanpa digambar ulang. Spektrum aksen visual diselaraskan dengan mark; bukan pengganti token resmi.
5. DM Sans disebut di CSS tetapi file/font loading tidak ditemukan. Marketing memasang DM Sans lokal dari @fontsource.
6. Auth lama: /, state signin/signup; Supabase OAuth kembali /#dashboard. /login dan /register belum ada.
7. Tidak ada vercel.json atau .vercel/project.json pada tracked repository. Connected Vercel belum memberikan project/team yang dapat diinspeksi.
8. Nama env dari .env.example: NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, OPENAI_API_KEY, XENDIT_SECRET_KEY, XENDIT_WEBHOOK_TOKEN, WHATSAPP_PROVIDER, WHATSAPP_ACCESS_TOKEN, WHATSAPP_BASE_URL, WHATSAPP_DEVICE_ID, CONVIA_API_KEY, CONVIA_BASE_URL, CONVIA_OTP_TEMPLATE, CONVIA_WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_OTP_TEMPLATE, WHATSAPP_TEMPLATE_LANGUAGE, WHATSAPP_GRAPH_VERSION, WHATSAPP_CHANNEL_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Tidak ada nilai secret diinspeksi atau disalin.
9. Dashboard navigasi hash di root, antara lain #dashboard, #administration, #product-master, #listings, #shipping, #creator-samples, #ratecard; blog memiliki route publik.
10. Arsitektur target: apps/marketing; apps/web (tahap migrasi mendatang); packages/ui, brand, analytics, config, types setelah kontrak aplikasi diverifikasi. Implementasi awal menjaga dashboard root dan menambah apps/marketing.
11. Aman dibagikan: logo, token, font, tipe, helper analitik serta primitive presentasional tanpa auth.
12. Tetap terpisah: shell dashboard, auth session, Supabase client dashboard, billing/token, owner control, data operasional.
13. Risiko: domain root sudah digunakan aplikasi; perubahan root directory/build; OAuth callback; Next global CSS lintas aplikasi; kemampuan source belum sama dengan kesiapan produksi; harga/kuota belum disetujui.
14. Fase: audit → marketing dan konten Indonesia → leads/SEO → build dan QA → preview → konfigurasi rahasia server dan domain → validasi produksi → indexable.

Bukti harga: BillingCenter mengambil luma_token_packages dari database; bukan konfigurasi paket subscription marketing. Karena harga komersial belum diberikan, halaman pricing bersifat konsultatif. Tidak digunakan fallback quota 50 sebagai janji penawaran.
