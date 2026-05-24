import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskDistribution } from "@/lib/admin/analytics-queries";

/**
 * §9.1 (BRD) — risk-level distribution. Stacked horizontal bar + legend.
 */
export function RiskDistributionBar({ distribution }: { distribution: RiskDistribution }) {
  const total = distribution.totalScored;
  const empty = total === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Risk-level distribution</CardTitle>
        <CardDescription>
          {empty
            ? "No scored pillars yet — distribution appears after the first assessment is scored."
            : `Based on ${total} scored pillar${total === 1 ? "" : "s"} across the platform.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="rounded-md border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            No scored assessments yet.
          </div>
        ) : (
          <div className="space-y-5">
            <div
              className="flex h-10 w-full overflow-hidden rounded-lg border"
              role="img"
              aria-label="Risk level distribution bar chart"
            >
              {distribution.buckets
                .filter((b) => b.count > 0)
                .map((b) => (
                  <div
                    key={b.level}
                    title={`${b.palette.label}: ${b.count} (${b.percent.toFixed(1)}%)`}
                    className={`${b.palette.bg} flex min-w-[2.5rem] items-center justify-center text-sm font-semibold tabular-nums`}
                    style={{ flexGrow: b.count }}
                    data-level={b.level}
                  >
                    <span className={b.palette.text}>{b.count}</span>
                  </div>
                ))}
            </div>

            <ul className="grid gap-2 sm:grid-cols-2">
              {distribution.buckets.map((b) => (
                <li
                  key={b.level}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={`inline-block h-3 w-3 shrink-0 rounded-sm border ${b.palette.bg} ${b.palette.border}`}
                    />
                    <span className="text-sm font-medium">{b.palette.label}</span>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {b.count}
                    <span className="ml-1 text-muted-foreground/80">
                      ({b.percent.toFixed(0)}%)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
