import Link from "next/link";
import { getDatasets } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface DatasetsPageProps {
  searchParams: Promise<{
    search?: string;
    agency?: string;
    tag?: string;
    minQuality?: string;
    staleOnly?: string;
    sort?: "recent" | "quality" | "openness" | "freshness";
    page?: string;
  }>;
}

function buildPageHref(current: URLSearchParams, nextPage: number): string {
  const params = new URLSearchParams(current);
  params.set("page", String(nextPage));
  return `/datasets?${params.toString()}`;
}

export default async function DatasetsPage({ searchParams }: DatasetsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const search = params.search ?? "";
  const agency = params.agency ?? "";
  const tag = params.tag ?? "";
  const sort = params.sort ?? "recent";
  const minQualityRaw = params.minQuality ?? "";
  const minQuality = Number(minQualityRaw);
  const hasMinQuality = minQualityRaw !== "" && Number.isFinite(minQuality) && minQuality >= 0;
  const staleOnly = params.staleOnly === "true";

  const result = await getDatasets({
    search: search || undefined,
    agency: agency || undefined,
    tag: tag || undefined,
    minQuality: hasMinQuality ? minQuality : undefined,
    staleOnly,
    sort,
    page,
    pageSize: 25
  });

  const currentParams = new URLSearchParams();
  if (search) currentParams.set("search", search);
  if (agency) currentParams.set("agency", agency);
  if (tag) currentParams.set("tag", tag);
  if (hasMinQuality) currentParams.set("minQuality", String(minQuality));
  if (staleOnly) currentParams.set("staleOnly", "true");
  if (sort) currentParams.set("sort", sort);
  currentParams.set("page", String(page));

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Datasets</h2>
        <p className="mt-1 text-sm text-slate-600">
          Search and filter by agency, tag, quality, staleness, and sorting mode.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6" method="GET">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search title, notes, ID"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            name="agency"
            defaultValue={agency}
            placeholder="Agency filter"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            name="tag"
            defaultValue={tag}
            placeholder="Tag filter"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            name="minQuality"
            defaultValue={hasMinQuality ? String(minQuality) : ""}
            placeholder="Min quality"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select name="sort" defaultValue={sort} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="recent">Sort: recent</option>
            <option value="quality">Sort: quality</option>
            <option value="openness">Sort: openness</option>
            <option value="freshness">Sort: freshness</option>
          </select>
          <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" name="staleOnly" value="true" defaultChecked={staleOnly} />
            Stale only
          </label>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply filters
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Agency</th>
                <th className="px-4 py-3 font-semibold">Tags</th>
                <th className="px-4 py-3 font-semibold">Quality</th>
                <th className="px-4 py-3 font-semibold">Openness</th>
                <th className="px-4 py-3 font-semibold">Freshness</th>
                <th className="px-4 py-3 font-semibold">Link status</th>
                <th className="px-4 py-3 font-semibold">Modified</th>
                <th className="px-4 py-3 font-semibold">First seen</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((dataset) => (
                <tr key={dataset.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 align-top">
                    {dataset.sourceUrl ? (
                      <a href={dataset.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-700 hover:underline">
                        {dataset.title}
                      </a>
                    ) : (
                      <span className="font-medium text-slate-900">{dataset.title}</span>
                    )}
                    <p className="mt-1 text-xs text-slate-500">{dataset.ckanId}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-slate-700">{dataset.agency ?? "—"}</td>
                  <td className="px-4 py-3 align-top text-slate-700">{dataset.tags.slice(0, 4).join(", ") || "—"}</td>
                  <td className="px-4 py-3 align-top text-slate-700">{dataset.qualityScore.toFixed(1)}</td>
                  <td className="px-4 py-3 align-top text-slate-700">{dataset.opennessScore.toFixed(1)}</td>
                  <td className="px-4 py-3 align-top text-slate-700">{dataset.freshnessScore.toFixed(1)}</td>
                  <td className="px-4 py-3 align-top text-slate-700">
                    {dataset.linkStatus}
                    {dataset.linkHttpStatus ? <span className="ml-1 text-xs text-slate-500">({dataset.linkHttpStatus})</span> : null}
                  </td>
                  <td className="px-4 py-3 align-top text-slate-700">{formatDate(dataset.metadataModified)}</td>
                  <td className="px-4 py-3 align-top text-slate-700">{formatDate(dataset.firstSeenAt)}</td>
                </tr>
              ))}
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No datasets match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <p className="text-slate-600">
          Page {result.page} of {result.totalPages} ({result.total.toLocaleString()} datasets)
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
