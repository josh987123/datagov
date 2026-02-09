export function LoadingState() {
  return (
    <main className="state-shell">
      <section className="state-card">
        <div className="spinner" />
        <h2>Loading Data.gov metrics...</h2>
        <p>Reading the latest generated dashboard snapshot.</p>
      </section>
    </main>
  );
}
