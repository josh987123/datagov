import Link from "next/link";
import { getDatasets } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface DatasetsPageProps {
  searchParams: Promise<{
    search?: string;
    agency?: string;
    tag?: string;
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

  const result = await getDatasets({
    search: search || undefined,
    agency: agency || undefined,
    tag: tag || undefined,
    page,
    pageSize: 25
  });

  const currentParams = new URLSearchParams();
  if (search) currentParams.set("search", search);
  if (agency) currentParams.set("agency", agency);
  if (tag) currentParams.set("tag", tag);
  currentParams.set("page", String(page));

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Datasets</h2>
        <p className="mt-1 text-sm text-slate-600">Search and filter by agency or tag.</p>
        <form className="mt-4 grid gap-3 md:grid-cols-4" method="GET">
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
                  <td className="px-4 py-3 align-top text-slate-700">{formatDate(dataset.metadataModified)}</td>
                  <td className="px-4 py-3 align-top text-slate-700">{formatDate(dataset.firstSeenAt)}</td>
                </tr>
              ))}
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
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
