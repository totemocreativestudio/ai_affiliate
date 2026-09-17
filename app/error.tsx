"use client";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="lumaway-route-state" role="alert">
      <section className="lumaway-route-card">
        <img src="/luma-mark.png" alt="Lumaway" />
        <h1>Terjadi kesalahan</h1>
        <p>Halaman Lumaway tidak dapat dimuat dengan sempurna. Coba muat ulang tanpa keluar dari akun Anda.</p>
        <div className="lumaway-route-actions">
          <button type="button" className="primary" onClick={() => reset()}>Coba lagi</button>
          <a href="/app.lumaway/dashboard">Kembali ke Dashboard</a>
        </div>
      </section>
    </main>
  );
}
