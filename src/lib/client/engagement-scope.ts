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

/**
 * When Assessment.included_pillars is a strict superset of the assignment
 * scope, expand assignment to match. If focus previously covered the full
 * (old) included set, expand focus too; keep a true emphasis subset as-is.
 */
export function widenAssignmentScopeFromAssessment(
  assignmentIncluded: readonly string[],
  assignmentFocus: readonly string[],
  assessmentIncluded: readonly string[] | null | undefined,
): { includedPillars: string[]; focusAreas: string[] } | null {
  if (!assessmentIncluded?.length) return null;
  if (assessmentIncluded.length <= assignmentIncluded.length) return null;

  const assessmentSet = new Set(assessmentIncluded);
  if (!assignmentIncluded.every((id) => assessmentSet.has(id))) return null;

  const oldIncludedSet = new Set(assignmentIncluded);
  const focusCoveredAllIncluded =
    assignmentFocus.length === 0 ||
    (assignmentFocus.length === assignmentIncluded.length &&
      assignmentFocus.every((id) => oldIncludedSet.has(id)));

  return {
    includedPillars: [...assessmentIncluded],
    focusAreas: focusCoveredAllIncluded
      ? [...assessmentIncluded]
      : assignmentFocus.filter((id) => assessmentSet.has(id)),
  };
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
    // Assessment hub progress prefers Assessment.included_pillars when set.
    // If that row was expanded (e.g. legacy→full catalog) ahead of the
    // assignment, sync assignment so focus/banner counts stay aligned.
    if (reconcile) {
      const assessment = await prisma.assessment.findFirst({
        where: {
          userId: clientUserId,
          status: { in: ["IN_PROGRESS", "COMPLETED"] },
        },
        orderBy: { updatedAt: "desc" },
        select: { includedPillars: true },
      });

      const widened = widenAssignmentScopeFromAssessment(
        assignment.includedPillars,
        assignment.focusAreas,
        assessment?.includedPillars,
      );
      if (widened) {
        await writeAssignmentScope(assignment.id, widened);
        return {
          includedPillars: widened.includedPillars,
          focusAreas: widened.focusAreas,
          source: "assignment",
          approvalId: null,
          assignmentId: assignment.id,
          intakeWaived,
        };
      }
    }

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
      // Ignore approvals on archived (restarted) interviews so a restart
      // doesn't leave a stale approval unlocking the assessment.
      interview: { userId: clientUserId, archivedAt: null },
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
