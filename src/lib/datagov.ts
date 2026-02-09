import type { DashboardData, FacetItem, RecentDataset, TimeSeriesPoint } from "../types";

const CKAN_BASE_URL = "https://catalog.data.gov/api/3/action";
const WINDOW_DAYS = [7, 30, 90, 365] as const;

interface CkanResponse<T> {
  success: boolean;
  result: T;
  error?: {
    message?: string;
  };
}

interface CkanFacetValue {
  name: string;
  display_name: string;
  count: number;
}

interface CkanSearchFacets {
  [key: string]: {
    title: string;
    items: CkanFacetValue[];
  };
}

interface CkanPackage {
  id: string;
  title: string;
  metadata_modified: string;
  metadata_created: string;
  organization?: {
    title?: string;
    name?: string;
  };
  resources?: Array<{
    format?: string | null;
  }>;
}

interface CkanPackageSearchResult {
  count: number;
  search_facets?: CkanSearchFacets;
  results?: CkanPackage[];
}

function encodeParams(params: Record<string, string | number | boolean>): URLSearchParams {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    query.set(key, String(value));
  });

  return query;
}

async function requestAction<T>(
  action: string,
  params: Record<string, string | number | boolean>,
  apiKey?: string,
): Promise<T> {
  const query = encodeParams(params);
  const url = `${CKAN_BASE_URL}/${action}?${query.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(apiKey ? { "X-CKAN-API-Key": apiKey } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Data.gov request failed (${response.status})`);
  }

  const payload = (await response.json()) as CkanResponse<T>;

  if (!payload.success) {
    throw new Error(payload.error?.message ?? `Action failed: ${action}`);
  }

  return payload.result;
}

function facetToItems(
  facets: CkanSearchFacets | undefined,
  key: string,
  limit: number,
  includeUnknown = false,
): FacetItem[] {
  const items = facets?.[key]?.items ?? [];

  const normalized = items
    .filter((item) => item.count > 0)
    .map((item) => {
      const trimmedName = item.display_name?.trim() || item.name?.trim() || "Unknown";
      return {
        name: item.name || "unknown",
        label: trimmedName.length > 0 ? trimmedName : "Unknown",
        count: item.count,
      };
    })
    .filter((item) => (includeUnknown ? true : item.name !== "unknown"))
    .sort((a, b) => b.count - a.count);

  return normalized.slice(0, limit);
}

function packageToRecentDataset(record: CkanPackage): RecentDataset {
  const uniqueFormats = Array.from(
    new Set(
      (record.resources ?? [])
        .map((resource) => (resource.format ?? "").trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  return {
    id: record.id,
    title: record.title ?? "Untitled dataset",
    organization: record.organization?.title ?? record.organization?.name ?? "Unknown publisher",
    metadataModified: record.metadata_modified,
    metadataCreated: record.metadata_created,
    resourceCount: record.resources?.length ?? 0,
    formats: uniqueFormats.slice(0, 3),
  };
}

function getWindowLabel(days: number): string {
  return days >= 365 ? "Last 12 months" : `Last ${days} days`;
}

async function fetchWindowCount(
  field: "metadata_modified" | "metadata_created",
  days: number,
  apiKey?: string,
): Promise<number> {
  try {
    const fq = `${field}:[NOW-${days}DAY TO NOW]`;

    const result = await requestAction<CkanPackageSearchResult>(
      "package_search",
      {
        rows: 0,
        fq,
      },
      apiKey,
    );

    return result.count ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchDashboardData(apiKey?: string): Promise<DashboardData> {
  const normalizedApiKey = apiKey?.trim();

  const [facetData, recentData] = await Promise.all([
    requestAction<CkanPackageSearchResult>(
      "package_search",
      {
        rows: 0,
        facet: true,
        "facet.limit": 1000,
        "facet.field": JSON.stringify([
          "organization",
          "res_format",
          "license_id",
          "tags",
          "groups",
        ]),
      },
      normalizedApiKey,
    ),
    requestAction<CkanPackageSearchResult>(
      "package_search",
      {
        rows: 12,
        sort: "metadata_modified desc",
      },
      normalizedApiKey,
    ),
  ]);

  const windowPairs = await Promise.all(
    WINDOW_DAYS.map(async (days) => {
      const [modified, created] = await Promise.all([
        fetchWindowCount("metadata_modified", days, normalizedApiKey),
        fetchWindowCount("metadata_created", days, normalizedApiKey),
      ]);

      return {
        days,
        modified,
        created,
      };
    }),
  );

  const organizations = facetToItems(facetData.search_facets, "organization", 1000);
  const formats = facetToItems(facetData.search_facets, "res_format", 1000);

  const topPublishers = organizations.slice(0, 10);
  const topFormats = formats.slice(0, 10);
  const licenses = facetToItems(facetData.search_facets, "license_id", 8);
  const topTags = facetToItems(facetData.search_facets, "tags", 12);
  const groupCount = facetToItems(facetData.search_facets, "groups", 1000).length;

  const updated30 = windowPairs.find((item) => item.days === 30)?.modified ?? 0;
  const created30 = windowPairs.find((item) => item.days === 30)?.created ?? 0;
  const updated90 = windowPairs.find((item) => item.days === 90)?.modified ?? 0;

  const activitySeries: TimeSeriesPoint[] = windowPairs.map((item) => ({
    label: getWindowLabel(item.days),
    modified: item.modified,
    created: item.created,
  }));

  const totalDatasets = facetData.count ?? 0;
  const freshnessScore =
    totalDatasets === 0 ? 0 : Math.min(100, Math.round((updated90 / totalDatasets) * 1000) / 10);

  return {
    kpis: {
      totalDatasets,
      organizations: organizations.length,
      groups: groupCount,
      distinctFormats: formats.length,
      updatedLast30Days: updated30,
      createdLast30Days: created30,
      updatedLast90Days: updated90,
      freshnessScore,
    },
    topPublishers,
    topFormats,
    licenses,
    topTags,
    activitySeries,
    recentDatasets: (recentData.results ?? []).map(packageToRecentDataset),
    generatedAt: new Date().toISOString(),
  };
}
