import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Single KPI tile used on /admin/analytics. Mirrors the visual rhythm
 * of the existing KpiStrip tiles but renders as a standalone card so
 * the new "business activity" KPI row can sit in its own grid.
 */
export interface MetricCardProps {
  label: string;
  /** Pre-formatted value string (e.g. "1,204", "—", "12.4 h"). */
  value: string;
  /** Optional sub-line under the value. */
  sub?: string;
  /** Render as a muted card — used for "Not enough data yet". */
  muted?: boolean;
}

export function MetricCard({ label, value, sub, muted }: MetricCardProps) {
  return (
    <Card
      className={cn(
        "border-border/80 shadow-sm",
        muted && "bg-muted/40"
      )}
    >
      <CardContent className="space-y-2 pt-6">
        <p className="editorial-kicker">{label}</p>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums leading-tight sm:text-3xl",
            muted && "text-muted-foreground"
          )}
        >
          {value}
        </p>
        {sub ? (
          <p className="text-xs text-muted-foreground">{sub}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Helpers — kept here so metric callers can use them without owning the
 *  formatting decisions. */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export function formatPercent(
  ratio: number | null | undefined,
  digits = 0
): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return "—";
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))} min`;
  }
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}
