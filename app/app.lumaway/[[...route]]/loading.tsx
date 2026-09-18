export default function LumawayRouteLoading() {
  return (
    <main className="lumaway-route-state" aria-live="polite" aria-busy="true">
      <section className="lumaway-route-card">
        <img src="/luma-mark.png" alt="Lumaway" />
        <div className="lumaway-route-spinner" aria-hidden="true" />
        <h1>Menyiapkan Lumaway</h1>
        <p>Dashboard dan workspace Anda sedang dimuat.</p>
      </section>
    </main>
  );
}
