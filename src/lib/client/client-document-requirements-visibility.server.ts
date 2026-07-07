import "server-only";

import { prisma } from "@/lib/db";
import {
  isEnterpriseDocumentRequirementsWorkspaceEnabled,
  resolveEnterpriseMemberVisibilityContext,
} from "@/lib/enterprise/advisor-member-visibility";

/**
 * Whether the assigned advisor's firm exposes document collection to this client.
 * Defaults to enabled when there is no active assignment.
 */
export async function isClientDocumentRequirementsEnabledForUser(
  clientUserId: string,
): Promise<boolean> {
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: clientUserId, status: "ACTIVE" },
    orderBy: { assignedAt: "desc" },
    select: {
      advisor: {
        select: { userId: true },
      },
    },
  });

  if (!assignment) {
    return true;
  }

  const context = await resolveEnterpriseMemberVisibilityContext(
    assignment.advisor.userId,
  );
  return isEnterpriseDocumentRequirementsWorkspaceEnabled(context);
}
