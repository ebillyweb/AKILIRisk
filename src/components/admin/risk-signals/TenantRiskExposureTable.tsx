import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TenantRiskExposureRow } from "@/lib/admin/risk-signals-queries";

export function TenantRiskExposureTable({ rows }: { rows: TenantRiskExposureRow[] }) {
  const empty = rows.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Tenants by risk exposure</CardTitle>
        <CardDescription>
          {empty
            ? "No advisors with assessed clients yet."
            : "Top advisors by families at elevated risk (critical or moderate risk domain scores). Advisor identity only — no client names."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="rounded-md border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            No tenant rows.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left">Advisor</th>
                  <th className="px-3 py-2 text-right">Assessed</th>
                  <th className="px-3 py-2 text-right">At risk</th>
                  <th className="px-3 py-2 text-right">Critical indicators</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.advisorProfileId}
                    className="border-b last:border-b-0"
                    data-advisor-profile-id={r.advisorProfileId}
                  >
                    <td className="px-3 py-2 align-middle">
                      <p className="font-medium">{r.firmName ?? "(no firm name)"}</p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    </td>
                    <td className="px-3 py-2 text-right align-middle tabular-nums">
                      {r.familiesWithAssessment}
                    </td>
                    <td className="px-3 py-2 text-right align-middle tabular-nums">
                      {r.familiesAtRisk > 0 ? (
                        <span className="font-medium text-destructive">
                          {r.familiesAtRisk}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right align-middle tabular-nums text-muted-foreground">
                      {r.criticalIndicators}
                    </td>
                    <td className="px-3 py-2 text-right align-middle">
                      {r.advisorUserId ? (
                        <Button asChild variant="ghost" size="sm" className="shrink-0">
                          <Link href={`/admin/advisors/${r.advisorUserId}/edit`}>
                            Open
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      ) : null}
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
