"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdvisorRole } from "@/lib/advisor/auth";
import { prisma } from "@/lib/db";
import { reminderEmailPolicyInputToEnterpriseUpdate } from "@/lib/enterprise/enterprise-reminder-email-policy";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";

const reminderEmailPolicySchema = z.object({
  clientReminderEmailsEnabled: z.boolean(),
  advisorReminderEmailsEnabled: z.boolean(),
});

export async function updateEnterpriseReminderEmailPolicyAction(
  input: unknown,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    const parsed = reminderEmailPolicySchema.parse(input);

    await prisma.advisorEnterprise.update({
      where: { id: team.enterpriseId },
      data: reminderEmailPolicyInputToEnterpriseUpdate(parsed),
    });

    revalidatePath("/advisor/settings/access-control");
    revalidatePath("/advisor/settings/notifications");
    revalidatePath("/advisor/settings");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid reminder email settings" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update reminder email settings",
    };
  }
}

export async function updateAdvisorReminderEmailPolicyAction(
  input: unknown,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = reminderEmailPolicySchema.parse(input);

    const profile = await prisma.advisorProfile.findUnique({
      where: { userId },
      select: { id: true, enterpriseId: true },
    });

    if (!profile) {
      return { success: false, error: "Advisor profile not found" };
    }

    if (profile.enterpriseId) {
      return {
        success: false,
        error: "Reminder email settings are managed by your firm administrator",
      };
    }

    await prisma.advisorProfile.update({
      where: { id: profile.id },
      data: reminderEmailPolicyInputToEnterpriseUpdate(parsed),
    });

    revalidatePath("/advisor/settings/notifications");
    revalidatePath("/advisor/settings");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid reminder email settings" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update reminder email settings",
    };
  }
}
