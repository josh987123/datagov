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
  updatedLast30Days: number;
  createdLast30Days: number;
  updatedLast90Days: number;
  freshnessScore: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  topPublishers: FacetItem[];
  topFormats: FacetItem[];
  licenses: FacetItem[];
  topTags: FacetItem[];
  activitySeries: TimeSeriesPoint[];
  recentDatasets: RecentDataset[];
  generatedAt: string;
}
