import "server-only";

import type { HouseholdMember } from "@prisma/client";
import type { HouseholdProfile } from "@/lib/assessment/personalization";
import { listHouseholdMembers } from "@/lib/data/household-members";
import { prisma } from "@/lib/db";
import { getClientHouseholdProfilesEnabled } from "@/lib/household/profiles-policy";

export function mapMembersToHouseholdProfile(
  members: Pick<
    HouseholdMember,
    | "id"
    | "displayLabel"
    | "birthYear"
    | "sex"
    | "relationship"
    | "governanceRoles"
    | "isResident"
  >[],
): HouseholdProfile | null {
  if (members.length === 0) return null;
  return {
    members: members.map((m) => ({
      id: m.id,
      displayLabel: m.displayLabel,
      birthYear: m.birthYear,
      sex: m.sex,
      relationship: m.relationship,
      governanceRoles: m.governanceRoles as string[],
      isResident: m.isResident,
    })),
  };
}

/** Client assessment: all members when feature enabled. */
export async function getHouseholdProfileForClientAssessment(
  clientUserId: string,
): Promise<HouseholdProfile | null> {
  const enabled = await getClientHouseholdProfilesEnabled(clientUserId);
  if (!enabled) return null;

  const members = await listHouseholdMembers(clientUserId);
  return mapMembersToHouseholdProfile(members);
}

/** Advisor-facing surfaces: shared members only; null when feature off. */
export async function getHouseholdProfileForAdvisorView(
  clientUserId: string,
): Promise<HouseholdProfile | null> {
  const enabled = await getClientHouseholdProfilesEnabled(clientUserId);
  if (!enabled) return null;

  const members = await prisma.householdMember.findMany({
    where: { userId: clientUserId, shareWithAdvisor: true },
    orderBy: { createdAt: "asc" },
  });

  return mapMembersToHouseholdProfile(members);
}
