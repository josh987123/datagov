import { useMemo, useState, type ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock3,
  Database,
  FileBarChart2,
  FolderTree,
  Gauge,
  Layers3,
  PlusCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartPanel } from "./components/ChartPanel";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { MetricCard } from "./components/MetricCard";
import { RecentDatasetsTable } from "./components/RecentDatasetsTable";
import { formatCompact, formatDateTime, formatNumber, formatPercent, truncate } from "./lib/format";
import type { DashboardData } from "./types";

const PIE_COLORS = ["#8b5cf6", "#6366f1", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16", "#f59e0b"];

function formatTooltipValue(value: number | string | undefined): string {
  if (typeof value === "number") {
    return formatNumber(value);
  }

  const parsed = Number(value ?? 0);
  return formatNumber(Number.isFinite(parsed) ? parsed : 0);
}

async function fetchDashboardSnapshot(): Promise<DashboardData> {
  const response = await fetch(`${import.meta.env.BASE_URL}dashboard-data.json`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Dashboard snapshot unavailable (${response.status})`);
  }

  const payload = (await response.json()) as DashboardData;
  return payload;
}

export default function App() {
  const [isRecentExpanded, setIsRecentExpanded] = useState(true);
  const [recentSearch, setRecentSearch] = useState("");
  const [recentLimit, setRecentLimit] = useState(12);

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["datagov-dashboard-snapshot"],
    queryFn: fetchDashboardSnapshot,
    refetchInterval: 1000 * 60 * 10,
  });

  const chartData = useMemo(() => {
    if (!data) {
      return {
        topFormats: [],
        topPublishers: [],
        licenses: [],
        tags: [],
        freshnessBuckets: [],
        ageBuckets: [],
        dailyTrend: [],
        resourceHistogram: [],
        licenseComposition: [],
      };
    }

    return {
      topFormats: data.topFormats.map((item) => ({
        name: truncate(item.label, 18),
        value: item.count,
      })),
      topPublishers: data.topPublishers.slice(0, 8).map((item) => ({
        label: truncate(item.label, 28),
        count: item.count,
      })),
      licenses: data.licenses.map((item) => ({
        name: truncate(item.label, 22),
        value: item.count,
      })),
      tags: data.topTags.slice(0, 10).map((item) => ({
        label: truncate(item.label, 24),
        count: item.count,
      })),
      freshnessBuckets: data.analytics.freshnessBuckets.map((bucket) => ({
        label: bucket.label,
        count: bucket.count,
        share: bucket.share,
      })),
      ageBuckets: data.analytics.ageBuckets.map((bucket) => ({
        label: bucket.label,
        count: bucket.count,
        share: bucket.share,
      })),
      dailyTrend: data.analytics.dailyTrend,
      resourceHistogram: data.analytics.resourceHistogram,
      licenseComposition: [
        { name: "Open", value: data.analytics.licenseSummary.openCount },
        { name: "Restricted/other", value: data.analytics.licenseSummary.restrictedCount },
        { name: "Unspecified", value: data.analytics.licenseSummary.unspecifiedCount },
      ].filter((item) => item.value > 0),
    };
  }, [data]);

  const matchingRecentDatasets = useMemo(() => {
    if (!data) {
      return [];
    }

    const query = recentSearch.trim().toLowerCase();
    if (query.length === 0) {
      return data.recentDatasets;
    }

    return data.recentDatasets.filter((dataset) => {
      const combined = [
        dataset.title,
        dataset.organization,
        dataset.formats.join(" "),
        dataset.metadataModified,
      ]
        .join(" ")
        .toLowerCase();

      return combined.includes(query);
    });
  }, [data, recentSearch]);

  const visibleRecentDatasets = useMemo(
    () => matchingRecentDatasets.slice(0, recentLimit),
    [matchingRecentDatasets, recentLimit],
  );

  const onLimitChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const parsed = Number(event.target.value);
    setRecentLimit(Number.isFinite(parsed) ? parsed : 12);
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (!data) {
    const message = error instanceof Error ? error.message : "Unknown API error";
    return <ErrorState message={message} onRetry={() => void refetch()} />;
  }

  const refreshHint = isFetching
    ? "Refreshing snapshot..."
    : `Snapshot generated ${formatDateTime(data.generatedAt)}`;

  return (
    <main className="dashboard-shell">
      <div className="decor decor--top" />
      <div className="decor decor--bottom" />
      <div className="dashboard">
        <header className="hero">
          <div>
            <p className="eyebrow">Federal open-data intelligence</p>
            <h1>Data.gov Metrics Command Center</h1>
            <p className="hero__subtitle">
              A high-level view of catalog scale, content freshness, resource formats, and top
              publishers from the Data.gov CKAN metadata API.
            </p>
            <p className="hero__timestamp">{refreshHint}</p>
            <div className="hero__insights">
              <span className="insight-pill">
                7-day momentum: {data.analytics.velocity.weeklyMomentum.toFixed(2)}x baseline
              </span>
              <span className="insight-pill">
                Open-license share: {formatPercent(data.analytics.licenseSummary.openShare / 100)}
              </span>
              <span className="insight-pill">
                Top publisher concentration: {formatPercent(data.analytics.concentration.top1Share / 100)}
              </span>
            </div>
          </div>
          <div className="hero__controls">
            <div className="api-form">
              <label>Data source mode</label>
              <p className="hero__mode-note">
                Snapshot data is generated at deploy time to avoid Data.gov browser CORS blocks.
              </p>
            </div>
            <button type="button" className="secondary-button" onClick={() => void refetch()}>
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>
        </header>

        <section className="metrics-grid">
          <MetricCard
            title="Total datasets"
            value={formatNumber(data.kpis.totalDatasets)}
            hint="Indexed records in Data.gov catalog"
            icon={<Database size={18} />}
            accent="violet"
          />
          <MetricCard
            title="Active publishers"
            value={formatNumber(data.kpis.organizations)}
            hint="Organizations with indexed datasets"
            icon={<Building2 size={18} />}
            accent="cyan"
          />
          <MetricCard
            title="Updated (30 days)"
            value={formatCompact(data.kpis.updatedLast30Days)}
            hint="Records modified in the last month"
            icon={<Clock3 size={18} />}
            accent="emerald"
          />
          <MetricCard
            title="Created (30 days)"
            value={formatCompact(data.kpis.createdLast30Days)}
            hint="Newly created metadata records"
            icon={<PlusCircle size={18} />}
            accent="amber"
          />
          <MetricCard
            title="Freshness score"
            value={formatPercent(data.kpis.freshnessScore / 100)}
            hint="Share updated within the last 90 days"
            icon={<Sparkles size={18} />}
            accent="violet"
          />
          <MetricCard
            title="Updated (90 days)"
            value={formatCompact(data.kpis.updatedLast90Days)}
            hint="Broader quarter-over-quarter activity"
            icon={<Activity size={18} />}
            accent="cyan"
          />
          <MetricCard
            title="Catalog groups"
            value={formatNumber(data.kpis.groups)}
            hint="Distinct collection groupings"
            icon={<FolderTree size={18} />}
            accent="emerald"
          />
          <MetricCard
            title="Top formats tracked"
            value={formatNumber(data.kpis.distinctFormats)}
            hint="Distinct resource formats in leaderboard"
            icon={<FileBarChart2 size={18} />}
            accent="amber"
          />
          <MetricCard
            title="Updated (7 days)"
            value={formatCompact(data.kpis.updatedLast7Days)}
            hint="Recently refreshed metadata records"
            icon={<CalendarClock size={18} />}
            accent="violet"
          />
          <MetricCard
            title="Created (7 days)"
            value={formatCompact(data.kpis.createdLast7Days)}
            hint="New metadata records this week"
            icon={<PlusCircle size={18} />}
            accent="cyan"
          />
          <MetricCard
            title="Updated (12 months)"
            value={formatCompact(data.kpis.updatedLast365Days)}
            hint="Yearly rolling update activity"
            icon={<BarChart3 size={18} />}
            accent="emerald"
          />
          <MetricCard
            title="Update velocity (30d)"
            value={`${formatNumber(Math.round(data.analytics.velocity.updatesPerDay30))}/day`}
            hint="Average metadata modifications per day"
            icon={<Gauge size={18} />}
            accent="amber"
          />
          <MetricCard
            title="Open-license share"
            value={formatPercent(data.analytics.licenseSummary.openShare / 100)}
            hint="Records with open/public license IDs"
            icon={<ShieldCheck size={18} />}
            accent="violet"
          />
          <MetricCard
            title="Avg resources/dataset"
            value={data.analytics.resourceCoverage.avgResources.toFixed(1)}
            hint={`From ${formatNumber(data.analytics.resourceCoverage.sampleSize)} recent datasets`}
            icon={<Layers3 size={18} />}
            accent="cyan"
          />
        </section>

        <section className="panel-grid panel-grid--two">
          <ChartPanel
            title="Metadata activity momentum"
            subtitle="Comparative count of records created versus modified across time windows"
          >
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.activitySeries} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="modifiedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="createdFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  tickFormatter={(value: number) => formatCompact(value)}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={formatTooltipValue}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid rgba(148, 163, 184, 0.25)",
                    borderRadius: "12px",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="modified"
                  name="Modified"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#modifiedFill)"
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fill="url(#createdFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Daily metadata pulse" subtitle="Created vs modified counts for the last 14 days">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.dailyTrend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  tickFormatter={(value: number) => formatCompact(value)}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={formatTooltipValue}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid rgba(148, 163, 184, 0.25)",
                    borderRadius: "12px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="modified"
                  name="Modified"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        </section>

        <section className="panel-grid panel-grid--two">
          <ChartPanel title="Top publishers" subtitle="Largest dataset publishers in the active catalog">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.topPublishers} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis type="number" tickFormatter={formatCompact} stroke="#94a3b8" axisLine={false} />
                <YAxis
                  dataKey="label"
                  type="category"
                  width={180}
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={formatTooltipValue}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid rgba(148, 163, 184, 0.25)",
                    borderRadius: "12px",
                  }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Freshness profile" subtitle="How recently datasets have been updated">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.freshnessBuckets} margin={{ top: 8, right: 12, left: -10, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tickLine={false} axisLine={false} />
                <Tooltip formatter={formatTooltipValue} />
                <Bar dataKey="count" fill="#14b8a6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        </section>

        <section className="panel-grid panel-grid--three">
          <ChartPanel title="Resource format distribution" subtitle="Most common resource formats attached to datasets">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData.topFormats}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={102}
                  paddingAngle={2}
                  label={({ name }) => name}
                  labelLine={false}
                >
                  {chartData.topFormats.map((entry, index) => (
                    <Cell key={`format-cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={formatTooltipValue} />
              </PieChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="License clarity composition" subtitle="Open, restrictive, and unspecified licensing">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData.licenseComposition}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={96}
                  paddingAngle={2}
                  label={({ name }) => name}
                  labelLine={false}
                >
                  {chartData.licenseComposition.map((entry, index) => (
                    <Cell key={`license-cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={formatTooltipValue} />
              </PieChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Top tags" subtitle="Frequently used metadata tags">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData.tags} margin={{ top: 6, right: 8, bottom: 10, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  angle={-32}
                  textAnchor="end"
                  interval={0}
                  height={86}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tickLine={false} axisLine={false} />
                <Tooltip formatter={formatTooltipValue} />
                <Bar dataKey="count" fill="#22c55e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        </section>

        <section className="panel-grid panel-grid--three">
          <ChartPanel title="Catalog age composition" subtitle="How old datasets are based on metadata creation">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData.ageBuckets} margin={{ top: 8, right: 10, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tickLine={false} axisLine={false} />
                <Tooltip formatter={formatTooltipValue} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Resource depth histogram" subtitle="Resource counts across recent sampled datasets">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData.resourceHistogram} margin={{ top: 8, right: 10, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tickLine={false} axisLine={false} />
                <Tooltip formatter={formatTooltipValue} />
                <Bar dataKey="count" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Concentration and quality diagnostics" subtitle="Publisher concentration, license quality, and velocity">
            <div className="insight-grid">
              <div className="insight-item">
                <span>Top 1 publisher share</span>
                <strong>{formatPercent(data.analytics.concentration.top1Share / 100)}</strong>
              </div>
              <div className="insight-item">
                <span>Top 5 publisher share</span>
                <strong>{formatPercent(data.analytics.concentration.top5Share / 100)}</strong>
              </div>
              <div className="insight-item">
                <span>Top 10 publisher share</span>
                <strong>{formatPercent(data.analytics.concentration.top10Share / 100)}</strong>
              </div>
              <div className="insight-item">
                <span>Publisher HHI</span>
                <strong>{formatNumber(Math.round(data.analytics.concentration.hhi))}</strong>
              </div>
              <div className="insight-item">
                <span>Format diversity score</span>
                <strong>{formatPercent(data.analytics.formatInsights.diversityScore / 100)}</strong>
              </div>
              <div className="insight-item">
                <span>Top-3 format share</span>
                <strong>{formatPercent(data.analytics.formatInsights.top3Share / 100)}</strong>
              </div>
              <div className="insight-item">
                <span>Update/create ratio (30d)</span>
                <strong>{data.analytics.velocity.updateToCreateRatio.toFixed(2)}x</strong>
              </div>
              <div className="insight-item">
                <span>Datasets with no resources</span>
                <strong>{formatPercent(data.analytics.resourceCoverage.noResourceShare / 100)}</strong>
              </div>
              <div className="insight-item">
                <span>Median resources/dataset</span>
                <strong>{data.analytics.resourceCoverage.medianResources.toFixed(1)}</strong>
              </div>
            </div>
          </ChartPanel>
        </section>

        <section className="panel-grid panel-grid--two">
          <ChartPanel title="Publisher share leaderboard" subtitle="Top agencies by share of total indexed datasets">
            <div className="progress-stack">
              {data.analytics.publisherShares.map((publisher) => (
                <div key={publisher.label} className="progress-row">
                  <div className="progress-row__label">
                    <span>{truncate(publisher.label, 42)}</span>
                    <strong>{formatPercent(publisher.share / 100)}</strong>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${Math.min(publisher.share, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </ChartPanel>

          <ChartPanel title="License and resource summary" subtitle="Macro-level data quality signals">
            <div className="insight-grid">
              <div className="insight-item">
                <span>Open-license records</span>
                <strong>{formatCompact(data.analytics.licenseSummary.openCount)}</strong>
              </div>
              <div className="insight-item">
                <span>Unspecified-license records</span>
                <strong>{formatCompact(data.analytics.licenseSummary.unspecifiedCount)}</strong>
              </div>
              <div className="insight-item">
                <span>Restricted/other-license records</span>
                <strong>{formatCompact(data.analytics.licenseSummary.restrictedCount)}</strong>
              </div>
              <div className="insight-item">
                <span>Total resources in sample</span>
                <strong>{formatCompact(data.analytics.resourceCoverage.totalResources)}</strong>
              </div>
              <div className="insight-item">
                <span>Max resources (sample)</span>
                <strong>{formatNumber(data.analytics.resourceCoverage.maxResources)}</strong>
              </div>
              <div className="insight-item">
                <span>Sample size</span>
                <strong>{formatNumber(data.analytics.resourceCoverage.sampleSize)}</strong>
              </div>
            </div>
          </ChartPanel>
        </section>

        <ChartPanel
          title="Recently modified datasets"
          subtitle="Latest metadata updates across federal publishers"
          actions={
            <button
              type="button"
              className="secondary-button secondary-button--compact"
              onClick={() => setIsRecentExpanded((isExpanded) => !isExpanded)}
            >
              {isRecentExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {isRecentExpanded ? "Collapse" : "Expand"}
            </button>
          }
        >
          {isRecentExpanded ? (
            <>
              <div className="recent-toolbar">
                <div className="search-input">
                  <Search size={15} />
                  <input
                    type="text"
                    value={recentSearch}
                    onChange={(event) => setRecentSearch(event.target.value)}
                    placeholder="Search title, publisher, format..."
                  />
                </div>
                <label className="recent-limit">
                  Rows
                  <select value={recentLimit} onChange={onLimitChange}>
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                  </select>
                </label>
                <p className="recent-summary">
                  Showing {formatNumber(visibleRecentDatasets.length)} of{" "}
                  {formatNumber(matchingRecentDatasets.length)} matching datasets
                </p>
              </div>
              <RecentDatasetsTable rows={visibleRecentDatasets} />
            </>
          ) : (
            <p className="collapsed-message">
              Section collapsed. Expand to inspect the most recently modified datasets.
            </p>
          )}
        </ChartPanel>
      </div>
    </main>
  );
}
