import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TopTenantRow } from "@/lib/admin/analytics-queries";

/**
 * §9.1 (BRD) — top tenants by active-client count. Top 10 advisors,
 * each row links to /admin/advisors/[id]/edit (existing route). No
 * client identities surfaced here — only advisor (firmName + email),
 * which is commercial counterparty data per round-11 §5.1.
 */
export function TopTenantsTable({ rows }: { rows: TopTenantRow[] }) {
  const empty = rows.length === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Top tenants by client count</CardTitle>
        <CardDescription>
          {empty
            ? "No advisors with active client assignments yet."
            : "Top 10 advisors by active-client roster size. Click a row to drill into advisor detail."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="rounded-md border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            No tenant rows.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left">Advisor</th>
                  <th className="px-3 py-2 text-right">Active clients</th>
                  <th className="px-3 py-2 text-right">Scored assessments</th>
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
                    <td className="px-3 py-2 text-right tabular-nums align-middle">
                      {r.activeClientCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums align-middle text-muted-foreground">
                      {r.scoredAssessmentCount}
                    </td>
                    <td className="px-3 py-2 text-right align-middle">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                      >
                        <Link href={`/admin/advisors/${r.advisorUserId}/edit`}>
                          Open
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
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
