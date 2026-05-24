import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PillarAveragesResult } from "@/lib/admin/analytics-queries";

/**
 * §9.1 (BRD) — per-pillar averages across the platform.
 */
export function PillarAveragesStrip({ data }: { data: PillarAveragesResult }) {
  const empty = data.totalScored === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Per-pillar averages</CardTitle>
        <CardDescription>
          {empty
            ? "Averages appear once any assessment is scored."
            : "Mean score and typical risk level for each domain."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="rounded-md border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            No scored assessments yet.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.pillars.map((p) => (
              <li
                key={p.pillarId}
                data-pillar-id={p.pillarId}
                data-dominant-level={p.dominantLevel}
                className={`min-w-0 rounded-lg border p-4 ${p.palette.bg} ${p.palette.text} ${p.palette.border}`}
              >
                <p
                  className="text-sm font-semibold leading-snug"
                  title={p.pillarName}
                >
                  {p.pillarName}
                </p>
                <p className="mt-3 text-2xl font-semibold tabular-nums leading-none">
                  {p.avgScore == null ? "—" : p.avgScore.toFixed(1)}
                  <span className="ml-1.5 text-xs font-normal opacity-80">
                    avg score
                  </span>
                </p>
                <p className="mt-2 text-xs leading-relaxed opacity-90">
                  {p.dominantLevel === "unassessed"
                    ? "Not assessed yet"
                    : `Typically ${p.palette.label.toLowerCase()}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
