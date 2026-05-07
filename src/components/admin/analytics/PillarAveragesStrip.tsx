import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PillarAveragesResult } from "@/lib/admin/analytics-queries";

/**
 * §9.1 (BRD) — per-pillar averages. 6-cell strip echoing the canonical
 * heat-map palette for visual continuity, but values are aggregate
 * averages across every advisor's clients (not per-client).
 */
export function PillarAveragesStrip({ data }: { data: PillarAveragesResult }) {
  const empty = data.totalScored === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Per-pillar averages</CardTitle>
        <CardDescription>
          {empty
            ? "Per-pillar averages populate once any assessment is scored."
            : "Mean score and dominant risk level per domain, across the platform."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="rounded-md border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            No scored assessments yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {data.pillars.map((p) => (
              <div
                key={p.pillarId}
                data-pillar-id={p.pillarId}
                data-dominant-level={p.dominantLevel}
                className={`flex flex-col gap-1 rounded-md border p-3 text-xs ${p.palette.bg} ${p.palette.text} ${p.palette.border}`}
              >
                <div className="font-medium leading-tight">{p.pillarName}</div>
                <div className="font-mono text-[11px] opacity-90 tabular-nums">
                  {p.avgScore == null ? "—" : `${p.avgScore.toFixed(1)} avg`}
                </div>
                <div className="text-[11px] opacity-80">
                  {p.dominantLevel === "unassessed"
                    ? "Not assessed"
                    : `${p.palette.label} dominant · n=${p.count}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
