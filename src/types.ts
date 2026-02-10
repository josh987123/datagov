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

export interface MonthlyTrendPoint {
  label: string;
  modified: number;
  created: number;
}

export interface ValueTrendPoint {
  label: string;
  value: number;
}

export interface SpendingTrendPoint {
  label: string;
  outlays: number;
  receipts: number;
  deficit: number;
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

export type AlertLevel = "good" | "watch" | "risk";

export interface AlertSignal {
  id: string;
  title: string;
  level: AlertLevel;
  metric: string;
  detail: string;
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

export interface PeriodComparison {
  updatedCurrent7Days: number;
  updatedPrevious7Days: number;
  createdCurrent7Days: number;
  createdPrevious7Days: number;
  updatedDeltaPct: number;
  createdDeltaPct: number;
}

export interface GroupCoverage {
  top3Share: number;
}

export interface DashboardAnalytics {
  freshnessBuckets: DistributionBucket[];
  ageBuckets: DistributionBucket[];
  dailyTrend: DailyTrendPoint[];
  monthlyTrend: MonthlyTrendPoint[];
  publisherShares: PublisherSharePoint[];
  resourceHistogram: ResourceHistogramBucket[];
  velocity: VelocityMetrics;
  concentration: ConcentrationMetrics;
  licenseSummary: LicenseSummary;
  resourceCoverage: ResourceCoverage;
  formatInsights: FormatInsights;
  periodComparison: PeriodComparison;
  groupCoverage: GroupCoverage;
  alerts: AlertSignal[];
}

export interface SourceMetadata {
  siteTitle: string;
  ckanVersion: string;
  apiBase: string;
  snapshotStrategy: string;
}

export interface EconomySnapshot {
  population: number;
  households: number;
  medianIncome: number;
  perCapitaIncome: number;
  medianHomeValue: number;
  medianRent: number;
  medianAge: number;
  giniIndex: number;
  povertyRate: number;
  internetAccessRate: number;
  laborForce: number;
  unemploymentPersons: number;
  unemploymentRate: number;
  unemploymentRate3mAvg: number;
  unemploymentRateMoMDelta: number;
  unemploymentRateYoYDelta: number;
  underemploymentRate: number;
  underemploymentGap: number;
  longTermUnemploymentShare: number;
  sahmRuleValue: number;
  laborForceParticipationRate: number;
  laborForceParticipationMoMDelta: number;
  employmentPopulationRatio: number;
  employmentPopulationMoMDelta: number;
  nonfarmPayrollEmployment: number;
  payrollMoMChange: number;
  payrollYoYChange: number;
  payroll3mAvgChange: number;
  cpiIndex: number;
  cpiMoM: number;
  coreCpiIndex: number;
  coreInflationYoY: number;
  coreInflationMoM: number;
  inflationGapToTarget: number;
  inflationVsCoreSpread: number;
  inflationYoY: number;
  inflationYoY3mAvg: number;
  averageHourlyEarnings: number;
  hourlyEarningsMoM: number;
  hourlyEarningsYoY: number;
  hourlyEarningsYoY3mAvg: number;
  averageWeeklyHours: number;
  averageWeeklyHoursYoY: number;
  weeklyEarnings: number;
  weeklyEarningsYoY: number;
  realWeeklyEarningsYoY: number;
  realWageYoY: number;
  realWageYoY3mAvg: number;
  totalPublicDebt: number;
  debtHeldByPublic: number;
  intragovernmentalHoldings: number;
  debtHeldByPublicShare: number;
  intragovShare: number;
  debtChange7Days: number;
  debtChange30Days: number;
  debtChange365Days: number;
  debtChange7DaysPct: number;
  debtChange30DaysPct: number;
  debtChange365DaysPct: number;
  debtYoYGrowthPct: number;
  avgDailyDebtChange30: number;
  debtDailyVolatility30: number;
  maxDailyDebtIncrease30: number;
  maxDailyDebtDecrease30: number;
  debtPerCapita: number;
  debtToIncomeRatio: number;
  latestOutlays: number;
  latestReceipts: number;
  latestDeficit: number;
  receiptsToOutlaysRatio: number;
  deficitToOutlaysRatio: number;
  deficitShare3mAvg: number;
  outlays3mAvg: number;
  receipts3mAvg: number;
  outlaysPerCapita: number;
  receiptsPerCapita: number;
  deficitPerCapita: number;
  trailing12Outlays: number;
  trailing12Receipts: number;
  trailing12Deficit: number;
  avgMonthlyOutlays12: number;
  avgMonthlyReceipts12: number;
  avgMonthlyDeficit12: number;
  deficitVolatility12: number;
  deficitPeakToTrough12: number;
  fiscalImpulseYoY: number;
  outlaysYoY: number;
  receiptsYoY: number;
  deficitYoY: number;
  deficitStreakMonths: number;
  surplusMonthsLast12: number;
  largestDeficitMonth: string;
  largestDeficitAmount: number;
  largestSurplusMonth: string;
  largestSurplusAmount: number;
  housingUnits: number;
  vacantHousingUnits: number;
  ownerOccupiedHousingUnits: number;
  renterOccupiedHousingUnits: number;
  vacancyRate: number;
  homeownershipRate: number;
  renterShareOfOccupied: number;
  severeRentBurdenShare: number;
  ownerCostBurdenShare: number;
  singleFamilyHousingShare: number;
  multiFamilyHousingShare: number;
  mobileHomeShare: number;
  personsPerHousehold: number;
  childPopulationShare: number;
  seniorPopulationShare: number;
  workingAgePopulationShare: number;
  dependencyRatio: number;
  femalePopulationShare: number;
  highSchoolOrHigherShare: number;
  lessThanHighSchoolShare: number;
  longCommuteShare: number;
  zeroVehicleShare: number;
  bachelorsOrHigherShare: number;
  homeValueToIncomeRatio: number;
  annualRentToIncomeRatio: number;
  grossPrivateDomesticInvestment: number | null;
  personalSavingRate: number | null;
  beaDataAvailable: boolean;
}

export interface EconomyTrends {
  monthlySpending: SpendingTrendPoint[];
  debtDaily: ValueTrendPoint[];
  debtDailyChange: ValueTrendPoint[];
  unemploymentRate: ValueTrendPoint[];
  underemploymentRate: ValueTrendPoint[];
  unemploymentGap: ValueTrendPoint[];
  laborForceParticipationRate: ValueTrendPoint[];
  employmentPopulationRatio: ValueTrendPoint[];
  inflationYoY: ValueTrendPoint[];
  coreInflationYoY: ValueTrendPoint[];
  cpiMoM: ValueTrendPoint[];
  hourlyEarningsYoY: ValueTrendPoint[];
  hourlyEarningsMoM: ValueTrendPoint[];
  weeklyEarningsYoY: ValueTrendPoint[];
  realWageYoY: ValueTrendPoint[];
  deficitShareOfOutlays: ValueTrendPoint[];
  deficit3mAvg: ValueTrendPoint[];
  outlays3mAvg: ValueTrendPoint[];
  receipts3mAvg: ValueTrendPoint[];
  nonfarmPayroll: ValueTrendPoint[];
  payrollMoMChange: ValueTrendPoint[];
}

export interface EconomyData {
  snapshot: EconomySnapshot;
  trends: EconomyTrends;
}

export interface DashboardData {
  kpis: DashboardKpis;
  topPublishers: FacetItem[];
  topGroups: FacetItem[];
  topFormats: FacetItem[];
  licenses: FacetItem[];
  topTags: FacetItem[];
  activitySeries: TimeSeriesPoint[];
  analytics: DashboardAnalytics;
  economy: EconomyData;
  recentDatasets: RecentDataset[];
  source: SourceMetadata;
  generatedAt: string;
}
