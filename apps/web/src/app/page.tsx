import { DashboardCard } from "@/components/dashboard-card";
import { StatusBadge } from "@/components/status-badge";
import { DatasetGrowthChart } from "@/components/charts/dataset-growth-chart";
import { getMetricsSummary, getMetricsTrends } from "@/lib/api";
import { formatCompactNumber, formatDateTime } from "@/lib/format";

export default async function HomePage() {
  const [summary, trends] = await Promise.all([getMetricsSummary(), getMetricsTrends(30)]);

  return (
    <main className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <DashboardCard title="Total datasets" value={formatCompactNumber(summary.totalDatasets)} />
        <DashboardCard title="Added in last 7 days" value={formatCompactNumber(summary.datasetsAddedLast7Days)} />
        <DashboardCard title="Added in last 30 days" value={formatCompactNumber(summary.datasetsAddedLast30Days)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <DatasetGrowthChart data={trends.totals} />
        <aside className="space-y-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Last ingest run</h2>
            {summary.lastIngest ? (
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <StatusBadge status={summary.lastIngest.status} />
                <p>Started: {formatDateTime(summary.lastIngest.startedAt)}</p>
                <p>Finished: {formatDateTime(summary.lastIngest.finishedAt)}</p>
                <p>Processed: {formatCompactNumber(summary.lastIngest.processedCount)}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No ingest runs yet.</p>
            )}
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Top agencies</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {summary.topAgencies.slice(0, 6).map((agency) => (
                <li key={agency.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-slate-700">{agency.name}</span>
                  <span className="font-medium text-slate-900">{formatCompactNumber(agency.datasetCount)}</span>
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Most common tags</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.mostCommonTags.slice(0, 16).map((tag) => (
            <span key={tag.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {tag.name} ({formatCompactNumber(tag.datasetCount)})
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
