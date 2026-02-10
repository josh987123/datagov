import type { DashboardData, FacetItem, RecentDataset, TimeSeriesPoint } from "../types";

const CKAN_BASE_URL = "https://catalog.data.gov/api/3/action";
const WINDOW_DAYS = [7, 30, 90, 365] as const;
const OPEN_LICENSE_IDS = new Set(["cc-by", "cc-zero", "us-pd", "odc-odbl", "gfdl"]);

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

interface CkanStatusResult {
  site_title?: string;
  ckan_version?: string;
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

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function toPercent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return round((part / total) * 100, 1);
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

  const [statusData, facetData, recentData] = await Promise.all([
    requestAction<CkanStatusResult>("status_show", {}, normalizedApiKey),
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
  const topGroups = facetToItems(facetData.search_facets, "groups", 10);
  const topFormats = formats.slice(0, 10);
  const licenses = facetToItems(facetData.search_facets, "license_id", 8, true);
  const topTags = facetToItems(facetData.search_facets, "tags", 12);
  const groupCount = facetToItems(facetData.search_facets, "groups", 1000).length;

  const updated7 = windowPairs.find((item) => item.days === 7)?.modified ?? 0;
  const created7 = windowPairs.find((item) => item.days === 7)?.created ?? 0;
  const updated30 = windowPairs.find((item) => item.days === 30)?.modified ?? 0;
  const created30 = windowPairs.find((item) => item.days === 30)?.created ?? 0;
  const updated90 = windowPairs.find((item) => item.days === 90)?.modified ?? 0;
  const updated365 = windowPairs.find((item) => item.days === 365)?.modified ?? 0;
  const created365 = windowPairs.find((item) => item.days === 365)?.created ?? 0;

  const activitySeries: TimeSeriesPoint[] = windowPairs.map((item) => ({
    label: getWindowLabel(item.days),
    modified: item.modified,
    created: item.created,
  }));

  const totalDatasets = facetData.count ?? 0;
  const freshnessScore =
    totalDatasets === 0 ? 0 : Math.min(100, Math.round((updated90 / totalDatasets) * 1000) / 10);

  const top3Formats = topFormats.slice(0, 3).reduce((sum, item) => sum + item.count, 0);
  const totalFormatCounts = formats.reduce((sum, item) => sum + item.count, 0);
  const openCount = licenses
    .filter((license) => OPEN_LICENSE_IDS.has(license.name))
    .reduce((sum, license) => sum + license.count, 0);
  const unspecifiedCount = licenses
    .filter((license) => license.name === "notspecified" || license.name === "unknown")
    .reduce((sum, license) => sum + license.count, 0);
  const restrictedCount = Math.max(totalDatasets - openCount - unspecifiedCount, 0);

  const publisherShares = topPublishers.slice(0, 8).map((publisher) => ({
    label: publisher.label,
    count: publisher.count,
    share: toPercent(publisher.count, totalDatasets),
  }));

  return {
    kpis: {
      totalDatasets,
      organizations: organizations.length,
      groups: groupCount,
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
    activitySeries,
    analytics: {
      freshnessBuckets: [
        { label: "0-30 days", count: updated30, share: toPercent(updated30, totalDatasets) },
        {
          label: "31-180 days",
          count: Math.max(updated90 - updated30, 0),
          share: toPercent(Math.max(updated90 - updated30, 0), totalDatasets),
        },
        {
          label: "181-365 days",
          count: Math.max(updated365 - updated90, 0),
          share: toPercent(Math.max(updated365 - updated90, 0), totalDatasets),
        },
        {
          label: "Over 1 year",
          count: Math.max(totalDatasets - updated365, 0),
          share: toPercent(Math.max(totalDatasets - updated365, 0), totalDatasets),
        },
      ],
      ageBuckets: [
        { label: "0-30 days", count: created30, share: toPercent(created30, totalDatasets) },
        {
          label: "31-365 days",
          count: Math.max(created365 - created30, 0),
          share: toPercent(Math.max(created365 - created30, 0), totalDatasets),
        },
        {
          label: "1-5 years",
          count: 0,
          share: 0,
        },
        {
          label: "Over 5 years",
          count: Math.max(totalDatasets - created365, 0),
          share: toPercent(Math.max(totalDatasets - created365, 0), totalDatasets),
        },
      ],
      dailyTrend: activitySeries.map((point) => ({
        label: point.label,
        modified: point.modified,
        created: point.created,
      })),
      monthlyTrend: [],
      publisherShares,
      resourceHistogram: [],
      velocity: {
        updatesPerDay30: round(updated30 / 30, 1),
        creationsPerDay30: round(created30 / 30, 1),
        updateToCreateRatio: created30 === 0 ? 0 : round(updated30 / created30, 2),
        weeklyMomentum:
          updated30 === 0 ? 0 : round(updated7 / ((updated30 / 30) * 7 || 1), 2),
      },
      concentration: {
        top1Share: toPercent(topPublishers[0]?.count ?? 0, totalDatasets),
        top5Share: toPercent(
          topPublishers.slice(0, 5).reduce((sum, item) => sum + item.count, 0),
          totalDatasets,
        ),
        top10Share: toPercent(
          topPublishers.slice(0, 10).reduce((sum, item) => sum + item.count, 0),
          totalDatasets,
        ),
        hhi: round(
          organizations.reduce((sum, item) => {
            const share = totalDatasets === 0 ? 0 : item.count / totalDatasets;
            return sum + share * share;
          }, 0) * 10000,
          1,
        ),
      },
      licenseSummary: {
        openCount,
        restrictedCount,
        unspecifiedCount,
        openShare: toPercent(openCount, totalDatasets),
        unspecifiedShare: toPercent(unspecifiedCount, totalDatasets),
      },
      resourceCoverage: {
        sampleSize: 0,
        totalResources: 0,
        avgResources: 0,
        medianResources: 0,
        maxResources: 0,
        datasetsWithNoResources: 0,
        noResourceShare: 0,
      },
      formatInsights: {
        top3Share: toPercent(top3Formats, totalFormatCounts),
        diversityScore: round(
          (1 -
            formats.reduce((sum, item) => {
              const share = totalFormatCounts === 0 ? 0 : item.count / totalFormatCounts;
              return sum + share * share;
            }, 0)) *
            100,
          1,
        ),
      },
      periodComparison: {
        updatedCurrent7Days: updated7,
        updatedPrevious7Days: 0,
        createdCurrent7Days: created7,
        createdPrevious7Days: 0,
        updatedDeltaPct: 0,
        createdDeltaPct: 0,
      },
      groupCoverage: {
        top3Share: toPercent(
          topGroups.slice(0, 3).reduce((sum, group) => sum + group.count, 0),
          totalDatasets,
        ),
      },
      alerts: [
        {
          id: "freshness",
          title: "Freshness health",
          level: freshnessScore < 30 ? "risk" : freshnessScore < 45 ? "watch" : "good",
          metric: `${freshnessScoreOrZero(freshnessScore)}%`,
          detail: "Share of datasets updated in the last 90 days.",
        },
      ],
    },
    economy: {
      snapshot: {
        population: 0,
        households: 0,
        medianIncome: 0,
        perCapitaIncome: 0,
        medianHomeValue: 0,
        medianRent: 0,
        medianAge: 0,
        giniIndex: 0,
        povertyRate: 0,
        internetAccessRate: 0,
        laborForce: 0,
        unemploymentPersons: 0,
        unemploymentRate: 0,
        unemploymentRate3mAvg: 0,
        unemploymentRateMoMDelta: 0,
        unemploymentRateYoYDelta: 0,
        underemploymentRate: 0,
        underemploymentGap: 0,
        longTermUnemploymentShare: 0,
        sahmRuleValue: 0,
        laborForceParticipationRate: 0,
        laborForceParticipationMoMDelta: 0,
        employmentPopulationRatio: 0,
        employmentPopulationMoMDelta: 0,
        nonfarmPayrollEmployment: 0,
        payrollMoMChange: 0,
        payrollYoYChange: 0,
        payroll3mAvgChange: 0,
        cpiIndex: 0,
        cpiMoM: 0,
        coreCpiIndex: 0,
        coreInflationYoY: 0,
        coreInflationMoM: 0,
        inflationGapToTarget: 0,
        inflationVsCoreSpread: 0,
        inflationYoY: 0,
        inflationYoY3mAvg: 0,
        averageHourlyEarnings: 0,
        hourlyEarningsMoM: 0,
        hourlyEarningsYoY: 0,
        hourlyEarningsYoY3mAvg: 0,
        averageWeeklyHours: 0,
        averageWeeklyHoursYoY: 0,
        weeklyEarnings: 0,
        weeklyEarningsYoY: 0,
        realWeeklyEarningsYoY: 0,
        realWageYoY: 0,
        realWageYoY3mAvg: 0,
        totalPublicDebt: 0,
        debtHeldByPublic: 0,
        intragovernmentalHoldings: 0,
        debtHeldByPublicShare: 0,
        intragovShare: 0,
        debtChange7Days: 0,
        debtChange30Days: 0,
        debtChange365Days: 0,
        debtChange7DaysPct: 0,
        debtChange30DaysPct: 0,
        debtChange365DaysPct: 0,
        debtYoYGrowthPct: 0,
        avgDailyDebtChange30: 0,
        debtDailyVolatility30: 0,
        maxDailyDebtIncrease30: 0,
        maxDailyDebtDecrease30: 0,
        debtPerCapita: 0,
        debtToIncomeRatio: 0,
        latestOutlays: 0,
        latestReceipts: 0,
        latestDeficit: 0,
        receiptsToOutlaysRatio: 0,
        deficitToOutlaysRatio: 0,
        deficitShare3mAvg: 0,
        outlays3mAvg: 0,
        receipts3mAvg: 0,
        outlaysPerCapita: 0,
        receiptsPerCapita: 0,
        deficitPerCapita: 0,
        trailing12Outlays: 0,
        trailing12Receipts: 0,
        trailing12Deficit: 0,
        avgMonthlyOutlays12: 0,
        avgMonthlyReceipts12: 0,
        avgMonthlyDeficit12: 0,
        deficitVolatility12: 0,
        deficitPeakToTrough12: 0,
        fiscalImpulseYoY: 0,
        outlaysYoY: 0,
        receiptsYoY: 0,
        deficitYoY: 0,
        deficitStreakMonths: 0,
        surplusMonthsLast12: 0,
        largestDeficitMonth: "N/A",
        largestDeficitAmount: 0,
        largestSurplusMonth: "N/A",
        largestSurplusAmount: 0,
        housingUnits: 0,
        vacantHousingUnits: 0,
        ownerOccupiedHousingUnits: 0,
        renterOccupiedHousingUnits: 0,
        vacancyRate: 0,
        homeownershipRate: 0,
        renterShareOfOccupied: 0,
        severeRentBurdenShare: 0,
        ownerCostBurdenShare: 0,
        singleFamilyHousingShare: 0,
        multiFamilyHousingShare: 0,
        mobileHomeShare: 0,
        personsPerHousehold: 0,
        childPopulationShare: 0,
        seniorPopulationShare: 0,
        workingAgePopulationShare: 0,
        dependencyRatio: 0,
        femalePopulationShare: 0,
        highSchoolOrHigherShare: 0,
        lessThanHighSchoolShare: 0,
        longCommuteShare: 0,
        zeroVehicleShare: 0,
        bachelorsOrHigherShare: 0,
        homeValueToIncomeRatio: 0,
        annualRentToIncomeRatio: 0,
        grossPrivateDomesticInvestment: null,
        personalSavingRate: null,
        beaDataAvailable: false,
      },
      trends: {
        monthlySpending: [],
        debtDaily: [],
        debtDailyChange: [],
        unemploymentRate: [],
        underemploymentRate: [],
        unemploymentGap: [],
        laborForceParticipationRate: [],
        employmentPopulationRatio: [],
        inflationYoY: [],
        coreInflationYoY: [],
        cpiMoM: [],
        hourlyEarningsYoY: [],
        hourlyEarningsMoM: [],
        weeklyEarningsYoY: [],
        realWageYoY: [],
        deficitShareOfOutlays: [],
        deficit3mAvg: [],
        outlays3mAvg: [],
        receipts3mAvg: [],
        nonfarmPayroll: [],
        payrollMoMChange: [],
      },
    },
    recentDatasets: (recentData.results ?? []).map(packageToRecentDataset),
    source: {
      siteTitle: statusData.site_title ?? "Catalog",
      ckanVersion: statusData.ckan_version ?? "unknown",
      apiBase: CKAN_BASE_URL,
      snapshotStrategy: "live fetch",
    },
    generatedAt: new Date().toISOString(),
  };
}

function freshnessScoreOrZero(score: number): string {
  if (!Number.isFinite(score)) {
    return "0.0";
  }

  return score.toFixed(1);
}
