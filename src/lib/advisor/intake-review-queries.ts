import "server-only";

import { getAdvisorProfileOrThrow, requireAdvisorRole } from "@/lib/advisor/auth";
import type { IntakeReviewData } from "@/lib/advisor/types";
import {
  loadAdvisorPiiPolicy,
  resolveEffectiveFieldVisibility,
} from "@/lib/advisor/field-visibility";
import { isPlatformAdminRole } from "@/lib/auth-roles";
import { getAssignedAdvisorFirmNameForClient } from "@/lib/client/assigned-advisor-firm-name";
import {
  createIntakeApproval,
  getClientIntakeForReview,
  getIntakeInterviewForPlatformAdminReview,
  updateIntakeApproval,
} from "@/lib/data/advisor";
import { prisma } from "@/lib/db";
import { loadIntakeScriptQuestions } from "@/lib/intake/load-intake-script";
import { personalizeIntakeScript } from "@/lib/intake/personalize-intake-question";
import { toAdvisorHouseholdMemberViews } from "@/lib/profiles/advisor-household-view";

/**
 * Advisor intake review page loader. Mirrors `getAssessmentForAdvisorReview`:
 * server-only query invoked directly from the RSC (not via a `'use server'`
 * action) so `auth()` sees the same request session as the page render.
 *
 * Returns `null` when the interview is missing or the caller lacks tenant
 * access — the page maps that to `notFound()`.
 */
export async function getIntakeReviewDataForAdvisorPage(
  interviewId: string,
): Promise<IntakeReviewData | null> {
  const trimmedId = interviewId.trim();
  if (!trimmedId) return null;

  const { userId, role } = await requireAdvisorRole();
  const isPlatformAdmin = isPlatformAdminRole(role);

  let reviewData;
  let profile;

  if (isPlatformAdmin) {
    reviewData = await getIntakeInterviewForPlatformAdminReview(trimmedId, userId);
    if (!reviewData) return null;

    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: { clientId: reviewData.interview.userId, status: "ACTIVE" },
      orderBy: { assignedAt: "desc" },
      select: { advisorId: true },
    });
    if (!assignment) return null;

    profile = await prisma.advisorProfile.findUnique({
      where: { id: assignment.advisorId },
    });
    if (!profile) return null;
  } else {
    profile = await getAdvisorProfileOrThrow(userId);
    reviewData = await getClientIntakeForReview(profile.id, trimmedId, userId);
    if (!reviewData) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[getIntakeReviewDataForAdvisorPage] advisor access denied", {
          interviewId: trimmedId,
          advisorProfileId: profile.id,
          advisorUserId: userId,
          firmName: profile.firmName,
        });
      }
      return null;
    }
  }

  // US-11: opening a submitted intake moves approval to IN_REVIEW.
  let approval = reviewData.approval;
  const assignmentAdvisorProfileId =
    reviewData.assignmentAdvisorProfileId ?? profile.id;
  const assignmentProfile =
    assignmentAdvisorProfileId === profile.id
      ? profile
      : await prisma.advisorProfile.findUnique({
          where: { id: assignmentAdvisorProfileId },
        });
  if (!assignmentProfile) return null;

  if (
    !isPlatformAdmin &&
    reviewData.interview.status === "SUBMITTED" &&
    (!approval || approval.status === "PENDING")
  ) {
    const priorApproval = await createIntakeApproval(
      trimmedId,
      assignmentAdvisorProfileId,
    );
    if (priorApproval.status === "PENDING") {
      approval = await updateIntakeApproval(priorApproval.id, {
        status: "IN_REVIEW",
        reviewedAt: new Date(),
      });
    } else {
      approval = priorApproval;
    }
  }

  const [script, firmName] = await Promise.all([
    loadIntakeScriptQuestions(),
    getAssignedAdvisorFirmNameForClient(reviewData.interview.userId),
  ]);
  const personalizedScript = personalizeIntakeScript(script, firmName);

  const rawHouseholdMembers = assignmentProfile.householdProfilesEnabled
    ? await prisma.householdMember.findMany({
        where: { userId: reviewData.interview.userId },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      advisorId: assignmentAdvisorProfileId,
      clientId: reviewData.interview.userId,
      status: "ACTIVE",
    },
    select: { fieldVisibility: true },
  });
  const advisorPolicy = await loadAdvisorPiiPolicy(assignmentAdvisorProfileId);
  const effective = resolveEffectiveFieldVisibility(
    advisorPolicy,
    assignment?.fieldVisibility ?? null,
  );
  const householdMembers = toAdvisorHouseholdMemberViews(
    rawHouseholdMembers,
    effective,
  );

  return {
    interview: reviewData.interview,
    approval,
    questions: personalizedScript.map((q) => ({
      id: q.id,
      text: q.questionText,
      helpText: q.context,
      type: "audio",
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      context: q.context,
      whyThisMatters: q.whyThisMatters,
      recommendedActions: q.recommendedActions,
      recordingTips: q.recordingTips,
    })),
    householdMembers,
  };
}
