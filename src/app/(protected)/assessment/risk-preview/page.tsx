import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getClientAssessmentSummaryAccess } from "@/lib/client/assessment-summary-gate";
import { RiskHeatMap } from "@/components/assessment/RiskHeatMap";
import { DeliverablePhaseBanner } from "@/components/deliverable/DeliverablePhaseBanner";
import { resolveTopRisks } from "@/lib/dashboard/client-summary";
import {
  formatNarrowScopePreviewCopy,
  isNarrowAssessmentScope,
} from "@/lib/assessment/included-pillars";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AssessmentPreviewPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const access = await getClientAssessmentSummaryAccess(session.user.id);
  if (access.canViewSummary) {
    redirect("/assessment/results");
  }

  const assessment = access.assessmentId
    ? await prisma.assessment.findFirst({
        where: { id: access.assessmentId, userId: session.user.id },
        select: {
          id: true,
          deliverablePhase: true,
          previewEnteredAt: true,
          profileEnteredAt: true,
          upsellTriggersFired: true,
          portfolioEngagement: {
            select: {
              status: true,
              meetingScheduledAt: true,
              meetingAt: true,
            },
          },
        },
      })
    : null;

  if (!assessment) {
    redirect("/assessment");
  }

  const pillarScores = await prisma.pillarScore.findMany({
    where: { assessmentId: assessment.id },
    select: { pillar: true, score: true, riskLevel: true },
    orderBy: { pillar: "asc" },
  });

  const includedPillars = access.includedPillars;
  const narrowScope = isNarrowAssessmentScope(includedPillars);
  const includedSet = new Set(includedPillars.map(normalizePillarSlug));
  const scopedScores = pillarScores.filter((row) =>
    includedSet.has(normalizePillarSlug(row.pillar)),
  );
  const topRisks = resolveTopRisks(scopedScores);

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <DeliverablePhaseBanner
        assessmentId={assessment.id}
        phase={assessment.deliverablePhase}
        upsellTriggersFired={
          Array.isArray(assessment.upsellTriggersFired)
            ? (assessment.upsellTriggersFired as string[])
            : null
        }
        engagement={assessment.portfolioEngagement}
        previewEnteredAt={assessment.previewEnteredAt}
        profileEnteredAt={assessment.profileEnteredAt}
      />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Risk by domain</CardTitle>
            <CardDescription>
              {narrowScope
                ? formatNarrowScopePreviewCopy(includedPillars)
                : "High-level view of your six risk domains. Each cell shows the maturity score and risk level from your completed assessment."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RiskHeatMap
              mode="single-client"
              pillarScores={scopedScores}
              includedPillarIds={narrowScope ? includedPillars : undefined}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Top risks</CardTitle>
            <CardDescription>
              Highest-priority domains based on your scoring. Your advisor will
              include detailed recommendations in your published Risk Profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topRisks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No prioritized domains to surface yet.
              </p>
            ) : (
              <ul className="divide-y divide-border" data-testid="risk-preview-top-risks">
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
                      <p className="mt-1 text-sm leading-snug text-muted-foreground line-clamp-2">
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

      <section className="flex flex-col gap-3 border-t section-divider pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground max-w-xl">
          This Risk Preview does not include your action plan. Your advisor will
          publish the full Risk Profile when it is ready.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/assessment">Assessment hub</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
