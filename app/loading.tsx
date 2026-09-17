export default function Loading() {
  return (
    <main className="lumaway-route-state" aria-live="polite" aria-busy="true">
      <section className="lumaway-route-card">
        <img src="/luma-mark.png" alt="Lumaway" />
        <div className="lumaway-route-spinner" aria-hidden="true" />
        <h1>Menyiapkan Lumaway</h1>
        <p>Workspace dan data Anda sedang dimuat.</p>
      </section>
    </main>
  );
}
