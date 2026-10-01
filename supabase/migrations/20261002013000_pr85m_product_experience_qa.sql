-- PR85M Product Experience QA additions
insert into public.luma_qa_definitions(check_key,area,title,description,check_mode,severity,sort_order)
values
 ('px_new_user_10s','Product Experience · New User','New user understands next step','Login sebagai member baru. Dalam 10 detik user harus dapat menemukan langkah berikutnya, Upload, Bantuan, dan Action Center tanpa bantuan teknis.','manual','critical',210),
 ('px_empty_state','Product Experience · New User','Smart empty states guide action','Verifikasi empty state pada Live, Tutorial, Action Center, dan area data kosong menjelaskan apa yang belum ada serta CTA berikutnya.','manual','major',220),
 ('px_affiliate_staff','Product Experience · Affiliate','Affiliate daily journey','Upload Affiliate → cari creator → Listing → channel follow-up → PIC/jadwal → Action Center. Pastikan alur dapat diselesaikan tanpa data Live tercampur.','manual','critical',230),
 ('px_live_team','Product Experience · Live','Live team end-to-end journey','Upload Shopee/TikTok → Auto Detect → Preview → Import → Data Health → Analytics → Product Intelligence → Live P&L. Pastikan data Affiliate tidak berubah.','manual','critical',240),
 ('px_manager','Product Experience · SPV','Manager decision journey','Review Action Center, Campaign deadline, Goal/Forecast dan Saved Views. Pastikan prioritas dan CTA mudah dipahami.','manual','major',250),
 ('px_finance','Product Experience · Finance','Finance review journey','Review Spending dan Live P&L. Pastikan HPP coverage, cost categories, contribution margin dan partial coverage jelas.','manual','critical',260),
 ('px_member_privacy','Product Experience · Privacy','Member privacy boundary','Login sebagai member biasa dan verifikasi tidak ada nama owner/admin, provider account, credential, internal business configuration atau owner control center.','manual','critical',270),
 ('px_mobile_pwa','Product Experience · Mobile/PWA','Mobile operational journey','Uji Today, Follow Up, Live, Upload, More, offline fallback, install mode dan touch target di mobile.','manual','major',280),
 ('px_perceived_speed','Product Experience · Performance','Perceived speed journey','Uji route feedback, skeleton/progress, chart/table rendering dan pastikan tidak ada blank screen atau freeze yang menghambat pekerjaan.','manual','major',290),
 ('px_command_center','Product Experience · Navigation','Command Center journey','Gunakan Ctrl/Cmd+K untuk menemukan entity lintas workspace dan buka hasil dengan keyboard. Pastikan hasil mengarah ke konteks yang benar.','manual','major',300)
on conflict(check_key) do update set
 area=excluded.area,title=excluded.title,description=excluded.description,check_mode=excluded.check_mode,severity=excluded.severity,sort_order=excluded.sort_order,active=true;
