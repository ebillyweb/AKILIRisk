import "server-only";

import { prisma } from "@/lib/db";
import { findUserByEmail } from "@/lib/auth/user-email";

export type PrepareHouseholdProfilesE2EOptions = {
  clientEmail: string;
  advisorEmail?: string;
  /** Delete all household members for the client. Default true. */
  resetMembers?: boolean;
  /** Set advisor tenant toggle. Omit to leave unchanged. */
  householdProfilesEnabled?: boolean;
};

export type PrepareHouseholdProfilesE2EResult = {
  clientUserId: string;
  advisorProfileId: string;
  householdProfilesEnabled: boolean;
  memberCount: number;
};

/**
 * Test-only: reset household profile state for Epic 5.3 Playwright.
 */
export async function prepareHouseholdProfilesForE2E(
  options: PrepareHouseholdProfilesE2EOptions,
): Promise<PrepareHouseholdProfilesE2EResult> {
  const clientEmail = options.clientEmail.trim().toLowerCase();
  const advisorEmail = (options.advisorEmail ?? "advisor@test.com").trim().toLowerCase();

  const client = await findUserByEmail(clientEmail);
  if (!client) {
    throw new Error(`Client not found: ${clientEmail}`);
  }

  const advisorUser = await findUserByEmail(advisorEmail);
  if (!advisorUser) {
    throw new Error(`Advisor not found: ${advisorEmail}`);
  }

  const advisorProfile = await prisma.advisorProfile.findUnique({
    where: { userId: advisorUser.id },
    select: { id: true, householdProfilesEnabled: true },
  });
  if (!advisorProfile) {
    throw new Error(`AdvisorProfile not found for: ${advisorEmail}`);
  }

  if (options.resetMembers !== false) {
    await prisma.householdMember.deleteMany({ where: { userId: client.id } });
  }

  let enabled = advisorProfile.householdProfilesEnabled;
  if (typeof options.householdProfilesEnabled === "boolean") {
    const updated = await prisma.advisorProfile.update({
      where: { id: advisorProfile.id },
      data: { householdProfilesEnabled: options.householdProfilesEnabled },
      select: { householdProfilesEnabled: true },
    });
    enabled = updated.householdProfilesEnabled;
  }

  const memberCount = await prisma.householdMember.count({
    where: { userId: client.id },
  });

  return {
    clientUserId: client.id,
    advisorProfileId: advisorProfile.id,
    householdProfilesEnabled: enabled,
    memberCount,
  };
}
