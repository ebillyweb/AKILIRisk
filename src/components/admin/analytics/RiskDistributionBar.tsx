import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskDistribution } from "@/lib/admin/analytics-queries";

/**
 * §9.1 (BRD) — risk-level distribution. Stacked horizontal bar showing
 * how many latest-per-pillar PillarScore rows are LOW / MEDIUM / HIGH /
 * CRITICAL across every client on the platform.
 *
 * Implementation note: pure CSS (flexbox + percentages) — avoids
 * adding a chart-library dependency for a single bar. Each segment's
 * width is a flex-grow proportional to its count; segments below 1%
 * collapse to a fixed minimum width so they remain visible.
 */
export function RiskDistributionBar({ distribution }: { distribution: RiskDistribution }) {
  const total = distribution.totalScored;
  const empty = total === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Risk-level distribution</CardTitle>
        <CardDescription>
          {empty
            ? "No scored pillars yet — distribution will populate once the first assessment is scored."
            : `Across ${total} latest-per-pillar score${total === 1 ? "" : "s"} platform-wide.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="rounded-md border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            No scored assessments yet.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex h-8 w-full overflow-hidden rounded-md border">
              {distribution.buckets
                .filter((b) => b.count > 0)
                .map((b) => (
                  <div
                    key={b.level}
                    title={`${b.level}: ${b.count} (${b.percent.toFixed(1)}%)`}
                    className={`${b.palette.bg} flex items-center justify-center text-xs font-mono`}
                    style={{ flexGrow: b.count, flexShrink: 0, minWidth: "32px" }}
                    data-level={b.level}
                  >
                    <span className={b.palette.text}>{b.count}</span>
                  </div>
                ))}
            </div>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              {distribution.buckets.map((b) => (
                <li key={b.level} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`inline-block h-3 w-3 rounded-sm border ${b.palette.bg} ${b.palette.border}`}
                  />
                  <span className="font-medium">{b.palette.label}</span>
                  <span className="ml-auto font-mono tabular-nums text-muted-foreground">
                    {b.count} · {b.percent.toFixed(0)}%
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
