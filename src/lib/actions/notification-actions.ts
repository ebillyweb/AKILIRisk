'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdvisorRole, advisorHubActionErrorMessage } from "@/lib/advisor/auth";
import { getUserPreferences, updatePreferences } from '@/lib/notifications/preferences';

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

    const preferences = await getUserPreferences(userId);

    return {
      success: true,
      data: preferences,
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

    // Update preferences
    const updatedPreferences = await updatePreferences(userId, validatedData.data);

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