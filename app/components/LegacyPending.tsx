"use client";

export default function LegacyPending({ isAdmin }: { isAdmin: boolean }) {
  const items=[
    ["excel-sync","DATA & SYNC","Excel Sync","Edit massal Excel dan export template V5.6.4.1 sedang dipindahkan ke PostgreSQL."],
    ["agreements","AFFILIATE MANAGEMENT","Agreement","Agreement existing tetap tersimpan. Upload dokumen akan memakai Supabase Storage."],
    ["affiliate-support","AFFILIATE MANAGEMENT","Affiliate Support","Sample, shipping, support status, creator target dan task akan dipulihkan dari tabel existing."],
    ["luma-affiliate","LUMA AFFILIATE","Luma Affiliate","Referral profile/event dan komisi 5% tetap dipertahankan."],
    ["promo-studio","AI PROMO STUDIO","AI Promo Studio","Generator TOFU–MOFU–BOFU, AIDA, PAS dan history akan dipindahkan setelah AI Analytics."],
    ["tutorial","LEARNING","Tutorial","Tutorial V5.6.4.1 tetap menjadi acuan UI/UX."],
    ["billing","LUMA BILLING","Billing & Token","Token wallet, transaction, top-up order dan PDF report existing tidak dihapus."],
    ["google-sheets","INTEGRATION","Google Sheets","Sync mapping/history tetap dipertahankan; credential tetap server-side."],
  ];
  return <>
    {items.map(([id,eye,title,desc])=><section key={id} id={id} className="card legacy-page-anchor legacy-port-status"><div className="eyebrow">{eye}</div><h2>{title}</h2><p className="muted">{desc}</p><span className="role-badge">Porting from V5.6.4.1</span></section>)}
    {isAdmin&&<section id="administration" className="card legacy-page-anchor legacy-port-status"><div className="eyebrow">LUMA ADMINISTRATION</div><h2>Administration</h2><p className="muted">User Management, AI Monitoring, Sheets Monitoring dan Billing/Referral akan dipindahkan tanpa memberi customer akses lintas workspace.</p><span className="role-badge">Admin only</span></section>}
  </>;
}
