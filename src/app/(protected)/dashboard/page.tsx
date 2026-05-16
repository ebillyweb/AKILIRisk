import { auth } from "@/lib/auth";
import { getAdvisorHubAccessForUserId } from "@/lib/advisor/auth";
import { getClientIntakeGateState } from "@/lib/client/intake-gate";
import { prisma } from "@/lib/db";
import { isPlatformAdminRole } from "@/lib/auth-roles";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { countVisibleGovernanceQuestions } from "@/lib/assessment/bank/load-bank";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UnauthorizedNotice } from "@/components/layout/UnauthorizedNotice";
import { RiskHeatMap } from "@/components/assessment/RiskHeatMap";
import {
  resolveOverallRisk,
  resolveTopRisks,
} from "@/lib/dashboard/client-summary";
import { ChevronRight } from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const sp = await searchParams;
  // Forward to the role-appropriate landing while preserving the
  // ?error=unauthorized signal so the destination can surface a notice.
  const errorSuffix =
    sp.error === "unauthorized" ? "?error=unauthorized" : "";

  // Advisors and admins land on the advisor hub instead of the client dashboard
  const role = session.user.role?.toString().toUpperCase();
  if (role === "ADVISOR") {
    const hub = await getAdvisorHubAccessForUserId(session.user.id);
    if (!hub.allowed) {
      if (hub.blockReason === "deactivated") {
        redirect(
          `/api/auth/signout?callbackUrl=${encodeURIComponent("/signin?notice=account_deactivated")}`
        );
      }
      redirect(
        hub.blockReason === "disabled"
          ? "/settings?notice=advisor_portal_disabled"
          : "/advisor/billing"
      );
    }
    redirect(`/advisor${errorSuffix}`);
  }
  if (isPlatformAdminRole(role)) {
    redirect(`/admin${errorSuffix}`);
  }

  // Latest intake (any status) for hero; assessment access from gate (approve or advisor waiver)
  let intakeHeroLabel = "Not started";

  const [latestIntake, intakeGate] = await Promise.all([
    prisma.intakeInterview.findFirst({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, status: true },
    }),
    getClientIntakeGateState(session.user.id),
  ]);

  const assessmentUnlocked = intakeGate.assessmentUnlocked;

  if (latestIntake) {
    if (latestIntake.status === "NOT_STARTED") {
      intakeHeroLabel = "Not started";
    } else if (latestIntake.status === "IN_PROGRESS") {
      intakeHeroLabel = "In progress";
    } else if (latestIntake.status === "COMPLETED") {
      intakeHeroLabel = "Complete";
    } else if (latestIntake.status === "SUBMITTED") {
      const approval = await prisma.intakeApproval.findUnique({
        where: { interviewId: latestIntake.id },
        select: { status: true },
      });
      if (approval?.status === "APPROVED") {
        intakeHeroLabel = "Approved";
      } else if (approval?.status === "IN_REVIEW") {
        intakeHeroLabel = "In review";
      } else if (approval?.status === "REJECTED") {
        intakeHeroLabel = "Update needed";
      } else {
        intakeHeroLabel = "Pending review";
      }
    }
  }

  if (intakeGate.intakeWaived && !intakeGate.intakeApproved) {
    intakeHeroLabel = "Waived by advisor";
  }

  // Fetch assessments with responses and scores
  const assessments = await prisma.assessment.findMany({
    where: { userId: session.user.id },
    include: {
      _count: { select: { responses: true } },
      scores: {
        orderBy: { calculatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const assessmentHeroLabel =
    assessments[0]?.status === "COMPLETED"
      ? "Complete"
      : assessments.length
        ? "In progress"
        : "None yet";

  const totalQuestions = await countVisibleGovernanceQuestions();

  // §4.3 close-out: load every PillarScore for the latest assessment so
  // the dashboard can render the 6-cell heat map + the top-risks list.
  // Cheap query — at most 6 rows per assessment, indexed on assessmentId.
  const latestAssessmentForHeatMap = assessments[0];
  const allPillarScores = latestAssessmentForHeatMap
    ? await prisma.pillarScore.findMany({
        where: { assessmentId: latestAssessmentForHeatMap.id },
        select: { pillar: true, score: true, riskLevel: true },
        orderBy: { pillar: "asc" },
      })
    : [];

  const overallRisk = resolveOverallRisk({
    score: latestAssessmentForHeatMap?.scores[0]?.score ?? null,
    riskLevel: latestAssessmentForHeatMap?.scores[0]?.riskLevel ?? null,
  });
  const topRisks = resolveTopRisks(allPillarScores);
  const showHeatMap = assessmentUnlocked && allPillarScores.length > 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <UnauthorizedNotice error={sp.error} />
      <section className="hero-surface rounded-[1.75rem] p-4 sm:p-8">
        <div className="grid min-w-0 gap-6 sm:gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="flex min-w-0 flex-col justify-center space-y-2 sm:space-y-3">
            <p className="text-sm text-muted-foreground">
              Welcome back,{" "}
              {session.user.firstName ?? session.user.name ?? "Guest"}
            </p>
          </div>

          <div className="min-w-0">
            <Card className="bg-background/60">
              {/* §4.3 close-out: the hero now leads with Overall Risk
                  (BRD §4.3 "single-screen summary dashboard"); the
                  remaining tiles are kept and laid out 1×5 on lg, 2×3
                  on smaller screens. MFA status duplicates the Account
                  Settings card below — kept here for at-a-glance
                  visibility. */}
              <CardContent className="grid grid-cols-2 gap-x-6 gap-y-8 pt-5 sm:grid-cols-3 sm:gap-x-8 sm:px-6 sm:pt-6 lg:grid-cols-5">
                <div className="min-w-0 max-w-full" data-testid="hero-overall-risk">
                  <p className="editorial-kicker block">Overall Risk</p>
                  {overallRisk ? (
                    <div className="mt-2 space-y-1">
                      <p className="break-words text-2xl font-semibold leading-tight tracking-tight tabular-nums sm:text-3xl">
                        {overallRisk.score.toFixed(1)} / 10
                      </p>
                      <Badge
                        variant="outline"
                        className={`${overallRisk.palette.bg} ${overallRisk.palette.text} ${overallRisk.palette.border}`}
                      >
                        {overallRisk.palette.label}
                      </Badge>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm leading-snug text-muted-foreground">
                      Complete your assessment to see your overall risk.
                    </p>
                  )}
                </div>
                <div className="min-w-0 max-w-full">
                  <p className="editorial-kicker block">Intake</p>
                  <p className="mt-2 break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                    {intakeHeroLabel}
                  </p>
                </div>
                <div className="min-w-0 max-w-full">
                  <p className="editorial-kicker block">Assessment</p>
                  <p className="mt-2 break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                    {assessmentHeroLabel}
                  </p>
                </div>
                <div className="min-w-0 max-w-full">
                  <p className="editorial-kicker block">Assessments</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums leading-tight sm:text-3xl">
                    {assessments.length}
                  </p>
                </div>
                <div className="min-w-0 max-w-full">
                  <p className="editorial-kicker block">MFA</p>
                  <p className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
                    {session?.user?.mfaEnabled ? "On" : "Off"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* §4.3 close-out: Risk by Domain heat map + Top Risks. The heat
          map is the same component the advisor side uses, fed by the
          per-pillar PillarScore rows for the latest assessment.
          - assessmentUnlocked=false (intake not yet approved) → hidden
            so the locked banner above is the only signal.
          - assessmentUnlocked=true but no scored pillars → empty heat
            map with "Complete your assessment" placeholder copy.
          - scored → full heat map + top-risks list when at least one
            pillar has a non-unassessed level. */}
      {assessmentUnlocked && (
        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Risk by domain</CardTitle>
              <CardDescription>
                {showHeatMap
                  ? "Snapshot of your six risk domains. Each cell shows the maturity score and the risk level."
                  : "Complete your assessment to populate the heat map."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RiskHeatMap
                mode="single-client"
                pillarScores={allPillarScores}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Top risks</CardTitle>
              <CardDescription>
                {topRisks.length > 0
                  ? "Highest-priority domains based on your most recent scoring."
                  : "No risks to surface yet — complete your assessment to see prioritized domains."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topRisks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Once your assessment is scored, the highest-priority
                  domains appear here so you can review them in order.
                </p>
              ) : (
                <ul className="divide-y divide-border" data-testid="top-risks">
                  {topRisks.map((risk) => (
                    <li
                      key={risk.pillarId}
                      className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      data-pillar-id={risk.pillarId}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{risk.pillarName}</p>
                          <Badge
                            variant="outline"
                            className={`${risk.palette.bg} ${risk.palette.text} ${risk.palette.border} text-xs`}
                          >
                            {risk.palette.label}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground tabular-nums">
                            {risk.score.toFixed(1)} / 10
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-snug text-muted-foreground line-clamp-2">
                          {risk.summary}
                        </p>
                      </div>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                      >
                        <Link
                          href={`/assessment/results?pillar=${encodeURIComponent(risk.pillarId)}`}
                        >
                          Review
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className={!assessmentUnlocked ? "opacity-75" : undefined}>
          <CardHeader>
            <CardTitle className="text-3xl">Your Assessments</CardTitle>
            <CardDescription>
              {assessmentUnlocked
                ? "Monitor progress and continue or review the latest family governance assessment."
                : "Assessment unlocks after your advisor reviews and approves your intake."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!assessmentUnlocked ? (
              <div className="rounded-[1.5rem] border section-divider bg-muted/40 px-6 py-10 text-center">
                <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground">
                  Complete your intake and wait for your advisor to approve it.
                  The assessment will then become available here.
                </p>
              </div>
            ) : assessments.length === 0 ? (
              <div className="rounded-[1.5rem] border section-divider bg-background/55 px-6 py-10 text-center">
                <p className="mx-auto mb-5 max-w-2xl text-sm leading-7 text-muted-foreground">
                  No assessments yet. Start your first risk assessment to
                  receive personalized governance recommendations.
                </p>
                <Button asChild size="lg">
                  <Link href="/assessment">Start Assessment</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {assessments.map((assessment) => {
                  const isCompleted = assessment.status === "COMPLETED";
                  const responseCount = assessment._count.responses;
                  const progressPercentage =
                    (responseCount / totalQuestions) * 100;
                  const latestScore = assessment.scores[0];

                  return (
                    <Card key={assessment.id} className="bg-background/55">
                      <CardHeader className="pb-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-2xl">
                              Family Governance Assessment
                            </CardTitle>
                            <CardDescription>
                              Updated{" "}
                              {formatDistanceToNow(
                                new Date(assessment.updatedAt),
                                { addSuffix: true },
                              )}
                            </CardDescription>
                          </div>
                          <Badge
                            variant={isCompleted ? "success" : "info"}
                            className="w-fit"
                          >
                            {isCompleted ? "Completed" : "In Progress"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        {!isCompleted ? (
                          <>
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Progress
                                </span>
                                <span className="font-medium text-foreground">
                                  {responseCount} of {totalQuestions} questions
                                  answered
                                </span>
                              </div>
                              <Progress
                                value={progressPercentage}
                                className="h-2.5"
                              />
                              <p className="text-xs text-muted-foreground">
                                {Math.round(progressPercentage)}% complete
                              </p>
                            </div>

                            <div className="rounded-[1.25rem] border section-divider bg-card/50 px-4 py-4">
                              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                Section Status
                              </p>
                              <div className="mt-3 flex items-center gap-3">
                                <div className="flex-1">
                                  <Progress
                                    value={progressPercentage}
                                    className="h-2"
                                  />
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  Family Governance
                                </span>
                              </div>
                            </div>

                            {assessmentUnlocked ? (
                              <Button asChild className="w-full" size="lg">
                                <Link href="/assessment">
                                  Continue Assessment
                                </Link>
                              </Button>
                            ) : (
                              <Button
                                className="w-full"
                                size="lg"
                                disabled
                                title="Assessment unlocks after your advisor approves your intake."
                              >
                                Continue Assessment
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            {latestScore && (
                              <div className="space-y-4">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground">
                                      Overall Score
                                    </p>
                                    <p className="text-4xl font-semibold">
                                      {latestScore.score.toFixed(1)} / 10
                                    </p>
                                  </div>
                                  <Badge
                                    variant={
                                      latestScore.riskLevel === "LOW"
                                        ? "success"
                                        : latestScore.riskLevel === "MEDIUM"
                                          ? "warning"
                                          : latestScore.riskLevel === "HIGH"
                                            ? "warning"
                                            : "outline"
                                    }
                                    className="w-fit"
                                  >
                                    {latestScore.riskLevel} Risk
                                  </Badge>
                                </div>

                                <div className="rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4 text-sm text-muted-foreground">
                                  Completed on{" "}
                                  {format(
                                    new Date(
                                      assessment.completedAt ||
                                        assessment.updatedAt,
                                    ),
                                    "MMM d, yyyy",
                                  )}
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                  {assessmentUnlocked ? (
                                    <>
                                      <Button asChild size="lg">
                                        <Link href="/assessment/results">
                                          View Results
                                        </Link>
                                      </Button>
                                      <Button asChild size="lg" variant="outline">
                                        <a
                                          href={`/api/reports/${assessment.id}/pdf?pillar=${encodeURIComponent(latestScore.pillar)}`}
                                          download
                                        >
                                          Download Report
                                        </a>
                                      </Button>
                                      <Button asChild size="lg" variant="outline">
                                        <Link href="/assessment/results">
                                          Get Templates
                                        </Link>
                                      </Button>
                                      <Button asChild size="lg" variant="outline">
                                        <Link href="/assessment">Start New</Link>
                                      </Button>
                                    </>
                                  ) : (
                                    <p className="col-span-full text-sm text-muted-foreground">
                                      Assessment actions unlock after your advisor approves your intake.
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Account Settings</CardTitle>
            <CardDescription>
              Review identity and account protection details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4">
              <p className="editorial-kicker">Email</p>
              <p className="mt-2 text-base font-semibold">
                {session?.user?.email}
              </p>
            </div>

            <div className="rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="editorial-kicker">Two-Factor Auth</p>
                  <p className="mt-2 text-base font-semibold">
                    {session?.user?.mfaEnabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <Badge
                  variant={session?.user?.mfaEnabled ? "success" : "secondary"}
                >
                  {session?.user?.mfaEnabled ? "Protected" : "Recommended"}
                </Badge>
              </div>
            </div>

            <Button asChild variant="outline" size="lg" className="w-full">
              <Link href="/settings">Manage Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
