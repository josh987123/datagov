interface DashboardCardProps {
  title: string;
  value: string;
  subtitle?: string;
}

export function DashboardCard({ title, value, subtitle }: DashboardCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </article>
  );
}
