import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  Clock3,
  Database,
  FileBarChart2,
  FolderTree,
  PlusCircle,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { fetchDashboardData } from "./lib/datagov";
import { formatCompact, formatDateTime, formatNumber, formatPercent, truncate } from "./lib/format";

const API_KEY_STORAGE_KEY = "datagov.dashboard.apiKey";
const PIE_COLORS = ["#8b5cf6", "#6366f1", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16", "#f59e0b"];

function formatTooltipValue(value: number | string | undefined): string {
  if (typeof value === "number") {
    return formatNumber(value);
  }

  const parsed = Number(value ?? 0);
  return formatNumber(Number.isFinite(parsed) ? parsed : 0);
}

function resolveInitialApiKey(): string {
  const envKey = import.meta.env.VITE_DATA_GOV_API_KEY ?? "";

  if (typeof window === "undefined") {
    return envKey;
  }

  const savedKey = window.localStorage.getItem(API_KEY_STORAGE_KEY);
  return savedKey ?? envKey;
}

export default function App() {
  const [apiKeyInput, setApiKeyInput] = useState(() => resolveInitialApiKey());
  const [activeApiKey, setActiveApiKey] = useState(() => resolveInitialApiKey());

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["datagov-dashboard", activeApiKey],
    queryFn: () => fetchDashboardData(activeApiKey),
    refetchInterval: 1000 * 60 * 10,
  });

  const chartData = useMemo(() => {
    if (!data) {
      return {
        topFormats: [],
        topPublishers: [],
        licenses: [],
        tags: [],
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
    };
  }, [data]);

  const saveApiKey = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = apiKeyInput.trim();
    setActiveApiKey(normalized);

    if (normalized.length > 0) {
      window.localStorage.setItem(API_KEY_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (!data) {
    const message = error instanceof Error ? error.message : "Unknown API error";
    return <ErrorState message={message} onRetry={() => void refetch()} />;
  }

  const refreshHint = isFetching ? "Refreshing data..." : `Updated ${formatDateTime(data.generatedAt)}`;

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
              A live, high-level view of catalog scale, content freshness, resource formats, and
              top publishers from the Data.gov CKAN metadata API.
            </p>
            <p className="hero__timestamp">{refreshHint}</p>
          </div>
          <div className="hero__controls">
            <form className="api-form" onSubmit={saveApiKey}>
              <label htmlFor="apiKey">Optional API key</label>
              <div className="api-form__row">
                <input
                  id="apiKey"
                  type="password"
                  placeholder="Paste Data.gov API key"
                  value={apiKeyInput}
                  onChange={(event) => setApiKeyInput(event.target.value)}
                />
                <button type="submit" className="primary-button">
                  Apply
                </button>
              </div>
            </form>
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

          <ChartPanel title="License profile" subtitle="License identifiers currently represented in the catalog">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData.licenses}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={96}
                  paddingAngle={2}
                  label={({ name }) => name}
                  labelLine={false}
                >
                  {chartData.licenses.map((entry, index) => (
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

        <ChartPanel
          title="Recently modified datasets"
          subtitle="Latest metadata updates across federal publishers"
        >
          <RecentDatasetsTable rows={data.recentDatasets} />
        </ChartPanel>
      </div>
    </main>
  );
}
