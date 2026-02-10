import { useMemo, useState, type ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  FileBarChart2,
  FolderTree,
  Gauge,
  Globe2,
  Home,
  Landmark,
  Layers3,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HashRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { ChartPanel } from "./components/ChartPanel";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { MetricCard } from "./components/MetricCard";
import { RecentDatasetsTable } from "./components/RecentDatasetsTable";
import { formatCompact, formatDateTime, formatNumber, formatPercent, truncate } from "./lib/format";
import type { DashboardData } from "./types";

const PIE_COLORS = ["#8b5cf6", "#6366f1", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16", "#f59e0b"];

const CATEGORY_LINKS = [
  { to: "/", label: "Overview", end: true },
  { to: "/economy", label: "Economy" },
  { to: "/labor-prices", label: "Labor & Prices" },
  { to: "/fiscal", label: "Spending & Debt" },
  { to: "/demographics", label: "Demographics" },
  { to: "/catalog", label: "Catalog Context" },
];

function formatTooltipValue(value: number | string | undefined): string {
  if (typeof value === "number") {
    return formatNumber(value);
  }

  const parsed = Number(value ?? 0);
  return formatNumber(Number.isFinite(parsed) ? parsed : 0);
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatCurrencyCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${formatCompact(Math.abs(value))}`;
}

function formatRatio(value: number, digits = 2): string {
  return `${value.toFixed(digits)}x`;
}

function escapeCsvCell(value: string | number): string {
  const asString = String(value);
  if (/[",\n]/.test(asString)) {
    return `"${asString.replaceAll("\"", "\"\"")}"`;
  }

  return asString;
}

