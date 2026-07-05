"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAdvisorProfileOrThrow, requireAdvisorRole } from "@/lib/advisor/auth";
import { assertAdvisorCanSkipIntake } from "@/lib/enterprise/advisor-member-visibility";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { persistClientEngagementScope } from "@/lib/client/engagement-scope";
import { assertAdvisorAssessmentDomainSelection } from "@/lib/methodology/advisor-assessment-domains";
import { waiverAssessmentScopeSchema } from "@/lib/schemas/advisor";

export type IntakeWaiverActionResult =
  | { success: true }
  | { success: false; error: string };

export type WaiverScopeInput = {
  includedPillars: string[];
  focusAreas?: string[];
};

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

async function persistWaiverScope(
  advisorProfileId: string,
  _assignmentId: string,
  clientId: string,
  scope: WaiverScopeInput,
): Promise<IntakeWaiverActionResult> {
  try {
    const parsed = waiverAssessmentScopeSchema.safeParse(scope);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid assessment scope";
      return { success: false, error: msg };
    }
    await assertAdvisorAssessmentDomainSelection(
      advisorProfileId,
      parsed.data.includedPillars,
    );
    await persistClientEngagementScope({
      clientId,
      includedPillars: parsed.data.includedPillars,
      focusAreas: parsed.data.focusAreas,
      approvalId: null,
    });
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Invalid assessment scope",
    };
  }

  revalidatePath("/advisor/pipeline");
  revalidatePath(`/advisor/pipeline/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/assessment", "layout");
  revalidatePath("/intake", "layout");

  return { success: true };
}

/**
 * Advisor (assigned to the client) may waive the governance intake requirement.
 * When waiving, assessment domains (1–6) are required — waiver alone does not unlock.
 */
export async function setClientIntakeWaiver(
  clientId: string,
  waive: boolean,
  scope?: WaiverScopeInput,
): Promise<IntakeWaiverActionResult> {
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
          "Assessment is already in progress. Intake waiver cannot be changed for this household.",
      };
    }

    if (waive) {
      await assertAdvisorCanSkipIntake(userId);

      if (!scope) {
        return {
          success: false,
          error: "Select at least one risk domain before waiving intake.",
        };
      }

      const scopeResult = await persistWaiverScope(
        profile.id,
        assignment.id,
        clientId,
        scope,
      );
      if (!scopeResult.success) return scopeResult;

      const newWaivedAt = new Date();
      await prisma.clientAdvisorAssignment.update({
        where: { id: assignment.id },
        data: {
          intakeWaivedAt: newWaivedAt,
          intakeWaivedByAdvisorId: profile.id,
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
          includedPillars: assignment.includedPillars,
          focusAreas: assignment.focusAreas,
        },
        afterData: {
          intakeWaivedAt: newWaivedAt.toISOString(),
          intakeWaivedByAdvisorId: profile.id,
          includedPillars: scope.includedPillars,
          focusAreas: scope.focusAreas ?? scope.includedPillars,
        },
        metadata: { clientId, advisorId: profile.id, waived: true },
      });
    } else {
      await prisma.clientAdvisorAssignment.update({
        where: { id: assignment.id },
        data: {
          intakeWaivedAt: null,
          intakeWaivedByAdvisorId: null,
          includedPillars: [],
          focusAreas: [],
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
          includedPillars: assignment.includedPillars,
          focusAreas: assignment.focusAreas,
        },
        afterData: {
          intakeWaivedAt: null,
          intakeWaivedByAdvisorId: null,
          includedPillars: [],
          focusAreas: [],
        },
        metadata: { clientId, advisorId: profile.id, waived: false },
      });

      revalidatePath("/advisor/pipeline");
      revalidatePath(`/advisor/pipeline/${clientId}`);
      revalidatePath("/dashboard");
      revalidatePath("/assessment", "layout");
      revalidatePath("/intake", "layout");
    }

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update intake waiver";
    return { success: false, error: message };
  }
}

/** Update assessment domains for a client whose intake is already waived. */
export async function updateClientWaiverAssessmentScope(
  clientId: string,
  scope: WaiverScopeInput,
): Promise<IntakeWaiverActionResult> {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const assignment = await requireAdvisorAssignment(clientId, profile.id);

    if (!assignment) {
      return { success: false, error: "This client is not assigned to you." };
    }

    if (!assignment.intakeWaivedAt) {
      return {
        success: false,
        error: "Intake is not waived for this client. Waive intake with risk domains first.",
      };
    }

    await assertAdvisorCanSkipIntake(userId);

    const scopeResult = await persistWaiverScope(
      profile.id,
      assignment.id,
      clientId,
      scope,
    );
    if (!scopeResult.success) return scopeResult;

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action: AUDIT_ACTIONS.INTAKE_WAIVER_SET,
      entityType: "ClientAdvisorAssignment",
      entityId: assignment.id,
      beforeData: {
        includedPillars: assignment.includedPillars,
        focusAreas: assignment.focusAreas,
      },
      afterData: {
        includedPillars: scope.includedPillars,
        focusAreas: scope.focusAreas ?? scope.includedPillars,
      },
      metadata: { clientId, advisorId: profile.id, scopeUpdate: true },
    });

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update assessment scope";
    return { success: false, error: message };
  }
}
