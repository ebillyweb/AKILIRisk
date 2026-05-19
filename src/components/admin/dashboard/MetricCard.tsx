import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricStatus = "healthy" | "warning" | "critical" | "neutral";

export type MetricTrendDirection = "up" | "down" | "flat";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  status?: MetricStatus;
  trend?: {
    value: string;
    direction: MetricTrendDirection;
  };
  className?: string;
}

const trendStyles: Record<MetricTrendDirection, string> = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-600 dark:text-red-400",
  flat: "text-muted-foreground",
};

const trendIcons: Record<MetricTrendDirection, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
};

const statusDotStyles: Record<MetricStatus, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
  neutral: "bg-muted-foreground/40",
};

const statusBadgeStyles: Record<MetricStatus, string> = {
  healthy:
    "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300",
  critical:
    "border-red-500/30 bg-red-500/12 text-red-700 dark:text-red-300",
  neutral:
    "border-border/60 bg-muted/40 text-muted-foreground",
};

/**
 * Treat the value as a status label (renders as a badge) when it is a
 * non-numeric string that isn't a percentage / count token like "80%" or
 * "1,234". Examples: "Operational", "Degraded", "Down".
 */
function isStatusStringValue(value: string | number): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "—") return false;
  const numericLead = parseFloat(trimmed);
  return Number.isNaN(numericLead);
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  status = "neutral",
  trend,
  className,
}: MetricCardProps) {
  const renderAsStatusBadge = isStatusStringValue(value);
  const TrendIcon = trend ? trendIcons[trend.direction] : null;
  const showStatusDot = !renderAsStatusBadge && status !== "neutral";

  return (
    <article
      className={cn(
        "hero-surface group relative flex h-full flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border hover:shadow-md",
        className
      )}
    >
      <div className="flex flex-col items-start gap-2">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors",
            "border-border/60 bg-muted/40 group-hover:border-primary/25 group-hover:bg-primary/5 group-hover:text-primary"
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>

        {showStatusDot && (
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            )}
            aria-label={`Status: ${status}`}
          >
            <span
              className={cn(
                "inline-block size-1.5 rounded-full",
                statusDotStyles[status]
              )}
              aria-hidden
            />
            {status}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <p className="whitespace-normal text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>

        {renderAsStatusBadge ? (
          <span
            className={cn(
              "inline-flex w-fit max-w-full items-center whitespace-normal break-words rounded-md border px-2 py-1 text-sm font-semibold leading-tight",
              statusBadgeStyles[status]
            )}
          >
            {value}
          </span>
        ) : (
          <p className="text-3xl font-semibold leading-none tracking-tight text-foreground">
            {value}
          </p>
        )}
      </div>

      {(trend || subtitle) && (
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {trend && TrendIcon && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                trendStyles[trend.direction]
              )}
            >
              <TrendIcon className="size-3" aria-hidden />
              {trend.value}
            </span>
          )}
          {subtitle && (
            <span className="whitespace-normal text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
