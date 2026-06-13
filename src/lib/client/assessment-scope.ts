import "server-only";

import { prisma } from "@/lib/db";
import {
  normalizeIncludedPillarIds,
  resolveIncludedPillars,
} from "@/lib/assessment/included-pillars";

export type ClientAssessmentScope = {
  includedPillars: string[];
  focusAreas: string[];
  source: "approval" | "waiver" | null;
  approvalId: string | null;
};

/**
 * Resolve the client's active assessment pillar scope from intake approval
 * or intake-waiver assignment settings.
 */
export async function getClientAssessmentScope(
  clientUserId: string,
): Promise<ClientAssessmentScope> {
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
    return {
      includedPillars: approval.includedPillars,
      focusAreas: approval.focusAreas,
      source: "approval",
      approvalId: approval.id,
    };
  }

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: clientUserId, status: "ACTIVE" },
    orderBy: { assignedAt: "desc" },
    select: {
      intakeWaivedAt: true,
      includedPillars: true,
      focusAreas: true,
    },
  });

  if (assignment?.intakeWaivedAt && assignment.includedPillars.length > 0) {
    return {
      includedPillars: assignment.includedPillars,
      focusAreas: assignment.focusAreas,
      source: "waiver",
      approvalId: null,
    };
  }

  return {
    includedPillars: [],
    focusAreas: [],
    source: null,
    approvalId: null,
  };
}

/**
 * Resolve pillar scope for client-facing assessment UI.
 * Prefers assessment row scope, then approval/waiver, then legacy all-six when
 * an assessment exists with empty scope. Returns [] when locked (no scope yet).
 */
export function resolveClientAssessmentIncludedPillars(input: {
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

/** Normalize waiver/approval scope writes; emphasis defaults to all included. */
export function normalizeWaiverScopeInput(input: {
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
