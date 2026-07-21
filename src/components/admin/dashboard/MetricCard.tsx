import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type MetricStatus = "healthy" | "warning" | "critical" | "neutral";

export type MetricTrendDirection = "up" | "down" | "flat";

interface MetricCardProps {
  title: string;
  value: string | number;
  /** Secondary line under the trend (e.g. timezone note). */
  subtitle?: string;
  /** Explains what the trend delta measures (e.g. "vs yesterday"). */
  trendLabel?: string;
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

const statusLabels: Record<Exclude<MetricStatus, "neutral">, string> = {
  healthy: "Healthy",
  warning: "Attention",
  critical: "Critical",
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

/**
 * Loading placeholder that mirrors {@link MetricCard}'s layout so the metrics
 * grid keeps its shape while a snapshot is being fetched.
 */
export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <article
      aria-hidden
      className={cn(
        "hero-surface relative flex min-h-[9.5rem] flex-col rounded-2xl border border-border/80 bg-card p-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <Skeleton className="mt-0.5 size-8 shrink-0 rounded-lg" />
        <Skeleton className="mt-1 h-4 w-24" />
      </div>
      <div className="mt-3 flex flex-1 flex-col justify-end gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-28" />
      </div>
    </article>
  );
}

export function MetricCard({
  title,
  value,
  subtitle,
  trendLabel,
  icon: Icon,
  status = "neutral",
  trend,
  className,
}: MetricCardProps) {
  const renderAsStatusBadge = isStatusStringValue(value);
  const TrendIcon = trend ? trendIcons[trend.direction] : null;
  const showHeaderStatusPill =
    !renderAsStatusBadge && (status === "warning" || status === "critical");

  return (
    <article
      className={cn(
        "hero-surface group relative flex min-h-[9.5rem] flex-col rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors",
              "border-border/60 bg-muted/40 group-hover:border-primary/25 group-hover:bg-primary/5 group-hover:text-primary"
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <p className="min-w-0 text-sm font-medium leading-snug text-foreground">
            {title}
          </p>
        </div>

        {showHeaderStatusPill && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
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
            {statusLabels[status]}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-1 flex-col justify-end gap-2">
        {renderAsStatusBadge ? (
          <span
            className={cn(
              "inline-flex w-fit max-w-full items-center rounded-md border px-2.5 py-1 text-sm font-semibold leading-tight",
              statusBadgeStyles[status]
            )}
          >
            {value}
          </span>
        ) : (
          <p className="text-3xl font-semibold tabular-nums leading-none tracking-tight text-foreground">
            {value}
          </p>
        )}

        {(trend || subtitle) && (
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {trend && TrendIcon && (
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-medium",
                    trendStyles[trend.direction]
                  )}
                >
                  <TrendIcon className="size-3 shrink-0" aria-hidden />
                  {trend.value}
                </span>
                {trendLabel ? (
                  <span className="text-muted-foreground">{trendLabel}</span>
                ) : null}
              </p>
            )}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        )}
      </div>
    </article>
  );
}
