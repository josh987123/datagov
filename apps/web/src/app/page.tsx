import Link from "next/link";
import { DashboardCard } from "@/components/dashboard-card";
import { StatusBadge } from "@/components/status-badge";
import { DatasetGrowthChart } from "@/components/charts/dataset-growth-chart";
import { ExposureTrendsChart } from "@/components/charts/exposure-trends-chart";
import { ScoreTrendsChart } from "@/components/charts/score-trends-chart";
import { InsightCard } from "@/components/insight-card";
import { ProgressMetric } from "@/components/progress-metric";
import { getIngestRuns, getMetricsInsights, getMetricsSummary, getMetricsTrends } from "@/lib/api";
import { formatCompactNumber, formatDateTime } from "@/lib/format";

export default async function HomePage() {
  const [summary, trends, insights, ingestRuns] = await Promise.all([
    getMetricsSummary(),
    getMetricsTrends(90),
    getMetricsInsights(90),
    getIngestRuns(12)
  ]);

  const healthTone = summary.brokenLinkCount > 0 ? "alert" : summary.staleDatasetShare > 0.35 ? "watch" : "positive";

  return (
    <main className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Total datasets" value={formatCompactNumber(summary.totalDatasets)} />
        <DashboardCard
          title="Added in last 7 days"
          value={formatCompactNumber(summary.datasetsAddedLast7Days)}
          trend="Publication cadence"
        />
        <DashboardCard
          title="Avg quality score"
          value={summary.averageQualityScore.toFixed(1)}
          subtitle="Metadata completeness + freshness"
          tone={summary.averageQualityScore >= 70 ? "positive" : "watch"}
        />
        <DashboardCard
          title="Avg openness score"
          value={summary.averageOpennessScore.toFixed(1)}
          subtitle="Open formats + API readiness"
          tone={summary.averageOpennessScore >= 65 ? "positive" : "watch"}
        />
        <DashboardCard
          title="Stale datasets"
          value={formatCompactNumber(summary.staleDatasetCount)}
          subtitle={`${(summary.staleDatasetShare * 100).toFixed(1)}% of catalog`}
          tone={summary.staleDatasetShare > 0.35 ? "alert" : "watch"}
        />
        <DashboardCard
          title="Open format coverage"
          value={`${(summary.openFormatShare * 100).toFixed(1)}%`}
          subtitle="Datasets with at least one open format signal"
          tone={summary.openFormatShare >= 0.6 ? "positive" : "watch"}
        />
        <DashboardCard
          title="API resource coverage"
          value={`${(summary.apiResourceShare * 100).toFixed(1)}%`}
          subtitle="Datasets exposing API-like access"
          tone={summary.apiResourceShare >= 0.4 ? "positive" : "default"}
        />
        <DashboardCard
          title="Broken links detected"
          value={formatCompactNumber(summary.brokenLinkCount)}
          subtitle="From latest optional link checks"
          tone={healthTone}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DatasetGrowthChart data={trends.totals} />
        <ScoreTrendsChart data={trends.totals} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ExposureTrendsChart data={trends.totals} />
        <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Catalog risk & readiness</h2>
          <ProgressMetric label="Stale share" valuePct={summary.staleDatasetShare * 100} tone="amber" />
          <ProgressMetric label="Open format share" valuePct={summary.openFormatShare * 100} tone="emerald" />
          <ProgressMetric label="API resource share" valuePct={summary.apiResourceShare * 100} tone="blue" />
          <ProgressMetric
            label="Healthy links (inverse of broken)"
            valuePct={Math.max(0, 100 - (summary.totalDatasets > 0 ? (summary.brokenLinkCount / summary.totalDatasets) * 100 : 0))}
            tone="rose"
          />
          {summary.lastIngest ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-700">Latest ingest run</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={summary.lastIngest.status} />
                <span>Started {formatDateTime(summary.lastIngest.startedAt)}</span>
              </div>
              <p className="mt-1">Processed {formatCompactNumber(summary.lastIngest.processedCount)} datasets.</p>
            </div>
          ) : null}
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-slate-700">Automated insights</h2>
          <Link href="/insights" className="text-sm font-semibold text-blue-700 hover:underline">
            View all insights
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {insights.insights.slice(0, 3).map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
          {insights.insights.length === 0 ? <p className="text-sm text-slate-500">No insights generated yet.</p> : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-slate-700">Top agencies by dataset count</h2>
            <Link href="/agencies" className="text-sm font-semibold text-blue-700 hover:underline">
              See agency leaderboard
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {summary.topAgencies.slice(0, 8).map((agency) => (
              <li key={agency.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-2">
                <Link href={`/agencies/${agency.id}`} className="truncate font-medium text-slate-700 hover:text-blue-700 hover:underline">
                  {agency.name}
                </Link>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{formatCompactNumber(agency.datasetCount)}</p>
                  <p className="text-xs text-slate-500">
                    Q {agency.avgQualityScore.toFixed(1)} / O {agency.avgOpennessScore.toFixed(1)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Ingest timeline</h2>
          <div className="mt-3 space-y-2">
            {ingestRuns.data.map((run) => (
              <div key={run.id} className="rounded-md border border-slate-100 p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700">Run #{run.id}</span>
                  <StatusBadge status={run.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">Started {formatDateTime(run.startedAt)}</p>
                <p className="text-xs text-slate-500">
                  Processed {formatCompactNumber(run.processedCount)} | Inserts {formatCompactNumber(run.insertedCount)} | Updates{" "}
                  {formatCompactNumber(run.updatedCount)}
                </p>
              </div>
            ))}
            {ingestRuns.data.length === 0 ? <p className="text-sm text-slate-500">No ingest runs available.</p> : null}
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Most common tags</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.mostCommonTags.slice(0, 20).map((tag) => (
            <span key={tag.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              {tag.name} ({formatCompactNumber(tag.datasetCount)})
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
