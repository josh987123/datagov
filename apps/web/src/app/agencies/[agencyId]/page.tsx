import Link from "next/link";
import { notFound } from "next/navigation";
import { AgencyDetailTrendChart } from "@/components/charts/agency-detail-trend-chart";
import { FreshnessBucketsChart } from "@/components/charts/freshness-buckets-chart";
import { DashboardCard } from "@/components/dashboard-card";
import { getAgencyDetail } from "@/lib/api";
import { formatCompactNumber, formatDate, formatPercent } from "@/lib/format";

interface AgencyDetailPageProps {
  params: Promise<{ agencyId: string }>;
  searchParams: Promise<{ days?: string }>;
}

export default async function AgencyDetailPage({ params, searchParams }: AgencyDetailPageProps) {
  const routeParams = await params;
  const queryParams = await searchParams;
  const agencyId = Number(routeParams.agencyId);
  if (!Number.isInteger(agencyId) || agencyId <= 0) {
    notFound();
  }

  const days = Math.min(365, Math.max(30, Number(queryParams.days ?? "180") || 180));
  const detail = await getAgencyDetail(agencyId, days).catch(() => null);
  if (!detail) {
    notFound();
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agency deep dive</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{detail.summary.name}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Detailed performance and metadata quality profile for a single publishing agency.
            </p>
          </div>
          <form method="GET" className="flex items-center gap-3">
            <label htmlFor="days" className="text-sm font-medium text-slate-700">
              Trend window
            </label>
            <select id="days" name="days" defaultValue={String(days)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="90">90</option>
              <option value="180">180</option>
              <option value="365">365</option>
            </select>
            <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Update
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Datasets" value={formatCompactNumber(detail.summary.datasetCount)} />
        <DashboardCard title="Avg quality score" value={detail.summary.avgQualityScore.toFixed(1)} />
        <DashboardCard title="Avg openness score" value={detail.summary.avgOpennessScore.toFixed(1)} />
        <DashboardCard title="30d growth" value={formatCompactNumber(detail.summary.growth30d)} />
        <DashboardCard title="90d growth" value={formatCompactNumber(detail.summary.growth90d)} />
        <DashboardCard title="Stale share" value={formatPercent(detail.summary.staleShare)} tone={detail.summary.staleShare > 0.35 ? "alert" : "watch"} />
        <DashboardCard title="Open format share" value={formatPercent(detail.summary.openFormatShare)} tone="positive" />
        <DashboardCard title="API resource share" value={formatPercent(detail.summary.apiResourceShare)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <AgencyDetailTrendChart data={detail.trend} />
        <FreshnessBucketsChart data={detail.freshnessBuckets} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Top tags</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.topTags.map((tag) => (
              <span key={tag.name} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                {tag.name} ({formatCompactNumber(tag.count)})
              </span>
            ))}
            {detail.topTags.length === 0 ? <p className="text-sm text-slate-500">No tags found for this agency.</p> : null}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Recent datasets</h3>
          <ul className="mt-3 space-y-2">
            {detail.recentDatasets.map((dataset) => (
              <li key={dataset.id} className="rounded-md border border-slate-100 p-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {dataset.sourceUrl ? (
                      <a href={dataset.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-700 hover:underline">
                        {dataset.title}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-slate-900">{dataset.title}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">Modified {formatDate(dataset.metadataModified)}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>Q {dataset.qualityScore.toFixed(1)}</p>
                    <p>O {dataset.opennessScore.toFixed(1)}</p>
                  </div>
                </div>
              </li>
            ))}
            {detail.recentDatasets.length === 0 ? <p className="text-sm text-slate-500">No datasets found.</p> : null}
          </ul>
        </article>
      </section>

      <section>
        <Link href="/agencies" className="text-sm font-semibold text-blue-700 hover:underline">
          Back to agency leaderboard
        </Link>
      </section>
    </main>
  );
}
