import Link from "next/link";
import { getAgencies } from "@/lib/api";
import { formatCompactNumber, formatPercent } from "@/lib/format";

interface AgenciesPageProps {
  searchParams: Promise<{
    search?: string;
    minQuality?: string;
    page?: string;
  }>;
}

function buildPageHref(current: URLSearchParams, nextPage: number): string {
  const params = new URLSearchParams(current);
  params.set("page", String(nextPage));
  return `/agencies?${params.toString()}`;
}

export default async function AgenciesPage({ searchParams }: AgenciesPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const search = params.search ?? "";
  const minQualityRaw = params.minQuality ?? "";
  const minQuality = Number(minQualityRaw);
  const hasMinQuality = minQualityRaw !== "" && Number.isFinite(minQuality) && minQuality >= 0;

  const result = await getAgencies({
    search: search || undefined,
    minQuality: hasMinQuality ? minQuality : undefined,
    page,
    pageSize: 25
  });

  const currentParams = new URLSearchParams();
  if (search) currentParams.set("search", search);
  if (hasMinQuality) currentParams.set("minQuality", String(minQuality));
  currentParams.set("page", String(page));

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Agency leaderboard</h2>
        <p className="mt-1 text-sm text-slate-600">
          Compare agency publication scale, quality, openness, and recent momentum.
        </p>
        <form method="GET" className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search agency name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            name="minQuality"
            defaultValue={hasMinQuality ? String(minQuality) : ""}
            placeholder="Min avg quality score"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Apply
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Rank</th>
                <th className="px-4 py-3 font-semibold">Agency</th>
                <th className="px-4 py-3 font-semibold">Datasets</th>
                <th className="px-4 py-3 font-semibold">Quality</th>
                <th className="px-4 py-3 font-semibold">Openness</th>
                <th className="px-4 py-3 font-semibold">Stale share</th>
                <th className="px-4 py-3 font-semibold">Open format share</th>
                <th className="px-4 py-3 font-semibold">30d growth</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((agency) => (
                <tr key={agency.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600">#{agency.rank}</td>
                  <td className="px-4 py-3">
                    <Link href={`/agencies/${agency.id}`} className="font-medium text-blue-700 hover:underline">
                      {agency.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatCompactNumber(agency.datasetCount)}</td>
                  <td className="px-4 py-3 text-slate-700">{agency.avgQualityScore.toFixed(1)}</td>
                  <td className="px-4 py-3 text-slate-700">{agency.avgOpennessScore.toFixed(1)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatPercent(agency.staleShare)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatPercent(agency.openFormatShare)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatCompactNumber(agency.growth30d)}</td>
                </tr>
              ))}
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No agencies match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <p className="text-slate-600">
          Page {result.page} of {result.totalPages} ({formatCompactNumber(result.total)} agencies)
        </p>
        <div className="flex items-center gap-2">
          {result.page > 1 ? (
            <Link href={buildPageHref(currentParams, result.page - 1)} className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
              Previous
            </Link>
          ) : (
            <span className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-400">Previous</span>
          )}
          {result.page < result.totalPages ? (
            <Link href={buildPageHref(currentParams, result.page + 1)} className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
              Next
            </Link>
          ) : (
            <span className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-400">Next</span>
          )}
        </div>
      </section>
    </main>
  );
}
