import type { ReactNode } from "react";

interface ChartPanelProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ChartPanel({ title, subtitle, actions, children }: ChartPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header panel__header--with-actions">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {actions ? <div className="panel__actions">{actions}</div> : null}
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}
