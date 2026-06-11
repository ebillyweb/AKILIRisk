import "server-only";

import { prisma } from "@/lib/db";

/** Apply advisor-approved pillar scope to the client's in-progress assessment, if any. */
export async function syncAssessmentScopeFromApproval(
  clientUserId: string,
  approvalId: string,
  includedPillars: string[],
): Promise<void> {
  const inProgress = await prisma.assessment.findFirst({
    where: { userId: clientUserId, status: "IN_PROGRESS" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (!inProgress) return;

  await prisma.assessment.update({
    where: { id: inProgress.id },
    data: {
      approvalId,
      includedPillars,
    },
  });
}
