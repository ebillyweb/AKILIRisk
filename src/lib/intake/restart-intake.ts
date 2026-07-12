import "server-only";

import type { IntakeInterview } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { RestartIntakeBlockReason } from "@/lib/intake/restart-intake-copy";
import { restartIntakeBlockedMessage } from "@/lib/intake/restart-intake-copy";

export type { RestartIntakeBlockReason } from "@/lib/intake/restart-intake-copy";
export { restartIntakeBlockedMessage };

export type RestartIntakeEligibility = {
  allowed: boolean;
  reason?: RestartIntakeBlockReason;
};

export async function getRestartIntakeEligibility(input: {
  assignmentStatus: "ACTIVE" | "INACTIVE";
  intakeWaived: boolean;
  clientId: string;
}): Promise<RestartIntakeEligibility> {
  if (input.assignmentStatus !== "ACTIVE") {
    return { allowed: false, reason: "assignment_inactive" };
  }
  if (input.intakeWaived) {
    return { allowed: false, reason: "intake_waived" };
  }

  // A started/completed assessment no longer blocks restart — the advisor may
  // send the client back to intake after new information or a practice-standards
  // change. `restartClientIntakeForUser` archives that assessment and resets the
  // engagement scope so the assessment re-locks until the new intake is approved.
  // An open live (facilitated) session still blocks — it should be finished or
  // cancelled first so its in-flight state isn't stranded.
  const facilitatedSession = await prisma.facilitatedSession.findFirst({
    where: {
      clientId: input.clientId,
      status: { not: "COMPLETE" },
    },
    select: { id: true },
  });

  if (facilitatedSession) {
    return { allowed: false, reason: "facilitated_session_open" };
  }

  return { allowed: true };
}

/**
 * Sends the client back to the start of intake. In one transaction:
 *  - archives all active intake interviews (and, by the engagement-scope
 *    `archivedAt` filter, neutralizes their approvals),
 *  - archives any started/completed assessment so it drops out of the active
 *    flow (status ARCHIVED — the record is kept for history),
 *  - clears the engagement scope on active assignments so the assessment
 *    re-locks until the fresh intake is approved,
 *  - creates a fresh NOT_STARTED interview, which freezes the CURRENT
 *    practice-standards script on first progress (new interview → no snapshot).
 *
 * Caller must verify advisor assignment and eligibility first.
 */
export async function restartClientIntakeForUser(clientId: string): Promise<{
  interview: IntakeInterview;
  archivedCount: number;
  archivedAssessmentCount: number;
}> {
  return prisma.$transaction(async (tx) => {
    const archivedAt = new Date();
    const archivedInterviews = await tx.intakeInterview.updateMany({
      where: { userId: clientId, archivedAt: null },
      data: { archivedAt },
    });
    const archivedAssessments = await tx.assessment.updateMany({
      where: {
        userId: clientId,
        status: { in: ["IN_PROGRESS", "COMPLETED"] },
      },
      data: { status: "ARCHIVED" },
    });

    // Reset the engagement gate: an empty assignment scope + no active
    // approval/assessment means the assessment is locked until re-approval.
    await tx.clientAdvisorAssignment.updateMany({
      where: { clientId, status: "ACTIVE" },
      data: { includedPillars: [], focusAreas: [] },
    });

    const interview = await tx.intakeInterview.create({
      data: {
        userId: clientId,
        status: "NOT_STARTED",
        currentQuestionIndex: 0,
      },
    });

    return {
      interview,
      archivedCount: archivedInterviews.count,
      archivedAssessmentCount: archivedAssessments.count,
    };
  });
}
