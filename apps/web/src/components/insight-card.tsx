import type { InsightItem } from "@datagov/shared";

interface InsightCardProps {
  insight: InsightItem;
}

const severityStyles: Record<InsightItem["severity"], { badge: string; border: string }> = {
  alert: { badge: "bg-rose-100 text-rose-800", border: "border-rose-200" },
  watch: { badge: "bg-amber-100 text-amber-800", border: "border-amber-200" },
  positive: { badge: "bg-emerald-100 text-emerald-800", border: "border-emerald-200" },
  info: { badge: "bg-blue-100 text-blue-800", border: "border-blue-200" }
};

export function InsightCard({ insight }: InsightCardProps) {
  const style = severityStyles[insight.severity];

  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm ${style.border}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{insight.title}</h3>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${style.badge}`}>
          {insight.severity}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-700">{insight.summary}</p>
      <p className="mt-3 text-xs font-medium text-slate-600">Why it matters</p>
      <p className="mt-1 text-sm text-slate-600">{insight.whyItMatters}</p>
      <p className="mt-3 text-xs font-medium text-slate-600">Recommendation</p>
      <p className="mt-1 text-sm text-slate-600">{insight.recommendation}</p>
    </article>
  );
}
