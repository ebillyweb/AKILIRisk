import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PillarRiskSignal } from "@/lib/admin/risk-signals-queries";

export function PillarRiskSignalsTable({ pillars }: { pillars: PillarRiskSignal[] }) {
  const empty = pillars.every(
    (p) => p.familiesAtRisk === 0 && p.avgScore === null
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Risk by domain</CardTitle>
        <CardDescription>
          {empty
            ? "No pillar-level signals yet."
            : "Domains ranked by how many families show critical or moderate scores (latest assessment per family)."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="rounded-md border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            No domain rows.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left">Domain</th>
                  <th className="px-3 py-2 text-right">Families at risk</th>
                  <th className="px-3 py-2 text-right">Avg score</th>
                  <th className="px-3 py-2 text-right">Critical</th>
                  <th className="px-3 py-2 text-right">Moderate</th>
                </tr>
              </thead>
              <tbody>
                {pillars.map((p) => (
                  <tr
                    key={p.pillarId}
                    className="border-b last:border-b-0"
                    data-pillar-id={p.pillarId}
                  >
                    <td className="px-3 py-2 align-middle font-medium">
                      {p.pillarName}
                    </td>
                    <td className="px-3 py-2 text-right align-middle tabular-nums">
                      {p.familiesAtRisk > 0 ? (
                        <Badge variant="destructive">{p.familiesAtRisk}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right align-middle tabular-nums text-muted-foreground">
                      {p.avgScore == null ? "—" : p.avgScore.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right align-middle tabular-nums">
                      {p.criticalCount}
                    </td>
                    <td className="px-3 py-2 text-right align-middle tabular-nums">
                      {p.moderateCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
