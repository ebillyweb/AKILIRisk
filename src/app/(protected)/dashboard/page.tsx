import { auth } from "@/lib/auth";
import { getAdvisorHubAccessForUserId } from "@/lib/advisor/auth";
import { resolveAdvisorCheckoutBillingHref } from "@/lib/advisor/checkout-billing-redirect";
import { getClientIntakeGateState } from "@/lib/client/intake-gate";
import { hasClientAssessmentStarted } from "@/lib/client/intake-edit-gate";
import { getClientAssessmentSummaryAccess } from "@/lib/client/assessment-summary-gate";
import { prisma } from "@/lib/db";
import { isPlatformAdminRole, normalizeUserRoleString } from "@/lib/auth-roles";
import { redirect } from "next/navigation";
import { countVisibleGovernanceQuestions } from "@/lib/assessment/bank/load-bank";
import { UnauthorizedNotice } from "@/components/layout/UnauthorizedNotice";
import { ClientDashboardOverview } from "@/components/dashboard/ClientDashboardOverview";
import { DeliverablePhaseBanner } from "@/components/deliverable/DeliverablePhaseBanner";
import { deliverableBannerBrandingProps } from "@/lib/client/deliverable-banner-branding";
import { loadDeliverableHeatMapData } from "@/lib/client/deliverable-heat-map.server";
import { resolveClientPortalBrandingForUser } from "@/lib/client/resolve-client-portal-branding";
import { isTenantBrandedRequest } from "@/lib/client/branded-portal-requirements";
import { isClientActionPlanEnabledForUser } from "@/lib/client/client-action-plan-visibility.server";
import {
  buildClientDashboardDestinations,
  buildClientDashboardHeadline,
  buildClientDashboardJourney,
} from "@/lib/dashboard/client-dashboard-hub";

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
  const errorSuffix =
    sp.error === "unauthorized" ? "?error=unauthorized" : "";

  const role = normalizeUserRoleString(session.user.role);
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
          : await resolveAdvisorCheckoutBillingHref(session.user.id)
      );
    }
    redirect(`/advisor${errorSuffix}`);
  }
  if (isPlatformAdminRole(role)) {
    redirect(`/admin${errorSuffix}`);
  }

  let intakeHeroLabel = "Not started";

  const [latestIntake, intakeGate, summaryAccess, assessments, totalQuestions, intakeAnswersLocked, portalBranding, actionPlanEnabled, onTenantHost] =
    await Promise.all([
      prisma.intakeInterview.findFirst({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true, status: true },
      }),
      getClientIntakeGateState(session.user.id),
      getClientAssessmentSummaryAccess(session.user.id),
      prisma.assessment.findMany({
        where: { userId: session.user.id },
        select: {
          id: true,
          status: true,
          deliverablePhase: true,
          upsellTriggersFired: true,
          previewEnteredAt: true,
          profileEnteredAt: true,
          updatedAt: true,
          portfolioEngagement: {
            select: {
              status: true,
              meetingScheduledAt: true,
              meetingAt: true,
            },
          },
          _count: { select: { responses: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 1,
      }),
      countVisibleGovernanceQuestions(),
      hasClientAssessmentStarted(session.user.id),
      resolveClientPortalBrandingForUser({
        userId: session.user.id,
        email: session.user.email ?? "",
      }),
      isClientActionPlanEnabledForUser(session.user.id),
      isTenantBrandedRequest(),
    ]);

  const assessmentUnlocked = intakeGate.assessmentUnlocked;
  const latestAssessment = assessments[0] ?? null;

  if (intakeGate.intakeWaived) {
    intakeHeroLabel = "Bypassed by advisor";
  } else if (latestIntake) {
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

  const assessmentComplete = latestAssessment?.status === "COMPLETED";
  const assessmentInProgress =
    !!latestAssessment && latestAssessment.status !== "COMPLETED";
  const responseCount = latestAssessment?._count.responses ?? 0;

  const hubInput = {
    intakeHeroLabel,
    intakeWaived: intakeGate.intakeWaived,
    hasSubmittedInterview: intakeGate.hasSubmittedInterview,
    intakeAnswersLocked,
    restrictNavToIntake: intakeGate.restrictNavToIntake,
    assessmentUnlocked,
    assessmentScopePending: intakeGate.assessmentScopePending,
    assessmentInProgress,
    assessmentComplete,
    canViewRiskPreview: summaryAccess.canViewRiskPreview,
    canViewSummary: summaryAccess.canViewSummary,
    canViewActionPlan: summaryAccess.canViewSummary && actionPlanEnabled,
    actionPlanEnabled,
    responseCount,
    totalQuestions,
    mfaEnabled: !!session.user.mfaEnabled,
    portalCopy: portalBranding
      ? {
          tagline: portalBranding.tagline,
          landingHeadline: portalBranding.landingHeadline,
          landingSubheadline: portalBranding.landingSubheadline,
        }
      : undefined,
  };

  const bannerBranding = deliverableBannerBrandingProps(portalBranding);
  const isWhiteLabeledPortal = onTenantHost || Boolean(portalBranding);

  const { headline, subheadline } = buildClientDashboardHeadline(hubInput);
  const journeySteps = buildClientDashboardJourney(hubInput);
  const destinations = buildClientDashboardDestinations(hubInput);

  const showDeliverableBanner =
    latestAssessment?.status === "COMPLETED" &&
    assessmentUnlocked &&
    summaryAccess.canViewRiskPreview;

  const deliverableHeatMap =
    showDeliverableBanner && latestAssessment
      ? await loadDeliverableHeatMapData(
          latestAssessment.id,
          summaryAccess.includedPillars,
        )
      : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <UnauthorizedNotice error={sp.error} />

      <ClientDashboardOverview
        headline={headline}
        subheadline={subheadline}
        journeySteps={journeySteps}
        destinations={destinations}
        hideExplorePortalSection={isWhiteLabeledPortal}
        deliverableBanner={
          showDeliverableBanner && latestAssessment ? (
            <DeliverablePhaseBanner
              assessmentId={latestAssessment.id}
              phase={summaryAccess.deliverablePhase}
              upsellTriggersFired={
                Array.isArray(latestAssessment.upsellTriggersFired)
                  ? (latestAssessment.upsellTriggersFired as string[])
                  : null
              }
              engagement={latestAssessment.portfolioEngagement ?? null}
              previewEnteredAt={latestAssessment.previewEnteredAt}
              profileEnteredAt={latestAssessment.profileEnteredAt}
              advisorTeamLabel={bannerBranding.advisorTeamLabel}
              brandHex={bannerBranding.brandHex}
              heatMap={deliverableHeatMap}
            />
          ) : null
        }
      />
    </div>
  );
}
