export default function NotFound() {
  return (
    <main className="lumaway-route-state">
      <section className="lumaway-route-card">
        <img src="/luma-mark.png" alt="Lumaway" />
        <h1>Halaman tidak ditemukan</h1>
        <p>Alamat ini tidak tersedia di workspace Lumaway. Gunakan Dashboard untuk kembali ke area kerja Anda.</p>
        <div className="lumaway-route-actions">
          <a className="primary" href="/app.lumaway/dashboard">Buka Dashboard</a>
        </div>
      </section>
    </main>
  );
}
