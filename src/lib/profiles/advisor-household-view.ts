import 'server-only';

import type { FamilyRelationship, GovernanceRole, HouseholdMember } from '@prisma/client';

/**
 * Round-11 commit 2.2 (BRD §5.1 amendment): demographic-only advisor
 * view. Pre-round-11 this view redacted fullName/contact when the
 * client's `shareNameAndContactWithAdvisor` flag was off; round-11
 * dropped both the PII fields and the flag itself, so the view is
 * now a near-passthrough.
 *
 * The function + type are preserved so call sites don't need
 * coordinated rewrites; future schema changes that re-introduce
 * advisor-visible PII can extend this view.
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

/**
 * Maps a stored household member to what an advisor is allowed to see.
 * Now a near-identity transform — every column on the row is
 * non-identifying demographic / relationship data and safe to surface.
 */
export function toAdvisorHouseholdMemberView(member: HouseholdMember): AdvisorHouseholdMemberView {
  // Cast through unknown so the action layer compiles before
  // `prisma generate` picks up the new column shape locally.
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

export function toAdvisorHouseholdMemberViews(members: HouseholdMember[]): AdvisorHouseholdMemberView[] {
  return members.map(toAdvisorHouseholdMemberView);
}
