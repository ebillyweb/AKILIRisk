"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAdvisorProfileOrThrow, requireAdvisorRole } from "@/lib/advisor/auth";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

export type ManualCompletionActionResult =
  | { success: true }
  | { success: false; error: string };

async function requireAdvisorAssignment(clientId: string, advisorProfileId: string) {
  return prisma.clientAdvisorAssignment.findFirst({
    where: {
      clientId,
      advisorId: advisorProfileId,
      status: "ACTIVE",
    },
  });
}

/**
 * Mark a client engagement as manually complete.
 * This allows advisors to skip remaining workflow steps and mark the engagement done.
 */
export async function markEngagementComplete(
  clientId: string,
): Promise<ManualCompletionActionResult> {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const assignment = await requireAdvisorAssignment(clientId, profile.id);

    if (!assignment) {
      return { success: false, error: "This client is not assigned to you." };
    }

    if (assignment.manuallyCompletedAt) {
      return { success: false, error: "This engagement is already marked as complete." };
    }

    const completedAt = new Date();
    await prisma.clientAdvisorAssignment.update({
      where: { id: assignment.id },
      data: {
        manuallyCompletedAt: completedAt,
        manuallyCompletedByAdvisorId: profile.id,
      },
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action: AUDIT_ACTIONS.ENGAGEMENT_MANUAL_COMPLETE,
      entityType: "ClientAdvisorAssignment",
      entityId: assignment.id,
      beforeData: {
        manuallyCompletedAt: null,
        manuallyCompletedByAdvisorId: null,
      },
      afterData: {
        manuallyCompletedAt: completedAt.toISOString(),
        manuallyCompletedByAdvisorId: profile.id,
      },
      metadata: { clientId, advisorId: profile.id },
    });

    revalidatePath("/advisor/pipeline");
    revalidatePath(`/advisor/pipeline/${clientId}`);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to mark engagement complete";
    return { success: false, error: message };
  }
}

/**
 * Undo manual completion, returning the engagement to its previous workflow state.
 */
export async function undoEngagementCompletion(
  clientId: string,
): Promise<ManualCompletionActionResult> {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const assignment = await requireAdvisorAssignment(clientId, profile.id);

    if (!assignment) {
      return { success: false, error: "This client is not assigned to you." };
    }

    if (!assignment.manuallyCompletedAt) {
      return { success: false, error: "This engagement is not manually completed." };
    }

    await prisma.clientAdvisorAssignment.update({
      where: { id: assignment.id },
      data: {
        manuallyCompletedAt: null,
        manuallyCompletedByAdvisorId: null,
      },
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action: AUDIT_ACTIONS.ENGAGEMENT_MANUAL_COMPLETE_UNDO,
      entityType: "ClientAdvisorAssignment",
      entityId: assignment.id,
      beforeData: {
        manuallyCompletedAt: assignment.manuallyCompletedAt.toISOString(),
        manuallyCompletedByAdvisorId: assignment.manuallyCompletedByAdvisorId,
      },
      afterData: {
        manuallyCompletedAt: null,
        manuallyCompletedByAdvisorId: null,
      },
      metadata: { clientId, advisorId: profile.id },
    });

    revalidatePath("/advisor/pipeline");
    revalidatePath(`/advisor/pipeline/${clientId}`);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to undo completion";
    return { success: false, error: message };
  }
}
