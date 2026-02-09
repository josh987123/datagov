import type { ReactNode } from "react";

interface ChartPanelProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function ChartPanel({ title, subtitle, children }: ChartPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}
