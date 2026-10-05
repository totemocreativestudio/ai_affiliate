export default function Loading() {
  return (
    <main className="lumaway-route-state" aria-busy="true">
      <section className="lumaway-route-card" role="status">
        <img src="/luma-mark.png" alt="Lumaway" width={44} height={44} decoding="async" />
        <div className="lumaway-route-spinner" aria-hidden="true" />
        <h1>Menyiapkan Lumaway…</h1>
        <p>Workspace dan data Anda sedang dimuat.</p>
      </section>
    </main>
  );
}
