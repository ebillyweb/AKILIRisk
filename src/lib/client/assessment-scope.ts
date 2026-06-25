import "server-only";

import {
  resolveIncludedPillars,
} from "@/lib/assessment/included-pillars";
import {
  getClientEngagementScope,
  normalizeEngagementScopeInput,
  resolveAssessmentIncludedPillars,
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

export async function getClientAssessmentScope(
  clientUserId: string,
): Promise<ClientAssessmentScope> {
  return toLegacyAssessmentScope(await getClientEngagementScope(clientUserId));
}

export async function resolveEffectiveClientPillarScope(
  clientUserId: string,
): Promise<ClientAssessmentScope> {
  return getClientAssessmentScope(clientUserId);
}

export async function syncAssignmentPillarScopeIfMissing(
  _assignmentId: string,
  _effective: Pick<ClientAssessmentScope, "includedPillars" | "focusAreas">,
): Promise<void> {
  // No-op: getClientEngagementScope reconciles legacy sources on read.
}

export async function resolveClientAssessmentIncludedPillars(input: {
  assessmentIncludedPillars?: string[] | null;
  approvedScopeIncludedPillars?: string[] | null;
  hasAssessmentRow: boolean;
}): Promise<string[]> {
  return resolveAssessmentIncludedPillars({
    assessmentIncludedPillars: input.assessmentIncludedPillars,
    engagementIncludedPillars: input.approvedScopeIncludedPillars,
    hasAssessmentRow: input.hasAssessmentRow,
  });
}

export async function normalizeWaiverScopeInput(input: {
  includedPillars: string[];
  focusAreas?: string[];
}): Promise<{ includedPillars: string[]; focusAreas: string[] }> {
  return normalizeEngagementScopeInput(input);
}

export { resolveIncludedPillars };
