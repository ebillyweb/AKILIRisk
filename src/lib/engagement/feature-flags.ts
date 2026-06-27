import "server-only";

import { prisma } from "@/lib/db";

/**
 * Check whether implementation tracking is enabled for an advisor's enterprise.
 *
 * Solo advisors (no enterprise row) default to tracking enabled.
 * Enterprise advisors use the enterprise-level flag.
 */
export async function isImplementationTrackingEnabled(
  advisorProfileId: string,
): Promise<boolean> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      enterprise: {
        select: { implementationTrackingEnabled: true },
      },
    },
  });

  // No profile found: fail closed (false)
  if (!profile) return false;

  // Solo advisor (no enterprise): default to enabled
  // Enterprise advisor: respect the enterprise flag
  return profile.enterprise?.implementationTrackingEnabled ?? true;
}

/**
 * Check whether tracking is active for a specific assessment.
 *
 * Tracking activates when the advisor publishes the action plan
 * (sets actionPlanPublishedAt). Per D-02: auto-activates on publish,
 * no separate toggle.
 */
export async function isTrackingActiveForAssessment(
  assessmentId: string,
): Promise<boolean> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { actionPlanPublishedAt: true },
  });

  return assessment?.actionPlanPublishedAt != null;
}
