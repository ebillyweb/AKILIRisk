"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAdvisorProfileOrThrow, requireAdvisorRole } from "@/lib/advisor/auth";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

export type AssessmentWaiverActionResult =
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

async function clientHasStartedAssessment(clientId: string): Promise<boolean> {
  const assessment = await prisma.assessment.findFirst({
    where: {
      userId: clientId,
      status: { in: ["IN_PROGRESS", "COMPLETED"] },
    },
    select: { id: true },
  });
  return assessment != null;
}

async function isIntakeComplete(clientId: string, intakeWaived: boolean): Promise<boolean> {
  if (intakeWaived) return true;

  const interview = await prisma.intakeInterview.findFirst({
    where: {
      userId: clientId,
      status: { in: ["SUBMITTED", "COMPLETED"] },
    },
    select: { id: true },
  });
  return interview != null;
}

/**
 * Advisor (assigned to the client) may waive the assessment requirement.
 * When waived, client skips directly to reporting/recommendations after intake.
 * Assessment waiver is only allowed after intake is complete and before assessment starts.
 */
export async function setClientAssessmentWaiver(
  clientId: string,
  waive: boolean,
): Promise<AssessmentWaiverActionResult> {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const assignment = await requireAdvisorAssignment(clientId, profile.id);

    if (!assignment) {
      return { success: false, error: "This client is not assigned to you." };
    }

    if (await clientHasStartedAssessment(clientId)) {
      return {
        success: false,
        error:
          "Assessment is already in progress or completed. Assessment waiver cannot be changed.",
      };
    }

    const intakeComplete = await isIntakeComplete(
      clientId,
      assignment.intakeWaivedAt != null,
    );

    if (waive && !intakeComplete) {
      return {
        success: false,
        error:
          "Intake must be completed or waived before skipping assessment. Complete intake first.",
      };
    }

    if (waive) {
      const newWaivedAt = new Date();
      await prisma.clientAdvisorAssignment.update({
        where: { id: assignment.id },
        data: {
          assessmentWaivedAt: newWaivedAt,
          assessmentWaivedByAdvisorId: profile.id,
        },
      });

      await writeAudit({
        actor: { userId, role: role as UserRole, email },
        action: AUDIT_ACTIONS.ASSESSMENT_WAIVER_SET,
        entityType: "ClientAdvisorAssignment",
        entityId: assignment.id,
        beforeData: {
          assessmentWaivedAt: assignment.assessmentWaivedAt?.toISOString() ?? null,
          assessmentWaivedByAdvisorId: assignment.assessmentWaivedByAdvisorId,
        },
        afterData: {
          assessmentWaivedAt: newWaivedAt.toISOString(),
          assessmentWaivedByAdvisorId: profile.id,
        },
        metadata: { clientId, advisorId: profile.id, waived: true },
      });
    } else {
      await prisma.clientAdvisorAssignment.update({
        where: { id: assignment.id },
        data: {
          assessmentWaivedAt: null,
          assessmentWaivedByAdvisorId: null,
        },
      });

      await writeAudit({
        actor: { userId, role: role as UserRole, email },
        action: AUDIT_ACTIONS.ASSESSMENT_WAIVER_UNDO,
        entityType: "ClientAdvisorAssignment",
        entityId: assignment.id,
        beforeData: {
          assessmentWaivedAt: assignment.assessmentWaivedAt?.toISOString() ?? null,
          assessmentWaivedByAdvisorId: assignment.assessmentWaivedByAdvisorId,
        },
        afterData: {
          assessmentWaivedAt: null,
          assessmentWaivedByAdvisorId: null,
        },
        metadata: { clientId, advisorId: profile.id, waived: false },
      });
    }

    revalidatePath("/advisor/pipeline");
    revalidatePath(`/advisor/pipeline/${clientId}`);
    revalidatePath("/dashboard");
    revalidatePath("/assessment", "layout");
    revalidatePath("/intake", "layout");

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update assessment waiver";
    return { success: false, error: message };
  }
}
