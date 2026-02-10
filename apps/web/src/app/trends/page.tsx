import { DatasetGrowthChart } from "@/components/charts/dataset-growth-chart";
import { ExposureTrendsChart } from "@/components/charts/exposure-trends-chart";
import { ScoreTrendsChart } from "@/components/charts/score-trends-chart";
import { TopAgenciesTrendChart } from "@/components/charts/top-agencies-trend-chart";
import { getMetricsTrends } from "@/lib/api";
import { formatCompactNumber, formatPercent } from "@/lib/format";

interface TrendsPageProps {
  searchParams: Promise<{
    days?: string;
  }>;
}

export default async function TrendsPage({ searchParams }: TrendsPageProps) {
  const params = await searchParams;
  const days = Math.min(365, Math.max(7, Number(params.days ?? "30") || 30));
  const trends = await getMetricsTrends(days);
  const latestTotal = trends.totals.length > 0 ? trends.totals[trends.totals.length - 1].totalDatasets : 0;
  const latest = trends.totals.length > 0 ? trends.totals[trends.totals.length - 1] : null;

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Trends</h2>
        <p className="mt-1 text-sm text-slate-600">Track dataset growth and top-agency momentum over time.</p>
        <form className="mt-4 flex items-center gap-3" method="GET">
          <label className="text-sm font-medium text-slate-700" htmlFor="days">
            Window (days)
          </label>
          <select id="days" name="days" defaultValue={String(days)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="30">30</option>
            <option value="60">60</option>
            <option value="90">90</option>
            <option value="180">180</option>
            <option value="365">365</option>
          </select>
          <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Update
          </button>
        </form>
        <p className="mt-3 text-sm text-slate-600">
          Latest total datasets in selected range: <span className="font-semibold text-slate-900">{formatCompactNumber(latestTotal)}</span>
        </p>
      </section>

      <DatasetGrowthChart data={trends.totals} />
      {latest ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Net daily growth</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCompactNumber(latest.netDatasetChange)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg quality</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{latest.avgQualityScore.toFixed(1)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg openness</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{latest.avgOpennessScore.toFixed(1)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stale share</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatPercent(latest.staleDatasetShare)}</p>
          </article>
        </section>
      ) : null}
      <section className="grid gap-6 xl:grid-cols-2">
        <ScoreTrendsChart data={trends.totals} />
        <ExposureTrendsChart data={trends.totals} />
      </section>
      <TopAgenciesTrendChart series={trends.topAgenciesOverTime} />
    </main>
  );
}
