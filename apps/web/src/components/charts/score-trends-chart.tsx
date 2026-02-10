"use client";

import type { TrendPoint } from "@datagov/shared";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface ScoreTrendsChartProps {
  data: TrendPoint[];
}

export function ScoreTrendsChart({ data }: ScoreTrendsChartProps) {
  const chartData = data.map((point) => ({
    ...point,
    label: point.date.slice(5)
  }));

  return (
    <div className="h-80 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Quality and Openness Score Trends</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis dataKey="label" minTickGap={28} tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) => `${Number(value ?? 0).toFixed(1)}`}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend />
          <Line type="monotone" dataKey="avgQualityScore" name="Avg quality score" stroke="#2563eb" strokeWidth={2.2} dot={false} />
          <Line type="monotone" dataKey="avgOpennessScore" name="Avg openness score" stroke="#0f766e" strokeWidth={2.2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
