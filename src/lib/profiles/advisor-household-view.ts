import 'server-only';

import type { FamilyRelationship, GovernanceRole, HouseholdMember } from '@prisma/client';

/**
 * Advisor-visible household member view. US-48: members with
 * `shareWithAdvisor = false` are excluded before mapping.
 */
export type AdvisorHouseholdMemberView = {
  id: string;
  userId: string;
  displayLabel: string;
  birthYear: number | null;
  sex: string | null;
  relationship: FamilyRelationship;
  governanceRoles: GovernanceRole[];
  isResident: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function memberSharesWithAdvisor(member: HouseholdMember): boolean {
  const share = (member as HouseholdMember & { shareWithAdvisor?: boolean }).shareWithAdvisor;
  return share !== false;
}

export function toAdvisorHouseholdMemberView(member: HouseholdMember): AdvisorHouseholdMemberView {
  const m = member as unknown as Record<string, unknown>;
  return {
    id: m.id as string,
    userId: m.userId as string,
    displayLabel: (m.displayLabel ?? '') as string,
    birthYear: (m.birthYear ?? null) as number | null,
    sex: (m.sex ?? null) as string | null,
    relationship: m.relationship as FamilyRelationship,
    governanceRoles: (m.governanceRoles ?? []) as GovernanceRole[],
    isResident: (m.isResident ?? true) as boolean,
    createdAt: m.createdAt as Date,
    updatedAt: m.updatedAt as Date,
  };
}

export function toAdvisorHouseholdMemberViews(
  members: HouseholdMember[],
): AdvisorHouseholdMemberView[] {
  return members.filter(memberSharesWithAdvisor).map(toAdvisorHouseholdMemberView);
}
