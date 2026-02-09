import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const CKAN_BASE_URL = "https://catalog.data.gov/api/3/action";
const WINDOW_DAYS = [7, 30, 90, 180, 365, 1825];
const DAILY_TREND_DAYS = 14;
const MONTHLY_TREND_MONTHS = 12;
const QUERY_CONCURRENCY = 4;
const RECENT_DATASET_ROWS = 30;
const RESOURCE_SAMPLE_ROWS = 200;
const OUTPUT_FILE = resolve(process.cwd(), "public", "dashboard-data.json");
const API_KEY =
  process.env.DATA_GOV_API_KEY?.trim() || process.env.VITE_DATA_GOV_API_KEY?.trim() || "";
const OPEN_LICENSE_IDS = new Set(["cc-by", "cc-zero", "us-pd", "odc-odbl", "gfdl"]);
const UNSPECIFIED_LICENSE_IDS = new Set(["notspecified", "unknown"]);

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

function round(value, digits = 1) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function toPercent(part, total) {
  if (total <= 0) {
    return 0;
  }

  return round((part / total) * 100, 1);
}

function percentChange(current, previous) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return round(((current - previous) / previous) * 100, 1);
}

function sumCounts(items) {
  return items.reduce((sum, item) => sum + item.count, 0);
}

function median(values) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return round((sorted[middle - 1] + sorted[middle]) / 2, 1);
  }

  return sorted[middle];
}

async function mapWithConcurrency(items, worker, concurrency = QUERY_CONCURRENCY) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        break;
      }

      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
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

async function fetchRangeCount(field, start, end) {
  try {
    const result = await requestAction("package_search", {
      rows: 0,
      fq: `${field}:[${start} TO ${end}]`,
    });

    return result.count ?? 0;
  } catch {
    return 0;
  }
}

function buildDailyTrend() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });

  const offsets = Array.from({ length: DAILY_TREND_DAYS }, (_, index) => DAILY_TREND_DAYS - index - 1);

  return offsets.map((offset) => {
    const dayDate = new Date(Date.now() - offset * 24 * 60 * 60 * 1000);
    return {
      label: formatter.format(dayDate),
      start: `NOW-${offset + 1}DAY/DAY`,
      end: `NOW-${offset}DAY/DAY`,
    };
  });
}

function buildMonthlyTrend() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });

  const offsets = Array.from(
    { length: MONTHLY_TREND_MONTHS },
    (_, index) => MONTHLY_TREND_MONTHS - index - 1,
  );

  return offsets.map((offset) => {
    const monthDate = new Date();
    monthDate.setUTCDate(1);
    monthDate.setUTCHours(0, 0, 0, 0);
    monthDate.setUTCMonth(monthDate.getUTCMonth() - offset - 1);

    return {
      label: formatter.format(monthDate),
      start: `NOW-${offset + 1}MONTH/MONTH`,
      end: `NOW-${offset}MONTH/MONTH`,
    };
  });
}

function toAlertLevel(metricValue, watchThreshold, riskThreshold, direction = "higher-is-risk") {
  if (direction === "higher-is-risk") {
    if (metricValue >= riskThreshold) {
      return "risk";
    }

    if (metricValue >= watchThreshold) {
      return "watch";
    }

    return "good";
  }

  if (metricValue <= riskThreshold) {
    return "risk";
  }

  if (metricValue <= watchThreshold) {
    return "watch";
  }

  return "good";
}

