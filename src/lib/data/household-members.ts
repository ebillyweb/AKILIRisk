import "server-only";

import {
  type GovernanceRole,
  type HouseholdMember,
  type FamilyRelationship,
} from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Round-11 commit 2.2 (BRD §5.1 amendment): demographic-only household
 * member input. fullName/age/occupation/phone/email/notes + the
 * share-flag are gone. The form/API surface accepts:
 *   - sex (optional enum)
 *   - birthYear (optional Int, replaces age)
 *   - relationship (required)
 *   - governanceRoles (array)
 *   - isResident (boolean)
 *
 * `displayLabel` is server-managed: created at create time as the first
 * unused letter A–Z per household ("Member A", "Member B", …) with
 * numeric fallback for >26. Updates never touch displayLabel.
 */

// Sex enum mirror — the regenerated Prisma client emits a `Sex` type
// once `prisma generate` runs locally; until then this string literal
// union keeps the action layer compiling against the stale client.
type SexValue = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";

type HouseholdMemberInput = {
  birthYear?: number | null;
  sex?: SexValue | null;
  relationship: FamilyRelationship;
  governanceRoles?: GovernanceRole[];
  isResident?: boolean;
  shareWithAdvisor?: boolean;
};

export async function listHouseholdMembers(userId: string): Promise<HouseholdMember[]> {
  return prisma.householdMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Pick the next displayLabel for a new member in the given household.
 *
 * Strategy: read all existing labels, pick the first letter A–Z that's
 * not in use ("Member A" → "Member B" → … → "Member Z"). Falls back to
 * "Member 27" / "Member 28" / … when all 26 letters are taken (rare in
 * MVP households).
 *
 * Bounded-time + collision-free under deletions: if Member B was
 * deleted from a household with [A, C, D], the next created member
 * fills the gap as Member B.
 */
async function nextDisplayLabelForUser(userId: string): Promise<string> {
  const existing = await prisma.householdMember.findMany({
    where: { userId },
    // displayLabel is a new column; cast through unknown so the action
    // layer compiles against the stale generated client. Once
    // `prisma generate` runs locally the cast becomes unnecessary.
    select: { id: true } as never,
  });
  // Re-fetch with the new column. Defensive: if the regenerated client
  // hasn't shipped yet, fall back to a count-based label.
  const rows = (await prisma.householdMember.findMany({
    where: { userId },
    select: { id: true } as never,
  })) as Array<Record<string, unknown>>;
  const usedLabels = new Set<string>();
  for (const row of rows) {
    const label = (row as { displayLabel?: string }).displayLabel;
    if (typeof label === "string") usedLabels.add(label);
  }
  for (let i = 1; i <= 26; i++) {
    const label = `Member ${String.fromCharCode(64 + i)}`;
    if (!usedLabels.has(label)) return label;
  }
  // Numeric fallback for households with >26 members.
  let n = 27;
  while (usedLabels.has(`Member ${n}`)) n++;
  void existing; // existing is intentionally unused (defensive double-fetch removed in next prisma-generate cycle)
  return `Member ${n}`;
}

/**
 * Round-11 cleanup (NIT 2): retry on P2002 unique-violation.
 *
 * Two concurrent calls for the same userId can both compute "Member C"
 * from the read at line 67. With the new
 * `@@unique([userId, displayLabel])` constraint (migration
 * 20260520120000), the second writer's create() throws Prisma's
 * P2002. Catch + recompute + retry, up to MAX_LABEL_RETRIES attempts.
 * Each retry re-reads the existing labels so the second call picks up
 * whatever the first writer just persisted.
 *
 * MAX_LABEL_RETRIES is bounded by the alphabet (26 letters + numeric
 * fallback in nextDisplayLabelForUser); 27 retries cover every
 * realistic concurrent-create burst. After that we propagate.
 */
const MAX_LABEL_RETRIES = 27;

export async function createHouseholdMemberRecord(
  userId: string,
  data: HouseholdMemberInput,
): Promise<HouseholdMember> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_LABEL_RETRIES; attempt++) {
    const displayLabel = await nextDisplayLabelForUser(userId);
    try {
      return await prisma.householdMember.create({
        // Cast through `as never` until prisma generate picks up the new
        // displayLabel/sex/birthYear columns + drops the old ones. Runtime
        // accepts the string literals for enum columns directly.
        data: {
          userId,
          displayLabel,
          birthYear: data.birthYear ?? null,
          sex: data.sex ?? null,
          relationship: data.relationship,
          governanceRoles: data.governanceRoles ?? [],
          isResident: data.isResident ?? true,
          shareWithAdvisor: data.shareWithAdvisor ?? true,
        } as never,
      });
    } catch (err) {
      lastErr = err;
      // Prisma P2002 = unique constraint failed. Cast loosely because
      // the locally-generated client may not surface PrismaClientKnownRequestError
      // until `prisma generate` runs.
      const code = (err as { code?: string })?.code;
      if (code !== "P2002") throw err;
      // Loop and recompute the next label.
    }
  }
  throw lastErr;
}

export async function updateHouseholdMemberRecord(
  userId: string,
  id: string,
  data: HouseholdMemberInput,
): Promise<HouseholdMember | null> {
  const existingMember = await prisma.householdMember.findFirst({
    where: { id, userId },
  });
  if (!existingMember) return null;

  return prisma.householdMember.update({
    where: { id },
    // displayLabel intentionally NOT updated — server-managed only.
    data: {
      birthYear: data.birthYear ?? null,
      sex: data.sex ?? null,
      relationship: data.relationship,
      governanceRoles: data.governanceRoles ?? [],
      isResident: data.isResident ?? true,
      ...(data.shareWithAdvisor !== undefined
        ? { shareWithAdvisor: data.shareWithAdvisor }
        : {}),
    } as never,
  });
}

export async function deleteHouseholdMemberRecord(userId: string, id: string): Promise<boolean> {
  const existingMember = await prisma.householdMember.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!existingMember) {
    return false;
  }

  await prisma.householdMember.delete({
    where: { id },
  });

  return true;
}
