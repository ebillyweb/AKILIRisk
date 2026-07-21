import "server-only";

import type { AssessmentStatus, DeliverablePhase } from "@prisma/client";
import { syncAssessmentCompletionStatus } from "@/lib/assessment/assessment-completion";
import { isAssessmentScopeComplete } from "@/lib/assessment/included-pillars";
import type { PillarCatalogEntry } from "@/lib/methodology/pillar-catalog";
import { prisma } from "@/lib/db";

type ReconcileInput = {
  assessmentId: string;
  status: AssessmentStatus;
  completedAt: Date | null;
  deliverablePhase: DeliverablePhase;
  pillarIds: string[];
  includedPillars: string[];
  catalog: readonly PillarCatalogEntry[];
};

/**
 * When every scoped pillar has a score but the assessment row is still
 * IN_PROGRESS, sync completion in the database so advisor pipeline status
 * matches what clients already see via summary-access.
 */
export async function reconcileAssessmentCompletionIfNeeded(
  input: ReconcileInput,
): Promise<Pick<ReconcileInput, "status" | "completedAt" | "deliverablePhase">> {
  const scopeComplete = isAssessmentScopeComplete(
    input.pillarIds,
    input.includedPillars,
    input.catalog,
  );

  if (!scopeComplete || input.status !== "IN_PROGRESS") {
    return {
      status: input.status,
      completedAt: input.completedAt,
      deliverablePhase: input.deliverablePhase,
    };
  }

  await prisma.$transaction(async (tx) => {
    await syncAssessmentCompletionStatus(tx, input.assessmentId);
  });

  const refreshed = await prisma.assessment.findUnique({
    where: { id: input.assessmentId },
    select: {
      status: true,
      completedAt: true,
      deliverablePhase: true,
    },
  });

  return {
    status: refreshed?.status ?? input.status,
    completedAt: refreshed?.completedAt ?? input.completedAt,
    deliverablePhase: refreshed?.deliverablePhase ?? input.deliverablePhase,
  };
}
