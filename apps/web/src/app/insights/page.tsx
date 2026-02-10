import { InsightCard } from "@/components/insight-card";
import { getMetricsInsights, getMetricsTrends } from "@/lib/api";
import { formatCompactNumber, formatPercent } from "@/lib/format";

interface InsightsPageProps {
  searchParams: Promise<{
    days?: string;
  }>;
}

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const params = await searchParams;
  const days = Math.min(365, Math.max(30, Number(params.days ?? "90") || 90));

  const [insights, trends] = await Promise.all([getMetricsInsights(days), getMetricsTrends(Math.min(days, 365))]);
  const latest = trends.totals.length > 0 ? trends.totals[trends.totals.length - 1] : null;

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Insights engine</h2>
        <p className="mt-1 text-sm text-slate-600">
          Automatically generated findings from snapshot trends, quality movement, staleness pressure, and agency momentum.
        </p>
        <form method="GET" className="mt-4 flex items-center gap-3">
          <label htmlFor="days" className="text-sm font-medium text-slate-700">
            Analysis window (days)
          </label>
          <select id="days" name="days" defaultValue={String(days)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="30">30</option>
            <option value="60">60</option>
            <option value="90">90</option>
            <option value="180">180</option>
            <option value="365">365</option>
          </select>
          <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Recompute
          </button>
        </form>
      </section>

      {latest ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest net growth</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCompactNumber(latest.netDatasetChange)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stale share</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatPercent(latest.staleDatasetShare)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg quality score</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{latest.avgQualityScore.toFixed(1)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Broken links</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCompactNumber(latest.brokenLinkCount)}</p>
          </article>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {insights.insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
        {insights.insights.length === 0 ? (
          <article className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Not enough trend history yet. Run daily ingests for stronger insight confidence.
          </article>
        ) : null}
      </section>
    </main>
  );
}
