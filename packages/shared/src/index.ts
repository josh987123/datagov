export type IngestRunStatus = "RUNNING" | "SUCCESS" | "FAILED";
export type LinkHealthStatus = "UNKNOWN" | "HEALTHY" | "BROKEN";
export type InsightSeverity = "positive" | "info" | "watch" | "alert";

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
  avgQualityScore: number;
  avgOpennessScore: number;
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
  averageQualityScore: number;
  averageOpennessScore: number;
  staleDatasetCount: number;
  staleDatasetShare: number;
  openFormatShare: number;
  apiResourceShare: number;
  brokenLinkCount: number;
  topAgencies: TopAgency[];
  mostCommonTags: TopTag[];
  lastIngest: IngestRunSummary | null;
}

export interface TrendPoint {
  date: string;
  totalDatasets: number;
  netDatasetChange: number;
  datasetsAdded7d: number;
  datasetsAdded30d: number;
  avgQualityScore: number;
  avgOpennessScore: number;
  staleDatasetShare: number;
  openFormatShare: number;
  apiResourceShare: number;
  brokenLinkCount: number;
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
  resourceCount: number;
  tagCount: number;
  qualityScore: number;
  opennessScore: number;
  freshnessScore: number;
  daysSinceModified: number | null;
  linkStatus: LinkHealthStatus;
  linkHttpStatus: number | null;
  hasApiResource: boolean;
  hasOpenFormat: boolean;
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

export interface AgencyListItem {
  id: number;
  name: string;
  datasetCount: number;
  avgQualityScore: number;
  avgOpennessScore: number;
  staleShare: number;
  openFormatShare: number;
  growth30d: number;
  rank: number;
}

export interface AgenciesResponse {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  data: AgencyListItem[];
}

export interface AgencyFreshnessBucket {
  label: string;
  count: number;
}

export interface AgencyTagCount {
  name: string;
  count: number;
}

export interface AgencyDetailSummary {
  id: number;
  name: string;
  datasetCount: number;
  avgQualityScore: number;
  avgOpennessScore: number;
  staleShare: number;
  openFormatShare: number;
  apiResourceShare: number;
  brokenLinkShare: number;
  growth30d: number;
  growth90d: number;
}

export interface AgencyDetailResponse {
  summary: AgencyDetailSummary;
  trend: AgencyTrendPoint[];
  topTags: AgencyTagCount[];
  freshnessBuckets: AgencyFreshnessBucket[];
  recentDatasets: DatasetListItem[];
}

export interface InsightItem {
  id: string;
  severity: InsightSeverity;
  title: string;
  summary: string;
  whyItMatters: string;
  recommendation: string;
  metric: string;
  delta: number;
}

export interface MetricsInsightsResponse {
  generatedAt: string;
  windowDays: number;
  insights: InsightItem[];
}

export interface IngestRunsResponse {
  data: IngestRunSummary[];
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
