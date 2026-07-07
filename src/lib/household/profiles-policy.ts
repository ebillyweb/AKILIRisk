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

/** Firm-wide household profiles toggle for enterprise team settings (defaults true). */
export async function getEnterpriseHouseholdProfilesEnabled(
  enterpriseId: string,
): Promise<boolean> {
  const ownerProfile = await prisma.advisorProfile.findFirst({
    where: {
      enterpriseId,
      enterpriseMembership: { role: "OWNER", status: "ACTIVE" },
    },
    select: { householdProfilesEnabled: true },
  });
  if (ownerProfile) {
    return ownerProfile.householdProfilesEnabled;
  }

  const anyProfile = await prisma.advisorProfile.findFirst({
    where: { enterpriseId },
    select: { householdProfilesEnabled: true },
  });
  return anyProfile?.householdProfilesEnabled ?? true;
}

export async function setEnterpriseHouseholdProfilesEnabled(
  enterpriseId: string,
  enabled: boolean,
): Promise<void> {
  await prisma.advisorProfile.updateMany({
    where: { enterpriseId },
    data: { householdProfilesEnabled: enabled },
  });
}
