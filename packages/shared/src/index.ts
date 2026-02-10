export type IngestRunStatus = "RUNNING" | "SUCCESS" | "FAILED";

export interface HealthResponse {
  status: "ok" | "error";
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  database: "ok" | "error";
}

export interface TopAgency {
  id: number;
  name: string;
  datasetCount: number;
}

export interface TopTag {
  id: number;
  name: string;
  datasetCount: number;
}

export interface IngestRunSummary {
  id: number;
  status: IngestRunStatus;
  startedAt: string;
  finishedAt: string | null;
  totalFromSource: number | null;
  processedCount: number;
  insertedCount: number;
  updatedCount: number;
  message: string | null;
}

export interface MetricsSummaryResponse {
  totalDatasets: number;
  datasetsAddedLast7Days: number;
  datasetsAddedLast30Days: number;
  topAgencies: TopAgency[];
  mostCommonTags: TopTag[];
  lastIngest: IngestRunSummary | null;
}

export interface TrendPoint {
  date: string;
  totalDatasets: number;
  datasetsAdded7d: number;
  datasetsAdded30d: number;
}

export interface AgencyTrendPoint {
  date: string;
  datasetCount: number;
}

export interface AgencyTrendSeries {
  agencyId: number;
  agencyName: string;
  points: AgencyTrendPoint[];
}

export interface MetricsTrendsResponse {
  days: number;
  totals: TrendPoint[];
  topAgenciesOverTime: AgencyTrendSeries[];
}

export interface DatasetListItem {
  id: number;
  ckanId: string;
  title: string;
  notes: string | null;
  metadataCreated: string | null;
  metadataModified: string | null;
  sourceUrl: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  agency: string | null;
  tags: string[];
}

export interface DatasetsResponse {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  data: DatasetListItem[];
}

export interface IngestRunResponse {
  run: IngestRunSummary;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  ok: boolean;
  message: string;
}

export interface SessionResponse {
  authenticated: boolean;
  email?: string;
}
