import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const CKAN_BASE_URL = "https://catalog.data.gov/api/3/action";
const WINDOW_DAYS = [7, 30, 90, 180, 365, 1825];
const DAILY_TREND_DAYS = 14;
const MONTHLY_TREND_MONTHS = 60;
const QUERY_CONCURRENCY = 4;
const RECENT_DATASET_ROWS = 30;
const RESOURCE_SAMPLE_ROWS = 200;
const BLS_HISTORY_YEARS = 12;
const SPENDING_HISTORY_MONTHS = 84;
const DEBT_HISTORY_DAYS = 1825;
const OUTPUT_FILE = resolve(process.cwd(), "public", "dashboard-data.json");
const API_KEY =
  process.env.DATA_GOV_API_KEY?.trim() || process.env.VITE_DATA_GOV_API_KEY?.trim() || "";
const BEA_API_KEY = process.env.BEA_API_KEY?.trim() || "";
const OPEN_LICENSE_IDS = new Set(["cc-by", "cc-zero", "us-pd", "odc-odbl", "gfdl"]);
const UNSPECIFIED_LICENSE_IDS = new Set(["notspecified", "unknown"]);
const BLS_ENDPOINT = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const ACS_ENDPOINT = "https://api.census.gov/data/2023/acs/acs1";
const TREASURY_DEBT_ENDPOINT =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny";
const TREASURY_MTS_TABLE1_ENDPOINT =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_1";
const BEA_ENDPOINT = "https://apps.bea.gov/api/data";
const MONTH_NAMES = new Map([
  ["01", "January"],
  ["02", "February"],
  ["03", "March"],
  ["04", "April"],
  ["05", "May"],
  ["06", "June"],
  ["07", "July"],
  ["08", "August"],
  ["09", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
]);

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

function parseNumber(value) {
  const normalized = String(value ?? "")
    .replaceAll(",", "")
    .replaceAll("$", "")
    .trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).replaceAll(",", "").replaceAll("$", "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeLabelFromDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function lastNAverage(points, count) {
  if (points.length === 0) {
    return 0;
  }

  const slice = points.slice(-count);
  return round(average(slice.map((point) => point.value)), 2);
}

function computeMovingAverage(points, windowSize) {
  const result = [];

  for (let index = 0; index < points.length; index += 1) {
    const start = Math.max(0, index - windowSize + 1);
    const slice = points.slice(start, index + 1);
    result.push({
      label: points[index].label,
      value: round(average(slice.map((item) => item.value)), 2),
    });
  }

  return result;
}

function standardDeviation(values) {
  if (values.length === 0) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function latestAbsoluteChange(points) {
  if (points.length < 2) {
    return 0;
  }

  return round(points.at(-1).value - points.at(-2).value, 2);
}

function latestYearOverYearDelta(points) {
  if (points.length < 13) {
    return 0;
  }

  return round(points.at(-1).value - points.at(-13).value, 2);
}

function computeMonthOverMonth(points) {
  const results = [];

  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[index - 1];
    const value = previous.value === 0 ? 0 : ((current.value / previous.value) - 1) * 100;
    results.push({
      label: current.label,
      value: round(value, 2),
    });
  }

  return results;
}

function computeAbsoluteChange(points) {
  const results = [];

  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[index - 1];
    results.push({
      label: current.label,
      value: round(current.value - previous.value, 2),
    });
  }

  return results;
}

function computeValueSpreadSeries(leftSeries, rightSeries) {
  const rightMap = new Map(rightSeries.map((point) => [point.label, point.value]));
  return leftSeries
    .filter((point) => rightMap.has(point.label))
    .map((point) => ({
      label: point.label,
      value: round(point.value - (rightMap.get(point.label) ?? 0), 2),
    }));
}

