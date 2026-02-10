"use client";

import type { AgencyTrendPoint } from "@datagov/shared";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactNumber } from "@/lib/format";

interface AgencyDetailTrendChartProps {
  data: AgencyTrendPoint[];
}

export function AgencyDetailTrendChart({ data }: AgencyDetailTrendChartProps) {
  const chartData = data.map((point) => ({
    ...point,
    label: point.date.slice(5)
  }));

  return (
    <div className="h-80 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Agency dataset trajectory</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis dataKey="label" minTickGap={28} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatCompactNumber} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => formatCompactNumber(value as number | string | undefined)} />
          <Line type="monotone" dataKey="datasetCount" stroke="#2563eb" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
