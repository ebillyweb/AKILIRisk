import "server-only";

import { prisma } from "@/lib/db";

/**
 * Apply advisor-selected pillar scope to the client's latest assessment.
 * Updates IN_PROGRESS first; if none, narrows the latest COMPLETED row so a
 * stale wider Assessment.included_pillars cannot outrank engagement scope.
 */
export async function syncInProgressAssessmentScope(
  clientUserId: string,
  includedPillars: string[],
  approvalId: string | null = null,
): Promise<void> {
  const inProgress = await prisma.assessment.findFirst({
    where: { userId: clientUserId, status: "IN_PROGRESS" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (inProgress) {
    await prisma.assessment.update({
      where: { id: inProgress.id },
      data: {
        approvalId,
        includedPillars,
      },
    });
    return;
  }

  const completed = await prisma.assessment.findFirst({
    where: { userId: clientUserId, status: "COMPLETED" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, includedPillars: true },
  });

  if (!completed) return;

  // Only rewrite completed rows when they are wider than engagement (stale
  // expand). Never expand a completed assessment beyond what it already has.
  const completedSet = new Set(completed.includedPillars);
  const engagementIsSubset =
    includedPillars.length > 0 &&
    includedPillars.every((id) => completedSet.has(id)) &&
    includedPillars.length < completed.includedPillars.length;

  if (!engagementIsSubset) return;

  await prisma.assessment.update({
    where: { id: completed.id },
    data: {
      approvalId: approvalId ?? undefined,
      includedPillars,
    },
  });
}
