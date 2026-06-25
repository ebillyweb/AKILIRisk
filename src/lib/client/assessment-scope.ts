import "server-only";

import {
  normalizeIncludedPillarIds,
  resolveIncludedPillars,
} from "@/lib/assessment/included-pillars";
import {
  getClientEngagementScope,
  normalizeEngagementScopeInput,
  type ClientEngagementScope,
} from "@/lib/client/engagement-scope";

/** @deprecated Use ClientEngagementScope — kept for existing imports. */
export type ClientAssessmentScope = {
  includedPillars: string[];
  focusAreas: string[];
  source: "approval" | "waiver" | null;
  approvalId: string | null;
};

function toLegacyAssessmentScope(
  scope: ClientEngagementScope,
): ClientAssessmentScope {
  let source: ClientAssessmentScope["source"] = null;
  if (scope.includedPillars.length > 0) {
    source = scope.intakeWaived ? "waiver" : "approval";
  }
  return {
    includedPillars: scope.includedPillars,
    focusAreas: scope.focusAreas,
    source,
    approvalId: scope.approvalId,
  };
}

/**
 * @deprecated Prefer getClientEngagementScope — reads canonical assignment scope.
 */
export async function getClientAssessmentScope(
  clientUserId: string,
): Promise<ClientAssessmentScope> {
  return toLegacyAssessmentScope(await getClientEngagementScope(clientUserId));
}

/**
 * @deprecated Prefer getClientEngagementScope — assignment is now canonical.
 */
export async function resolveEffectiveClientPillarScope(
  clientUserId: string,
): Promise<ClientAssessmentScope> {
  return getClientAssessmentScope(clientUserId);
}

/**
 * @deprecated Assignment scope is reconciled inside getClientEngagementScope.
 */
export async function syncAssignmentPillarScopeIfMissing(
  _assignmentId: string,
  _effective: Pick<ClientAssessmentScope, "includedPillars" | "focusAreas">,
): Promise<void> {
  // No-op: getClientEngagementScope reconciles legacy sources on read.
}

/**
 * Resolve pillar scope for client-facing assessment UI.
 * Prefers assessment row scope, then engagement scope, then legacy all-six when
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

/** Normalize scope writes; emphasis defaults to all included. */
export function normalizeWaiverScopeInput(input: {
  includedPillars: string[];
  focusAreas?: string[];
}): { includedPillars: string[]; focusAreas: string[] } {
  return normalizeEngagementScopeInput(input);
}
