import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UsageTrend } from "@/lib/admin/analytics-metrics";

/**
 * 14-day usage trend rendered as inline sparkline bars — no chart
 * library. Three series side-by-side per bucket (intake submissions,
 * assessments started, assessments completed). When the trend is
 * entirely empty we render an honest "Not enough data yet" empty state
 * instead of a row of zero-height bars.
 */
export function TrendCard({ trend }: { trend: UsageTrend }) {
  const max = Math.max(
    1,
    ...trend.points.flatMap((p) => [
      p.intakeSubmissions,
      p.assessmentsStarted,
      p.assessmentsCompleted,
    ])
  );

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold tracking-tight">
          Platform usage — last 14 days
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Intake submissions, assessments started, and assessments completed,
          bucketed by UTC day. Today&apos;s bucket is partial.
        </p>
      </CardHeader>
      <CardContent>
        {trend.empty ? (
          <EmptyState />
        ) : (
          <>
            <div className="flex items-end gap-1 sm:gap-2">
              {trend.points.map((p) => (
                <div
                  key={p.date}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div
                    className="flex h-32 w-full items-end justify-center gap-0.5"
                    aria-label={`Bucket ${p.date}: ${p.intakeSubmissions} intake submissions, ${p.assessmentsStarted} assessments started, ${p.assessmentsCompleted} completed`}
                  >
                    <Bar value={p.intakeSubmissions} max={max} variant="brand" />
                    <Bar
                      value={p.assessmentsStarted}
                      max={max}
                      variant="muted"
                    />
                    <Bar
                      value={p.assessmentsCompleted}
                      max={max}
                      variant="accent"
                    />
                  </div>
                  <span className="text-[0.6rem] text-muted-foreground">
                    {p.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
            <Legend />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Bar({
  value,
  max,
  variant,
}: {
  value: number;
  max: number;
  variant: "brand" | "muted" | "accent";
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const color =
    variant === "brand"
      ? "bg-foreground/80"
      : variant === "accent"
        ? "bg-emerald-500/70"
        : "bg-muted-foreground/40";
  return (
    <div className="flex h-full w-2 flex-col justify-end sm:w-2.5">
      <div
        className={`${color} rounded-sm transition-all`}
        style={{ height: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
      />
    </div>
  );
}

function Legend() {
  return (
    <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7rem] text-muted-foreground">
      <LegendDot className="bg-foreground/80" label="Intake submitted" />
      <LegendDot className="bg-muted-foreground/40" label="Assessment started" />
      <LegendDot className="bg-emerald-500/70" label="Assessment completed" />
    </ul>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className={`inline-block size-2 rounded-sm ${className}`} aria-hidden />
      <span>{label}</span>
    </li>
  );
}

function EmptyState() {
  return (
    <p className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
      Not enough data yet. Trend points will appear once intake submissions
      and assessment activity start flowing.
    </p>
  );
}
