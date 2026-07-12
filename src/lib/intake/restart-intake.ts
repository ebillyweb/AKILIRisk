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

  const [assessment, facilitatedSession] = await Promise.all([
    prisma.assessment.findFirst({
      where: {
        userId: input.clientId,
        status: { in: ["IN_PROGRESS", "COMPLETED"] },
      },
      select: { id: true },
    }),
    prisma.facilitatedSession.findFirst({
      where: {
        clientId: input.clientId,
        status: { not: "COMPLETE" },
      },
      select: { id: true },
    }),
  ]);

  if (assessment) {
    return { allowed: false, reason: "assessment_started" };
  }
  if (facilitatedSession) {
    return { allowed: false, reason: "facilitated_session_open" };
  }

  return { allowed: true };
}

/**
 * Archives all active intake interviews for the client and creates a fresh one.
 * Caller must verify advisor assignment and eligibility first.
 */
export async function restartClientIntakeForUser(
  clientId: string,
): Promise<{ interview: IntakeInterview; archivedCount: number }> {
  return prisma.$transaction(async (tx) => {
    const archivedAt = new Date();
    const archived = await tx.intakeInterview.updateMany({
      where: { userId: clientId, archivedAt: null },
      data: { archivedAt },
    });

    const interview = await tx.intakeInterview.create({
      data: {
        userId: clientId,
        status: "NOT_STARTED",
        currentQuestionIndex: 0,
      },
    });

    return { interview, archivedCount: archived.count };
  });
}
