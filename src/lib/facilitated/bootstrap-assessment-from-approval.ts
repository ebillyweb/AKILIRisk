import "server-only";

import { prisma } from "@/lib/db";
import {
  getClientAssessmentScope,
  type ClientAssessmentScope,
} from "@/lib/client/assessment-scope";
import { syncInProgressAssessmentScope } from "@/lib/assessment/sync-client-assessment-scope";
import { syncAssessmentScopeFromApproval } from "@/lib/assessment/sync-scope-from-approval";
import { resolveIncludedPillars } from "@/lib/assessment/included-pillars";
import { facilitatedAssessmentQuestionPath } from "@/lib/facilitated/paths";

/** Create or reuse a scoped in-progress assessment for facilitated entry (not at approve time). */
export async function ensureScopedAssessmentForClient(
  clientUserId: string,
  scope: ClientAssessmentScope,
): Promise<string> {
  if (scope.approvalId) {
    await syncAssessmentScopeFromApproval(
      clientUserId,
      scope.approvalId,
      scope.includedPillars,
    );
  } else {
    await syncInProgressAssessmentScope(
      clientUserId,
      scope.includedPillars,
      null,
    );
  }

  const existing = await prisma.assessment.findFirst({
    where: { userId: clientUserId, status: "IN_PROGRESS" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, includedPillars: true },
  });

  if (existing) {
    if (existing.includedPillars.length === 0 && scope.includedPillars.length > 0) {
      await prisma.assessment.update({
        where: { id: existing.id },
        data: {
          approvalId: scope.approvalId,
          includedPillars: scope.includedPillars,
        },
      });
    }
    return existing.id;
  }

  const created = await prisma.assessment.create({
    data: {
      userId: clientUserId,
      version: 1,
      status: "IN_PROGRESS",
      approvalId: scope.approvalId,
      includedPillars: scope.includedPillars,
    },
    select: { id: true },
  });

  return created.id;
}

/**
 * When intake is already approved with pillar scope, skip intake/pillar-select and
 * land the facilitated session in assessment.
 */
export async function tryBootstrapFacilitatedFromExistingApproval(
  facilitatedSessionId: string,
  clientUserId: string,
): Promise<string | null> {
  const scope = await getClientAssessmentScope(clientUserId);
  if (scope.includedPillars.length === 0) {
    return null;
  }

  const assessmentId = await ensureScopedAssessmentForClient(clientUserId, scope);

  await prisma.facilitatedSession.update({
    where: { id: facilitatedSessionId },
    data: { status: "ASSESSMENT", assessmentId },
  });

  const [firstPillar] = resolveIncludedPillars(scope.includedPillars);
  return facilitatedAssessmentQuestionPath(facilitatedSessionId, firstPillar, 0);
}