function computeRollingAverageSeries(points, windowSize, digits = 2) {
  const rolling = computeMovingAverage(points, windowSize);
  return rolling.map((point) => ({
    label: point.label,
    value: round(point.value, digits),
  }));
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

async function requestJson(
  url,
  {
    queryParams = {},
    method = "GET",
    body = null,
    headers = {},
    maxAttempts = 3,
  } = {},
) {
  const query = toQueryString(queryParams);
  const requestUrl = query.length > 0 ? `${url}?${query}` : url;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(requestUrl, {
        method,
        headers: {
          Accept: "application/json",
          ...headers,
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      return await response.json();
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

function formatMonthLabel(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function parseBlsSeries(seriesEntry) {
  const rows = seriesEntry?.data ?? [];

  return rows
    .filter((row) => typeof row.period === "string" && /^M\d{2}$/.test(row.period))
    .map((row) => {
      const month = Number.parseInt(row.period.slice(1), 10);
      const year = Number.parseInt(row.year, 10);
      const date = new Date(Date.UTC(year, month - 1, 1));
      return {
        year,
        month,
        date,
        label: new Intl.DateTimeFormat("en-US", {
          month: "short",
          year: "2-digit",
          timeZone: "UTC",
        }).format(date),
        value: parseNumber(row.value),
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function computeYearOverYear(points) {
  const results = [];

  for (let index = 12; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[index - 12];
    const value = previous.value === 0 ? 0 : ((current.value / previous.value) - 1) * 100;
    results.push({
      label: current.label,
      value: round(value, 2),
    });
  }

  return results;
}

async function fetchBlsIndicators() {
  const currentYear = new Date().getUTCFullYear();
  const startYear = String(currentYear - BLS_HISTORY_YEARS);
  const endYear = String(currentYear);

  const empty = {
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
    nonfarmPayrollEmployment: 0,
    payrollMoMChange: 0,
    payrollYoYChange: 0,
    payroll3mAvgChange: 0,
    unemploymentTrend: [],
    underemploymentTrend: [],
    unemploymentGapTrend: [],
    participationTrend: [],
    employmentPopulationTrend: [],
    inflationTrend: [],
    coreInflationTrend: [],
    cpiMoMTrend: [],
    earningsTrend: [],
    earningsMoMTrend: [],
    weeklyEarningsYoYTrend: [],
    realWageTrend: [],
    payrollTrend: [],
    payrollMoMTrend: [],
  };

  try {
    const payload = await requestJson(BLS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        seriesid: [
          "LNS14000000",
          "LNS13327709",
          "LNS13025703",
          "LNS13000000",
          "LNS11300000",
          "LNS12300000",
          "CUUR0000SA0",
          "CUUR0000SA0L1E",
          "CES0500000003",
          "CES0500000002",
          "CES0000000001",
        ],
        startyear: startYear,
        endyear: endYear,
      }),
    });

    const seriesRows = payload?.Results?.series ?? [];
    const byId = new Map(seriesRows.map((series) => [series.seriesID, parseBlsSeries(series)]));

    const unemployment = byId.get("LNS14000000") ?? [];
    const underemployment = byId.get("LNS13327709") ?? [];
    const longTermUnemployed = byId.get("LNS13025703") ?? [];
    const totalUnemployed = byId.get("LNS13000000") ?? [];
    const participation = byId.get("LNS11300000") ?? [];
    const employmentPopulation = byId.get("LNS12300000") ?? [];
    const cpi = byId.get("CUUR0000SA0") ?? [];
    const coreCpi = byId.get("CUUR0000SA0L1E") ?? [];
    const earnings = byId.get("CES0500000003") ?? [];
    const hours = byId.get("CES0500000002") ?? [];
    const payroll = byId.get("CES0000000001") ?? [];

    const inflationYoYSeries = computeYearOverYear(cpi);
    const coreInflationYoYSeries = computeYearOverYear(coreCpi);
    const cpiMoMSeries = computeMonthOverMonth(cpi);
    const coreCpiMoMSeries = computeMonthOverMonth(coreCpi);
    const earningsYoYSeries = computeYearOverYear(earnings);
    const earningsMoMSeries = computeMonthOverMonth(earnings);
    const hoursYoYSeries = computeYearOverYear(hours);
    const payrollYoYSeries = computeYearOverYear(payroll);
    const payrollMoMSeries = computeAbsoluteChange(payroll);
    const inflationMap = new Map(inflationYoYSeries.map((point) => [point.label, point.value]));
    const realWageYoYSeries = earningsYoYSeries.map((point) => ({
      label: point.label,
      value: round(point.value - (inflationMap.get(point.label) ?? 0), 2),
    }));
    const hoursMap = new Map(hours.map((point) => [point.label, point.value]));
    const weeklyEarningsSeries = earnings
      .filter((point) => hoursMap.has(point.label))
      .map((point) => ({
        date: point.date,
        label: point.label,
        value: round(point.value * (hoursMap.get(point.label) ?? 0), 2),
      }));
    const weeklyEarningsYoYSeries = computeYearOverYear(weeklyEarningsSeries);
    const unemploymentTrend = unemployment.map((point) => ({ label: point.label, value: point.value }));
    const underemploymentTrend = underemployment.map((point) => ({ label: point.label, value: point.value }));
    const unemploymentGapSeries = computeValueSpreadSeries(underemploymentTrend, unemploymentTrend);
    const unemployedTotalMap = new Map(totalUnemployed.map((point) => [point.label, point.value]));
    const longTermShareSeries = longTermUnemployed
      .filter((point) => unemployedTotalMap.has(point.label))
      .map((point) => ({
        label: point.label,
        value:
          (unemployedTotalMap.get(point.label) ?? 0) === 0
            ? 0
            : round((point.value / (unemployedTotalMap.get(point.label) ?? 0)) * 100, 2),
      }));
    const unemployment3mSeries = computeRollingAverageSeries(unemploymentTrend, 3, 2);
    const sahmLast12 = unemployment3mSeries.slice(-12).map((point) => point.value);
    const sahmRuleValue =
      unemployment3mSeries.length === 0 || sahmLast12.length === 0
        ? 0
        : round(
            (unemployment3mSeries.at(-1)?.value ?? 0) -
              Math.min(...sahmLast12),
            2,
          );
    const participationTrend = participation.map((point) => ({ label: point.label, value: point.value }));
    const employmentPopulationTrend = employmentPopulation.map((point) => ({
      label: point.label,
      value: point.value,
    }));

    const latestUnemployment = unemployment.at(-1)?.value ?? 0;
    const latestUnderemployment = underemployment.at(-1)?.value ?? 0;
    const latestParticipation = participation.at(-1)?.value ?? 0;
    const latestEmploymentPopulation = employmentPopulation.at(-1)?.value ?? 0;
    const latestCpi = cpi.at(-1)?.value ?? 0;
    const latestCoreCpi = coreCpi.at(-1)?.value ?? 0;
    const latestInflation = inflationYoYSeries.at(-1)?.value ?? 0;
    const latestCoreInflation = coreInflationYoYSeries.at(-1)?.value ?? 0;
    const latestEarnings = earnings.at(-1)?.value ?? 0;
    const latestEarningsYoY = earningsYoYSeries.at(-1)?.value ?? 0;
    const latestWeeklyHours = hours.at(-1)?.value ?? 0;
    const latestPayroll = payroll.at(-1)?.value ?? 0;
    const latestWeeklyEarnings = weeklyEarningsSeries.at(-1)?.value ?? 0;
    const latestWeeklyEarningsYoY = weeklyEarningsYoYSeries.at(-1)?.value ?? 0;
    const latestPayrollYoY = payrollYoYSeries.at(-1)?.value ?? 0;

    return {
      unemploymentRate: latestUnemployment,
      unemploymentRateMoMDelta: latestAbsoluteChange(unemployment),
      unemploymentRateYoYDelta: latestYearOverYearDelta(unemployment),
      underemploymentRate: latestUnderemployment,
      underemploymentGap: round(latestUnderemployment - latestUnemployment, 2),
      longTermUnemploymentShare: longTermShareSeries.at(-1)?.value ?? 0,
      sahmRuleValue,
      laborForceParticipationRate: latestParticipation,
      laborForceParticipationMoMDelta: latestAbsoluteChange(participation),
      employmentPopulationRatio: latestEmploymentPopulation,
      employmentPopulationMoMDelta: latestAbsoluteChange(employmentPopulation),
      cpiIndex: latestCpi,
      cpiMoM: cpiMoMSeries.at(-1)?.value ?? 0,
      coreCpiIndex: latestCoreCpi,
      coreInflationYoY: latestCoreInflation,
      coreInflationMoM: coreCpiMoMSeries.at(-1)?.value ?? 0,
      inflationGapToTarget: round(latestInflation - 2, 2),
      inflationVsCoreSpread: round(latestInflation - latestCoreInflation, 2),
      inflationYoY: latestInflation,
      inflationYoY3mAvg: lastNAverage(inflationYoYSeries, 3),
      averageHourlyEarnings: latestEarnings,
      hourlyEarningsMoM: earningsMoMSeries.at(-1)?.value ?? 0,
      hourlyEarningsYoY: latestEarningsYoY,
      hourlyEarningsYoY3mAvg: lastNAverage(earningsYoYSeries, 3),
      averageWeeklyHours: latestWeeklyHours,
      averageWeeklyHoursYoY: hoursYoYSeries.at(-1)?.value ?? 0,
      weeklyEarnings: latestWeeklyEarnings,
      weeklyEarningsYoY: latestWeeklyEarningsYoY,
      realWeeklyEarningsYoY: round(latestWeeklyEarningsYoY - latestInflation, 2),
      realWageYoY: realWageYoYSeries.at(-1)?.value ?? 0,
      realWageYoY3mAvg: lastNAverage(realWageYoYSeries, 3),
      unemploymentRate3mAvg: lastNAverage(unemploymentTrend, 3),
      nonfarmPayrollEmployment: latestPayroll,
      payrollMoMChange: payrollMoMSeries.at(-1)?.value ?? 0,
      payrollYoYChange: latestPayrollYoY,
      payroll3mAvgChange: lastNAverage(payrollMoMSeries, 3),
      unemploymentTrend,
      underemploymentTrend,
      unemploymentGapTrend: unemploymentGapSeries,
      participationTrend,
      employmentPopulationTrend,
      inflationTrend: inflationYoYSeries,
      coreInflationTrend: coreInflationYoYSeries,
      cpiMoMTrend: cpiMoMSeries,
      earningsTrend: earningsYoYSeries,
      earningsMoMTrend: earningsMoMSeries,
      weeklyEarningsYoYTrend: weeklyEarningsYoYSeries,
      realWageTrend: realWageYoYSeries,
      payrollTrend: payrollYoYSeries,
      payrollMoMTrend: payrollMoMSeries,
    };
  } catch {
    return empty;
  }
}

async function fetchAcsMap(variables) {
  try {
    const payload = await requestJson(ACS_ENDPOINT, {
      queryParams: {
        get: variables.join(","),
        for: "us:1",
      },
    });
    const headers = payload?.[0] ?? [];
    const values = payload?.[1] ?? [];
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  } catch {
    return {};
  }
}

async function fetchDemographicIndicators() {
  try {
    const coreVars = [
      "B01003_001E",
      "B11001_001E",
      "B19013_001E",
      "B19301_001E",
      "B19083_001E",
      "B17001_001E",
      "B17001_002E",
      "B01002_001E",
      "B23025_003E",
      "B23025_005E",
      "B25077_001E",
      "B25064_001E",
      "B25002_001E",
      "B25002_003E",
      "B25003_002E",
      "B25003_003E",
      "B28002_001E",
      "B28002_013E",
      "B15003_001E",
      "B15003_022E",
      "B15003_023E",
      "B15003_024E",
      "B15003_025E",
    ];
    const structureVars = [
      "B01001_001E",
      "B01001_002E",
      "B01001_026E",
      "B01001_003E",
      "B01001_004E",
      "B01001_005E",
      "B01001_006E",
      "B01001_027E",
      "B01001_028E",
      "B01001_029E",
      "B01001_030E",
      "B01001_020E",
      "B01001_021E",
      "B01001_022E",
      "B01001_023E",
      "B01001_024E",
      "B01001_025E",
      "B01001_044E",
      "B01001_045E",
      "B01001_046E",
      "B01001_047E",
      "B01001_048E",
      "B01001_049E",
      "B25070_001E",
      "B25070_007E",
      "B25070_008E",
      "B25070_009E",
      "B25070_010E",
      "B25091_001E",
      "B25091_007E",
      "B25091_008E",
      "B25091_009E",
      "B25091_010E",
      "B25024_001E",
      "B25024_002E",
      "B25024_003E",
      "B25024_004E",
      "B25024_005E",
      "B25024_006E",
      "B25024_007E",
      "B25024_008E",
      "B25024_009E",
      "B25024_010E",
      "B25024_011E",
      "B08303_001E",
      "B08303_011E",
      "B08303_012E",
      "B08303_013E",
      "B08201_001E",
      "B08201_002E",
    ];
    const educationDetailVars = [
      "B15003_002E",
      "B15003_003E",
      "B15003_004E",
      "B15003_005E",
      "B15003_006E",
      "B15003_007E",
      "B15003_008E",
      "B15003_009E",
      "B15003_010E",
      "B15003_011E",
      "B15003_012E",
      "B15003_013E",
      "B15003_014E",
      "B15003_015E",
      "B15003_016E",
    ];

    const [coreMapped, structureMapped, educationMapped] = await Promise.all([
      fetchAcsMap(coreVars),
      fetchAcsMap(structureVars),
      fetchAcsMap(educationDetailVars),
    ]);
    const mapped = {
      ...coreMapped,
      ...structureMapped,
      ...educationMapped,
    };
    const population = parseNumber(mapped.B01003_001E);
    const households = parseNumber(mapped.B11001_001E);
    const educationBase = parseNumber(mapped.B15003_001E);
    const lessThanHighSchool = [
      "B15003_002E",
      "B15003_003E",
      "B15003_004E",
      "B15003_005E",
      "B15003_006E",
      "B15003_007E",
      "B15003_008E",
      "B15003_009E",
      "B15003_010E",
      "B15003_011E",
      "B15003_012E",
      "B15003_013E",
      "B15003_014E",
      "B15003_015E",
      "B15003_016E",
    ].reduce((sum, key) => sum + parseNumber(mapped[key]), 0);
    const bachelorsOrHigher =
      parseNumber(mapped.B15003_022E) +
      parseNumber(mapped.B15003_023E) +
      parseNumber(mapped.B15003_024E) +
      parseNumber(mapped.B15003_025E);
    const povertyUniverse = parseNumber(mapped.B17001_001E);
    const belowPoverty = parseNumber(mapped.B17001_002E);
    const internetTotal = parseNumber(mapped.B28002_001E);
    const noInternet = parseNumber(mapped.B28002_013E);

    const ageTotal = parseNumber(mapped.B01001_001E);
    const femalePopulation = parseNumber(mapped.B01001_026E);
    const childPopulation =
      parseNumber(mapped.B01001_003E) +
      parseNumber(mapped.B01001_004E) +
      parseNumber(mapped.B01001_005E) +
      parseNumber(mapped.B01001_006E) +
      parseNumber(mapped.B01001_027E) +
      parseNumber(mapped.B01001_028E) +
      parseNumber(mapped.B01001_029E) +
      parseNumber(mapped.B01001_030E);
    const seniorPopulation =
      parseNumber(mapped.B01001_020E) +
      parseNumber(mapped.B01001_021E) +
      parseNumber(mapped.B01001_022E) +
      parseNumber(mapped.B01001_023E) +
      parseNumber(mapped.B01001_024E) +
      parseNumber(mapped.B01001_025E) +
      parseNumber(mapped.B01001_044E) +
      parseNumber(mapped.B01001_045E) +
      parseNumber(mapped.B01001_046E) +
      parseNumber(mapped.B01001_047E) +
      parseNumber(mapped.B01001_048E) +
      parseNumber(mapped.B01001_049E);
    const workingAgePopulation = Math.max(ageTotal - childPopulation - seniorPopulation, 0);

    const renterBurdenTotal = parseNumber(mapped.B25070_001E);
    const severeRentBurden = parseNumber(mapped.B25070_008E) + parseNumber(mapped.B25070_009E) + parseNumber(mapped.B25070_010E);
    const ownerBurdenTotal = parseNumber(mapped.B25091_001E);
    const ownerBurdenOver30 =
      parseNumber(mapped.B25091_007E) +
      parseNumber(mapped.B25091_008E) +
      parseNumber(mapped.B25091_009E) +
      parseNumber(mapped.B25091_010E);

    const structureTotal = parseNumber(mapped.B25024_001E);
    const singleFamilyCount = parseNumber(mapped.B25024_002E) + parseNumber(mapped.B25024_003E);
    const multiFamilyCount =
      parseNumber(mapped.B25024_004E) +
      parseNumber(mapped.B25024_005E) +
      parseNumber(mapped.B25024_006E) +
      parseNumber(mapped.B25024_007E) +
      parseNumber(mapped.B25024_008E) +
      parseNumber(mapped.B25024_009E);
    const mobileHomeCount = parseNumber(mapped.B25024_010E);

    const commutersTotal = parseNumber(mapped.B08303_001E);
    const longCommuteCount =
      parseNumber(mapped.B08303_011E) +
      parseNumber(mapped.B08303_012E) +
      parseNumber(mapped.B08303_013E);
    const vehicleTotal = parseNumber(mapped.B08201_001E);
    const zeroVehicleHouseholds = parseNumber(mapped.B08201_002E);

    return {
      population,
      households,
      medianIncome: parseNumber(mapped.B19013_001E),
      perCapitaIncome: parseNumber(mapped.B19301_001E),
      giniIndex: parseNumber(mapped.B19083_001E),
      povertyRate: toPercent(belowPoverty, povertyUniverse),
      internetAccessRate: toPercent(internetTotal - noInternet, internetTotal),
      medianAge: parseNumber(mapped.B01002_001E),
      laborForce: parseNumber(mapped.B23025_003E),
      unemploymentPersons: parseNumber(mapped.B23025_005E),
      medianHomeValue: parseNumber(mapped.B25077_001E),
      medianRent: parseNumber(mapped.B25064_001E),
      housingUnits: parseNumber(mapped.B25002_001E),
      vacantHousingUnits: parseNumber(mapped.B25002_003E),
      ownerOccupiedHousingUnits: parseNumber(mapped.B25003_002E),
      renterOccupiedHousingUnits: parseNumber(mapped.B25003_003E),
      severeRentBurdenShare: toPercent(severeRentBurden, renterBurdenTotal),
      ownerCostBurdenShare: toPercent(ownerBurdenOver30, ownerBurdenTotal),
      singleFamilyHousingShare: toPercent(singleFamilyCount, structureTotal),
      multiFamilyHousingShare: toPercent(multiFamilyCount, structureTotal),
      mobileHomeShare: toPercent(mobileHomeCount, structureTotal),
      personsPerHousehold: households === 0 ? 0 : round(population / households, 2),
      childPopulationShare: toPercent(childPopulation, ageTotal),
      seniorPopulationShare: toPercent(seniorPopulation, ageTotal),
      workingAgePopulationShare: toPercent(workingAgePopulation, ageTotal),
      dependencyRatio: workingAgePopulation === 0 ? 0 : round(((childPopulation + seniorPopulation) / workingAgePopulation) * 100, 2),
      femalePopulationShare: toPercent(femalePopulation, ageTotal),
      highSchoolOrHigherShare: toPercent(educationBase - lessThanHighSchool, educationBase),
      lessThanHighSchoolShare: toPercent(lessThanHighSchool, educationBase),
      longCommuteShare: toPercent(longCommuteCount, commutersTotal),
      zeroVehicleShare: toPercent(zeroVehicleHouseholds, vehicleTotal),
      bachelorsOrHigherShare: toPercent(bachelorsOrHigher, educationBase),
    };
  } catch {
    return {
      population: 0,
      households: 0,
      medianIncome: 0,
      perCapitaIncome: 0,
      giniIndex: 0,
      povertyRate: 0,
      internetAccessRate: 0,
      medianAge: 0,
      laborForce: 0,
      unemploymentPersons: 0,
      medianHomeValue: 0,
      medianRent: 0,
      housingUnits: 0,
      vacantHousingUnits: 0,
      ownerOccupiedHousingUnits: 0,
      renterOccupiedHousingUnits: 0,
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
    };
  }
}

async function fetchTreasurySpendingSeries() {
  try {
    const payload = await requestJson(TREASURY_MTS_TABLE1_ENDPOINT, {
      queryParams: {
        filter: "record_type_cd:eq:MTH",
        sort: "-record_date",
        "page[size]": 240,
      },
    });

    const rows = payload?.data ?? [];
    const monthlyByDate = new Map();

    rows.forEach((row) => {
      const isoDate = row.record_date;
      const monthCode = typeof isoDate === "string" ? isoDate.slice(5, 7) : "";
      const expectedName = MONTH_NAMES.get(monthCode);
      if (expectedName && row.classification_desc === expectedName && !monthlyByDate.has(isoDate)) {
        monthlyByDate.set(isoDate, row);
      }
    });

    const monthlySeries = Array.from(monthlyByDate.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([isoDate, row]) => ({
        recordDate: isoDate,
        label: formatMonthLabel(isoDate),
        outlays: parseNumber(row.current_month_gross_outly_amt),
        receipts: parseNumber(row.current_month_gross_rcpt_amt),
        deficit: parseNumber(row.current_month_dfct_sur_amt),
      }));

    return monthlySeries.slice(-SPENDING_HISTORY_MONTHS);
  } catch {
    return [];
  }
}

async function fetchDebtSeries() {
  try {
    const rows = [];
    const pageSize = 500;
    let pageNumber = 1;

    while (rows.length < Math.max(DEBT_HISTORY_DAYS, 400)) {
      const payload = await requestJson(TREASURY_DEBT_ENDPOINT, {
        queryParams: {
          fields: "record_date,tot_pub_debt_out_amt,debt_held_public_amt,intragov_hold_amt",
          sort: "-record_date",
          "page[size]": pageSize,
          "page[number]": pageNumber,
        },
      });

      const pageRows = payload?.data ?? [];
      if (pageRows.length === 0) {
        break;
      }

      rows.push(...pageRows);
      if (pageRows.length < pageSize) {
        break;
      }

      pageNumber += 1;
      if (pageNumber > 8) {
        break;
      }
    }

    const latest = rows[0];
    const baseline7 = rows[Math.min(7, Math.max(rows.length - 1, 0))];
    const baseline30 = rows[Math.min(30, Math.max(rows.length - 1, 0))];
    const baseline365 = rows[Math.min(365, Math.max(rows.length - 1, 0))];
    const latestValue = parseNumber(latest?.tot_pub_debt_out_amt);
    const latestDebtHeldPublic = parseNumber(latest?.debt_held_public_amt);
    const latestIntragov = parseNumber(latest?.intragov_hold_amt);
    const value7 = parseNumber(baseline7?.tot_pub_debt_out_amt);
    const value30 = parseNumber(baseline30?.tot_pub_debt_out_amt);
    const value365 = parseNumber(baseline365?.tot_pub_debt_out_amt);
    const trend = rows
      .slice(0, DEBT_HISTORY_DAYS)
      .reverse()
      .map((row) => ({
        label: safeLabelFromDate(row.record_date),
        value: parseNumber(row.tot_pub_debt_out_amt),
      }));
    const changeTrend = [];

    for (let index = 1; index < trend.length; index += 1) {
      changeTrend.push({
        label: trend[index].label,
        value: round(trend[index].value - trend[index - 1].value, 2),
      });
    }

    const recent30Changes = changeTrend.slice(-30).map((point) => point.value);

    return {
      totalDebt: latestValue,
      debtHeldByPublic: latestDebtHeldPublic,
      intragovernmentalHoldings: latestIntragov,
      debtHeldByPublicShare: toPercent(latestDebtHeldPublic, latestValue),
      intragovShare: toPercent(latestIntragov, latestValue),
      debtChange7Days: latestValue - value7,
      debtChange30Days: latestValue - value30,
      debtChange365Days: latestValue - value365,
      debtChange7DaysPct: value7 === 0 ? 0 : round(((latestValue / value7) - 1) * 100, 2),
      debtChange30DaysPct: value30 === 0 ? 0 : round(((latestValue / value30) - 1) * 100, 2),
      debtChange365DaysPct: value365 === 0 ? 0 : round(((latestValue / value365) - 1) * 100, 2),
      debtYoYGrowthPct: value365 === 0 ? 0 : round(((latestValue / value365) - 1) * 100, 2),
      avgDailyDebtChange30: recent30Changes.length === 0 ? 0 : round(average(recent30Changes), 2),
      debtDailyVolatility30: recent30Changes.length === 0 ? 0 : round(standardDeviation(recent30Changes), 2),
      maxDailyDebtIncrease30: recent30Changes.length === 0 ? 0 : round(Math.max(...recent30Changes), 2),
      maxDailyDebtDecrease30: recent30Changes.length === 0 ? 0 : round(Math.min(...recent30Changes), 2),
      trend,
      changeTrend,
    };
  } catch {
    return {
      totalDebt: 0,
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
      trend: [],
      changeTrend: [],
    };
  }
}

function parseBeaQuarter(quarterLabel) {
  const [yearPart, quarterPart] = String(quarterLabel).split("Q");
  const year = Number.parseInt(yearPart, 10);
  const quarter = Number.parseInt(quarterPart, 10);
  if (!Number.isFinite(year) || !Number.isFinite(quarter)) {
    return 0;
  }

  return year * 10 + quarter;
}

async function fetchBeaQuarterLine(lineNumber) {
  const payload = await requestJson(BEA_ENDPOINT, {
    queryParams: {
      UserID: BEA_API_KEY,
      method: "GetData",
      datasetname: "NIPA",
      TableName: "T10105",
      LineNumber: String(lineNumber),
      Frequency: "Q",
      Year: "X",
      ResultFormat: "json",
    },
  });

  const rows = payload?.BEAAPI?.Results?.Data ?? [];
  const parsed = rows
    .map((row) => ({
      time: row.TimePeriod,
      value: parseOptionalNumber(row.DataValue),
    }))
    .filter((row) => row.value !== null)
    .sort((left, right) => parseBeaQuarter(left.time) - parseBeaQuarter(right.time));

  return parsed.at(-1)?.value ?? null;
}

async function fetchBeaIndicators() {
  if (!BEA_API_KEY) {
    return {
      grossPrivateDomesticInvestment: null,
      personalSavingRate: null,
      beaDataAvailable: false,
    };
  }

  try {
    const [investment, savingsRate] = await Promise.all([
      fetchBeaQuarterLine(8),
      fetchBeaQuarterLine(35),
    ]);

    return {
      grossPrivateDomesticInvestment: investment,
      personalSavingRate: savingsRate,
      beaDataAvailable: true,
    };
  } catch {
    return {
      grossPrivateDomesticInvestment: null,
      personalSavingRate: null,
      beaDataAvailable: false,
    };
  }
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

  const [blsIndicators, demographicIndicators, spendingSeries, debtSeries, beaIndicators] =
    await Promise.all([
      fetchBlsIndicators(),
      fetchDemographicIndicators(),
      fetchTreasurySpendingSeries(),
      fetchDebtSeries(),
      fetchBeaIndicators(),
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

  const latestSpending = spendingSeries.at(-1) ?? {
    outlays: 0,
    receipts: 0,
    deficit: 0,
  };
  const priorYearSpending = spendingSeries.slice(-24, -12);
  const trailing3Spending = spendingSeries.slice(-3);
  const trailing12Spending = spendingSeries.slice(-12);
  const trailing12Outlays = trailing12Spending.reduce((sum, item) => sum + item.outlays, 0);
  const trailing12Receipts = trailing12Spending.reduce((sum, item) => sum + item.receipts, 0);
  const trailing12Deficit = trailing12Spending.reduce((sum, item) => sum + item.deficit, 0);
  const avgMonthlyOutlays12 =
    trailing12Spending.length === 0 ? 0 : round(trailing12Outlays / trailing12Spending.length, 2);
  const avgMonthlyReceipts12 =
    trailing12Spending.length === 0 ? 0 : round(trailing12Receipts / trailing12Spending.length, 2);
  const avgMonthlyDeficit12 =
    trailing12Spending.length === 0 ? 0 : round(trailing12Deficit / trailing12Spending.length, 2);
  const outlays3mAvg =
    trailing3Spending.length === 0
      ? 0
      : round(
          trailing3Spending.reduce((sum, item) => sum + item.outlays, 0) / trailing3Spending.length,
          2,
        );
  const receipts3mAvg =
    trailing3Spending.length === 0
      ? 0
      : round(
          trailing3Spending.reduce((sum, item) => sum + item.receipts, 0) / trailing3Spending.length,
          2,
        );
  const deficit3mAvg =
    trailing3Spending.length === 0
      ? 0
      : round(
          trailing3Spending.reduce((sum, item) => sum + item.deficit, 0) / trailing3Spending.length,
          2,
        );
  const deficitShare3mAvg =
    trailing3Spending.length === 0
      ? 0
      : round(
          average(
            trailing3Spending.map((item) =>
              item.outlays === 0 ? 0 : (item.deficit / item.outlays) * 100,
            ),
          ),
          2,
        );
  const deficitVolatility12 = round(
    standardDeviation(trailing12Spending.map((item) => item.deficit)),
    2,
  );
  const deficitPeakToTrough12 =
    trailing12Spending.length === 0
      ? 0
      : round(
          Math.max(...trailing12Spending.map((item) => item.deficit)) -
            Math.min(...trailing12Spending.map((item) => item.deficit)),
          2,
        );
  let deficitStreakMonths = 0;
  for (let index = spendingSeries.length - 1; index >= 0; index -= 1) {
    if (spendingSeries[index].deficit > 0) {
      deficitStreakMonths += 1;
      continue;
    }
    break;
  }
  const prior12Outlays = priorYearSpending.reduce((sum, item) => sum + item.outlays, 0);
  const prior12Receipts = priorYearSpending.reduce((sum, item) => sum + item.receipts, 0);
  const prior12Deficit = priorYearSpending.reduce((sum, item) => sum + item.deficit, 0);
  const outlaysYoY = percentChange(trailing12Outlays, prior12Outlays);
  const receiptsYoY = percentChange(trailing12Receipts, prior12Receipts);
  const deficitYoY = percentChange(trailing12Deficit, prior12Deficit);
  const fiscalImpulseYoY = round(outlaysYoY - receiptsYoY, 2);
  const surplusMonthsLast12 = trailing12Spending.filter((item) => item.deficit < 0).length;
  const largestDeficitMonthRow = trailing12Spending.reduce(
    (best, item) => (item.deficit > best.deficit ? item : best),
    { label: "N/A", deficit: 0 },
  );
  const largestSurplusMonthRow = trailing12Spending.reduce(
    (best, item) => (item.deficit < best.deficit ? item : best),
    { label: "N/A", deficit: 0 },
  );

  const unemploymentRate =
    blsIndicators.unemploymentRate > 0
      ? blsIndicators.unemploymentRate
      : demographicIndicators.laborForce > 0
        ? round((demographicIndicators.unemploymentPersons / demographicIndicators.laborForce) * 100, 2)
        : 0;
  const outlaysPerCapita =
    demographicIndicators.population > 0 ? latestSpending.outlays / demographicIndicators.population : 0;
  const receiptsPerCapita =
    demographicIndicators.population > 0 ? latestSpending.receipts / demographicIndicators.population : 0;
  const deficitPerCapita =
    demographicIndicators.population > 0 ? latestSpending.deficit / demographicIndicators.population : 0;
  const debtPerCapita =
    demographicIndicators.population > 0 ? debtSeries.totalDebt / demographicIndicators.population : 0;
  const debtToIncomeRatio =
    demographicIndicators.perCapitaIncome > 0 ? debtPerCapita / demographicIndicators.perCapitaIncome : 0;
  const homeValueToIncomeRatio =
    demographicIndicators.medianIncome > 0
      ? demographicIndicators.medianHomeValue / demographicIndicators.medianIncome
      : 0;
  const annualRentToIncomeRatio =
    demographicIndicators.medianIncome > 0
      ? (demographicIndicators.medianRent * 12) / demographicIndicators.medianIncome
      : 0;
  const vacancyRate = toPercent(
    demographicIndicators.vacantHousingUnits,
    demographicIndicators.housingUnits,
  );
  const occupiedHousingUnits =
    demographicIndicators.ownerOccupiedHousingUnits + demographicIndicators.renterOccupiedHousingUnits;
  const homeownershipRate = toPercent(
    demographicIndicators.ownerOccupiedHousingUnits,
    occupiedHousingUnits,
  );
  const renterShareOfOccupied = toPercent(
    demographicIndicators.renterOccupiedHousingUnits,
    occupiedHousingUnits,
  );
  const receiptsToOutlaysRatio = toPercent(
    latestSpending.receipts,
    latestSpending.outlays,
  );
  const deficitToOutlaysRatio = toPercent(
    latestSpending.deficit,
    latestSpending.outlays,
  );
  const realWageTrend = blsIndicators.realWageTrend ?? [];
  const outlaysSeries = spendingSeries.map((item) => ({
    label: item.label,
    value: item.outlays,
  }));
  const receiptsSeries = spendingSeries.map((item) => ({
    label: item.label,
    value: item.receipts,
  }));
  const deficitSeries = spendingSeries.map((item) => ({
    label: item.label,
    value: item.deficit,
  }));
  const deficitShareOfOutlaysTrend = spendingSeries.map((item) => ({
    label: item.label,
    value: item.outlays === 0 ? 0 : round((item.deficit / item.outlays) * 100, 2),
  }));
  const outlays3mAvgTrend = computeRollingAverageSeries(outlaysSeries, 3, 2);
  const receipts3mAvgTrend = computeRollingAverageSeries(receiptsSeries, 3, 2);
  const deficit3mAvgTrend = computeRollingAverageSeries(deficitSeries, 3, 2);

  const economySnapshot = {
    population: demographicIndicators.population,
    households: demographicIndicators.households,
    medianIncome: demographicIndicators.medianIncome,
    perCapitaIncome: demographicIndicators.perCapitaIncome,
    medianHomeValue: demographicIndicators.medianHomeValue,
    medianRent: demographicIndicators.medianRent,
    medianAge: demographicIndicators.medianAge,
    giniIndex: demographicIndicators.giniIndex,
    povertyRate: demographicIndicators.povertyRate,
    internetAccessRate: demographicIndicators.internetAccessRate,
    laborForce: demographicIndicators.laborForce,
    unemploymentPersons: demographicIndicators.unemploymentPersons,
    unemploymentRate,
    unemploymentRate3mAvg: blsIndicators.unemploymentRate3mAvg,
    unemploymentRateMoMDelta: blsIndicators.unemploymentRateMoMDelta,
    unemploymentRateYoYDelta: blsIndicators.unemploymentRateYoYDelta,
    underemploymentRate: blsIndicators.underemploymentRate,
    underemploymentGap: blsIndicators.underemploymentGap,
    longTermUnemploymentShare: blsIndicators.longTermUnemploymentShare,
    sahmRuleValue: blsIndicators.sahmRuleValue,
    laborForceParticipationRate: blsIndicators.laborForceParticipationRate,
    laborForceParticipationMoMDelta: blsIndicators.laborForceParticipationMoMDelta,
    employmentPopulationRatio: blsIndicators.employmentPopulationRatio,
    employmentPopulationMoMDelta: blsIndicators.employmentPopulationMoMDelta,
    nonfarmPayrollEmployment: blsIndicators.nonfarmPayrollEmployment,
    payrollMoMChange: blsIndicators.payrollMoMChange,
    payrollYoYChange: blsIndicators.payrollYoYChange,
    payroll3mAvgChange: blsIndicators.payroll3mAvgChange,
    cpiIndex: blsIndicators.cpiIndex,
    cpiMoM: blsIndicators.cpiMoM,
    coreCpiIndex: blsIndicators.coreCpiIndex,
    coreInflationYoY: blsIndicators.coreInflationYoY,
    coreInflationMoM: blsIndicators.coreInflationMoM,
    inflationGapToTarget: blsIndicators.inflationGapToTarget,
    inflationVsCoreSpread: blsIndicators.inflationVsCoreSpread,
    inflationYoY: blsIndicators.inflationYoY,
    inflationYoY3mAvg: blsIndicators.inflationYoY3mAvg,
    averageHourlyEarnings: blsIndicators.averageHourlyEarnings,
    hourlyEarningsMoM: blsIndicators.hourlyEarningsMoM,
    hourlyEarningsYoY: blsIndicators.hourlyEarningsYoY,
    hourlyEarningsYoY3mAvg: blsIndicators.hourlyEarningsYoY3mAvg,
    averageWeeklyHours: blsIndicators.averageWeeklyHours,
    averageWeeklyHoursYoY: blsIndicators.averageWeeklyHoursYoY,
    weeklyEarnings: blsIndicators.weeklyEarnings,
    weeklyEarningsYoY: blsIndicators.weeklyEarningsYoY,
    realWeeklyEarningsYoY: blsIndicators.realWeeklyEarningsYoY,
    realWageYoY: blsIndicators.realWageYoY,
    realWageYoY3mAvg: blsIndicators.realWageYoY3mAvg,
    totalPublicDebt: debtSeries.totalDebt,
    debtHeldByPublic: debtSeries.debtHeldByPublic,
    intragovernmentalHoldings: debtSeries.intragovernmentalHoldings,
    debtHeldByPublicShare: debtSeries.debtHeldByPublicShare,
    intragovShare: debtSeries.intragovShare,
    debtChange7Days: debtSeries.debtChange7Days,
    debtChange30Days: debtSeries.debtChange30Days,
    debtChange365Days: debtSeries.debtChange365Days,
    debtChange7DaysPct: debtSeries.debtChange7DaysPct,
    debtChange30DaysPct: debtSeries.debtChange30DaysPct,
    debtChange365DaysPct: debtSeries.debtChange365DaysPct,
    debtYoYGrowthPct: debtSeries.debtYoYGrowthPct,
    avgDailyDebtChange30: debtSeries.avgDailyDebtChange30,
    debtDailyVolatility30: debtSeries.debtDailyVolatility30,
    maxDailyDebtIncrease30: debtSeries.maxDailyDebtIncrease30,
    maxDailyDebtDecrease30: debtSeries.maxDailyDebtDecrease30,
    debtPerCapita,
    debtToIncomeRatio,
    latestOutlays: latestSpending.outlays,
    latestReceipts: latestSpending.receipts,
    latestDeficit: latestSpending.deficit,
    receiptsToOutlaysRatio,
    deficitToOutlaysRatio,
    deficitShare3mAvg,
    outlays3mAvg,
    receipts3mAvg,
    outlaysPerCapita,
    receiptsPerCapita,
    deficitPerCapita,
    trailing12Outlays,
    trailing12Receipts,
    trailing12Deficit,
    avgMonthlyOutlays12,
    avgMonthlyReceipts12,
    avgMonthlyDeficit12,
    deficitVolatility12,
    deficitPeakToTrough12,
    fiscalImpulseYoY,
    outlaysYoY,
    receiptsYoY,
    deficitYoY,
    deficitStreakMonths,
    surplusMonthsLast12,
    largestDeficitMonth: largestDeficitMonthRow.label,
    largestDeficitAmount: largestDeficitMonthRow.deficit,
    largestSurplusMonth: largestSurplusMonthRow.label,
    largestSurplusAmount: largestSurplusMonthRow.deficit,
    housingUnits: demographicIndicators.housingUnits,
    vacantHousingUnits: demographicIndicators.vacantHousingUnits,
    ownerOccupiedHousingUnits: demographicIndicators.ownerOccupiedHousingUnits,
    renterOccupiedHousingUnits: demographicIndicators.renterOccupiedHousingUnits,
    vacancyRate,
    homeownershipRate,
    renterShareOfOccupied,
    severeRentBurdenShare: demographicIndicators.severeRentBurdenShare,
    ownerCostBurdenShare: demographicIndicators.ownerCostBurdenShare,
    singleFamilyHousingShare: demographicIndicators.singleFamilyHousingShare,
    multiFamilyHousingShare: demographicIndicators.multiFamilyHousingShare,
    mobileHomeShare: demographicIndicators.mobileHomeShare,
    personsPerHousehold: demographicIndicators.personsPerHousehold,
    childPopulationShare: demographicIndicators.childPopulationShare,
    seniorPopulationShare: demographicIndicators.seniorPopulationShare,
    workingAgePopulationShare: demographicIndicators.workingAgePopulationShare,
    dependencyRatio: demographicIndicators.dependencyRatio,
    femalePopulationShare: demographicIndicators.femalePopulationShare,
    highSchoolOrHigherShare: demographicIndicators.highSchoolOrHigherShare,
    lessThanHighSchoolShare: demographicIndicators.lessThanHighSchoolShare,
    longCommuteShare: demographicIndicators.longCommuteShare,
    zeroVehicleShare: demographicIndicators.zeroVehicleShare,
    bachelorsOrHigherShare: demographicIndicators.bachelorsOrHigherShare,
    homeValueToIncomeRatio,
    annualRentToIncomeRatio,
    grossPrivateDomesticInvestment: beaIndicators.grossPrivateDomesticInvestment,
    personalSavingRate: beaIndicators.personalSavingRate,
    beaDataAvailable: beaIndicators.beaDataAvailable,
  };

  const economyTrends = {
    monthlySpending: spendingSeries.map((point) => ({
      label: point.label,
      outlays: point.outlays,
      receipts: point.receipts,
      deficit: point.deficit,
    })),
    debtDaily: debtSeries.trend,
    debtDailyChange: debtSeries.changeTrend,
    unemploymentRate: blsIndicators.unemploymentTrend,
    underemploymentRate: blsIndicators.underemploymentTrend,
    unemploymentGap: blsIndicators.unemploymentGapTrend,
    laborForceParticipationRate: blsIndicators.participationTrend,
    employmentPopulationRatio: blsIndicators.employmentPopulationTrend,
    inflationYoY: blsIndicators.inflationTrend,
    coreInflationYoY: blsIndicators.coreInflationTrend,
    cpiMoM: blsIndicators.cpiMoMTrend,
    hourlyEarningsYoY: blsIndicators.earningsTrend,
    hourlyEarningsMoM: blsIndicators.earningsMoMTrend,
    weeklyEarningsYoY: blsIndicators.weeklyEarningsYoYTrend,
    realWageYoY: realWageTrend,
    deficitShareOfOutlays: deficitShareOfOutlaysTrend,
    deficit3mAvg: deficit3mAvgTrend,
    outlays3mAvg: outlays3mAvgTrend,
    receipts3mAvg: receipts3mAvgTrend,
    nonfarmPayroll: blsIndicators.payrollTrend,
    payrollMoMChange: blsIndicators.payrollMoMTrend,
  };

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
    {
      id: "sahm-rule",
      title: "Labor stress (Sahm rule proxy)",
      level: toAlertLevel(blsIndicators.sahmRuleValue, 0.3, 0.5),
      metric: `${blsIndicators.sahmRuleValue.toFixed(2)}pp`,
      detail: "Current unemployment 3m average relative to its 12-month minimum.",
    },
    {
      id: "real-wage",
      title: "Real wage pressure",
      level: toAlertLevel(blsIndicators.realWageYoY, 0, -1, "lower-is-risk"),
      metric: `${blsIndicators.realWageYoY.toFixed(2)}%`,
      detail: "Inflation-adjusted hourly earnings growth year-over-year.",
    },
    {
      id: "fiscal-deficit-share",
      title: "Deficit pressure",
      level: toAlertLevel(deficitShare3mAvg, 20, 30),
      metric: `${deficitShare3mAvg.toFixed(1)}%`,
      detail: "3-month average deficit as a share of outlays.",
    },
    {
      id: "debt-growth",
      title: "Debt growth speed",
      level: toAlertLevel(debtSeries.debtYoYGrowthPct, 5, 8),
      metric: `${debtSeries.debtYoYGrowthPct.toFixed(2)}%`,
      detail: "Total public debt growth relative to one year ago.",
    },
    {
      id: "housing-burden",
      title: "Housing cost burden",
      level: toAlertLevel(demographicIndicators.severeRentBurdenShare, 20, 30),
      metric: `${demographicIndicators.severeRentBurdenShare.toFixed(1)}%`,
      detail: "Renter households paying at least 35% of income toward rent.",
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
    economy: {
      snapshot: economySnapshot,
      trends: economyTrends,
    },
    recentDatasets: (recentData.results ?? []).map(packageToRecentDataset),
    source: {
      siteTitle: statusData?.site_title ?? "Catalog",
      ckanVersion: statusData?.ckan_version ?? "unknown",
      apiBase: `${CKAN_BASE_URL} + BLS + Census + Treasury + ${BEA_API_KEY ? "BEA" : "BEA (key not set)"}`,
      snapshotStrategy: "build-time static snapshot from federal data APIs",
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
