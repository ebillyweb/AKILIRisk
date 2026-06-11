import "server-only";

import { prisma } from "@/lib/db";

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
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: clientUserId, status: "ACTIVE" },
    orderBy: { assignedAt: "desc" },
    select: {
      intakeWaivedAt: true,
      includedPillars: true,
    },
  });

  const intakeWaived = assignment?.intakeWaivedAt != null;
  const waiverScopeSet = (assignment?.includedPillars?.length ?? 0) > 0;

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
  const approvedWithScope =
    intakeApproved && (latestApproval?.includedPillars?.length ?? 0) > 0;
  const waivedWithScope = intakeWaived && waiverScopeSet;
  const assessmentUnlocked = approvedWithScope || waivedWithScope;
  const assessmentScopePending = intakeWaived && !waiverScopeSet;

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
