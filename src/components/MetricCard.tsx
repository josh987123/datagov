import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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

function parseNumericFromDisplay(value: string): number {
  const normalized = value.replaceAll(",", "").replace(/[^0-9.+-]/g, "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFallbackTrend(value: number): MetricTrendSeries {
  const now = new Date();
  const fiveYear = Array.from({ length: 60 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (59 - index), 1));
    const label = new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(date);

    return {
      label,
      value,
    };
  });

  return {
    oneYear: fiveYear.slice(-12),
    fiveYear,
  };
}

function normalizePoints(points: MetricTrendPoint[]): MetricTrendPoint[] {
  return points.filter((point) => Number.isFinite(point.value));
}

function clampTrend(points: MetricTrendPoint[]): MetricTrendPoint[] {
  if (points.length >= 2) {
    return points;
  }

  if (points.length === 1) {
    return [
      { ...points[0], label: `${points[0].label}-a` },
      { ...points[0], label: `${points[0].label}-b` },
    ];
  }

  return [
    { label: "start", value: 0 },
    { label: "end", value: 0 },
  ];
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
  const [range, setRange] = useState<"1y" | "5y">("1y");
  const trendMap = useContext(MetricTrendContext);
  const resolvedTrend = trend ?? trendMap[title] ?? EMPTY_TREND;
  const fallback = useMemo(() => buildFallbackTrend(parseNumericFromDisplay(value)), [value]);
  const rawPoints = range === "1y" ? resolvedTrend.oneYear : resolvedTrend.fiveYear;
  const displayPoints = clampTrend(normalizePoints(rawPoints.length > 0 ? rawPoints : range === "1y" ? fallback.oneYear : fallback.fiveYear));
  const geometry = sparklineGeometry(displayPoints);
  const startValue = displayPoints[0]?.value ?? 0;
  const endValue = displayPoints[displayPoints.length - 1]?.value ?? 0;
  const trendDelta = endValue - startValue;

  return (
    <article className={`metric-card metric-card--${accent}`}>
      <div className="metric-card__header">
        <span className="metric-card__title">{title}</span>
        <span className="metric-card__header-controls">
          <span className="metric-card__range-toggle" role="group" aria-label={`${title} trend range`}>
            <button
              type="button"
              className={range === "1y" ? "metric-card__range-button metric-card__range-button--active" : "metric-card__range-button"}
              onClick={() => setRange("1y")}
            >
              1Y
            </button>
            <button
              type="button"
              className={range === "5y" ? "metric-card__range-button metric-card__range-button--active" : "metric-card__range-button"}
              onClick={() => setRange("5y")}
            >
              5Y
            </button>
          </span>
          <span className="metric-card__icon">{icon}</span>
        </span>
      </div>
      <p className="metric-card__value">{value}</p>
      <div className="metric-card__sparkline" aria-hidden="true">
        <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none">
          <path d={geometry.areaPath} className="metric-card__sparkline-area" />
          <polyline points={geometry.linePath} className="metric-card__sparkline-line" />
        </svg>
        <p className="metric-card__sparkline-caption">
          {range === "1y" ? "Past year" : "Past 5 years"}:{" "}
          <span className={trendDelta >= 0 ? "metric-card__sparkline-delta metric-card__sparkline-delta--up" : "metric-card__sparkline-delta metric-card__sparkline-delta--down"}>
            {trendDelta >= 0 ? "+" : ""}
            {trendDelta.toFixed(2)}
          </span>
        </p>
      </div>
      <p className="metric-card__hint">{hint}</p>
    </article>
  );
}
