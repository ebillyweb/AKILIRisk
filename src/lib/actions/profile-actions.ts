'use server';

import type { UserRole } from '@prisma/client';
import { auth } from '@/lib/auth';
import {
  createHouseholdMemberRecord,
  deleteHouseholdMemberRecord,
  updateHouseholdMemberRecord,
  listHouseholdMembers,
} from '@/lib/data/household-members';
import { householdMemberSchema, updateHouseholdMemberSchema } from '@/lib/schemas/profile';
import { revalidatePath } from 'next/cache';
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit/audit-log';
import { scrubHouseholdMember } from '@/lib/audit/scrub-household-member';
import { prisma } from '@/lib/db';

// Helper function to get authenticated user ID
async function getAuthUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }
  return session.user.id;
}

/** Audit-friendly actor info for the signed-in client. Same `auth()` call
 *  shape as `getAuthUserId` but surfaces role + email so writeAudit can
 *  populate actorRole + actorEmailHash. */
async function getAuthActor() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }
  return {
    userId: session.user.id,
    role: session.user.role as UserRole | undefined,
    email: session.user.email ?? null,
  };
}

// Create a new household member
export async function createHouseholdMember(data: unknown) {
  try {
    const actor = await getAuthActor();

    const validatedFields = householdMemberSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    const member = await createHouseholdMemberRecord(actor.userId, validatedFields.data);

    // PII scrubbed before reaching writeAudit per BRD §5.1; the redactor
    // doesn't strip names by default because they're useful on User/AdvisorProfile,
    // so household-member sites apply the stricter rule explicitly.
    await writeAudit({
      actor,
      action: AUDIT_ACTIONS.HOUSEHOLD_MEMBER_CREATE,
      entityType: 'HouseholdMember',
      entityId: member.id,
      beforeData: null,
      afterData: scrubHouseholdMember(member as unknown as Record<string, unknown>),
    });

    revalidatePath('/profiles');
    return { success: true, member };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create household member';
    return { success: false, error: message };
  }
}

// Update an existing household member
export async function updateHouseholdMember(id: string, data: unknown) {
  try {
    const actor = await getAuthActor();

    const validatedFields = updateHouseholdMemberSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    // Capture prior state for audit beforeData. Tenant boundary: filter on
    // userId so a probing client can't get the prior state of someone else's
    // member. updateHouseholdMemberRecord does the same boundary check.
    const prior = await prisma.householdMember.findFirst({
      where: { id, userId: actor.userId },
    });

    const member = await updateHouseholdMemberRecord(actor.userId, id, validatedFields.data);

    if (!member) {
      return { success: false, error: 'Household member not found' };
    }

    await writeAudit({
      actor,
      action: AUDIT_ACTIONS.HOUSEHOLD_MEMBER_UPDATE,
      entityType: 'HouseholdMember',
      entityId: member.id,
      beforeData: scrubHouseholdMember(prior as unknown as Record<string, unknown>),
      afterData: scrubHouseholdMember(member as unknown as Record<string, unknown>),
    });

    revalidatePath('/profiles');
    return { success: true, member };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update household member';
    return { success: false, error: message };
  }
}

// Get all household members for current user
export async function getHouseholdMembers() {
  try {
    const userId = await getAuthUserId();
    const members = await listHouseholdMembers(userId);

    return { success: true, members };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get household members';
    return { success: false, error: message, members: null };
  }
}

/**
 * Round-11 commit 2.2 (BRD §5.1 amendment): RETIRED. The
 * `shareNameAndContactWithAdvisor` flag was dropped along with the
 * fullName/contact fields it gated. Kept as a no-op stub so existing
 * call sites (if any cached on the client) still resolve and audit
 * the historical intent. Safe to delete in a follow-up commit.
 */
export async function setAllHouseholdMembersShareNameAndContactWithAdvisor(share: boolean) {
  try {
    const actor = await getAuthActor();
    await writeAudit({
      actor,
      action: AUDIT_ACTIONS.HOUSEHOLD_MEMBER_SHARE_TOGGLE,
      entityType: 'HouseholdMember',
      entityId: null,
      metadata: {
        scope: 'all_members_for_user',
        userId: actor.userId,
        retiredAction: true,
        attemptedShare: share,
      },
    });
    return { success: true as const };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update advisor visibility for household';
    return { success: false as const, error: message };
  }
}

// Delete a household member
export async function deleteHouseholdMember(id: string) {
  try {
    const actor = await getAuthActor();

    // Capture row before delete so beforeData has the (scrubbed) shape.
    const prior = await prisma.householdMember.findFirst({
      where: { id, userId: actor.userId },
    });

    const deleted = await deleteHouseholdMemberRecord(actor.userId, id);

    if (!deleted) {
      return { success: false, error: 'Household member not found' };
    }

    await writeAudit({
      actor,
      action: AUDIT_ACTIONS.HOUSEHOLD_MEMBER_DELETE,
      entityType: 'HouseholdMember',
      entityId: id,
      beforeData: scrubHouseholdMember(prior as unknown as Record<string, unknown>),
      afterData: null,
    });

    revalidatePath('/profiles');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete household member';
    return { success: false, error: message };
  }
}