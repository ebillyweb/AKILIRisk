import "server-only";

import { prisma } from "@/lib/db";
import {
  isEnterpriseActionPlanWorkspaceEnabled,
  resolveEnterpriseMemberVisibilityContext,
} from "@/lib/enterprise/advisor-member-visibility";

/**
 * Whether the assigned advisor's firm exposes action plan surfaces to this client.
 * Defaults to enabled when there is no active assignment.
 */
export async function isClientActionPlanEnabledForUser(
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
  return isEnterpriseActionPlanWorkspaceEnabled(context);
}
