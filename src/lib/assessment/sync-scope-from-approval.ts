import "server-only";

import { syncInProgressAssessmentScope } from "@/lib/assessment/sync-client-assessment-scope";

/** Apply advisor-approved pillar scope to the client's in-progress assessment, if any. */
export async function syncAssessmentScopeFromApproval(
  clientUserId: string,
  approvalId: string,
  includedPillars: string[],
): Promise<void> {
  await syncInProgressAssessmentScope(clientUserId, includedPillars, approvalId);
}
