"use client";

import type { AgencyFreshnessBucket } from "@datagov/shared";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactNumber } from "@/lib/format";

interface FreshnessBucketsChartProps {
  data: AgencyFreshnessBucket[];
}

export function FreshnessBucketsChart({ data }: FreshnessBucketsChartProps) {
  return (
    <div className="h-72 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Freshness distribution</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatCompactNumber} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => formatCompactNumber(value as number | string | undefined)} />
          <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]}>
            <LabelList position="top" formatter={(value) => formatCompactNumber(value as number | string | undefined)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
