import "server-only";

import { prisma } from "@/lib/db";
import { syncInProgressAssessmentScope } from "@/lib/assessment/sync-client-assessment-scope";
import {
  normalizeIncludedPillarIds,
  resolveIncludedPillars,
} from "@/lib/assessment/included-pillars";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";
import type { PillarCatalogEntry } from "@/lib/methodology/pillar-catalog";

export type ClientEngagementScope = {
  includedPillars: string[];
  focusAreas: string[];
  source: "assignment" | "approval" | "assessment" | null;
  approvalId: string | null;
  assignmentId: string | null;
  intakeWaived: boolean;
};

/** Normalize scope writes; emphasis defaults to all included. */
export async function normalizeEngagementScopeInput(input: {
  includedPillars: string[];
  focusAreas?: string[];
}): Promise<{ includedPillars: string[]; focusAreas: string[] }> {
  const catalog = await getPlatformPillarCatalog();
  const includedPillars = normalizeIncludedPillarIds(input.includedPillars, catalog);
  if (includedPillars.length < 1) {
    throw new Error("Select at least one risk domain");
  }

  const focusAreas = input.focusAreas?.length
    ? normalizeIncludedPillarIds(input.focusAreas, catalog).filter((id) =>
        includedPillars.includes(id),
      )
    : includedPillars;

  return { includedPillars, focusAreas };
}

async function resolveClientAssessmentIncludedPillars(
  input: {
    assessmentIncludedPillars?: string[] | null;
    approvedScopeIncludedPillars?: string[] | null;
    hasAssessmentRow: boolean;
  },
  catalog: PillarCatalogEntry[],
): Promise<string[]> {
  if (input.assessmentIncludedPillars && input.assessmentIncludedPillars.length > 0) {
    return resolveIncludedPillars(input.assessmentIncludedPillars, catalog);
  }
  if (
    input.approvedScopeIncludedPillars &&
    input.approvedScopeIncludedPillars.length > 0
  ) {
    return resolveIncludedPillars(input.approvedScopeIncludedPillars, catalog);
  }
  if (input.hasAssessmentRow) {
    return resolveIncludedPillars([], catalog);
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

export async function persistClientEngagementScope(input: {
  clientId: string;
  includedPillars: string[];
  focusAreas?: string[];
  approvalId?: string | null;
}): Promise<{ includedPillars: string[]; focusAreas: string[] }> {
  const normalized = await normalizeEngagementScopeInput({
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

export function isEngagementAssessmentUnlocked(
  scope: Pick<ClientEngagementScope, "includedPillars">,
): boolean {
  return scope.includedPillars.length > 0;
}

export async function resolveAssessmentIncludedPillars(input: {
  assessmentIncludedPillars?: string[] | null;
  engagementIncludedPillars?: string[] | null;
  hasAssessmentRow: boolean;
}): Promise<string[]> {
  const catalog = await getPlatformPillarCatalog();
  return resolveClientAssessmentIncludedPillars(
    {
      assessmentIncludedPillars: input.assessmentIncludedPillars,
      approvedScopeIncludedPillars: input.engagementIncludedPillars,
      hasAssessmentRow: input.hasAssessmentRow,
    },
    catalog,
  );
}
