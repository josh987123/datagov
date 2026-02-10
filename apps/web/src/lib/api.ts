import type {
  AgenciesResponse,
  AgencyDetailResponse,
  DatasetsResponse,
  IngestRunsResponse,
  MetricsInsightsResponse,
  MetricsSummaryResponse,
  MetricsTrendsResponse
} from "@datagov/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function getMetricsSummary(): Promise<MetricsSummaryResponse> {
  return fetchApi<MetricsSummaryResponse>("/metrics/summary");
}

export async function getMetricsTrends(days = 30): Promise<MetricsTrendsResponse> {
  return fetchApi<MetricsTrendsResponse>(`/metrics/trends?days=${days}`);
}

export async function getDatasets(params: {
  search?: string;
  agency?: string;
  tag?: string;
  minQuality?: number;
  staleOnly?: boolean;
  sort?: "recent" | "quality" | "openness" | "freshness";
  page?: number;
  pageSize?: number;
}): Promise<DatasetsResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.agency) query.set("agency", params.agency);
  if (params.tag) query.set("tag", params.tag);
  if (typeof params.minQuality === "number") query.set("minQuality", String(params.minQuality));
  if (params.staleOnly) query.set("staleOnly", "true");
  if (params.sort) query.set("sort", params.sort);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  return fetchApi<DatasetsResponse>(`/datasets?${query.toString()}`);
}

export async function getMetricsInsights(days = 90): Promise<MetricsInsightsResponse> {
  return fetchApi<MetricsInsightsResponse>(`/metrics/insights?days=${days}`);
}

export async function getIngestRuns(limit = 20): Promise<IngestRunsResponse> {
  return fetchApi<IngestRunsResponse>(`/ingest/runs?limit=${limit}`);
}

export async function getAgencies(params: {
  search?: string;
  minQuality?: number;
  page?: number;
  pageSize?: number;
}): Promise<AgenciesResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (typeof params.minQuality === "number") query.set("minQuality", String(params.minQuality));
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  return fetchApi<AgenciesResponse>(`/agencies?${query.toString()}`);
}

export async function getAgencyDetail(agencyId: number, days = 180): Promise<AgencyDetailResponse> {
  return fetchApi<AgencyDetailResponse>(`/agencies/${agencyId}?days=${days}`);
}
