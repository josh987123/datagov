export interface FacetItem {
  name: string;
  label: string;
  count: number;
}

export interface TimeSeriesPoint {
  label: string;
  modified: number;
  created: number;
}

export interface DistributionBucket {
  label: string;
  count: number;
  share: number;
}

export interface DailyTrendPoint {
  label: string;
  modified: number;
  created: number;
}

export interface PublisherSharePoint {
  label: string;
  count: number;
  share: number;
}

export interface ResourceHistogramBucket {
  label: string;
  count: number;
}

export interface RecentDataset {
  id: string;
  title: string;
  organization: string;
  metadataModified: string;
  metadataCreated: string;
  resourceCount: number;
  formats: string[];
}

export interface DashboardKpis {
  totalDatasets: number;
  organizations: number;
  groups: number;
  distinctFormats: number;
  updatedLast7Days: number;
  createdLast7Days: number;
  updatedLast30Days: number;
  createdLast30Days: number;
  updatedLast90Days: number;
  updatedLast365Days: number;
  freshnessScore: number;
}

export interface VelocityMetrics {
  updatesPerDay30: number;
  creationsPerDay30: number;
  updateToCreateRatio: number;
  weeklyMomentum: number;
}

export interface ConcentrationMetrics {
  top1Share: number;
  top5Share: number;
  top10Share: number;
  hhi: number;
}

export interface LicenseSummary {
  openCount: number;
  restrictedCount: number;
  unspecifiedCount: number;
  openShare: number;
  unspecifiedShare: number;
}

export interface ResourceCoverage {
  sampleSize: number;
  totalResources: number;
  avgResources: number;
  medianResources: number;
  maxResources: number;
  datasetsWithNoResources: number;
  noResourceShare: number;
}

export interface FormatInsights {
  top3Share: number;
  diversityScore: number;
}

export interface DashboardAnalytics {
  freshnessBuckets: DistributionBucket[];
  ageBuckets: DistributionBucket[];
  dailyTrend: DailyTrendPoint[];
  publisherShares: PublisherSharePoint[];
  resourceHistogram: ResourceHistogramBucket[];
  velocity: VelocityMetrics;
  concentration: ConcentrationMetrics;
  licenseSummary: LicenseSummary;
  resourceCoverage: ResourceCoverage;
  formatInsights: FormatInsights;
}

export interface DashboardData {
  kpis: DashboardKpis;
  topPublishers: FacetItem[];
  topFormats: FacetItem[];
  licenses: FacetItem[];
  topTags: FacetItem[];
  activitySeries: TimeSeriesPoint[];
  analytics: DashboardAnalytics;
  recentDatasets: RecentDataset[];
  generatedAt: string;
}
