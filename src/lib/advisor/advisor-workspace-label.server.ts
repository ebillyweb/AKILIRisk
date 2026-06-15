import "server-only";

import { prisma } from "@/lib/db";
import {
  advisorWorkspaceTitle,
  DEFAULT_ADVISOR_WORKSPACE_TITLE,
} from "@/lib/advisor/advisor-workspace-label";

export async function resolveAdvisorWorkspaceTitleForUserId(
  userId: string | null | undefined
): Promise<string> {
  if (!userId) return DEFAULT_ADVISOR_WORKSPACE_TITLE;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, firstName: true, lastName: true },
  });

  if (!user) return DEFAULT_ADVISOR_WORKSPACE_TITLE;

  return advisorWorkspaceTitle(user);
}
