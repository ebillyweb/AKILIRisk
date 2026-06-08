import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeUserRoleString } from "@/lib/auth-roles";
import { getClientFacilitatedRecommendations } from "@/lib/client/assessment-recommendations";
import { getAssessmentSummaryAccessForAssessment } from "@/lib/client/assessment-summary-gate";
import { prisma } from "@/lib/db";

/**
 * GET /api/assessment/[id]/recommendations
 * Matched facilitated-service recommendations for the signed-in client.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const role = normalizeUserRoleString(session.user.role);
  if (role !== "USER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const access = await getAssessmentSummaryAccessForAssessment(
    id,
    session.user.id,
  );

  if (!access.assessmentId) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  if (!access.canViewSummary) {
    return NextResponse.json(
      {
        error: access.allPillarsComplete
          ? "Your Risk Profile must be published before viewing recommendations."
          : "Complete all assessment pillars first.",
        code: "SUMMARY_LOCKED",
      },
      { status: 403 },
    );
  }

  const [recommendations, assessmentMeta] = await Promise.all([
    getClientFacilitatedRecommendations(id, session.user.id),
    prisma.assessment.findFirst({
      where: { id, userId: session.user.id },
      select: {
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
    }),
  ]);

  return NextResponse.json({
    deliverablePhase: access.deliverablePhase,
    upsellTriggersFired: Array.isArray(assessmentMeta?.upsellTriggersFired)
      ? (assessmentMeta.upsellTriggersFired as string[])
      : null,
    previewEnteredAt: assessmentMeta?.previewEnteredAt?.toISOString() ?? null,
    profileEnteredAt: assessmentMeta?.profileEnteredAt?.toISOString() ?? null,
    engagement: assessmentMeta?.portfolioEngagement ?? null,
    recommendations,
  });
}
