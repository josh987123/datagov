"use client";

import type { TrendPoint } from "@datagov/shared";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface ExposureTrendsChartProps {
  data: TrendPoint[];
}

export function ExposureTrendsChart({ data }: ExposureTrendsChartProps) {
  const chartData = data.map((point) => ({
    label: point.date.slice(5),
    staleSharePct: Number((point.staleDatasetShare * 100).toFixed(2)),
    openFormatSharePct: Number((point.openFormatShare * 100).toFixed(2)),
    apiResourceSharePct: Number((point.apiResourceShare * 100).toFixed(2))
  }));

  return (
    <div className="h-80 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Staleness and Openness Exposure</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis dataKey="label" minTickGap={28} tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => `${Number(value ?? 0).toFixed(1)}%`} />
          <Legend />
          <Area
            type="monotone"
            dataKey="staleSharePct"
            name="Stale share"
            fill="#f97316"
            stroke="#ea580c"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="openFormatSharePct"
            name="Open format share"
            fill="#10b981"
            stroke="#059669"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="apiResourceSharePct"
            name="API resource share"
            fill="#3b82f6"
            stroke="#2563eb"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
