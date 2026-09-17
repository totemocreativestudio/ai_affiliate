"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: 'DM Sans, Inter, system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0b1020', color: '#f5f7ff' }}>
          <section style={{ width: 'min(420px, 100%)', display: 'grid', justifyItems: 'center', gap: 14, textAlign: 'center', padding: '30px 26px', background: '#111827', border: '1px solid #2a3548', borderRadius: 20 }}>
            <img src="/luma-mark.png" alt="Lumaway" style={{ width: 54, height: 54, objectFit: 'contain' }} />
            <h1 style={{ margin: 0, fontSize: 20 }}>Lumaway perlu dimuat ulang</h1>
            <p style={{ margin: 0, color: '#aeb9cb', fontSize: 13, lineHeight: 1.6 }}>Terjadi kesalahan pada aplikasi. Data akun Anda tetap tersimpan.</p>
            <button type="button" onClick={() => reset()} style={{ minHeight: 42, padding: '9px 16px', border: 0, borderRadius: 10, background: '#635bff', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Muat ulang Lumaway</button>
          </section>
        </main>
      </body>
    </html>
  );
}
