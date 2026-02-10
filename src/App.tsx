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
  payrollTrend: Array<{ label: string; value: number }>;
  macroTrend: Array<{ label: string; unemployment: number; inflation: number; wageGrowth: number }>;
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
  const unemploymentTrend = data.economy.trends.unemploymentRate ?? [];
  const inflationMap = new Map((data.economy.trends.inflationYoY ?? []).map((point) => [point.label, point.value]));
  const wageMap = new Map(
    (data.economy.trends.hourlyEarningsYoY ?? []).map((point) => [point.label, point.value]),
  );

  return {
    monthlySpending: data.economy.trends.monthlySpending ?? [],
    debtDaily: data.economy.trends.debtDaily ?? [],
    unemploymentTrend,
    participationTrend: data.economy.trends.laborForceParticipationRate ?? [],
    employmentPopulationTrend: data.economy.trends.employmentPopulationRatio ?? [],
    inflationTrend: data.economy.trends.inflationYoY ?? [],
    earningsTrend: data.economy.trends.hourlyEarningsYoY ?? [],
    payrollTrend: data.economy.trends.nonfarmPayroll ?? [],
    macroTrend: unemploymentTrend.map((point) => ({
      label: point.label,
      unemployment: point.value,
      inflation: inflationMap.get(point.label) ?? 0,
      wageGrowth: wageMap.get(point.label) ?? 0,
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
      </section>

      <section className="panel-grid panel-grid--two">
        <ChartPanel title="Wage growth (YoY)" subtitle="Average hourly earnings year-over-year">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.earningsTrend} margin={{ top: 8, right: 12, left: -10, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" tickFormatter={(value: number) => `${value.toFixed(1)}%`} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}%`} />
              <Bar dataKey="value" fill="#14b8a6" radius={[8, 8, 0, 0]} />
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
        <MetricCard title="Labor-force participation" value={`${economy.laborForceParticipationRate.toFixed(1)}%`} hint="Share of civilian population in labor force" icon={<Users size={18} />} accent="cyan" />
        <MetricCard title="Employment-pop ratio" value={`${economy.employmentPopulationRatio.toFixed(1)}%`} hint="Share of population employed" icon={<Building2 size={18} />} accent="emerald" />
        <MetricCard title="Labor force" value={formatCompact(economy.laborForce)} hint="People in labor force" icon={<Layers3 size={18} />} accent="amber" />
        <MetricCard title="Unemployed persons" value={formatCompact(economy.unemploymentPersons)} hint="Count of unemployed persons" icon={<AlertTriangle size={18} />} accent="violet" />
        <MetricCard title="CPI index" value={formatNumber(Math.round(economy.cpiIndex * 10) / 10)} hint="Consumer Price Index level" icon={<Sparkles size={18} />} accent="cyan" />
        <MetricCard title="Inflation (YoY)" value={formatSignedPercent(economy.inflationYoY)} hint="CPI year-over-year change" icon={<CalendarClock size={18} />} accent="emerald" />
        <MetricCard title="Wage growth (YoY)" value={formatSignedPercent(economy.hourlyEarningsYoY)} hint="Average hourly earnings growth" icon={<Wallet size={18} />} accent="amber" />
      </section>

      <section className="panel-grid panel-grid--two">
        <ChartPanel title="Unemployment trend" subtitle="12-month unemployment trajectory">
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
        <MetricCard title="Debt change (30d)" value={formatCurrencyCompact(economy.debtChange30Days)} hint="Recent debt movement" icon={<BarChart3 size={18} />} accent="cyan" />
        <MetricCard title="Debt per capita" value={formatCurrencyCompact(economy.debtPerCapita)} hint="Debt normalized by population" icon={<Users size={18} />} accent="emerald" />
        <MetricCard title="Latest outlays" value={formatCurrencyCompact(economy.latestOutlays)} hint="Most recent monthly outlays" icon={<Landmark size={18} />} accent="amber" />
        <MetricCard title="Latest receipts" value={formatCurrencyCompact(economy.latestReceipts)} hint="Most recent monthly receipts" icon={<Wallet size={18} />} accent="violet" />
        <MetricCard title="Latest deficit/surplus" value={formatCurrencyCompact(economy.latestDeficit)} hint="Monthly balance (positive=deficit)" icon={<Gauge size={18} />} accent="cyan" />
        <MetricCard title="Trailing 12m outlays" value={formatCurrencyCompact(economy.trailing12Outlays)} hint="Sum of latest 12 months" icon={<FolderTree size={18} />} accent="emerald" />
        <MetricCard title="Trailing 12m receipts" value={formatCurrencyCompact(economy.trailing12Receipts)} hint="Sum of latest 12 months" icon={<FileBarChart2 size={18} />} accent="amber" />
        <MetricCard title="Trailing 12m deficit" value={formatCurrencyCompact(economy.trailing12Deficit)} hint="12-month cumulative balance" icon={<CalendarClock size={18} />} accent="violet" />
        <MetricCard title="Receipts/outlays ratio" value={`${economy.receiptsToOutlaysRatio.toFixed(1)}%`} hint="Coverage of outlays by receipts" icon={<ShieldCheck size={18} />} accent="cyan" />
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

  return (
    <div className="page-stack">
      <section className="metrics-grid">
        <MetricCard title="Population" value={formatNumber(Math.round(economy.population))} hint="ACS U.S. population estimate" icon={<Users size={18} />} accent="violet" />
        <MetricCard title="Median age" value={economy.medianAge.toFixed(1)} hint="Median age in years" icon={<CalendarClock size={18} />} accent="cyan" />
        <MetricCard title="Median household income" value={formatCurrencyCompact(economy.medianIncome)} hint="Income midpoint estimate" icon={<Wallet size={18} />} accent="emerald" />
        <MetricCard title="Per-capita income" value={formatCurrencyCompact(economy.perCapitaIncome)} hint="Income per person estimate" icon={<Building2 size={18} />} accent="amber" />
        <MetricCard title="Median home value" value={formatCurrencyCompact(economy.medianHomeValue)} hint="Owner-occupied housing value" icon={<Home size={18} />} accent="violet" />
        <MetricCard title="Median rent" value={formatCurrencyCompact(economy.medianRent)} hint="Typical monthly gross rent" icon={<FolderTree size={18} />} accent="cyan" />
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
          </div>
        </ChartPanel>
      </section>
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
      </section>

      <section className="panel-grid panel-grid--three">
        <ChartPanel title="Top publishers" subtitle="Largest dataset publishers">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.topPublishers} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis type="number" tickFormatter={formatCompact} stroke="#94a3b8" axisLine={false} />
              <YAxis dataKey="label" type="category" width={160} stroke="#94a3b8" tickLine={false} axisLine={false} />
              <Tooltip formatter={formatTooltipValue} />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]} />
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
              <Bar dataKey="count" fill="#22c55e" radius={[8, 8, 0, 0]} />
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
