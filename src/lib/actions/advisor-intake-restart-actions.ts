"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAdvisorProfileOrThrow, requireAdvisorRole } from "@/lib/advisor/auth";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import {
  getRestartIntakeEligibility,
  restartClientIntakeForUser,
  restartIntakeBlockedMessage,
} from "@/lib/intake/restart-intake";

export type RestartIntakeActionResult =
  | { success: true; interviewId: string }
  | { success: false; error: string };

const restartIntakeSchema = z.object({
  clientId: z.string().cuid(),
});

/**
 * Advisor archives the client's current intake and starts a fresh interview
 * so updated question banks apply on the next session.
 */
export async function restartClientIntake(
  input: unknown,
): Promise<RestartIntakeActionResult> {
  try {
    const parsed = restartIntakeSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid request" };
    }

    const { clientId } = parsed.data;
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        clientId,
        advisorId: profile.id,
        status: { in: ["ACTIVE", "INACTIVE"] },
      },
      select: {
        id: true,
        status: true,
        intakeWaivedAt: true,
      },
    });

    if (!assignment) {
      return { success: false, error: "This client is not assigned to you." };
    }

    const eligibility = await getRestartIntakeEligibility({
      assignmentStatus: assignment.status,
      intakeWaived: assignment.intakeWaivedAt != null,
      clientId,
    });

    if (!eligibility.allowed) {
      return {
        success: false,
        error: restartIntakeBlockedMessage(eligibility.reason!),
      };
    }

    const { interview, archivedCount, archivedAssessmentCount } =
      await restartClientIntakeForUser(clientId);

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action: AUDIT_ACTIONS.INTAKE_RESTART,
      entityType: "IntakeInterview",
      entityId: interview.id,
      beforeData: {
        archivedInterviewCount: archivedCount,
        archivedAssessmentCount,
      },
      afterData: {
        interviewId: interview.id,
        status: interview.status,
      },
      metadata: {
        clientId,
        advisorId: profile.id,
        assignmentId: assignment.id,
      },
    });

    revalidatePath("/advisor/pipeline");
    revalidatePath(`/advisor/pipeline/${clientId}`);
    revalidatePath("/dashboard");
    revalidatePath("/intake", "layout");
    revalidatePath("/assessment", "layout");

    return { success: true, interviewId: interview.id };
  } catch (e) {
    logSafeError("advisor/restartClientIntake", e);
    return {
      success: false,
      error: safeErrorMessage(e, "Failed to restart intake"),
    };
  }
}
