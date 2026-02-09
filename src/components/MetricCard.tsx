import type { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string;
  hint: string;
  icon: ReactNode;
  accent?: "violet" | "cyan" | "emerald" | "amber";
}

export function MetricCard({ title, value, hint, icon, accent = "violet" }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${accent}`}>
      <div className="metric-card__header">
        <span className="metric-card__title">{title}</span>
        <span className="metric-card__icon">{icon}</span>
      </div>
      <p className="metric-card__value">{value}</p>
      <p className="metric-card__hint">{hint}</p>
    </article>
  );
}
