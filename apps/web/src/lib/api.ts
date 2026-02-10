import type {
  DatasetsResponse,
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
  page?: number;
  pageSize?: number;
}): Promise<DatasetsResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.agency) query.set("agency", params.agency);
  if (params.tag) query.set("tag", params.tag);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  return fetchApi<DatasetsResponse>(`/datasets?${query.toString()}`);
}
