import 'server-only';

import type { FamilyRelationship, GovernanceRole, HouseholdMember } from '@prisma/client';

import type { EligiblePiiField } from '@/lib/advisor/pii-policy';
import {
  safeDecryptHouseholdFullName,
  safeDecryptHouseholdNotes,
  safeDecryptHouseholdPhone,
} from '@/lib/data/client-pii';

/**
 * Advisor-visible household member view. US-48: members with
 * `shareWithAdvisor = false` are excluded before mapping.
 * Option D: optional PII columns appear only when effective visibility grants them.
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
  fullName?: string | null;
  phone?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function memberSharesWithAdvisor(member: HouseholdMember): boolean {
  const share = (member as HouseholdMember & { shareWithAdvisor?: boolean }).shareWithAdvisor;
  return share !== false;
}

function isFieldVisible(
  effective: Record<EligiblePiiField, boolean> | undefined,
  field: EligiblePiiField
): boolean {
  return effective?.[field] === true;
}

export function toAdvisorHouseholdMemberView(
  member: HouseholdMember,
  effective?: Record<EligiblePiiField, boolean>
): AdvisorHouseholdMemberView {
  const m = member as unknown as Record<string, unknown>;
  const rowId = m.id as string;
  const view: AdvisorHouseholdMemberView = {
    id: rowId,
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

  if (isFieldVisible(effective, 'HouseholdMember.fullName')) {
    view.fullName = safeDecryptHouseholdFullName(m.fullName as string | null, {
      rowId,
    });
  }
  if (isFieldVisible(effective, 'HouseholdMember.phone')) {
    view.phone = safeDecryptHouseholdPhone(m.phone as string | null, { rowId });
  }
  if (isFieldVisible(effective, 'HouseholdMember.notes')) {
    view.notes = safeDecryptHouseholdNotes(m.notes as string | null, { rowId });
  }

  return view;
}

export function toAdvisorHouseholdMemberViews(
  members: HouseholdMember[],
  effective?: Record<EligiblePiiField, boolean>,
): AdvisorHouseholdMemberView[] {
  return members
    .filter(memberSharesWithAdvisor)
    .map((member) => toAdvisorHouseholdMemberView(member, effective));
}
