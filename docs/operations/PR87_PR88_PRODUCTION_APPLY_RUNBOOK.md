# PR87 + PR88 — Runbook Apply Supabase Production

Terakhir diperbarui: 2026-11-01
Project Supabase: `lbibiofoyejwwsxfbbcs`
Penulis: hasil probe produksi read-only 2026-10-11 + audit kode 2026-11-01

---

## 1. Latar belakang

Kode aplikasi untuk follow-up listing (No. WhatsApp, Follow Up Via, PIC nama asli)
**sudah lengkap di repo dan sudah ter-deploy** (`app/components/.../Listings.tsx`).
Yang belum berjalan adalah **skema di Supabase production**:

| Komponen | State produksi (probe 2026-10-11) | Efek di UI |
| --- | --- | --- |
| `public.luma_resolve_listing_creator_v1` | EXISTS — PR87 sudah applied | OK |
| `public.luma_listing_creator_link_report_v1` | EXISTS — PR87 sudah applied | OK |
| `public.luma_channel_contacts` | **MISSING (PGRST205)** | Kolom No. WhatsApp kosong; "Follow Up Via" fallback ke daftar mati |
| `public.luma_safe_workspace_assignees_v1` | EXISTS tapi versi lama | PIC tampil "Saya" / "PIC 01", bukan nama asli ("Silvia") |

---

## 2. Langkah apply (urut, pakai file "siap tempel")

### Langkah 1 — Verifikasi dulu (opsional tapi disarankan)

Buka <https://supabase.com/dashboard/project/lbibiofoyejwwsxfbbcs/sql/new>, jalankan:

```sql
select * from supabase.list_migrations() order by version desc limit 40;
```

Catat versi terakhir yang tercatat. Bandingkan dengan
`supabase/PRODUCTION_MIGRATION_MANIFEST.md` (bagian *checkpoint 2026-11-01*).

### Langkah 2 — PR87 (backfill + index, satu kali)

1. Buka `supabase/PR87_JUST_RUN_ME.sql` (atau `PR87_APPLY_READY.sql` — isinya setara).
2. Copy **seluruh isi** file → paste ke SQL Editor → **Run**.
3. Berhasil jika muncul `Success. No rows returned`.
4. File ini additive + idempotent — boleh dijalankan ulang tanpa efek samping.

Isi file (sumber migrasi repo, jangan diubah):
- `supabase/migrations/20261004090000_pr87_listing_creator_link_flow.sql`
- index `idx_listings_workspace_creator*`, `idx_creators_workspace_username_lower`
- backfill `listings.creator_id` yang masih NULL (hanya baris kosong, tidak menimpa)

### Langkah 3 — PR88 (tabel kanal kontak, satu kali)

1. Buka `supabase/PR88_CHANNEL_CONTACTS_APPLY_READY.sql`.
2. Copy **seluruh isi** file → paste ke SQL Editor → **Run**.
3. Berhasil jika muncul `Success. No rows returned`.
4. File ini additive (tanpa drop/tanpa menimpa data) + idempotent.

Isi file (sumber migrasi repo):
- `20261004103000_pr88_followup_channel_contacts.sql` — tabel + RLS `luma_channel_contacts`
- `20261010090000_pr89_channel_contact_backfill.sql` — backfill kontak dari data profil/kanal yang sudah ada (`NOT EXISTS`, tidak duplikat)
- `20261011140000_pr88b_pic_realname_fix.sql` — `luma_safe_workspace_assignees_v1` versi nama asli
- `20261011190000_pr88c_readiness_channel_contacts.sql` — skor readiness kontak

### Langkah 4 — Audit hasil (opsional, disarankan)

Bagian bawah `PR88_CHANNEL_CONTACTS_APPLY_READY.sql` berisi kueri audit.
Jalankan untuk memastikan:

- [ ] `public.luma_channel_contacts` ada (select 1 baris group by workspace)
- [ ] `luma_safe_workspace_assignees_v1` mengembalikan display name asli, bukan `Saya`
- [ ] skor readiness kontak tersimpan per workspace

### Langkah 5 — Validasi UI

1. Hard-refresh dashboard (`Ctrl + Shift + R`) atau clear cache PWA.
2. Buka section **Listings**:
   - [ ] Kolom **No. WhatsApp** terisi (yang datanya tersedia)
   - [ ] **Follow Up Via** berisi pilihan kanal aktif (WhatsApp / IG / TikTok / dll)
   - [ ] **PIC Follow Up** menampilkan nama user asli (mis. "Silvia"), bukan "Saya"
   - [ ] Search bisa mencari berdasarkan nomor WA
3. Buka masalah: `masalah/context.md` item 2026-10-06 — sudah tertutup semua setelah apply.

---

## 3. Aturan keamanan (wajib)

- File apply-ready **tidak menghapus, tidak drop, tidak menimpa** data lama.
- Idempotent: aman dijalankan berulang.
- Semua perubahan harus punya file migrasi di `supabase/migrations/` (aturan PR42);
  file "siap tempel" hanya konsolidasi — jangan mengedit isi migrasi.
- Setelah apply, perbarui `supabase/PRODUCTION_MIGRATION_MANIFEST.md`
  (bagian checkpoint 2026-11-01) agar manifest tetap jadi source of truth.

## 4. Checklist singkat

| # | Aksi | Selesai |
| --- | --- | --- |
| 1 | Run `supabase.list_migrations()` — catat state | ☐ |
| 2 | Run `PR87_JUST_RUN_ME.sql` | ☐ |
| 3 | Run `PR88_CHANNEL_CONTACTS_APPLY_READY.sql` | ☐ |
| 4 | Audit queries (bagian bawah file PR88) | ☐ |
| 5 | Validasi UI Listings + hard refresh | ☐ |
| 6 | Update `PRODUCTION_MIGRATION_MANIFEST.md` | ☐ |
