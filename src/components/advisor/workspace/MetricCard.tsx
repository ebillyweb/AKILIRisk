import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: number | string;
  className?: string;
}

export function MetricCard({ label, value, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-center",
        className
      )}
    >
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
