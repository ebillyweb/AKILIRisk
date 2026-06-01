import "server-only";

import { prisma } from "@/lib/db";

/** Firm name from the client's active advisor assignment (not gated on branding). */
export async function getAssignedAdvisorFirmNameForClient(
  clientUserId: string
): Promise<string | null> {
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: clientUserId, status: "ACTIVE" },
    orderBy: { assignedAt: "desc" },
    select: { advisor: { select: { firmName: true } } },
  });

  return assignment?.advisor.firmName?.trim() || null;
}