function triggerDownload(filename: string, payload: string, mimeType: string): void {
  const blob = new Blob([payload], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

  return (await response.json()) as DashboardData;
}

interface ChartVm {
  monthlySpending: Array<{ label: string; outlays: number; receipts: number; deficit: number }>;
  debtDaily: Array<{ label: string; value: number }>;
  unemploymentTrend: Array<{ label: string; value: number }>;
  participationTrend: Array<{ label: string; value: number }>;
  employmentPopulationTrend: Array<{ label: string; value: number }>;
  inflationTrend: Array<{ label: string; value: number }>;
  earningsTrend: Array<{ label: string; value: number }>;
  realWageTrend: Array<{ label: string; value: number }>;
  deficitShareTrend: Array<{ label: string; value: number }>;
  payrollTrend: Array<{ label: string; value: number }>;
  macroTrend: Array<{
    label: string;
    unemployment: number;
    inflation: number;
    wageGrowth: number;
    realWage: number;
  }>;
  topFormats: Array<{ name: string; value: number }>;
  topPublishers: Array<{ label: string; count: number }>;
  topGroups: Array<{ label: string; count: number }>;
  tags: Array<{ label: string; count: number }>;
  freshnessBuckets: Array<{ label: string; count: number; share: number }>;
  ageBuckets: Array<{ label: string; count: number; share: number }>;
  resourceHistogram: Array<{ label: string; count: number }>;
  licenseComposition: Array<{ name: string; value: number }>;
  housingComposition: Array<{ name: string; value: number }>;
}

function buildChartVm(data: DashboardData): ChartVm {
  const unemploymentTrend = (data.economy.trends.unemploymentRate ?? []).slice(-120);
  const participationTrend = (data.economy.trends.laborForceParticipationRate ?? []).slice(-120);
  const employmentPopulationTrend = (data.economy.trends.employmentPopulationRatio ?? []).slice(-120);
  const inflationTrend = (data.economy.trends.inflationYoY ?? []).slice(-120);
  const earningsTrend = (data.economy.trends.hourlyEarningsYoY ?? []).slice(-120);
  const realWageTrend = (data.economy.trends.realWageYoY ?? []).slice(-120);
  const payrollTrend = (data.economy.trends.nonfarmPayroll ?? []).slice(-120);
  const monthlySpending = (data.economy.trends.monthlySpending ?? []).slice(-60);
  const debtDaily = (data.economy.trends.debtDaily ?? []).slice(-365);
  const deficitShareTrend = (data.economy.trends.deficitShareOfOutlays ?? []).slice(-60);
  const inflationMap = new Map(inflationTrend.map((point) => [point.label, point.value]));
  const wageMap = new Map(earningsTrend.map((point) => [point.label, point.value]));
  const realWageMap = new Map(realWageTrend.map((point) => [point.label, point.value]));

  return {
    monthlySpending,
    debtDaily,
    unemploymentTrend,
    participationTrend,
    employmentPopulationTrend,
    inflationTrend,
    earningsTrend,
    realWageTrend,
    deficitShareTrend,
    payrollTrend,
    macroTrend: unemploymentTrend.map((point) => ({
      label: point.label,
      unemployment: point.value,
      inflation: inflationMap.get(point.label) ?? 0,
      wageGrowth: wageMap.get(point.label) ?? 0,
      realWage: realWageMap.get(point.label) ?? 0,
    })),
    topFormats: data.topFormats.map((item) => ({
      name: truncate(item.label, 18),
      value: item.count,
    })),
    topPublishers: data.topPublishers.slice(0, 8).map((item) => ({
      label: truncate(item.label, 28),
      count: item.count,
    })),
    topGroups: (data.topGroups ?? []).map((group) => ({
      label: truncate(group.label, 24),
      count: group.count,
    })),
    tags: data.topTags.slice(0, 10).map((item) => ({
      label: truncate(item.label, 22),
      count: item.count,
    })),
    freshnessBuckets: data.analytics.freshnessBuckets ?? [],
    ageBuckets: data.analytics.ageBuckets ?? [],
    resourceHistogram: data.analytics.resourceHistogram ?? [],
    licenseComposition: [
      { name: "Open", value: data.analytics.licenseSummary?.openCount ?? 0 },
      { name: "Restricted/other", value: data.analytics.licenseSummary?.restrictedCount ?? 0 },
      { name: "Unspecified", value: data.analytics.licenseSummary?.unspecifiedCount ?? 0 },
    ].filter((item) => item.value > 0),
    housingComposition: [
      { name: "Owner occupied", value: data.economy.snapshot.ownerOccupiedHousingUnits },
      { name: "Renter occupied", value: data.economy.snapshot.renterOccupiedHousingUnits },
      { name: "Vacant units", value: data.economy.snapshot.vacantHousingUnits },
    ].filter((item) => item.value > 0),
  };
}

function CategoryNavigation() {
  return (
    <nav className="category-nav" aria-label="Dashboard categories">
      {CATEGORY_LINKS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => (isActive ? "category-link category-link--active" : "category-link")}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function AlertsList({
  alerts,
}: {
  alerts: DashboardData["analytics"]["alerts"];
}) {
  return (
    <div className="alert-list">
      {alerts.map((alert) => (
        <article key={alert.id} className={`alert-card alert-card--${alert.level}`}>
          <div className="alert-card__header">
            <span className="alert-card__icon">
              {alert.level === "good" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            </span>
            <h4>{alert.title}</h4>
            <strong>{alert.metric}</strong>
          </div>
          <p>{alert.detail}</p>
        </article>
      ))}
    </div>
  );
}

interface IndicatorExplanation {
  metric: string;
  what: string;
  why: string;
}

function IndicatorExplainers({
  title,
  items,
}: {
  title: string;
  items: IndicatorExplanation[];
}) {
  return (
    <section className="explainer-block">
      <h4>{title}</h4>
      <div className="explainer-grid">
        {items.map((item) => (
          <article key={item.metric} className="explainer-item">
            <h5>{item.metric}</h5>
            <p>
              <strong>What:</strong> {item.what}
            </p>
            <p>
              <strong>Why it matters:</strong> {item.why}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function OverviewPage({
  data,
  charts,
}: {
  data: DashboardData;
  charts: ChartVm;
}) {
  const economy = data.economy.snapshot;

  return (
    <div className="page-stack">
      <section className="metrics-grid">
        <MetricCard
          title="U.S. population"
          value={formatCompact(economy.population)}
          hint="ACS 1-year estimate"
          icon={<Users size={18} />}
          accent="violet"
        />
        <MetricCard
          title="Median household income"
          value={formatCurrencyCompact(economy.medianIncome)}
          hint="ACS national median income"
          icon={<Wallet size={18} />}
          accent="cyan"
        />
        <MetricCard
          title="Unemployment rate"
          value={`${economy.unemploymentRate.toFixed(1)}%`}
          hint="BLS household survey"
          icon={<Gauge size={18} />}
          accent="emerald"
        />
        <MetricCard
          title="Inflation (YoY)"
          value={formatSignedPercent(economy.inflationYoY)}
          hint="Consumer price index trend"
          icon={<Sparkles size={18} />}
          accent="amber"
        />
        <MetricCard
          title="Federal outlays"
          value={formatCurrencyCompact(economy.latestOutlays)}
          hint="Latest monthly Treasury outlays"
          icon={<Landmark size={18} />}
          accent="violet"
        />
        <MetricCard
          title="Federal deficit/surplus"
          value={formatCurrencyCompact(economy.latestDeficit)}
          hint="Latest monthly budget balance"
          icon={<BarChart3 size={18} />}
          accent="cyan"
        />
        <MetricCard
          title="Total public debt"
          value={formatCurrencyCompact(economy.totalPublicDebt)}
          hint="Debt to the penny"
          icon={<Database size={18} />}
          accent="emerald"
        />
        <MetricCard
          title="Debt per capita"
          value={formatCurrencyCompact(economy.debtPerCapita)}
          hint="Debt normalized by population"
          icon={<Globe2 size={18} />}
          accent="amber"
        />
        <MetricCard
          title="Real wage growth (YoY)"
          value={formatSignedPercent(economy.realWageYoY)}
          hint="Wage growth net of inflation"
          icon={<Wallet size={18} />}
          accent="violet"
        />
        <MetricCard
          title="Poverty rate"
          value={`${economy.povertyRate.toFixed(1)}%`}
          hint="Share of people below poverty threshold"
          icon={<Users size={18} />}
          accent="cyan"
        />
        <MetricCard
          title="Homeownership rate"
          value={`${economy.homeownershipRate.toFixed(1)}%`}
          hint="Owner-occupied share of occupied units"
          icon={<Home size={18} />}
          accent="emerald"
        />
        <MetricCard
          title="Deficit share of outlays"
          value={`${economy.deficitToOutlaysRatio.toFixed(1)}%`}
          hint="How much spending exceeded receipts"
          icon={<Landmark size={18} />}
          accent="amber"
        />
      </section>

      <section className="panel-grid panel-grid--two">
        <ChartPanel title="Federal spending flow (monthly)" subtitle="Outlays, receipts, and deficit/surplus">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={charts.monthlySpending} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tickLine={false} axisLine={false} />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
              <Line type="monotone" dataKey="outlays" name="Outlays" stroke="#f97316" strokeWidth={2} dot={false} />
              <Line
                type="monotone"
                dataKey="receipts"
                name="Receipts"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="deficit"
                name="Deficit/Surplus"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Labor, inflation, and wage momentum" subtitle="Cross-series macro trend comparison">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={charts.macroTrend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={(value: number) => `${value.toFixed(1)}%`} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}%`} />
              <Legend />
              <Line type="monotone" dataKey="unemployment" name="Unemployment" stroke="#06b6d4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="inflation" name="Inflation YoY" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="wageGrowth" name="Wage YoY" stroke="#14b8a6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      <section className="panel-grid panel-grid--two">
        <ChartPanel title="Public debt trajectory" subtitle="Recent debt-to-the-penny trend">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={charts.debtDaily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="debtFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tickLine={false} axisLine={false} />
              <Tooltip formatter={formatTooltipValue} />
              <Area type="monotone" dataKey="value" name="Total debt" stroke="#ef4444" fill="url(#debtFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Operational alert center" subtitle="Automated health checks across economy and data quality">
          <AlertsList alerts={data.analytics.alerts} />
        </ChartPanel>
      </section>

      <IndicatorExplainers
        title="Overview indicator guide"
        items={[
          {
            metric: "Inflation (YoY)",
            what: "The percentage change in CPI versus the same month last year.",
            why: "Tracks purchasing-power pressure and guides policy/rate expectations.",
          },
          {
            metric: "Unemployment rate",
            what: "The share of labor-force participants actively seeking work.",
            why: "Core gauge of labor-market slack and recession risk.",
          },
          {
            metric: "Federal deficit/surplus",
            what: "Monthly outlays minus receipts (positive values indicate deficits).",
            why: "Signals fiscal pressure and borrowing needs.",
          },
          {
            metric: "Debt per capita",
            what: "Total public debt divided by population.",
            why: "Normalizes debt size to a person-level burden benchmark.",
          },
          {
            metric: "Real wage growth",
            what: "Hourly earnings growth minus inflation.",
            why: "Shows whether paycheck growth is beating rising prices.",
          },
          {
            metric: "Poverty rate",
            what: "Share of individuals below the official poverty threshold.",
            why: "Monitors household economic vulnerability and social stress.",
          },
        ]}
      />
    </div>
  );
}

function EconomyPage({
  data,
  charts,
}: {
  data: DashboardData;
  charts: ChartVm;
}) {
  const economy = data.economy.snapshot;

  return (
    <div className="page-stack">
      <section className="metrics-grid">
        <MetricCard title="Median household income" value={formatCurrencyCompact(economy.medianIncome)} hint="ACS median household income" icon={<Wallet size={18} />} accent="violet" />
        <MetricCard title="Per-capita income" value={formatCurrencyCompact(economy.perCapitaIncome)} hint="ACS per-person income estimate" icon={<Users size={18} />} accent="cyan" />
        <MetricCard title="Median home value" value={formatCurrencyCompact(economy.medianHomeValue)} hint="ACS owner-occupied median value" icon={<Home size={18} />} accent="emerald" />
        <MetricCard title="Median gross rent" value={formatCurrencyCompact(economy.medianRent)} hint="ACS renter cost benchmark" icon={<Building2 size={18} />} accent="amber" />
        <MetricCard title="Private investment" value={economy.grossPrivateDomesticInvestment === null ? "N/A" : formatCurrencyCompact(economy.grossPrivateDomesticInvestment)} hint={economy.beaDataAvailable ? "BEA gross private domestic investment" : "Set BEA_API_KEY to unlock"} icon={<BarChart3 size={18} />} accent="violet" />
        <MetricCard title="Personal saving rate" value={economy.personalSavingRate === null ? "N/A" : `${economy.personalSavingRate.toFixed(1)}%`} hint={economy.beaDataAvailable ? "BEA saving as % of disposable income" : "Set BEA_API_KEY to unlock"} icon={<ShieldCheck size={18} />} accent="cyan" />
        <MetricCard title="Average hourly earnings" value={formatCurrencyCompact(economy.averageHourlyEarnings)} hint={`YoY change ${formatSignedPercent(economy.hourlyEarningsYoY)}`} icon={<Gauge size={18} />} accent="emerald" />
        <MetricCard title="Nonfarm payroll" value={formatCompact(economy.nonfarmPayrollEmployment)} hint="BLS payroll employment index level" icon={<Layers3 size={18} />} accent="amber" />
        <MetricCard title="Real wage growth" value={formatSignedPercent(economy.realWageYoY)} hint="Wage growth minus inflation" icon={<Sparkles size={18} />} accent="violet" />
        <MetricCard title="Real wage 3m avg" value={formatSignedPercent(economy.realWageYoY3mAvg)} hint="Smoother real wage momentum" icon={<CalendarClock size={18} />} accent="cyan" />
        <MetricCard title="Inflation 3m avg" value={formatSignedPercent(economy.inflationYoY3mAvg)} hint="Three-month average inflation" icon={<Globe2 size={18} />} accent="emerald" />
        <MetricCard title="Wage growth 3m avg" value={formatSignedPercent(economy.hourlyEarningsYoY3mAvg)} hint="Three-month average wage growth" icon={<BarChart3 size={18} />} accent="amber" />
        <MetricCard title="Home value / income" value={formatRatio(economy.homeValueToIncomeRatio)} hint="Housing affordability proxy" icon={<Home size={18} />} accent="violet" />
        <MetricCard title="Annual rent / income" value={`${(economy.annualRentToIncomeRatio * 100).toFixed(1)}%`} hint="Rent burden proxy" icon={<Building2 size={18} />} accent="cyan" />
        <MetricCard title="Internet access rate" value={`${economy.internetAccessRate.toFixed(1)}%`} hint="Households with internet access" icon={<Globe2 size={18} />} accent="emerald" />
        <MetricCard title="Bachelor+ attainment" value={`${economy.bachelorsOrHigherShare.toFixed(1)}%`} hint="Education attainment benchmark" icon={<Users size={18} />} accent="amber" />
      </section>

      <section className="panel-grid panel-grid--two">
        <ChartPanel title="Wage growth (YoY)" subtitle="Average hourly earnings year-over-year">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.earningsTrend.slice(-24)} margin={{ top: 8, right: 12, left: -10, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={(value: number) => `${value.toFixed(1)}%`} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}%`} />
              <Bar dataKey="value" fill="#14b8a6" radius={[8, 8, 0, 0]}>
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(value) => `${Number(value ?? 0).toFixed(1)}%`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Payroll growth (YoY)" subtitle="Nonfarm payroll trend signal">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={charts.payrollTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={(value: number) => `${value.toFixed(1)}%`} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}%`} />
              <Line type="monotone" dataKey="value" name="Payroll YoY" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      <section className="panel-grid panel-grid--two">
        <ChartPanel title="Real wage growth (YoY)" subtitle="Inflation-adjusted wage growth over time">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={charts.realWageTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={(value: number) => `${value.toFixed(1)}%`} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}%`} />
              <Line type="monotone" dataKey="value" name="Real wage YoY" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Affordability diagnostics" subtitle="Housing and income affordability ratios">
          <div className="insight-grid">
            <div className="insight-item">
              <span>Home value to income ratio</span>
              <strong>{formatRatio(economy.homeValueToIncomeRatio)}</strong>
            </div>
            <div className="insight-item">
              <span>Annual rent to income</span>
              <strong>{(economy.annualRentToIncomeRatio * 100).toFixed(1)}%</strong>
            </div>
            <div className="insight-item">
              <span>Median rent (monthly)</span>
              <strong>{formatCurrencyCompact(economy.medianRent)}</strong>
            </div>
            <div className="insight-item">
              <span>Median home value</span>
              <strong>{formatCurrencyCompact(economy.medianHomeValue)}</strong>
            </div>
            <div className="insight-item">
              <span>Internet access rate</span>
              <strong>{economy.internetAccessRate.toFixed(1)}%</strong>
            </div>
            <div className="insight-item">
              <span>Bachelor+ attainment</span>
              <strong>{economy.bachelorsOrHigherShare.toFixed(1)}%</strong>
            </div>
          </div>
        </ChartPanel>
      </section>

      <ChartPanel title="Investment and savings context" subtitle="Key macro savings and capital formation signals">
        <div className="insight-grid">
          <div className="insight-item">
            <span>Inflation (YoY)</span>
            <strong>{formatSignedPercent(economy.inflationYoY)}</strong>
          </div>
          <div className="insight-item">
            <span>CPI index level</span>
            <strong>{formatNumber(Math.round(economy.cpiIndex * 10) / 10)}</strong>
          </div>
          <div className="insight-item">
            <span>Labor-force participation</span>
            <strong>{economy.laborForceParticipationRate.toFixed(1)}%</strong>
          </div>
          <div className="insight-item">
            <span>Employment-population ratio</span>
            <strong>{economy.employmentPopulationRatio.toFixed(1)}%</strong>
          </div>
          <div className="insight-item">
            <span>Federal receipts/outlays</span>
            <strong>{economy.receiptsToOutlaysRatio.toFixed(1)}%</strong>
          </div>
          <div className="insight-item">
            <span>Deficit share of outlays</span>
            <strong>{economy.deficitToOutlaysRatio.toFixed(1)}%</strong>
          </div>
        </div>
      </ChartPanel>

      <IndicatorExplainers
        title="Economy indicator guide"
        items={[
          {
            metric: "Per-capita income",
            what: "Average income per person, estimated from ACS.",
            why: "Useful for comparing prosperity independent of population size.",
          },
          {
            metric: "Real wage growth",
            what: "Nominal wage growth minus inflation.",
            why: "Measures whether workers gain or lose purchasing power.",
          },
          {
            metric: "Home value/income ratio",
            what: "Median home value divided by median household income.",
            why: "A compact affordability stress indicator for housing markets.",
          },
          {
            metric: "Annual rent/income ratio",
            what: "Median annualized rent as a share of median income.",
            why: "Highlights potential renter burden and discretionary-income pressure.",
          },
          {
            metric: "Private investment",
            what: "Gross private domestic investment from BEA NIPA.",
            why: "Forward-looking signal of business confidence and productive capacity.",
          },
          {
            metric: "Personal saving rate",
            what: "Share of disposable personal income saved by households.",
            why: "Indicates household financial resilience and spending headroom.",
          },
        ]}
      />
    </div>
  );
}

function LaborPricesPage({
  data,
  charts,
}: {
  data: DashboardData;
  charts: ChartVm;
}) {
  const economy = data.economy.snapshot;
  const latestPayrollYoY = charts.payrollTrend.at(-1)?.value ?? 0;
  const laborTrend = charts.participationTrend.map((point) => {
    const employmentPoint = charts.employmentPopulationTrend.find((entry) => entry.label === point.label);
    return {
      label: point.label,
      participation: point.value,
      employmentPopulation: employmentPoint?.value ?? 0,
    };
  });

  return (
    <div className="page-stack">
      <section className="metrics-grid">
        <MetricCard title="Unemployment rate" value={`${economy.unemploymentRate.toFixed(1)}%`} hint="BLS unemployment rate" icon={<Gauge size={18} />} accent="violet" />
        <MetricCard title="Unemployment 3m avg" value={`${economy.unemploymentRate3mAvg.toFixed(1)}%`} hint="Three-month average unemployment" icon={<CalendarClock size={18} />} accent="cyan" />
        <MetricCard title="Labor-force participation" value={`${economy.laborForceParticipationRate.toFixed(1)}%`} hint="Share of civilian population in labor force" icon={<Users size={18} />} accent="cyan" />
        <MetricCard title="Employment-pop ratio" value={`${economy.employmentPopulationRatio.toFixed(1)}%`} hint="Share of population employed" icon={<Building2 size={18} />} accent="emerald" />
        <MetricCard title="Labor force" value={formatCompact(economy.laborForce)} hint="People in labor force" icon={<Layers3 size={18} />} accent="amber" />
        <MetricCard title="Unemployed persons" value={formatCompact(economy.unemploymentPersons)} hint="Count of unemployed persons" icon={<AlertTriangle size={18} />} accent="violet" />
        <MetricCard title="CPI index" value={formatNumber(Math.round(economy.cpiIndex * 10) / 10)} hint="Consumer Price Index level" icon={<Sparkles size={18} />} accent="cyan" />
        <MetricCard title="Inflation (YoY)" value={formatSignedPercent(economy.inflationYoY)} hint="CPI year-over-year change" icon={<CalendarClock size={18} />} accent="emerald" />
        <MetricCard title="Inflation 3m avg" value={formatSignedPercent(economy.inflationYoY3mAvg)} hint="Three-month average inflation" icon={<BarChart3 size={18} />} accent="amber" />
        <MetricCard title="Wage growth (YoY)" value={formatSignedPercent(economy.hourlyEarningsYoY)} hint="Average hourly earnings growth" icon={<Wallet size={18} />} accent="amber" />
        <MetricCard title="Wage growth 3m avg" value={formatSignedPercent(economy.hourlyEarningsYoY3mAvg)} hint="Three-month average wage growth" icon={<Wallet size={18} />} accent="violet" />
        <MetricCard title="Real wage growth" value={formatSignedPercent(economy.realWageYoY)} hint="Wage growth minus inflation" icon={<Gauge size={18} />} accent="cyan" />
        <MetricCard title="Real wage 3m avg" value={formatSignedPercent(economy.realWageYoY3mAvg)} hint="Smoothed real wage trajectory" icon={<Gauge size={18} />} accent="emerald" />
        <MetricCard title="Payroll growth YoY" value={formatSignedPercent(latestPayrollYoY)} hint="Nonfarm payroll year-over-year" icon={<Layers3 size={18} />} accent="amber" />
      </section>

      <section className="panel-grid panel-grid--two">
        <ChartPanel title="Unemployment trend" subtitle="Extended historical unemployment trajectory">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={charts.unemploymentTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={(value: number) => `${value.toFixed(1)}%`} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}%`} />
              <Line type="monotone" dataKey="value" name="Unemployment" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Participation vs employment" subtitle="Labor-force participation and employment-population ratio">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={laborTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={(value: number) => `${value.toFixed(1)}%`} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}%`} />
              <Legend />
              <Line type="monotone" dataKey="participation" name="Participation" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="employmentPopulation" name="Employment-population" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      <section className="panel-grid panel-grid--two">
        <ChartPanel title="Inflation vs wage vs real wage" subtitle="Comparing nominal and inflation-adjusted income momentum">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={charts.macroTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={(value: number) => `${value.toFixed(1)}%`} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}%`} />
              <Legend />
              <Line type="monotone" dataKey="inflation" name="Inflation YoY" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="wageGrowth" name="Wage YoY" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="realWage" name="Real wage YoY" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Labor & price diagnostics" subtitle="Additional labor-market and price pressure diagnostics">
          <div className="insight-grid">
            <div className="insight-item">
              <span>Nonfarm payroll index</span>
              <strong>{formatCompact(economy.nonfarmPayrollEmployment)}</strong>
            </div>
            <div className="insight-item">
              <span>Payroll YoY</span>
              <strong>{formatSignedPercent(latestPayrollYoY)}</strong>
            </div>
            <div className="insight-item">
              <span>Unemployment (current vs 3m avg)</span>
              <strong>
                {economy.unemploymentRate.toFixed(1)}% / {economy.unemploymentRate3mAvg.toFixed(1)}%
              </strong>
            </div>
            <div className="insight-item">
              <span>Inflation (current vs 3m avg)</span>
              <strong>
                {formatSignedPercent(economy.inflationYoY)} / {formatSignedPercent(economy.inflationYoY3mAvg)}
              </strong>
            </div>
            <div className="insight-item">
              <span>Wage growth (current vs 3m avg)</span>
              <strong>
                {formatSignedPercent(economy.hourlyEarningsYoY)} /{" "}
                {formatSignedPercent(economy.hourlyEarningsYoY3mAvg)}
              </strong>
            </div>
            <div className="insight-item">
              <span>Employment-population ratio</span>
              <strong>{economy.employmentPopulationRatio.toFixed(1)}%</strong>
            </div>
          </div>
        </ChartPanel>
      </section>

      <IndicatorExplainers
        title="Labor & prices indicator guide"
        items={[
          {
            metric: "Unemployment rate",
            what: "Share of labor-force participants actively looking for work.",
            why: "Tracks labor-market tightness and recession risk.",
          },
          {
            metric: "Labor-force participation",
            what: "Share of civilian population working or seeking work.",
            why: "Shows workforce engagement and hidden slack.",
          },
          {
            metric: "Employment-population ratio",
            what: "Share of population currently employed.",
            why: "Provides a broad employment utilization measure.",
          },
          {
            metric: "Inflation YoY",
            what: "CPI change relative to the same month one year ago.",
            why: "Captures consumer price pressure and purchasing-power erosion.",
          },
          {
            metric: "Wage growth YoY",
            what: "Average hourly earnings growth versus one year ago.",
            why: "Monitors income momentum and labor-market bargaining power.",
          },
          {
            metric: "Real wage growth",
            what: "Wage growth minus inflation.",
            why: "Indicates whether household purchasing power is improving.",
          },
        ]}
      />
    </div>
  );
}

function FiscalPage({
  data,
  charts,
}: {
  data: DashboardData;
  charts: ChartVm;
}) {
  const economy = data.economy.snapshot;

  return (
    <div className="page-stack">
      <section className="metrics-grid">
        <MetricCard title="Total public debt" value={formatCurrencyCompact(economy.totalPublicDebt)} hint="Treasury debt to the penny" icon={<Database size={18} />} accent="violet" />
        <MetricCard title="Debt change (7d)" value={formatCurrencyCompact(economy.debtChange7Days)} hint="One-week debt movement" icon={<CalendarClock size={18} />} accent="cyan" />
        <MetricCard title="Debt change (30d)" value={formatCurrencyCompact(economy.debtChange30Days)} hint="Recent debt movement" icon={<BarChart3 size={18} />} accent="cyan" />
        <MetricCard title="Debt change (1y)" value={formatCurrencyCompact(economy.debtChange365Days)} hint="Year-over-year debt movement" icon={<Gauge size={18} />} accent="emerald" />
        <MetricCard title="Debt YoY growth" value={formatSignedPercent(economy.debtYoYGrowthPct)} hint="Debt growth percentage over one year" icon={<Sparkles size={18} />} accent="amber" />
        <MetricCard title="Debt per capita" value={formatCurrencyCompact(economy.debtPerCapita)} hint="Debt normalized by population" icon={<Users size={18} />} accent="emerald" />
        <MetricCard title="Debt-to-income ratio" value={formatRatio(economy.debtToIncomeRatio)} hint="Debt per capita / per-capita income" icon={<ShieldCheck size={18} />} accent="violet" />
        <MetricCard title="Latest outlays" value={formatCurrencyCompact(economy.latestOutlays)} hint="Most recent monthly outlays" icon={<Landmark size={18} />} accent="amber" />
        <MetricCard title="Latest receipts" value={formatCurrencyCompact(economy.latestReceipts)} hint="Most recent monthly receipts" icon={<Wallet size={18} />} accent="violet" />
        <MetricCard title="Latest deficit/surplus" value={formatCurrencyCompact(economy.latestDeficit)} hint="Monthly balance (positive=deficit)" icon={<Gauge size={18} />} accent="cyan" />
        <MetricCard title="Outlays per capita" value={formatCurrencyCompact(economy.outlaysPerCapita)} hint="Latest monthly outlays per person" icon={<Users size={18} />} accent="emerald" />
        <MetricCard title="Receipts per capita" value={formatCurrencyCompact(economy.receiptsPerCapita)} hint="Latest monthly receipts per person" icon={<Users size={18} />} accent="amber" />
        <MetricCard title="Deficit per capita" value={formatCurrencyCompact(economy.deficitPerCapita)} hint="Latest monthly balance per person" icon={<Users size={18} />} accent="violet" />
        <MetricCard title="Trailing 12m outlays" value={formatCurrencyCompact(economy.trailing12Outlays)} hint="Sum of latest 12 months" icon={<FolderTree size={18} />} accent="emerald" />
        <MetricCard title="Trailing 12m receipts" value={formatCurrencyCompact(economy.trailing12Receipts)} hint="Sum of latest 12 months" icon={<FileBarChart2 size={18} />} accent="amber" />
        <MetricCard title="Trailing 12m deficit" value={formatCurrencyCompact(economy.trailing12Deficit)} hint="12-month cumulative balance" icon={<CalendarClock size={18} />} accent="violet" />
        <MetricCard title="Receipts/outlays ratio" value={`${economy.receiptsToOutlaysRatio.toFixed(1)}%`} hint="Coverage of outlays by receipts" icon={<ShieldCheck size={18} />} accent="cyan" />
        <MetricCard title="Outlays YoY" value={formatSignedPercent(economy.outlaysYoY)} hint="Trailing-12-month outlay growth rate" icon={<BarChart3 size={18} />} accent="emerald" />
        <MetricCard title="Receipts YoY" value={formatSignedPercent(economy.receiptsYoY)} hint="Trailing-12-month receipts growth rate" icon={<BarChart3 size={18} />} accent="amber" />
        <MetricCard title="Deficit YoY" value={formatSignedPercent(economy.deficitYoY)} hint="Trailing-12-month deficit growth rate" icon={<BarChart3 size={18} />} accent="violet" />
        <MetricCard title="Surplus months (12m)" value={formatNumber(economy.surplusMonthsLast12)} hint="Months where receipts exceeded outlays" icon={<CheckCircle2 size={18} />} accent="cyan" />
      </section>

      <section className="panel-grid panel-grid--two">
        <ChartPanel title="Monthly outlays, receipts, and deficit" subtitle="Treasury fiscal flow over time">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={charts.monthlySpending} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tickLine={false} axisLine={false} />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
              <Line type="monotone" dataKey="outlays" name="Outlays" stroke="#fb923c" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="receipts" name="Receipts" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="deficit" name="Deficit/Surplus" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Debt trajectory (daily)" subtitle="Recent federal debt path">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={charts.debtDaily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="debtFillFiscal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tickLine={false} axisLine={false} />
              <Tooltip formatter={formatTooltipValue} />
              <Area type="monotone" dataKey="value" name="Total debt" stroke="#f43f5e" fill="url(#debtFillFiscal)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      <section className="panel-grid panel-grid--two">
        <ChartPanel title="Deficit share of outlays" subtitle="How much of spending is not covered by receipts">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.deficitShareTrend.slice(-24)} margin={{ top: 8, right: 10, left: -10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={(value: number) => `${value.toFixed(0)}%`} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}%`} />
              <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]}>
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(value) => `${Number(value ?? 0).toFixed(0)}%`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Fiscal concentration highlights" subtitle="Largest recent deficit and surplus months">
          <div className="insight-grid">
            <div className="insight-item">
              <span>Largest deficit month</span>
              <strong>{economy.largestDeficitMonth}</strong>
            </div>
            <div className="insight-item">
              <span>Largest deficit amount</span>
              <strong>{formatCurrencyCompact(economy.largestDeficitAmount)}</strong>
            </div>
            <div className="insight-item">
              <span>Largest surplus month</span>
              <strong>{economy.largestSurplusMonth}</strong>
            </div>
            <div className="insight-item">
              <span>Largest surplus amount</span>
              <strong>{formatCurrencyCompact(economy.largestSurplusAmount)}</strong>
            </div>
            <div className="insight-item">
              <span>Trailing-12 outlays YoY</span>
              <strong>{formatSignedPercent(economy.outlaysYoY)}</strong>
            </div>
            <div className="insight-item">
              <span>Trailing-12 receipts YoY</span>
              <strong>{formatSignedPercent(economy.receiptsYoY)}</strong>
            </div>
          </div>
        </ChartPanel>
      </section>

      <IndicatorExplainers
        title="Fiscal indicator guide"
        items={[
          {
            metric: "Debt-to-income ratio",
            what: "Debt per capita divided by per-capita income.",
            why: "Adds affordability context to debt size by benchmarking against incomes.",
          },
          {
            metric: "Receipts/outlays ratio",
            what: "Receipts as a share of outlays in the latest month.",
            why: "Shows how much spending is financed by current revenue.",
          },
          {
            metric: "Deficit share of outlays",
            what: "Deficit divided by outlays for each month.",
            why: "Helps compare fiscal stress across time regardless of spending scale.",
          },
          {
            metric: "Trailing-12-month totals",
            what: "Rolling one-year sums of outlays, receipts, and deficit.",
            why: "Smooths seasonality and reveals structural fiscal direction.",
          },
          {
            metric: "Debt YoY growth",
            what: "Debt change percentage from one year ago.",
            why: "Indicates acceleration or deceleration in federal borrowing.",
          },
          {
            metric: "Surplus months",
            what: "Count of months in the last year with negative deficit values.",
            why: "Captures frequency of temporary fiscal improvement.",
          },
        ]}
      />
    </div>
  );
}

function DemographicsPage({
  data,
  charts,
}: {
  data: DashboardData;
  charts: ChartVm;
}) {
  const economy = data.economy.snapshot;
  const demographicRates = [
    { label: "Poverty", value: economy.povertyRate },
    { label: "Vacancy", value: economy.vacancyRate },
    { label: "Homeownership", value: economy.homeownershipRate },
    { label: "Internet access", value: economy.internetAccessRate },
    { label: "Bachelor+", value: economy.bachelorsOrHigherShare },
    { label: "Rent/income", value: economy.annualRentToIncomeRatio * 100 },
  ];

  return (
    <div className="page-stack">
      <section className="metrics-grid">
        <MetricCard title="Population" value={formatNumber(Math.round(economy.population))} hint="ACS U.S. population estimate" icon={<Users size={18} />} accent="violet" />
        <MetricCard title="Households" value={formatCompact(economy.households)} hint="Total U.S. households" icon={<Users size={18} />} accent="cyan" />
        <MetricCard title="Median age" value={economy.medianAge.toFixed(1)} hint="Median age in years" icon={<CalendarClock size={18} />} accent="cyan" />
        <MetricCard title="Median household income" value={formatCurrencyCompact(economy.medianIncome)} hint="Income midpoint estimate" icon={<Wallet size={18} />} accent="emerald" />
        <MetricCard title="Per-capita income" value={formatCurrencyCompact(economy.perCapitaIncome)} hint="Income per person estimate" icon={<Building2 size={18} />} accent="amber" />
        <MetricCard title="Poverty rate" value={`${economy.povertyRate.toFixed(1)}%`} hint="Population below poverty threshold" icon={<AlertTriangle size={18} />} accent="violet" />
        <MetricCard title="Internet access rate" value={`${economy.internetAccessRate.toFixed(1)}%`} hint="Households with internet access" icon={<Globe2 size={18} />} accent="cyan" />
        <MetricCard title="Median home value" value={formatCurrencyCompact(economy.medianHomeValue)} hint="Owner-occupied housing value" icon={<Home size={18} />} accent="violet" />
        <MetricCard title="Median rent" value={formatCurrencyCompact(economy.medianRent)} hint="Typical monthly gross rent" icon={<FolderTree size={18} />} accent="cyan" />
        <MetricCard title="Home value / income" value={formatRatio(economy.homeValueToIncomeRatio)} hint="Housing affordability pressure" icon={<Home size={18} />} accent="emerald" />
        <MetricCard title="Annual rent / income" value={`${(economy.annualRentToIncomeRatio * 100).toFixed(1)}%`} hint="Rent burden pressure" icon={<Building2 size={18} />} accent="amber" />
        <MetricCard title="Homeownership rate" value={`${economy.homeownershipRate.toFixed(1)}%`} hint="Owner share of occupied units" icon={<ShieldCheck size={18} />} accent="emerald" />
        <MetricCard title="Housing vacancy rate" value={`${economy.vacancyRate.toFixed(1)}%`} hint="Vacant share of housing units" icon={<Database size={18} />} accent="amber" />
        <MetricCard title="Bachelor+ attainment" value={`${economy.bachelorsOrHigherShare.toFixed(1)}%`} hint="Adults 25+ with bachelor's or higher" icon={<Layers3 size={18} />} accent="violet" />
        <MetricCard title="Gini index" value={economy.giniIndex.toFixed(3)} hint="Income inequality index" icon={<Sparkles size={18} />} accent="cyan" />
      </section>

      <section className="panel-grid panel-grid--two">
        <ChartPanel title="Housing occupancy composition" subtitle="Owner, renter, and vacant housing units">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={charts.housingComposition}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={98}
                paddingAngle={2}
                label={({ name }) => name}
                labelLine={false}
              >
                {charts.housingComposition.map((entry, index) => (
                  <Cell key={`housing-cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={formatTooltipValue} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Demographic structure highlights" subtitle="Key household and inequality diagnostics">
          <div className="insight-grid">
            <div className="insight-item">
              <span>Total housing units</span>
              <strong>{formatCompact(economy.housingUnits)}</strong>
            </div>
            <div className="insight-item">
              <span>Owner-occupied units</span>
              <strong>{formatCompact(economy.ownerOccupiedHousingUnits)}</strong>
            </div>
            <div className="insight-item">
              <span>Renter-occupied units</span>
              <strong>{formatCompact(economy.renterOccupiedHousingUnits)}</strong>
            </div>
            <div className="insight-item">
              <span>Vacant units</span>
              <strong>{formatCompact(economy.vacantHousingUnits)}</strong>
            </div>
            <div className="insight-item">
              <span>Labor force size</span>
              <strong>{formatCompact(economy.laborForce)}</strong>
            </div>
            <div className="insight-item">
              <span>Unemployed persons</span>
              <strong>{formatCompact(economy.unemploymentPersons)}</strong>
            </div>
            <div className="insight-item">
              <span>Poverty rate</span>
              <strong>{economy.povertyRate.toFixed(1)}%</strong>
            </div>
            <div className="insight-item">
              <span>Internet access rate</span>
              <strong>{economy.internetAccessRate.toFixed(1)}%</strong>
            </div>
          </div>
        </ChartPanel>
      </section>

      <ChartPanel title="Demographic rate diagnostics" subtitle="Selected social and housing rates with data labels">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={demographicRates} margin={{ top: 8, right: 20, left: -6, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
            <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" tickFormatter={(value: number) => `${value.toFixed(0)}%`} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}%`} />
            <Bar dataKey="value" fill="#22c55e" radius={[8, 8, 0, 0]}>
              <LabelList
                dataKey="value"
                position="top"
                formatter={(value) => `${Number(value ?? 0).toFixed(1)}%`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <IndicatorExplainers
        title="Demographics indicator guide"
        items={[
          {
            metric: "Poverty rate",
            what: "Share of population below the Census poverty threshold.",
            why: "Direct measure of economic hardship and vulnerability.",
          },
          {
            metric: "Gini index",
            what: "Income inequality index where higher values imply more inequality.",
            why: "Tracks distributional imbalance often tied to social and economic risk.",
          },
          {
            metric: "Internet access rate",
            what: "Share of households reporting internet connectivity.",
            why: "Proxy for digital inclusion, workforce access, and education opportunity.",
          },
          {
            metric: "Homeownership and vacancy rates",
            what: "Owner share of occupied housing and vacant share of all units.",
            why: "Together they describe housing stability and supply slack.",
          },
          {
            metric: "Home value/income and rent/income",
            what: "Affordability ratios for ownership and renting.",
            why: "Highlights pressure points in housing costs relative to earnings.",
          },
          {
            metric: "Education attainment",
            what: "Share of adults 25+ with a bachelor's degree or higher.",
            why: "Long-run productivity and income potential signal.",
          },
        ]}
      />
    </div>
  );
}

function CatalogPage({
  data,
  charts,
}: {
  data: DashboardData;
  charts: ChartVm;
}) {
  const [isRecentExpanded, setIsRecentExpanded] = useState(true);
  const [recentSearch, setRecentSearch] = useState("");
  const [recentLimit, setRecentLimit] = useState(12);
  const [recentSort, setRecentSort] = useState<"modified_desc" | "resources_desc" | "title_asc">(
    "modified_desc",
  );

  const matchingRecentDatasets = useMemo(() => {
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
  }, [data.recentDatasets, recentSearch]);

  const sortedRecentDatasets = useMemo(() => {
    const rows = [...matchingRecentDatasets];

    if (recentSort === "resources_desc") {
      rows.sort((left, right) => right.resourceCount - left.resourceCount);
      return rows;
    }

    if (recentSort === "title_asc") {
      rows.sort((left, right) => left.title.localeCompare(right.title));
      return rows;
    }

    rows.sort((left, right) => {
      const leftTime = new Date(left.metadataModified).getTime();
      const rightTime = new Date(right.metadataModified).getTime();
      return rightTime - leftTime;
    });
    return rows;
  }, [matchingRecentDatasets, recentSort]);

  const visibleRecentDatasets = useMemo(
    () => sortedRecentDatasets.slice(0, recentLimit),
    [sortedRecentDatasets, recentLimit],
  );

  const onLimitChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const parsed = Number(event.target.value);
    setRecentLimit(Number.isFinite(parsed) ? parsed : 12);
  };

  const exportRecentCsv = () => {
    const headers = ["Dataset", "Publisher", "Modified", "Created", "Resources", "Formats"];
    const rows = visibleRecentDatasets.map((dataset) => [
      dataset.title,
      dataset.organization,
      dataset.metadataModified,
      dataset.metadataCreated,
      dataset.resourceCount,
      dataset.formats.join("|"),
    ]);

    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => escapeCsvCell(cell)).join(","))
      .join("\n");

    triggerDownload("datagov-recent-datasets.csv", `${csv}\n`, "text/csv;charset=utf-8");
  };

  return (
    <div className="page-stack">
      <section className="catalog-context-note">
        <p>
          This category retains Data.gov catalog metadata diagnostics as optional context. Primary
          pages focus on real economic and demographic indicators.
        </p>
      </section>

      <section className="metrics-grid">
        <MetricCard title="Catalog datasets" value={formatCompact(data.kpis.totalDatasets)} hint="Total metadata records indexed" icon={<Database size={18} />} accent="violet" />
        <MetricCard title="Active publishers" value={formatNumber(data.kpis.organizations)} hint="Organizations with indexed datasets" icon={<Building2 size={18} />} accent="cyan" />
        <MetricCard title="Catalog groups" value={formatNumber(data.kpis.groups)} hint="Distinct group collections" icon={<FolderTree size={18} />} accent="emerald" />
        <MetricCard title="Freshness score" value={formatPercent(data.kpis.freshnessScore / 100)} hint="Updated within last 90 days" icon={<Sparkles size={18} />} accent="amber" />
        <MetricCard title="Updated last 7d" value={formatCompact(data.kpis.updatedLast7Days)} hint="Records modified in the latest week" icon={<RefreshCcw size={18} />} accent="violet" />
        <MetricCard title="Created last 7d" value={formatCompact(data.kpis.createdLast7Days)} hint="New records created in the latest week" icon={<CalendarClock size={18} />} accent="cyan" />
        <MetricCard title="Updated last 30d" value={formatCompact(data.kpis.updatedLast30Days)} hint="Records modified in last 30 days" icon={<RefreshCcw size={18} />} accent="emerald" />
        <MetricCard title="Updated last 365d" value={formatCompact(data.kpis.updatedLast365Days)} hint="Records modified in last year" icon={<CalendarClock size={18} />} accent="amber" />
        <MetricCard title="Updates/day (30d)" value={formatNumber(Math.round(data.analytics.velocity.updatesPerDay30))} hint="Average daily update flow" icon={<BarChart3 size={18} />} accent="violet" />
        <MetricCard title="Create/day (30d)" value={formatNumber(Math.round(data.analytics.velocity.creationsPerDay30))} hint="Average daily new-record flow" icon={<BarChart3 size={18} />} accent="cyan" />
        <MetricCard title="Update/create ratio" value={formatRatio(data.analytics.velocity.updateToCreateRatio)} hint="Update intensity relative to creation" icon={<Gauge size={18} />} accent="emerald" />
        <MetricCard title="Weekly momentum" value={formatSignedPercent(data.analytics.velocity.weeklyMomentum)} hint="Week-over-week update change" icon={<Sparkles size={18} />} accent="amber" />
        <MetricCard title="Top-5 publisher share" value={`${data.analytics.concentration.top5Share.toFixed(1)}%`} hint="Share owned by top 5 publishers" icon={<Building2 size={18} />} accent="violet" />
        <MetricCard title="Publisher concentration (HHI)" value={formatNumber(Math.round(data.analytics.concentration.hhi))} hint="Higher value means more concentration" icon={<ShieldCheck size={18} />} accent="cyan" />
        <MetricCard title="Avg resources/dataset" value={data.analytics.resourceCoverage.avgResources.toFixed(1)} hint="Average resources attached per dataset" icon={<Database size={18} />} accent="emerald" />
        <MetricCard title="No-resource share" value={`${data.analytics.resourceCoverage.noResourceShare.toFixed(1)}%`} hint="Datasets with zero resources in sample" icon={<AlertTriangle size={18} />} accent="amber" />
        <MetricCard title="Open-license share" value={`${data.analytics.licenseSummary.openShare.toFixed(1)}%`} hint="Portion tagged with open licenses" icon={<CheckCircle2 size={18} />} accent="violet" />
        <MetricCard title="Format diversity score" value={data.analytics.formatInsights.diversityScore.toFixed(2)} hint="Higher score means broader format mix" icon={<Layers3 size={18} />} accent="cyan" />
      </section>

      <section className="panel-grid panel-grid--three">
        <ChartPanel title="Top publishers" subtitle="Largest dataset publishers">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.topPublishers} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis type="number" tickFormatter={formatCompact} stroke="#94a3b8" axisLine={false} />
              <YAxis dataKey="label" type="category" width={160} stroke="#94a3b8" tickLine={false} axisLine={false} />
              <Tooltip formatter={formatTooltipValue} />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]}>
                <LabelList
                  dataKey="count"
                  position="right"
                  formatter={(value) => formatCompact(Number(value ?? 0))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Top formats" subtitle="Most common resource formats">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={charts.topFormats}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={96}
                paddingAngle={2}
                label={({ name }) => name}
                labelLine={false}
              >
                {charts.topFormats.map((entry, index) => (
                  <Cell key={`format-cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={formatTooltipValue} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Top tags" subtitle="Most frequent tags">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.tags} margin={{ top: 6, right: 8, bottom: 10, left: -16 }}>
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
              <Bar dataKey="count" fill="#22c55e" radius={[8, 8, 0, 0]}>
                <LabelList
                  dataKey="count"
                  position="top"
                  formatter={(value) => formatCompact(Number(value ?? 0))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      <section className="panel-grid panel-grid--two">
        <ChartPanel title="Freshness buckets" subtitle="Dataset recency distribution">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.freshnessBuckets} margin={{ top: 8, right: 10, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tickLine={false} axisLine={false} />
              <Tooltip formatter={formatTooltipValue} />
              <Bar dataKey="count" fill="#06b6d4" radius={[8, 8, 0, 0]}>
                <LabelList
                  dataKey="share"
                  position="top"
                  formatter={(value) => `${Number(value ?? 0).toFixed(1)}%`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Dataset age buckets" subtitle="How old catalog records are overall">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.ageBuckets} margin={{ top: 8, right: 10, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tickLine={false} axisLine={false} />
              <Tooltip formatter={formatTooltipValue} />
              <Bar dataKey="count" fill="#f97316" radius={[8, 8, 0, 0]}>
                <LabelList
                  dataKey="share"
                  position="top"
                  formatter={(value) => `${Number(value ?? 0).toFixed(1)}%`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
              <div className="recent-controls">
                <label className="recent-limit">
                  Sort
                  <select
                    value={recentSort}
                    onChange={(event) =>
                      setRecentSort(event.target.value as "modified_desc" | "resources_desc" | "title_asc")
                    }
                  >
                    <option value="modified_desc">Newest modified</option>
                    <option value="resources_desc">Most resources</option>
                    <option value="title_asc">Title A-Z</option>
                  </select>
                </label>
                <label className="recent-limit">
                  Rows
                  <select value={recentLimit} onChange={onLimitChange}>
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                  </select>
                </label>
                <button type="button" className="secondary-button secondary-button--compact" onClick={exportRecentCsv}>
                  <Download size={14} />
                  Export CSV
                </button>
              </div>
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

      <IndicatorExplainers
        title="Catalog-context indicator guide"
        items={[
          {
            metric: "Freshness score",
            what: "Share of datasets updated in the last 90 days.",
            why: "High freshness implies users are more likely to find current data.",
          },
          {
            metric: "Update/create ratio",
            what: "How many updates occur per new dataset creation.",
            why: "Shows whether catalog operations focus on maintenance or expansion.",
          },
          {
            metric: "Publisher concentration (HHI)",
            what: "Concentration index of dataset ownership among publishers.",
            why: "Helps identify concentration risk and publisher diversity.",
          },
          {
            metric: "No-resource share",
            what: "Share of sampled datasets without attached resources.",
            why: "Signals metadata completeness and practical usability.",
          },
          {
            metric: "Open-license share",
            what: "Share of datasets tagged with clearly open licenses.",
            why: "Higher openness generally improves reuse and legal clarity.",
          },
          {
            metric: "Format diversity score",
            what: "Diversity metric across file/resource formats.",
            why: "Diverse formats can improve interoperability and downstream reuse.",
          },
        ]}
      />
    </div>
  );
}

export default function App() {
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["datagov-dashboard-snapshot"],
    queryFn: fetchDashboardSnapshot,
    refetchInterval: 1000 * 60 * 10,
  });

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
  const source = data.source;
  const economy = data.economy.snapshot;
  const charts = buildChartVm(data);

  const exportSnapshot = () => {
    triggerDownload(
      "datagov-dashboard-snapshot.json",
      `${JSON.stringify(data, null, 2)}\n`,
      "application/json;charset=utf-8",
    );
  };

  return (
    <HashRouter>
      <main className="dashboard-shell">
        <div className="decor decor--top" />
        <div className="decor decor--bottom" />
        <div className="dashboard">
          <header className="hero">
            <div>
              <p className="eyebrow">Federal economic and demographic intelligence</p>
              <h1>U.S. Economy, Spending, and Demographics Dashboard</h1>
              <p className="hero__subtitle">
                Multi-page analytical workspace focused on actual federal indicators across economy,
                labor, prices, spending, debt, demographics, and optional catalog context.
              </p>
              <p className="hero__timestamp">{refreshHint}</p>
              <div className="hero__insights">
                <span className="insight-pill">
                  Inflation YoY: {formatSignedPercent(economy.inflationYoY)}
                </span>
                <span className="insight-pill">
                  Unemployment: {economy.unemploymentRate.toFixed(1)}%
                </span>
                <span className="insight-pill">
                  Debt 30d change: {formatCurrencyCompact(economy.debtChange30Days)}
                </span>
              </div>
            </div>
            <div className="hero__controls">
              <div className="api-form">
                <label>Snapshot details</label>
                <p className="hero__mode-note">{source.snapshotStrategy}</p>
                <p className="hero__mode-note">
                  Source: {source.siteTitle} (CKAN {source.ckanVersion})
                </p>
                <p className="hero__mode-note">APIs: {truncate(source.apiBase, 60)}</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => void refetch()}>
                <RefreshCcw size={16} />
                Refresh
              </button>
              <button type="button" className="secondary-button" onClick={exportSnapshot}>
                <Download size={16} />
                Snapshot JSON
              </button>
            </div>
          </header>

          <CategoryNavigation />

          <Routes>
            <Route path="/" element={<OverviewPage data={data} charts={charts} />} />
            <Route path="/economy" element={<EconomyPage data={data} charts={charts} />} />
            <Route path="/labor-prices" element={<LaborPricesPage data={data} charts={charts} />} />
            <Route path="/fiscal" element={<FiscalPage data={data} charts={charts} />} />
            <Route path="/demographics" element={<DemographicsPage data={data} charts={charts} />} />
            <Route path="/catalog" element={<CatalogPage data={data} charts={charts} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </HashRouter>
  );
}
