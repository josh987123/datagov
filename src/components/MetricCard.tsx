import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { formatCompact } from "../lib/format";

export interface MetricTrendPoint {
  label: string;
  value: number;
}

export interface MetricTrendSeries {
  oneYear: MetricTrendPoint[];
  fiveYear: MetricTrendPoint[];
}

export type MetricTrendMap = Record<string, MetricTrendSeries>;

const EMPTY_TREND: MetricTrendSeries = {
  oneYear: [],
  fiveYear: [],
};

const MetricTrendContext = createContext<MetricTrendMap>({});

function normalizePoints(points: MetricTrendPoint[]): MetricTrendPoint[] {
  return points.filter((point) => Number.isFinite(point.value));
}

function hasVisibleVariation(points: MetricTrendPoint[]): boolean {
  if (points.length < 2) {
    return false;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return false;
  }

  const scale = Math.max(Math.abs(max), Math.abs(min), 1);
  return range / scale >= 0.001;
}

function formatCurrencyCompact(value: number): string {
  const sign = value < 0 ? "-" : value > 0 ? "+" : "";
  return `${sign}$${formatCompact(Math.abs(value))}`;
}

function formatTrendDelta(value: number, displayValue: string): string {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  if (displayValue.includes("$")) {
    return formatCurrencyCompact(value);
  }

  if (displayValue.includes("%")) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}pp`;
  }

  if (displayValue.includes("x")) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}x`;
  }

  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    return `${sign}${formatCompact(absolute)}`;
  }

  return `${sign}${absolute.toFixed(2)}`;
}

function sparklineGeometry(points: MetricTrendPoint[]) {
  const width = 170;
  const height = 48;
  const paddingX = 4;
  const paddingY = 5;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const step = points.length <= 1 ? 0 : innerWidth / (points.length - 1);

  const coords = points.map((point, index) => {
    const x = paddingX + index * step;
    const y = paddingY + ((max - point.value) / range) * innerHeight;
    return { x, y };
  });

  const linePath = coords.map((coord) => `${coord.x.toFixed(2)},${coord.y.toFixed(2)}`).join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];
  const areaPath = `M ${first.x.toFixed(2)} ${(height - paddingY).toFixed(2)} L ${linePath
    .split(" ")
    .join(" L ")} L ${last.x.toFixed(2)} ${(height - paddingY).toFixed(2)} Z`;

  return {
    width,
    height,
    linePath,
    areaPath,
  };
}

export function MetricTrendProvider({
  trends,
  children,
}: {
  trends: MetricTrendMap;
  children: ReactNode;
}) {
  return <MetricTrendContext.Provider value={trends}>{children}</MetricTrendContext.Provider>;
}

interface MetricCardProps {
  title: string;
  value: string;
  hint: string;
  icon: ReactNode;
  accent?: "violet" | "cyan" | "emerald" | "amber";
  trend?: MetricTrendSeries;
}

export function MetricCard({
  title,
  value,
  hint,
  icon,
  accent = "violet",
  trend,
}: MetricCardProps) {
  const trendMap = useContext(MetricTrendContext);
  const resolvedTrend = trend ?? trendMap[title] ?? EMPTY_TREND;
  const displayPoints = normalizePoints(resolvedTrend.fiveYear);
  const showSparkline = hasVisibleVariation(displayPoints);
  const geometry = showSparkline ? sparklineGeometry(displayPoints) : null;
  const startValue = displayPoints[0]?.value ?? 0;
  const endValue = displayPoints[displayPoints.length - 1]?.value ?? 0;
  const trendDelta = endValue - startValue;

  return (
    <article className={`metric-card metric-card--${accent}`}>
      <div className="metric-card__header">
        <span className="metric-card__title">{title}</span>
        <span className="metric-card__icon">{icon}</span>
      </div>
      <p className="metric-card__value">{value}</p>
      {showSparkline && geometry ? (
        <div className="metric-card__sparkline" aria-hidden="true">
          <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none">
            <path d={geometry.areaPath} className="metric-card__sparkline-area" />
            <polyline points={geometry.linePath} className="metric-card__sparkline-line" />
          </svg>
          <p className="metric-card__sparkline-caption">
            Past 5 years:{" "}
            <span className={trendDelta >= 0 ? "metric-card__sparkline-delta metric-card__sparkline-delta--up" : "metric-card__sparkline-delta metric-card__sparkline-delta--down"}>
              {formatTrendDelta(trendDelta, value)}
            </span>
          </p>
        </div>
      ) : null}
      <p className="metric-card__hint">{hint}</p>
    </article>
  );
}
