"use client";

import type { AgencyTrendSeries } from "@datagov/shared";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatCompactNumber } from "@/lib/format";

interface TopAgenciesTrendChartProps {
  series: AgencyTrendSeries[];
}

const COLORS = ["#0f766e", "#2563eb", "#9333ea", "#f97316", "#dc2626"];

export function TopAgenciesTrendChart({ series }: TopAgenciesTrendChartProps): JSX.Element {
  const allDates = Array.from(new Set(series.flatMap((entry) => entry.points.map((point) => point.date)))).sort();

  const chartData = allDates.map((date) => {
    const row: Record<string, string | number> = { date: date.slice(5) };
    for (const entry of series) {
      const point = entry.points.find((candidate) => candidate.date === date);
      row[`agency_${entry.agencyId}`] = point?.datasetCount ?? 0;
    }
    return row;
  });

  return (
    <div className="h-80 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-600">Top Agencies Over Time</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" minTickGap={28} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatCompactNumber} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => formatCompactNumber(Number(value))} />
          <Legend />
          {series.map((entry, index) => (
            <Line
              key={entry.agencyId}
              type="monotone"
              dataKey={`agency_${entry.agencyId}`}
              name={entry.agencyName}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
