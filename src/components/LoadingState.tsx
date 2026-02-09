export function LoadingState() {
  return (
    <main className="state-shell">
      <section className="state-card">
        <div className="spinner" />
        <h2>Loading Data.gov metrics...</h2>
        <p>Gathering metadata, publishers, formats, and freshness indicators.</p>
      </section>
    </main>
  );
}
