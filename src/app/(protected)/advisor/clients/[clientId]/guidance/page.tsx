import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { prisma } from "@/lib/db";
import { getGuidancePackageForClient } from "@/lib/recommendations/guidance-package";
import { GuidanceReviewPage } from "@/components/guidance/GuidanceReviewPage";
import { GuidanceSummaryStrip } from "@/components/guidance/GuidanceSummaryStrip";
import { PublishActionPlanButton } from "@/components/engagement/PublishActionPlanButton";
import { ClientAssessmentLifecycleToolbar } from "@/components/assessment/ClientAssessmentLifecycleToolbar";
import {
  isEnterpriseActionPlanWorkspaceEnabled,
  resolveEnterpriseMemberVisibilityContext,
} from "@/lib/enterprise/advisor-member-visibility";

import { getAdvisorAssessmentLifecycleContext } from "@/lib/advisor/assessment-lifecycle.server";

export default async function AdvisorClientGuidancePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  let advisorProfileId: string;
  let advisorUserId: string;
  try {
    const { userId } = await requireAdvisorRole();
    advisorUserId = userId;

    // T-22-10: Verify advisor has an active assignment for this client
    const advisorProfile = await prisma.advisorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!advisorProfile) {
      redirect("/advisor");
    }

    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        clientId,
        advisorId: advisorProfile.id,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!assignment) {
      redirect("/advisor");
    }

    advisorProfileId = advisorProfile.id;
  } catch {
    redirect("/advisor");
  }

  const visibilityContext = await resolveEnterpriseMemberVisibilityContext(advisorUserId);
  if (!isEnterpriseActionPlanWorkspaceEnabled(visibilityContext)) {
    redirect(`/advisor/pipeline/${clientId}`);
  }

  const guidancePackage = await getGuidancePackageForClient(
    clientId,
    advisorProfileId
  );

  // Query latest assessment for publish state
  const latestAssessment = await prisma.assessment.findFirst({
    where: { userId: clientId },
    orderBy: { startedAt: "desc" },
    select: { id: true, actionPlanPublishedAt: true, status: true },
  });

  const assessmentLifecycle = await getAdvisorAssessmentLifecycleContext(
    advisorUserId,
    latestAssessment,
  );

  if (!guidancePackage || guidancePackage.items.length === 0) {
    return (
      <div className="space-y-8">
        <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm ring-1 ring-border/30 sm:p-5">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60"
              aria-hidden
            >
              <Compass className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Client Guidance
              </p>
              <h1 className="text-2xl font-semibold font-display tracking-[-0.03em] text-foreground">
                {guidancePackage.clientName}
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Holistic guidance package synthesized across all completed
                assessments
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            No recommendations generated yet
          </p>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Complete an assessment for this client to generate the guidance
            package. Start an assessment from the client&apos;s profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm ring-1 ring-border/30 sm:p-5">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60"
            aria-hidden
          >
            <Compass className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Client Guidance
            </p>
            <h1 className="text-2xl font-semibold font-display tracking-[-0.03em] text-foreground">
              {guidancePackage.clientName}
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Holistic guidance package synthesized across all completed
              assessments
            </p>
          </div>
          {latestAssessment && (
            <div className="shrink-0 self-start">
              <PublishActionPlanButton
                assessmentId={latestAssessment.id}
                clientName={guidancePackage.clientName}
                publishedAt={latestAssessment.actionPlanPublishedAt}
              />
            </div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-border/50 space-y-4">
          <GuidanceSummaryStrip summary={guidancePackage.summary} />
          {latestAssessment ? (
            <ClientAssessmentLifecycleToolbar
              assessmentId={latestAssessment.id}
              assessmentStatus={latestAssessment.status}
              showStaleScoresActions={false}
              reassessmentEnabled={assessmentLifecycle.reassessmentEnabled}
              targetedQuestionCount={assessmentLifecycle.targetedQuestionCount}
              variant="stacked"
            />
          ) : null}
        </div>
      </div>

      <GuidanceReviewPage guidancePackage={guidancePackage} />
    </div>
  );
}
