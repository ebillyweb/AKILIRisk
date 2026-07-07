import "server-only";

import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of completed recommendations that triggers a system reassessment recommendation (D-09) */
export const SYSTEM_REASSESSMENT_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// System reassessment trigger check
// ---------------------------------------------------------------------------

/**
 * Check whether a system-recommended reassessment should be triggered for an assessment.
 *
 * Conditions (per D-09):
 * 1. Number of COMPLETED recommendations >= threshold (default 3)
 * 2. No reassessment already exists for this assessment (no Assessment with
 *    previousAssessmentId pointing to the given assessmentId)
 */
export async function checkSystemReassessmentTriggers(
  clientId: string,
  assessmentId: string,
): Promise<{ shouldRecommend: boolean; reason: string | null }> {
  // Count completed recommendations for this assessment
  const completedCount = await prisma.assessmentRecommendation.count({
    where: {
      assessmentId,
      status: "COMPLETED",
      assessment: { userId: clientId },
    },
  });

  if (completedCount < SYSTEM_REASSESSMENT_THRESHOLD) {
    return { shouldRecommend: false, reason: null };
  }

  // Check if a reassessment already exists for this assessment
  const existingReassessment = await prisma.assessment.findFirst({
    where: {
      previousAssessmentId: assessmentId,
    },
    select: { id: true },
  });

  if (existingReassessment) {
    return { shouldRecommend: false, reason: null };
  }

  return {
    shouldRecommend: true,
    reason: `${completedCount} completed recommendations since last assessment`,
  };
}
