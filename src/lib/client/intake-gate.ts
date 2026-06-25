import "server-only";

import { prisma } from "@/lib/db";
import {
  getClientEngagementScope,
  isEngagementAssessmentUnlocked,
} from "@/lib/client/engagement-scope";

export type ClientIntakeGateState = {
  hasSubmittedInterview: boolean;
  intakeApproved: boolean;
  intakeWaived: boolean;
  /** Waived intake but advisor has not selected assessment domains yet. */
  assessmentScopePending: boolean;
  restrictNavToIntake: boolean;
  assessmentUnlocked: boolean;
};

/**
 * Single source for client (USER) intake vs assessment access.
 * Epic 5.11: assessment unlocks after advisor sets pillar scope via intake
 * approval (1–6 domains) or via intake waiver + domains on the assignment.
 */
export async function getClientIntakeGateState(
  clientUserId: string,
): Promise<ClientIntakeGateState> {
  const [engagementScope, submittedInterview, latestApproval] = await Promise.all([
    getClientEngagementScope(clientUserId),
    prisma.intakeInterview.findFirst({
      where: { userId: clientUserId, status: "SUBMITTED" },
      select: { id: true },
    }),
    prisma.intakeApproval.findFirst({
      where: {
        status: "APPROVED",
        interview: { userId: clientUserId },
      },
      orderBy: { approvedAt: "desc" },
      select: { status: true },
    }),
  ]);

  const intakeWaived = engagementScope.intakeWaived;
  const hasSubmittedInterview = !!submittedInterview;
  const intakeApproved = latestApproval?.status === "APPROVED";
  const assessmentUnlocked = isEngagementAssessmentUnlocked(engagementScope);
  const assessmentScopePending = intakeWaived && !assessmentUnlocked;
  const restrictNavToIntake = !hasSubmittedInterview && !intakeWaived;

  return {
    hasSubmittedInterview,
    intakeApproved,
    intakeWaived,
    assessmentScopePending,
    restrictNavToIntake,
    assessmentUnlocked,
  };
}
