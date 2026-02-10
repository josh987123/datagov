interface StatusBadgeProps {
  status: "RUNNING" | "SUCCESS" | "FAILED";
}

const statusStyles: Record<StatusBadgeProps["status"], string> = {
  RUNNING: "bg-amber-100 text-amber-800",
  SUCCESS: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-rose-100 text-rose-800"
};

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>{status}</span>
  );
}
