'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getAdvisorProfileOrThrow } from '@/lib/advisor/auth';
import { resolveAdvisorPersonalNameFields } from '@/lib/advisor/advisor-workspace-label';
import {
  advisorPersonalDetailsSchema,
  clientPersonalDetailsSchema,
  type AdvisorPersonalDetailsFormData,
  type ClientPersonalDetailsFormData,
} from '@/lib/schemas/profile';
import { revalidatePath } from 'next/cache';
import { isAdvisorBrandingReadOnly } from '@/lib/enterprise/branding-access';

export async function getAdvisorPersonalDetails() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, data: null, error: 'Not authenticated' };
  try {
    const profile = await getAdvisorProfileOrThrow(session.user.id);
    const { firstName, lastName } = resolveAdvisorPersonalNameFields(profile.user);
    return {
      success: true,
      data: {
        firstName,
        lastName,
        phone: profile.phone ?? '',
        jobTitle: profile.jobTitle ?? '',
        firmName: profile.firmName ?? '',
        licenseNumber: profile.licenseNumber ?? '',
      } as AdvisorPersonalDetailsFormData,
      error: null,
    };
  } catch {
    return { success: false, data: null, error: 'Advisor profile not found' };
  }
}

export async function updateAdvisorPersonalDetails(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };
  const parsed = advisorPersonalDetailsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid data', errors: parsed.error.flatten().fieldErrors };
  }
  try {
    const profile = await getAdvisorProfileOrThrow(session.user.id);
    const brandingReadOnly = await isAdvisorBrandingReadOnly(session.user.id);
    const { firstName, lastName, phone, jobTitle, firmName, licenseNumber } = parsed.data;
    const trimmedFirmName = firmName?.trim() || null;
    if (
      brandingReadOnly &&
      trimmedFirmName !== (profile.firmName?.trim() || null)
    ) {
      return {
        success: false,
        error: 'Firm name is managed by your firm owner or administrators.',
      };
    }
    const displayName = [firstName, lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          firstName: firstName?.trim() || null,
          lastName: lastName?.trim() || null,
          ...(displayName ? { name: displayName } : {}),
        },
      }),
      prisma.advisorProfile.update({
        where: { id: profile.id },
        data: {
          phone: phone?.trim() || null,
          jobTitle: jobTitle?.trim() || null,
          firmName: brandingReadOnly ? profile.firmName?.trim() || null : trimmedFirmName,
          licenseNumber: licenseNumber?.trim() || null,
        },
      }),
    ]);
    revalidatePath('/settings');
    revalidatePath('/advisor/settings');
    revalidatePath('/advisor');
    return { success: true, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update advisor profile';
    return { success: false, error: message };
  }
}

export async function getClientPersonalDetails() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, data: null, error: 'Not authenticated' }
  try {
    // Round-11 commit 2.1 (BRD §5.1 amendment): only firstName/lastName
    // remain on the client settings form. Contact + address + DOB
    // fields were dropped from ClientProfile; we no longer touch that
    // table here.
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true },
    });
    const data: ClientPersonalDetailsFormData = {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
    };
    return { success: true, data, error: null };
  } catch {
    return { success: false, data: null, error: 'Failed to load profile' };
  }
}

export async function updateClientPersonalDetails(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' };
  const parsed = clientPersonalDetailsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid data', errors: parsed.error.flatten().fieldErrors };
  }
  try {
    const { firstName, lastName } = parsed.data;
    // Round-11 commit 2.1: only User.firstName/lastName are written
    // here. ClientProfile no longer has writable client-PII columns.
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
      },
    });
    revalidatePath('/settings');
    return { success: true, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update profile';
    return { success: false, error: message };
  }
}