async function generateDashboardData() {
  const [statusData, facetData, recentData, resourceSampleData] = await Promise.all([
    requestAction("status_show", {}),
    requestAction("package_search", {
      rows: 0,
      facet: true,
      "facet.limit": 1000,
      "facet.field": JSON.stringify(["organization", "res_format", "license_id", "tags", "groups"]),
    }),
    requestAction("package_search", {
      rows: RECENT_DATASET_ROWS,
      sort: "metadata_modified desc",
    }),
    requestAction("package_search", {
      rows: RESOURCE_SAMPLE_ROWS,
      sort: "metadata_modified desc",
    }),
  ]);

  const windowPairs = await mapWithConcurrency(WINDOW_DAYS, async (days) => {
    const [modified, created] = await Promise.all([
      fetchWindowCount("metadata_modified", days),
      fetchWindowCount("metadata_created", days),
    ]);

    return { days, modified, created };
  });

  const dailyRanges = buildDailyTrend();
  const dailyTrend = await mapWithConcurrency(dailyRanges, async (range) => {
    const [modified, created] = await Promise.all([
      fetchRangeCount("metadata_modified", range.start, range.end),
      fetchRangeCount("metadata_created", range.start, range.end),
    ]);

    return {
      label: range.label,
      modified,
      created,
    };
  });

  const monthlyRanges = buildMonthlyTrend();
  const monthlyTrend = await mapWithConcurrency(monthlyRanges, async (range) => {
    const [modified, created] = await Promise.all([
      fetchRangeCount("metadata_modified", range.start, range.end),
      fetchRangeCount("metadata_created", range.start, range.end),
    ]);

    return {
      label: range.label,
      modified,
      created,
    };
  });

  const [updatedPrevious7Days, createdPrevious7Days] = await Promise.all([
    fetchRangeCount("metadata_modified", "NOW-14DAY/DAY", "NOW-7DAY/DAY"),
    fetchRangeCount("metadata_created", "NOW-14DAY/DAY", "NOW-7DAY/DAY"),
  ]);

  const organizations = facetToItems(facetData.search_facets, "organization", 1000, true);
  const knownOrganizations = organizations.filter((organization) => organization.name !== "unknown");
  const formats = facetToItems(facetData.search_facets, "res_format", 1000, true).filter(
    (format) => format.name !== "unknown",
  );
  const licensesAll = facetToItems(facetData.search_facets, "license_id", 1000, true);

  const topPublishers = knownOrganizations.slice(0, 10);
  const topGroups = facetToItems(facetData.search_facets, "groups", 10);
  const topFormats = formats.slice(0, 10);
  const licenses = facetToItems(facetData.search_facets, "license_id", 8);
  const topTags = facetToItems(facetData.search_facets, "tags", 12);
  const groups = facetToItems(facetData.search_facets, "groups", 1000);

  const updated7 = windowPairs.find((item) => item.days === 7)?.modified ?? 0;
  const created7 = windowPairs.find((item) => item.days === 7)?.created ?? 0;
  const updated30 = windowPairs.find((item) => item.days === 30)?.modified ?? 0;
  const created30 = windowPairs.find((item) => item.days === 30)?.created ?? 0;
  const updated90 = windowPairs.find((item) => item.days === 90)?.modified ?? 0;
  const updated180 = windowPairs.find((item) => item.days === 180)?.modified ?? 0;
  const created365 = windowPairs.find((item) => item.days === 365)?.created ?? 0;
  const updated365 = windowPairs.find((item) => item.days === 365)?.modified ?? 0;
  const created1825 = windowPairs.find((item) => item.days === 1825)?.created ?? 0;
  const totalDatasets = facetData.count ?? 0;
  const freshnessScore =
    totalDatasets === 0 ? 0 : Math.min(100, Math.round((updated90 / totalDatasets) * 1000) / 10);

  const freshnessBuckets = [
    { label: "0-30 days", count: updated30 },
    { label: "31-180 days", count: Math.max(updated180 - updated30, 0) },
    { label: "181-365 days", count: Math.max(updated365 - updated180, 0) },
    { label: "Over 1 year", count: Math.max(totalDatasets - updated365, 0) },
  ].map((bucket) => ({
    ...bucket,
    share: toPercent(bucket.count, totalDatasets),
  }));

  const ageBuckets = [
    { label: "0-30 days", count: created30 },
    { label: "31-365 days", count: Math.max(created365 - created30, 0) },
    { label: "1-5 years", count: Math.max(created1825 - created365, 0) },
    { label: "Over 5 years", count: Math.max(totalDatasets - created1825, 0) },
  ].map((bucket) => ({
    ...bucket,
    share: toPercent(bucket.count, totalDatasets),
  }));

  const publisherCounts = topPublishers.map((publisher) => publisher.count);
  const top1Share = toPercent(publisherCounts[0] ?? 0, totalDatasets);
  const top5Share = toPercent(publisherCounts.slice(0, 5).reduce((sum, count) => sum + count, 0), totalDatasets);
  const top10Share = toPercent(
    publisherCounts.slice(0, 10).reduce((sum, count) => sum + count, 0),
    totalDatasets,
  );
  const hhi = round(
    knownOrganizations.reduce((sum, organization) => {
      const share = totalDatasets === 0 ? 0 : organization.count / totalDatasets;
      return sum + share * share;
    }, 0) * 10000,
    1,
  );

  const publisherShares = topPublishers.slice(0, 8).map((publisher) => ({
    label: publisher.label,
    count: publisher.count,
    share: toPercent(publisher.count, totalDatasets),
  }));

  const licenseTotalFromFacet = sumCounts(licensesAll);
  const missingLicenseCount = Math.max(totalDatasets - licenseTotalFromFacet, 0);
  const openCount = licensesAll
    .filter((license) => OPEN_LICENSE_IDS.has(license.name))
    .reduce((sum, license) => sum + license.count, 0);
  const unspecifiedFacetCount = licensesAll
    .filter((license) => UNSPECIFIED_LICENSE_IDS.has(license.name))
    .reduce((sum, license) => sum + license.count, 0);
  const unspecifiedCount = unspecifiedFacetCount + missingLicenseCount;
  const restrictedCount = Math.max(totalDatasets - openCount - unspecifiedCount, 0);
  const openShare = toPercent(openCount, totalDatasets);
  const unspecifiedShare = toPercent(unspecifiedCount, totalDatasets);

  const totalFormatAssignments = sumCounts(formats);
  const top3FormatAssignments = topFormats.slice(0, 3).reduce((sum, format) => sum + format.count, 0);
  const formatTop3Share = toPercent(top3FormatAssignments, totalFormatAssignments);
  const formatDiversityScore = round(
    (1 -
      formats.reduce((sum, format) => {
        const share = totalFormatAssignments === 0 ? 0 : format.count / totalFormatAssignments;
        return sum + share * share;
      }, 0)) *
      100,
    1,
  );

  const resourceCounts = (resourceSampleData.results ?? []).map((dataset) => dataset.resources?.length ?? 0);
  const totalResources = resourceCounts.reduce((sum, count) => sum + count, 0);
  const sampleSize = resourceCounts.length;
  const zeroResourceCount = resourceCounts.filter((count) => count === 0).length;
  const resourceHistogram = [
    { label: "0", count: resourceCounts.filter((count) => count === 0).length },
    { label: "1", count: resourceCounts.filter((count) => count === 1).length },
    { label: "2-5", count: resourceCounts.filter((count) => count >= 2 && count <= 5).length },
    { label: "6-10", count: resourceCounts.filter((count) => count >= 6 && count <= 10).length },
    { label: "11+", count: resourceCounts.filter((count) => count >= 11).length },
  ];

  const updatesPerDay30 = round(updated30 / 30, 1);
  const creationsPerDay30 = round(created30 / 30, 1);
  const updateToCreateRatio = created30 === 0 ? 0 : round(updated30 / created30, 2);
  const baselineWeek = (updated30 / 30) * 7;
  const weeklyMomentum = baselineWeek === 0 ? 0 : round(updated7 / baselineWeek, 2);

  const alerts = [
    {
      id: "freshness",
      title: "Freshness health",
      level: toAlertLevel(freshnessScore, 45, 30, "lower-is-risk"),
      metric: `${freshnessScore}%`,
      detail: "Share of datasets updated in the last 90 days.",
    },
    {
      id: "license-clarity",
      title: "License clarity",
      level: toAlertLevel(unspecifiedShare, 20, 35),
      metric: `${unspecifiedShare}%`,
      detail: "Datasets with unspecified or missing license identifiers.",
    },
    {
      id: "publisher-concentration",
      title: "Publisher concentration",
      level: toAlertLevel(top1Share, 25, 40),
      metric: `${top1Share}%`,
      detail: "Share of catalog held by the largest publisher.",
    },
    {
      id: "resource-completeness",
      title: "Resource completeness",
      level: toAlertLevel(toPercent(zeroResourceCount, sampleSize), 15, 30),
      metric: `${toPercent(zeroResourceCount, sampleSize)}%`,
      detail: "Recent sampled datasets with zero resources attached.",
    },
    {
      id: "weekly-momentum",
      title: "Weekly momentum",
      level: toAlertLevel(weeklyMomentum, 0.95, 0.75, "lower-is-risk"),
      metric: `${weeklyMomentum}x`,
      detail: "Current 7-day updates versus the 30-day baseline.",
    },
  ];

  return {
    kpis: {
      totalDatasets,
      organizations: knownOrganizations.length,
      groups: groups.length,
      distinctFormats: formats.length,
      updatedLast7Days: updated7,
      createdLast7Days: created7,
      updatedLast30Days: updated30,
      createdLast30Days: created30,
      updatedLast90Days: updated90,
      updatedLast365Days: updated365,
      freshnessScore,
    },
    topPublishers,
    topGroups,
    topFormats,
    licenses,
    topTags,
    activitySeries: windowPairs.map((item) => ({
      label: getWindowLabel(item.days),
      modified: item.modified,
      created: item.created,
    })),
    analytics: {
      freshnessBuckets,
      ageBuckets,
      dailyTrend,
      monthlyTrend,
      publisherShares,
      resourceHistogram,
      velocity: {
        updatesPerDay30,
        creationsPerDay30,
        updateToCreateRatio,
        weeklyMomentum,
      },
      concentration: {
        top1Share,
        top5Share,
        top10Share,
        hhi,
      },
      licenseSummary: {
        openCount,
        restrictedCount,
        unspecifiedCount,
        openShare,
        unspecifiedShare,
      },
      resourceCoverage: {
        sampleSize,
        totalResources,
        avgResources: sampleSize === 0 ? 0 : round(totalResources / sampleSize, 1),
        medianResources: median(resourceCounts),
        maxResources: sampleSize === 0 ? 0 : Math.max(...resourceCounts),
        datasetsWithNoResources: zeroResourceCount,
        noResourceShare: toPercent(zeroResourceCount, sampleSize),
      },
      formatInsights: {
        top3Share: formatTop3Share,
        diversityScore: formatDiversityScore,
      },
      periodComparison: {
        updatedCurrent7Days: updated7,
        updatedPrevious7Days,
        createdCurrent7Days: created7,
        createdPrevious7Days,
        updatedDeltaPct: percentChange(updated7, updatedPrevious7Days),
        createdDeltaPct: percentChange(created7, createdPrevious7Days),
      },
      groupCoverage: {
        top3Share: toPercent(
          topGroups.slice(0, 3).reduce((sum, group) => sum + group.count, 0),
          totalDatasets,
        ),
      },
      alerts,
    },
    recentDatasets: (recentData.results ?? []).map(packageToRecentDataset),
    source: {
      siteTitle: statusData?.site_title ?? "Catalog",
      ckanVersion: statusData?.ckan_version ?? "unknown",
      apiBase: CKAN_BASE_URL,
      snapshotStrategy: "build-time static snapshot",
    },
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
