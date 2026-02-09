import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const CKAN_BASE_URL = "https://catalog.data.gov/api/3/action";
const WINDOW_DAYS = [7, 30, 90, 365];
const OUTPUT_FILE = resolve(process.cwd(), "public", "dashboard-data.json");
const API_KEY =
  process.env.DATA_GOV_API_KEY?.trim() || process.env.VITE_DATA_GOV_API_KEY?.trim() || "";

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function toQueryString(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }
  return search.toString();
}

async function requestAction(action, params, maxAttempts = 3) {
  const query = toQueryString(params);
  const url = `${CKAN_BASE_URL}/${action}?${query}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(API_KEY ? { "X-CKAN-API-Key": API_KEY } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error?.message ?? `Action failed: ${action}`);
      }

      return payload.result;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await sleep(300 * 2 ** attempt);
    }
  }

  throw new Error("Unreachable request state");
}

function facetToItems(facets, key, limit, includeUnknown = false) {
  const items = facets?.[key]?.items ?? [];

  const normalized = items
    .filter((item) => item.count > 0)
    .map((item) => {
      const fallbackName = item.display_name?.trim() || item.name?.trim() || "Unknown";
      const label = fallbackName.length > 0 ? fallbackName : "Unknown";
      return {
        name: item.name || "unknown",
        label,
        count: item.count,
      };
    })
    .filter((item) => (includeUnknown ? true : item.name !== "unknown"))
    .sort((a, b) => b.count - a.count);

  return normalized.slice(0, limit);
}

function packageToRecentDataset(record) {
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

function getWindowLabel(days) {
  return days >= 365 ? "Last 12 months" : `Last ${days} days`;
}

async function fetchWindowCount(field, days) {
  try {
    const result = await requestAction("package_search", {
      rows: 0,
      fq: `${field}:[NOW-${days}DAY TO NOW]`,
    });

    return result.count ?? 0;
  } catch {
    return 0;
  }
}

async function generateDashboardData() {
  const [facetData, recentData] = await Promise.all([
    requestAction("package_search", {
      rows: 0,
      facet: true,
      "facet.limit": 1000,
      "facet.field": JSON.stringify(["organization", "res_format", "license_id", "tags", "groups"]),
    }),
    requestAction("package_search", {
      rows: 12,
      sort: "metadata_modified desc",
    }),
  ]);

  const windowPairs = await Promise.all(
    WINDOW_DAYS.map(async (days) => {
      const [modified, created] = await Promise.all([
        fetchWindowCount("metadata_modified", days),
        fetchWindowCount("metadata_created", days),
      ]);

      return { days, modified, created };
    }),
  );

  const organizations = facetToItems(facetData.search_facets, "organization", 1000);
  const formats = facetToItems(facetData.search_facets, "res_format", 1000);

  const topPublishers = organizations.slice(0, 10);
  const topFormats = formats.slice(0, 10);
  const licenses = facetToItems(facetData.search_facets, "license_id", 8);
  const topTags = facetToItems(facetData.search_facets, "tags", 12);
  const groups = facetToItems(facetData.search_facets, "groups", 1000);

  const updated30 = windowPairs.find((item) => item.days === 30)?.modified ?? 0;
  const created30 = windowPairs.find((item) => item.days === 30)?.created ?? 0;
  const updated90 = windowPairs.find((item) => item.days === 90)?.modified ?? 0;
  const totalDatasets = facetData.count ?? 0;
  const freshnessScore =
    totalDatasets === 0 ? 0 : Math.min(100, Math.round((updated90 / totalDatasets) * 1000) / 10);

  return {
    kpis: {
      totalDatasets,
      organizations: organizations.length,
      groups: groups.length,
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
    activitySeries: windowPairs.map((item) => ({
      label: getWindowLabel(item.days),
      modified: item.modified,
      created: item.created,
    })),
    recentDatasets: (recentData.results ?? []).map(packageToRecentDataset),
    generatedAt: new Date().toISOString(),
  };
}

async function main() {
  const dashboardData = await generateDashboardData();
  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(dashboardData, null, 2)}\n`, "utf8");

  console.log(
    `Generated dashboard-data.json with ${dashboardData.kpis.totalDatasets} datasets at ${dashboardData.generatedAt}`,
  );
}

main().catch((error) => {
  console.error("Failed to generate dashboard snapshot:", error);
  process.exit(1);
});
