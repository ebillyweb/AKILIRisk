"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AssignmentStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAdvisorProfileOrThrow, requireAdvisorRole } from "@/lib/advisor/auth";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";

export type ClientAssignmentActionResult =
  | { success: true }
  | { success: false; error: string };

const assignmentStatusSchema = z.object({
  clientId: z.string().cuid(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

/**
 * Advisor sets their assignment to a client ACTIVE or INACTIVE.
 * INACTIVE removes the client from the active pipeline without deleting the account.
 */
export async function setClientAssignmentStatus(
  input: unknown,
): Promise<ClientAssignmentActionResult> {
  try {
    const parsed = assignmentStatusSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid request" };
    }

    const { clientId, status } = parsed.data;
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        clientId,
        advisorId: profile.id,
      },
      select: {
        id: true,
        status: true,
        client: { select: { deletedAt: true } },
      },
    });

    if (!assignment) {
      return { success: false, error: "This client is not assigned to you." };
    }

    if (assignment.status === status) {
      return {
        success: false,
        error:
          status === "INACTIVE"
            ? "This client workflow is already inactive."
            : "This client workflow is already active.",
      };
    }

    if (status === "ACTIVE" && assignment.client.deletedAt) {
      return {
        success: false,
        error:
          "This client account is deactivated. Contact platform admin to restore the account first.",
      };
    }

    if (status === "INACTIVE" && assignment.status !== "ACTIVE") {
      return { success: false, error: "Only active workflows can be ended." };
    }

    if (status === "ACTIVE" && assignment.status !== "INACTIVE") {
      return { success: false, error: "Only inactive workflows can be restored." };
    }

    await prisma.clientAdvisorAssignment.update({
      where: { id: assignment.id },
      data: { status: status as AssignmentStatus },
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action:
        status === "INACTIVE"
          ? AUDIT_ACTIONS.CLIENT_ASSIGNMENT_DEACTIVATE
          : AUDIT_ACTIONS.CLIENT_ASSIGNMENT_REACTIVATE,
      entityType: "ClientAdvisorAssignment",
      entityId: assignment.id,
      beforeData: { status: assignment.status },
      afterData: { status },
      metadata: { clientId, advisorId: profile.id },
    });

    revalidatePath("/advisor/pipeline");
    revalidatePath(`/advisor/pipeline/${clientId}`);

    return { success: true };
  } catch (e) {
    logSafeError("advisor/setClientAssignmentStatus", e);
    return {
      success: false,
      error: safeErrorMessage(e, "Failed to update client workflow status"),
    };
  }
}
