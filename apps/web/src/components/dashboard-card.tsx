interface DashboardCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: string;
  tone?: "default" | "positive" | "watch" | "alert";
}

const toneClasses: Record<NonNullable<DashboardCardProps["tone"]>, string> = {
  default: "border-slate-200",
  positive: "border-emerald-200",
  watch: "border-amber-200",
  alert: "border-rose-200"
};

export function DashboardCard({ title, value, subtitle, trend, tone = "default" }: DashboardCardProps) {
  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      {trend ? <p className="mt-2 text-xs font-semibold text-slate-600">{trend}</p> : null}
    </article>
  );
}
