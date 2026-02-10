interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <main className="state-shell">
      <section className="state-card state-card--error">
        <h2>Unable to load dashboard data</h2>
        <p>{message}</p>
        <button type="button" className="primary-button" onClick={onRetry}>
          Try again
        </button>
      </section>
    </main>
  );
}
