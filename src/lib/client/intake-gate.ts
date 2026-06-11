import "server-only";

import { prisma } from "@/lib/db";

export type ClientIntakeGateState = {
  hasSubmittedInterview: boolean;
  intakeApproved: boolean;
  intakeWaived: boolean;
  restrictNavToIntake: boolean;
  assessmentUnlocked: boolean;
};

/**
 * Single source for client (USER) intake vs assessment access.
 * Epic 5.11: assessment unlocks only after advisor approval with explicit
 * included pillars (1–6). Intake waiver alone does not unlock assessment.
 */
export async function getClientIntakeGateState(
  clientUserId: string,
): Promise<ClientIntakeGateState> {
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: clientUserId, status: "ACTIVE" },
    orderBy: { assignedAt: "desc" },
    select: { intakeWaivedAt: true },
  });

  const intakeWaived = assignment?.intakeWaivedAt != null;

  const submittedInterview = await prisma.intakeInterview.findFirst({
    where: { userId: clientUserId, status: "SUBMITTED" },
    select: { id: true },
  });
  const hasSubmittedInterview = !!submittedInterview;

  const latestApproval = await prisma.intakeApproval.findFirst({
    where: {
      status: "APPROVED",
      interview: { userId: clientUserId },
    },
    orderBy: { approvedAt: "desc" },
    select: { status: true, includedPillars: true },
  });

  const intakeApproved = latestApproval?.status === "APPROVED";
  const assessmentUnlocked =
    intakeApproved && (latestApproval?.includedPillars?.length ?? 0) > 0;

  const restrictNavToIntake = !hasSubmittedInterview && !intakeWaived;

  return {
    hasSubmittedInterview,
    intakeApproved,
    intakeWaived,
    restrictNavToIntake,
    assessmentUnlocked,
  };
}
