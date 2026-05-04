"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAdvisorProfileOrThrow, requireAdvisorRole } from "@/lib/advisor/auth";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

export type IntakeWaiverActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Advisor (assigned to the client) may waive the governance intake requirement
 * so the client can open Assessment without a submitted/approved interview.
 */
export async function setClientIntakeWaiver(
  clientId: string,
  waive: boolean,
): Promise<IntakeWaiverActionResult> {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        clientId,
        advisorId: profile.id,
        status: "ACTIVE",
      },
    });

    if (!assignment) {
      return { success: false, error: "This client is not assigned to you." };
    }

    const newWaivedAt = waive ? new Date() : null;
    await prisma.clientAdvisorAssignment.update({
      where: { id: assignment.id },
      data: waive
        ? {
            intakeWaivedAt: newWaivedAt,
            intakeWaivedByAdvisorId: profile.id,
          }
        : {
            intakeWaivedAt: null,
            intakeWaivedByAdvisorId: null,
          },
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action: AUDIT_ACTIONS.INTAKE_WAIVER_SET,
      entityType: "ClientAdvisorAssignment",
      entityId: assignment.id,
      beforeData: {
        intakeWaivedAt: assignment.intakeWaivedAt?.toISOString() ?? null,
        intakeWaivedByAdvisorId: assignment.intakeWaivedByAdvisorId,
      },
      afterData: {
        intakeWaivedAt: newWaivedAt?.toISOString() ?? null,
        intakeWaivedByAdvisorId: waive ? profile.id : null,
      },
      metadata: { clientId, advisorId: profile.id, waived: waive },
    });

    revalidatePath("/advisor/pipeline");
    revalidatePath(`/advisor/pipeline/${clientId}`);
    revalidatePath("/dashboard");
    revalidatePath("/assessment", "layout");
    revalidatePath("/intake", "layout");

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update intake waiver";
    return { success: false, error: message };
  }
}
