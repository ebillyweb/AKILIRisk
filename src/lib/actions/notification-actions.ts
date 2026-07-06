'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdvisorRole, advisorHubActionErrorMessage } from "@/lib/advisor/auth";
import { getUserPreferences, updatePreferences } from '@/lib/notifications/preferences';
import { updateAdvisorReminderEmailPolicyAction } from '@/lib/actions/reminder-email-policy-actions';
import { prisma } from '@/lib/db';

// Zod schema for notification preferences
const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM (24-hour)')
  .optional()
  .nullable();

const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean(),
  emailMilestones: z.boolean(),
  emailReminders: z.boolean(),
  emailStalled: z.boolean(),
  emailRegistrations: z.boolean(),
  reminderFrequencyDays: z.number().min(1).max(30),
  quietStart: timeStringSchema,
  quietEnd: timeStringSchema,
});

export async function getNotificationPreferencesAction() {
  try {
    const { userId } = await requireAdvisorRole();

    const [preferences, profile] = await Promise.all([
      getUserPreferences(userId),
      prisma.advisorProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          enterpriseId: true,
          clientReminderEmailsEnabled: true,
          advisorReminderEmailsEnabled: true,
          enterprise: {
            select: {
              clientReminderEmailsEnabled: true,
              advisorReminderEmailsEnabled: true,
            },
          },
        },
      }),
    ]);

    const isEnterpriseMember = Boolean(profile?.enterpriseId);
    const reminderPolicy = profile
      ? profile.enterpriseId && profile.enterprise
        ? {
            clientReminderEmailsEnabled: profile.enterprise.clientReminderEmailsEnabled,
            advisorReminderEmailsEnabled: profile.enterprise.advisorReminderEmailsEnabled,
          }
        : {
            clientReminderEmailsEnabled: profile.clientReminderEmailsEnabled,
            advisorReminderEmailsEnabled: profile.advisorReminderEmailsEnabled,
          }
      : null;

    const data =
      profile && !profile.enterpriseId
        ? {
            ...preferences,
            emailReminders: profile.clientReminderEmailsEnabled,
            emailStalled: profile.advisorReminderEmailsEnabled,
          }
        : preferences;

    return {
      success: true,
      data,
      reminderPolicy,
      isEnterpriseMember,
    };
  } catch (error) {
    return { success: false, error: advisorHubActionErrorMessage(error, 'Failed to get notification preferences') };
  }
}

export async function updateNotificationPreferencesAction(formData: FormData) {
  try {
    const { userId } = await requireAdvisorRole();

    // Parse form data
    const quietStartRaw = formData.get('quietStart')?.toString().trim() ?? '';
    const quietEndRaw = formData.get('quietEnd')?.toString().trim() ?? '';

    const rawData = {
      emailEnabled: formData.get('emailEnabled') === 'true',
      emailMilestones: formData.get('emailMilestones') === 'true',
      emailReminders: formData.get('emailReminders') === 'true',
      emailStalled: formData.get('emailStalled') === 'true',
      emailRegistrations: formData.get('emailRegistrations') === 'true',
      reminderFrequencyDays: parseInt(formData.get('reminderFrequencyDays')?.toString() || '7'),
      quietStart: quietStartRaw.length > 0 ? quietStartRaw : null,
      quietEnd: quietEndRaw.length > 0 ? quietEndRaw : null,
    };

    const validatedData = notificationPreferencesSchema.safeParse(rawData);
    if (!validatedData.success) {
      return {
        success: false,
        error: 'Invalid form data',
        fieldErrors: validatedData.error.flatten().fieldErrors,
      };
    }

    const profile = await prisma.advisorProfile.findUnique({
      where: { userId },
      select: { id: true, enterpriseId: true },
    });

    let preferenceUpdates = validatedData.data;
    if (profile?.enterpriseId) {
      const existing = await getUserPreferences(userId);
      preferenceUpdates = {
        ...validatedData.data,
        emailReminders: existing.emailReminders,
        emailStalled: existing.emailStalled,
      };
    }

    // Update preferences
    const updatedPreferences = await updatePreferences(userId, preferenceUpdates);

    if (profile && !profile.enterpriseId) {
      await updateAdvisorReminderEmailPolicyAction({
        clientReminderEmailsEnabled: validatedData.data.emailReminders,
        advisorReminderEmailsEnabled: validatedData.data.emailStalled,
      });
    }

    revalidatePath('/advisor/settings/notifications');
    revalidatePath('/advisor/notifications');

    return {
      success: true,
      data: updatedPreferences,
    };
  } catch (error) {
    return { success: false, error: advisorHubActionErrorMessage(error, 'Failed to update notification preferences') };
  }
}