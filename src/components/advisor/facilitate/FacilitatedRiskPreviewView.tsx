import Link from "next/link";

import { FinishSessionButton } from "@/components/advisor/facilitate/FinishSessionButton";
import { RiskHeatMap } from "@/components/assessment/RiskHeatMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatNarrowScopePreviewCopy,
  isNarrowAssessmentScope,
} from "@/lib/assessment/included-pillars";
import { resolveTopRisks } from "@/lib/dashboard/client-summary";
import { facilitatedAssessmentHubPath } from "@/lib/facilitated/paths";

type FacilitatedRiskPreviewViewProps = {
  sessionId: string;
  clientName: string | null;
  includedPillars: string[];
  pillarScores: Array<{ pillar: string; score: number; riskLevel: string }>;
};

export function FacilitatedRiskPreviewView({
  sessionId,
  clientName,
  includedPillars,
  pillarScores,
}: FacilitatedRiskPreviewViewProps) {
  const narrowScope = isNarrowAssessmentScope(includedPillars);
  const topRisks = resolveTopRisks(pillarScores);

  return (
    <div
      className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:space-y-8"
      data-testid="facilitated-risk-preview"
    >
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Live session · Risk preview
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {clientName ? `Review with ${clientName}` : "Review risk preview"}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Walk through the heat map and top risks with your client. When you are
          done, finish the session to move them into your profile review queue.
        </p>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Risk by domain</CardTitle>
            <CardDescription>
              {narrowScope
                ? formatNarrowScopePreviewCopy(includedPillars)
                : "High-level view of the assessed risk domains for this session."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RiskHeatMap
              mode="single-client"
              pillarScores={pillarScores}
              includedPillarIds={narrowScope ? includedPillars : undefined}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Top risks</CardTitle>
            <CardDescription>
              Highest-priority domains from this session. Detailed recommendations
              belong in the published Risk Profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topRisks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No prioritized domains to surface yet.
              </p>
            ) : (
              <ul
                className="divide-y divide-border"
                data-testid="facilitated-risk-preview-top-risks"
              >
                {topRisks.map((risk) => (
                  <li
                    key={risk.pillarId}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{risk.pillarName}</p>
                        <Badge
                          variant="outline"
                          className={`${risk.palette.bg} ${risk.palette.text} ${risk.palette.border} text-xs`}
                        >
                          {risk.palette.label}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {risk.score.toFixed(1)} / 3
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">
                        {risk.summary}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">
          This preview does not include the full action plan. Publish the Risk
          Profile from the client record when you are ready for follow-up work.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <Link href={facilitatedAssessmentHubPath(sessionId)}>
              Back to assessment
            </Link>
          </Button>
          <FinishSessionButton sessionId={sessionId} />
        </div>
      </section>
    </div>
  );
}
