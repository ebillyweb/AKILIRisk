import "server-only";

import { prisma } from "@/lib/db";
import { syncInProgressAssessmentScope } from "@/lib/assessment/sync-client-assessment-scope";
import {
  normalizeIncludedPillarIds,
  resolveIncludedPillars,
} from "@/lib/assessment/included-pillars";

export type ClientEngagementScope = {
  includedPillars: string[];
  focusAreas: string[];
  /** Canonical store when populated; legacy sources reconciled on read. */
  source: "assignment" | "approval" | "assessment" | null;
  approvalId: string | null;
  assignmentId: string | null;
  intakeWaived: boolean;
};

/** Normalize scope writes; emphasis defaults to all included. */
export function normalizeEngagementScopeInput(input: {
  includedPillars: string[];
  focusAreas?: string[];
}): { includedPillars: string[]; focusAreas: string[] } {
  const includedPillars = normalizeIncludedPillarIds(input.includedPillars);
  if (includedPillars.length < 1) {
    throw new Error("Select at least one assessment domain");
  }

  const focusAreas = input.focusAreas?.length
    ? normalizeIncludedPillarIds(input.focusAreas).filter((id) =>
        includedPillars.includes(id),
      )
    : includedPillars;

  return { includedPillars, focusAreas };
}

function resolveClientAssessmentIncludedPillars(input: {
  assessmentIncludedPillars?: string[] | null;
  approvedScopeIncludedPillars?: string[] | null;
  hasAssessmentRow: boolean;
}): string[] {
  if (input.assessmentIncludedPillars && input.assessmentIncludedPillars.length > 0) {
    return resolveIncludedPillars(input.assessmentIncludedPillars);
  }
  if (
    input.approvedScopeIncludedPillars &&
    input.approvedScopeIncludedPillars.length > 0
  ) {
    return resolveIncludedPillars(input.approvedScopeIncludedPillars);
  }
  if (input.hasAssessmentRow) {
    return resolveIncludedPillars([]);
  }
  return [];
}

type ActiveAssignment = {
  id: string;
  intakeWaivedAt: Date | null;
  includedPillars: string[];
  focusAreas: string[];
};

async function loadActiveAssignment(
  clientUserId: string,
): Promise<ActiveAssignment | null> {
  return prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: clientUserId, status: "ACTIVE" },
    orderBy: { assignedAt: "desc" },
    select: {
      id: true,
      intakeWaivedAt: true,
      includedPillars: true,
      focusAreas: true,
    },
  });
}

async function writeAssignmentScope(
  assignmentId: string,
  scope: { includedPillars: string[]; focusAreas: string[] },
): Promise<void> {
  await prisma.clientAdvisorAssignment.update({
    where: { id: assignmentId },
    data: {
      includedPillars: scope.includedPillars,
      focusAreas: scope.focusAreas,
    },
  });
}

/**
 * Single write path for advisor-selected pillar scope. Updates the active
 * assignment (source of truth) and syncs any in-progress assessment snapshot.
 */
export async function persistClientEngagementScope(input: {
  clientId: string;
  includedPillars: string[];
  focusAreas?: string[];
  approvalId?: string | null;
}): Promise<{ includedPillars: string[]; focusAreas: string[] }> {
  const normalized = normalizeEngagementScopeInput({
    includedPillars: input.includedPillars,
    focusAreas: input.focusAreas,
  });

  const assignment = await loadActiveAssignment(input.clientId);
  if (!assignment) {
    throw new Error("No active advisor assignment for this client.");
  }

  await writeAssignmentScope(assignment.id, normalized);
  await syncInProgressAssessmentScope(
    input.clientId,
    normalized.includedPillars,
    input.approvalId ?? null,
  );

  return normalized;
}

/**
 * Canonical read for engagement pillar scope. `ClientAdvisorAssignment` is
 * authoritative; legacy approval/assessment copies are reconciled on read.
 */
export async function getClientEngagementScope(
  clientUserId: string,
  options?: { reconcile?: boolean },
): Promise<ClientEngagementScope> {
  const reconcile = options?.reconcile !== false;
  const assignment = await loadActiveAssignment(clientUserId);
  const intakeWaived = assignment?.intakeWaivedAt != null;

  if (assignment && assignment.includedPillars.length > 0) {
    return {
      includedPillars: assignment.includedPillars,
      focusAreas: assignment.focusAreas,
      source: "assignment",
      approvalId: null,
      assignmentId: assignment.id,
      intakeWaived,
    };
  }

  const approval = await prisma.intakeApproval.findFirst({
    where: {
      status: "APPROVED",
      interview: { userId: clientUserId },
    },
    orderBy: { approvedAt: "desc" },
    select: {
      id: true,
      includedPillars: true,
      focusAreas: true,
    },
  });

  if (approval && approval.includedPillars.length > 0) {
    if (reconcile && assignment) {
      await writeAssignmentScope(assignment.id, {
        includedPillars: approval.includedPillars,
        focusAreas:
          approval.focusAreas.length > 0
            ? approval.focusAreas
            : approval.includedPillars,
      });
    }
    return {
      includedPillars: approval.includedPillars,
      focusAreas:
        approval.focusAreas.length > 0
          ? approval.focusAreas
          : approval.includedPillars,
      source: "approval",
      approvalId: approval.id,
      assignmentId: assignment?.id ?? null,
      intakeWaived,
    };
  }

  const assessment = await prisma.assessment.findFirst({
    where: {
      userId: clientUserId,
      status: { in: ["IN_PROGRESS", "COMPLETED"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { includedPillars: true },
  });

  if (assessment?.includedPillars.length) {
    const focusAreas =
      assignment?.focusAreas.length && assignment.includedPillars.length === 0
        ? assignment.focusAreas.filter((id) =>
            assessment.includedPillars.includes(id),
          )
        : assessment.includedPillars;

    if (reconcile && assignment) {
      await writeAssignmentScope(assignment.id, {
        includedPillars: assessment.includedPillars,
        focusAreas: focusAreas.length > 0 ? focusAreas : assessment.includedPillars,
      });
    }

    return {
      includedPillars: assessment.includedPillars,
      focusAreas: focusAreas.length > 0 ? focusAreas : assessment.includedPillars,
      source: "assessment",
      approvalId: null,
      assignmentId: assignment?.id ?? null,
      intakeWaived,
    };
  }

  return {
    includedPillars: [],
    focusAreas: [],
    source: null,
    approvalId: null,
    assignmentId: assignment?.id ?? null,
    intakeWaived,
  };
}

/** Whether the client may access the assessment flow (scope set on engagement). */
export function isEngagementAssessmentUnlocked(
  scope: Pick<ClientEngagementScope, "includedPillars">,
): boolean {
  return scope.includedPillars.length > 0;
}

/** Included pillars for an in-flight assessment row (assignment scope + legacy fallback). */
export function resolveAssessmentIncludedPillars(input: {
  assessmentIncludedPillars?: string[] | null;
  engagementIncludedPillars?: string[] | null;
  hasAssessmentRow: boolean;
}): string[] {
  return resolveClientAssessmentIncludedPillars({
    assessmentIncludedPillars: input.assessmentIncludedPillars,
    approvedScopeIncludedPillars: input.engagementIncludedPillars,
    hasAssessmentRow: input.hasAssessmentRow,
  });
}
