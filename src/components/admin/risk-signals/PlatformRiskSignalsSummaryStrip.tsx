import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlatformRiskSignalsSummary } from "@/lib/admin/risk-signals-queries";

export function PlatformRiskSignalsSummaryStrip({
  summary,
}: {
  summary: PlatformRiskSignalsSummary;
}) {
  const empty = summary.familiesWithAssessment === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Portfolio risk snapshot</CardTitle>
        <CardDescription>
          {empty
            ? "Signals appear once any client completes an assessment."
            : "Aggregate counts from each family's latest completed assessment (score-based severity, same rules as advisor Risk intelligence)."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="rounded-md border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            No scored assessments yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SignalStat
              label="Families assessed"
              value={summary.familiesWithAssessment}
            />
            <SignalStat
              label="Families at risk"
              value={summary.familiesAtRisk}
              highlight={summary.familiesAtRisk > 0}
            />
            <SignalStat
              label="Critical indicators"
              value={summary.criticalIndicators}
              highlight={summary.criticalIndicators > 0}
            />
            <SignalStat
              label="Moderate indicators"
              value={summary.moderateIndicators}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SignalStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="hero-surface rounded-lg p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          highlight ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
