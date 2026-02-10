"use client";

import type { TrendPoint } from "@datagov/shared";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatCompactNumber } from "@/lib/format";

interface DatasetGrowthChartProps {
  data: TrendPoint[];
}

export function DatasetGrowthChart({ data }: DatasetGrowthChartProps) {
  const chartData = data.map((point) => ({
    ...point,
    label: point.date.slice(5)
  }));

  return (
    <div className="h-80 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-600">Dataset Growth Over Time</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" minTickGap={28} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatCompactNumber} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) => formatCompactNumber(value as number | string | undefined)}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Line type="monotone" dataKey="totalDatasets" name="Total datasets" stroke="#2563eb" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
