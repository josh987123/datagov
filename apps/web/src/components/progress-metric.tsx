interface ProgressMetricProps {
  label: string;
  valuePct: number;
  tone?: "blue" | "emerald" | "amber" | "rose";
}

const toneClasses: Record<NonNullable<ProgressMetricProps["tone"]>, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500"
};

export function ProgressMetric({ label, valuePct, tone = "blue" }: ProgressMetricProps) {
  const bounded = Math.max(0, Math.min(100, valuePct));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="font-semibold text-slate-900">{bounded.toFixed(1)}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${toneClasses[tone]}`} style={{ width: `${bounded}%` }} />
      </div>
    </div>
  );
}
