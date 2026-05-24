import "server-only";

import { prisma } from "@/lib/db";

/**
 * US-49: whether household profiles are enabled for a client (via their
 * single assigned advisor). Defaults true when unassigned.
 */
export async function getClientHouseholdProfilesEnabled(
  clientUserId: string,
): Promise<boolean> {
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: clientUserId, status: "ACTIVE" },
    orderBy: { assignedAt: "desc" },
    select: {
      advisor: { select: { householdProfilesEnabled: true } },
    },
  });

  if (!assignment) {
    return true;
  }

  return assignment.advisor.householdProfilesEnabled;
}

/** US-49: advisor tenant toggle (defaults true). */
export async function getAdvisorHouseholdProfilesEnabled(
  advisorProfileId: string,
): Promise<boolean> {
  const row = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { householdProfilesEnabled: true },
  });
  return row?.householdProfilesEnabled ?? true;
}
