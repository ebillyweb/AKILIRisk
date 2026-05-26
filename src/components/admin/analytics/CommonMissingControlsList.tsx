import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MissingControlRow } from "@/lib/admin/analytics-queries";

/**
 * §9.1 (BRD) — top 10 ServiceRecommendations by AssessmentRecommendation
 * row count. Highest-signal product card on the page: tells AKILI
 * which controls are most-commonly missing across every advisor's
 * client base, useful for product strategy + curriculum prioritization.
 */
export function CommonMissingControlsList({ rows }: { rows: MissingControlRow[] }) {
  const empty = rows.length === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Common missing controls</CardTitle>
        <CardDescription>
          {empty
            ? "No assessment recommendations on the platform yet."
            : "Top 10 service recommendations by occurrence across every assessment."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="rounded-md border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            No control rows.
          </div>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, index) => (
              <li
                key={r.serviceRecommendationId}
                className="flex items-center justify-between gap-3 rounded-md border bg-card/30 px-3 py-2"
                data-service-id={r.serviceRecommendationId}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums w-6 shrink-0">
                    #{index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.name}</p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {r.category}
                    </Badge>
                  </div>
                </div>
                <span className="font-mono text-sm tabular-nums shrink-0">
                  {r.count}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
